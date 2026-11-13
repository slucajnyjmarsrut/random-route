'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [
   {name:'phone',width:390,height:844,isMobile:true},
   {name:'pc',width:1440,height:900,isMobile:false}
  ]){
   const context=await browser.newContext({
     viewport:{width:device.width,height:device.height},
     isMobile:device.isMobile,hasTouch:device.isMobile,serviceWorkers:'block'
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#profileAuthModal.show').count(),0);
   assert.equal(await page.locator('#homeOpenGuestProfileBtn').isVisible(),true,'entry must be visible on home');
   // Regression from a user's screenshot: a hardcoded former tester ("Данил")
   // remained signed in via the old localStorage session flag after a release.
   await page.evaluate(()=>{
     localStorage.setItem('rr_user_profile',JSON.stringify({
       name:'Данил',email:'tester.route@yandex.ru',role:'tester'
     }));
     localStorage.setItem('rr_user_session','1');
   });
   await page.reload({waitUntil:'domcontentloaded'});
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   assert.equal(await page.locator('#profileName').innerText(),'Гость',
     'legacy tester session must never auto-enter guest profile');
   assert.match(await page.locator('#profileHeroTitle').innerText(),/Гостевой профиль/);
   // Even a newer explicit test session must be left behind when the user
   // selects guest mode. It must not erase local routes, coins or mascots.
   await page.evaluate(()=>{
     localStorage.setItem('rr_user_session_v30','1');
     window.__rrOpenScreen('profile',{restoreScroll:false});
   });
   assert.equal(await page.locator('#profileName').innerText(),'Данил');
   await page.evaluate(()=>window.__rrOpenScreen('home',{restoreScroll:false}));
   await page.locator('#homeOpenGuestProfileBtn').click();
   await page.locator('#profile.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileName').innerText(),'Гость');
   assert.equal(await page.locator('#profileLogout').innerText(),'На главную');
   assert.equal(await page.locator('#guestProfileNotice').isVisible(),true);
   assert.match(await page.locator('#profileEmail').innerText(),/Без учётной записи/);
   assert.equal(await page.locator('#profileAuthModal.show').count(),0);
   const empty=await page.evaluate(()=>({
     account:localStorage.getItem('rr_user_profile'),
     session:localStorage.getItem('rr_user_session'),
     newSession:localStorage.getItem('rr_user_session_v30')
   }));
   assert.deepEqual(empty,{account:null,session:null,newSession:null},'guest browsing must not save auth');
   // Show existing walking history without an account. It is still stored
   // locally by the original app and this guest-entry change must not delete it.
   await page.evaluate(()=>{
     localStorage.setItem('rr_verified_events_v1',JSON.stringify([{
       type:'route_completed',key:'route_completed:sample',at:Date.now(),
       data:{routeDistanceM:3000,dailyEligible:true}
     }]));
   });
   // The verified-event ledger is read when the app starts.
   await page.reload({waitUntil:'domcontentloaded'});
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   await page.locator('#profile.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileRoutes').innerText(),'1');
   await page.locator('#profileLogout').click();
   await page.locator('#home.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileAuthModal.show').count(),0);
   await page.evaluate(()=>window.__rrOpenScreen('mascots',{restoreScroll:false}));
   await page.locator('.nav [data-screen="profile"]').click();
   await page.locator('#profile.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileName').innerText(),'Гость');
   assert.equal(await page.locator('#profileRoutes').innerText(),'1');
   const noAccount=await page.evaluate(()=>({
     account:localStorage.getItem('rr_user_profile'),
     session:localStorage.getItem('rr_user_session'),
     newSession:localStorage.getItem('rr_user_session_v30')
   }));
   assert.deepEqual(noAccount,{account:null,session:null,newSession:null});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   await page.locator('#profile.active').waitFor({state:'visible'});
   assert.equal(await page.locator('#profileName').innerText(),'Гость');
   assert.equal(await page.locator('#profileRoutes').innerText(),'1');
   assert.equal(await page.locator('#profileAuthModal.show').count(),0);
   assert.equal(errors.filter(s=>/TypeError|ReferenceError/.test(s)).length,0,errors.join(' | '));
   console.log('GUEST_PROFILE_BROWSER_OK '+device.name+' home and bottom entry, no account, progress retained');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
