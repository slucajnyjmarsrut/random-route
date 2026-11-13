'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [
   {name:'phone',width:390,height:844,mobile:true},
   {name:'short-phone',width:375,height:667,mobile:true},
   {name:'desktop',width:1440,height:900,mobile:false}
  ]){
   const context=await browser.newContext({viewport:{width:device.width,height:device.height},
    isMobile:device.mobile,hasTouch:device.mobile,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
   await page.locator('#home.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#home .mascot-home-current').count(),0,
    'marked-out duplicate mascot row must be removed');
   assert.equal(await page.locator('#home .rr-welcome-mascot').count(),1,
    'retain one Marshik instruction block');
   assert.match(await page.locator('#homeActionHelp').innerText(),
    /Нажми «Построить маршрут».*Магазин, спутники и профиль — в меню снизу/);
   assert.equal(await page.locator('#homeOpenCreateBtn').getAttribute('aria-describedby'),'homeActionHelp');
   const sizes=await page.evaluate(()=>{
     const rect=id=>document.querySelector(id).getBoundingClientRect().toJSON();
     return {home:rect('#home'),button:rect('#homeOpenCreateBtn'),
      nav:rect('.nav'),app:rect('.app'),
      display:getComputedStyle(document.querySelector('#home')).display};
   });
   assert.equal(sizes.display,'flex','home should use vertical layout');
   assert.ok(sizes.button.width>250,'primary route CTA must be large');
   assert.ok(sizes.button.bottom<sizes.nav.top+2||device.height<700,
    'primary button must not overlap bottom navigation: '+JSON.stringify(sizes));
   if(device.height>=800)assert.ok(sizes.nav.top-sizes.button.bottom<135,
    'avoid giant empty gap beneath main route button: '+JSON.stringify(sizes));
   // Companion collection remains reachable in its own dedicated tab.
   await page.locator('.nav [data-screen="mascots"]').click();
   await page.locator('#mascots.active').waitFor({state:'visible'});
   await page.locator('#mascotCollectionGrid .mascot-card').first().waitFor();
   await page.locator('.nav [data-screen="home"]').click();
   await page.locator('#home.active').waitFor({state:'visible'});
   await page.locator('#homeOpenCreateBtn').click();
   await page.locator('#create.active').waitFor({state:'visible'});
   assert.equal(await page.locator('.nav [data-screen="profile"]').isVisible(),true);
   assert.equal(await page.locator('.nav [data-screen="shop"]').isVisible(),true);
   assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,errors.join(' | '));
   console.log('CLEAN_HOME_BROWSER_OK '+device.name+
     ' no duplicate mascot, clear button guidance, comfortable CTA placement, companions in bottom menu');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
