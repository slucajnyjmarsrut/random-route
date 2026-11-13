'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT='http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [
   {name:'phone',width:390,height:844,mobile:true},
   {name:'short-phone',width:375,height:667,mobile:true},
   {name:'desktop',width:1440,height:900,mobile:false}
  ]){
   const context=await browser.newContext({
    viewport:{width:device.width,height:device.height},
    isMobile:device.mobile,hasTouch:device.mobile,serviceWorkers:'block'
   });
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url().startsWith(ROOT+'/')?r.continue():r.abort());
   await page.goto(ROOT+'/index.html',{waitUntil:'domcontentloaded'});
   await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
   // Welcome screen is still the only entry gate. Choose guest just once.
   await page.locator('#authGuest').click();
   await page.locator('#home.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#homeOpenGuestProfileBtn').count(),0,
     'the removed duplicate login must stay removed');
   async function checkNav(screen){
     await page.locator('#'+screen+'.active').waitFor({state:'visible'});
     const x=await page.locator('.app>.nav').evaluate(nav=>{
      const r=nav.getBoundingClientRect(),s=getComputedStyle(nav);
      const app=nav.closest('.app').getBoundingClientRect();
      const shop=nav.querySelector('[data-screen="shop"]').getBoundingClientRect();
      const profile=nav.querySelector('[data-screen="profile"]').getBoundingClientRect();
      return {display:s.display,visibility:s.visibility,rect:r.toJSON(),
        app:app.toJSON(),shop:shop.toJSON(),profile:profile.toJSON()};
     });
     assert.notEqual(x.display,'none',screen+' bottom menu hidden: '+JSON.stringify(x));
     assert.notEqual(x.visibility,'hidden',screen+' bottom menu invisible');
     assert.ok(x.shop.width>36&&x.profile.width>36,'menu buttons too narrow');
     assert.ok(x.rect.bottom<=x.app.bottom+2,'menu beyond app viewport');
     assert.ok(x.rect.top>=0,'menu beyond top of viewport');
     assert.ok(x.shop.left>=-2&&x.profile.right<=device.width+2,'nav buttons horizontally cut off');
     return x;
   }
   await checkNav('home');
   assert.equal(await page.locator('.app .nav [data-screen="home"]').getAttribute('type'),'button');
   await page.locator('.app .nav [data-screen="shop"]').click();
   await page.locator('#shop.active').waitFor({state:'visible'});
   assert.match(await page.locator('#shop .hero').innerText(),/Магазин/);
   assert.equal(await page.locator('#profileAuthModal.show').count(),0,
     'shop must be browseable as guest, no auth dialog');
   await checkNav('shop');
   await page.locator('.app .nav [data-screen="profile"]').click();
   await page.locator('#profile.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileName').innerText(),'Гость');
   assert.equal(await page.locator('#guestProfileSignIn').isVisible(),true);
   assert.equal(await page.locator('#profileAuthModal.show').count(),0);
   await checkNav('profile');
   // Guest can still choose login from Profile if they want a local account.
   await page.locator('#guestProfileSignIn').click();
   await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
   await page.locator('#authGuest').click();
   await page.locator('#home.active').waitFor({state:'visible'});
   await checkNav('home');
   // The route wizard must also keep Profile and Store immediately reachable.
   await page.locator('#homeOpenCreateBtn').click();
   await page.locator('#create.active').waitFor({state:'visible'});
   const nav=await checkNav('create');
   const bottom=await page.locator('.content').evaluate(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {rect:r.toJSON(),paddingBottom:Number.parseFloat(s.paddingBottom)};
   });
   assert.ok(bottom.paddingBottom>=nav.rect.height-8,
     'content should reserve room for fixed nav: '+JSON.stringify({bottom,nav}));
   await page.locator('.app .nav [data-screen="shop"]').click();
   await page.locator('#shop.active').waitFor({state:'visible'});
   await page.locator('.app .nav [data-screen="profile"]').click();
   await page.locator('#profile.active').waitFor({state:'visible'});
   await page.locator('.app .nav [data-screen="home"]').click();
   await page.locator('#home.active').waitFor({state:'visible'});
   await checkNav('home');
   assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,errors.join(' | '));
   console.log('MAIN_NAV_BROWSER_OK '+device.name+' shop/profile from home and wizard, bottom padding, guest accessible');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
