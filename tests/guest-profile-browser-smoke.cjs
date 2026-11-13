'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [
    {name:'phone',width:390,height:844,mobile:true},
    {name:'desktop',width:1440,height:900,mobile:false}
  ]){
   const context=await browser.newContext({
     viewport:{width:device.width,height:device.height},isMobile:device.mobile,
     hasTouch:device.mobile,serviceWorkers:'block'
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
   await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
   assert.equal(await page.locator('#authLoginTab').isVisible(),true);
   assert.equal(await page.locator('#authRegisterTab').isVisible(),true);
   assert.equal(await page.locator('#authGuest').isVisible(),true);
   assert.equal(await page.locator('#authEmail').isVisible(),true);
   assert.equal(await page.locator('#authPassword').isVisible(),true);
   const bounds=await page.locator('.rr-entry-sheet').boundingBox();
   assert.ok(bounds.width>=Math.min(360,device.width-35),'narrow welcome form');
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=device.width+1,'welcome overflows screen');
   await page.locator('#authGuest').click();
   await page.locator('#profileAuthModal').waitFor({state:'hidden'});
   await page.locator('#home.active').waitFor({state:'visible'});
   assert.deepEqual(await page.evaluate(()=>({
     profile:localStorage.getItem('rr_user_profile'),
     session:localStorage.getItem('rr_user_session_v31'),
     accounts:localStorage.getItem('rr_local_accounts_v2')
   })),{profile:null,session:null,accounts:null},'guest must not create credentials');
   // The old built-in tester local session must not appear on next launch.
   await page.evaluate(()=>{
     localStorage.setItem('rr_user_profile',JSON.stringify({
       name:'Данил',email:'tester.route@yandex.ru',role:'tester'
     }));
     localStorage.setItem('rr_user_session','1');
   });
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
   await page.locator('#authGuest').click();
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   assert.equal(await page.locator('#profileName').innerText(),'Гость');
   assert.equal(await page.locator('#profileAuthModal.show').count(),0);
   await page.evaluate(()=>{
     localStorage.setItem('rr_verified_events_v1',JSON.stringify([{
       type:'route_completed',key:'route_completed:guest-walk',at:Date.now(),
       data:{routeDistanceM:3000,dailyEligible:true}
     }]));
   });
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#authGuest').click();
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   await page.locator('#profile.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileRoutes').innerText(),'1');
   assert.equal(await page.locator('#profileName').innerText(),'Гость');
   // The home entry reopens the same login/register/guest gateway.
   await page.locator('#profileLogout').click();
   await page.locator('#homeOpenGuestProfileBtn').click();
   await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
   await page.locator('#authRegisterTab').click();
   assert.equal(await page.locator('#authNameField').isVisible(),true);
   assert.equal(await page.locator('#authConfirmField').isVisible(),true);
   await page.locator('#authLoginTab').click();
   assert.equal(await page.locator('#authNameField').isVisible(),false);
   await page.locator('#authGuest').click();
   await page.evaluate(()=>window.__rrOpenScreen('mascots',{restoreScroll:false}));
   await page.locator('.nav [data-screen="profile"]').click();
   await page.locator('#profile.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileName').innerText(),'Гость');
   assert.equal(await page.locator('#profileRoutes').innerText(),'1');
   assert.deepEqual(await page.evaluate(()=>({
     profile:localStorage.getItem('rr_user_profile'),
     session:localStorage.getItem('rr_user_session_v31')
   })),{profile:null,session:null});
   assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,errors.join(' | '));
   console.log('WELCOME_GUEST_BROWSER_OK '+device.name+' first-visit gateway, tabs, guest profile and progress preserved');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
