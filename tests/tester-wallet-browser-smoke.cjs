'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT='http://127.0.0.1:8765/index.html';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [
   {name:'phone',width:390,height:844,mobile:true},
   {name:'desktop',width:1440,height:900,mobile:false}
  ]){
   const context=await browser.newContext({
     viewport:{width:device.width,height:device.height},
     isMobile:device.mobile,hasTouch:device.mobile,serviceWorkers:'block'
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
   await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:20000});
   await page.locator('#authGuest').click();
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   let status=await page.evaluate(()=>({
     coins:window.state.coins,
     profile:document.querySelector('#coinsProfile').textContent,
     mode:window.__rrWalletMode(),
     wallet:localStorage.getItem('rr_coins')
   }));
   assert.deepEqual(status,{coins:0,profile:'0',mode:'normal',wallet:'0'});
   // Tester gets its own 250,000 RC; no write is allowed to the guest wallet.
   await page.evaluate(()=>window.activateTesterAccount());
   status=await page.evaluate(()=>({
     coins:window.state.coins,mode:window.__rrWalletMode(),
     guest:localStorage.getItem('rr_coins'),
     tester:localStorage.getItem('rr_tester_coins_v35'),
     profile:document.querySelector('#profileName').textContent
   }));
   assert.equal(status.coins,250000);
   assert.equal(status.mode,'tester');
   assert.equal(status.guest,'0');
   assert.equal(status.tester,'250000');
   assert.equal(status.profile,'Данил');
   await page.evaluate(()=>window.__rrOpenGuestProfile('profile'));
   status=await page.evaluate(()=>({
     coins:window.state.coins,mode:window.__rrWalletMode(),
     profileCoins:document.querySelector('#coinsProfile').textContent,
     guest:localStorage.getItem('rr_coins'),
     tester:localStorage.getItem('rr_tester_coins_v35'),
     name:document.querySelector('#profileName').textContent
   }));
   assert.equal(status.mode,'normal');
   assert.equal(status.coins,0);
   assert.equal(status.guest,'0');
   assert.equal(status.tester,'250000');
   assert.equal(status.profileCoins,'0');
   assert.equal(status.name,'Гость');
   // Legitimately earned local guest balance is not erased by a tester visit.
   await page.evaluate(()=>{
     window.state.coins=25;
     window.__syncApp();
     window.__recordVerifiedEvent('photo_verified','wallet-test-real-photo',
       {dailyEligible:true,routeId:'test',point:1});
     window.activateTesterAccount();
   });
   status=await page.evaluate(()=>({
     coins:window.state.coins,guest:localStorage.getItem('rr_coins'),
     stats:window.__verifiedStats().photos
   }));
   assert.equal(status.guest,'25');
   assert.equal(status.stats,1);
   assert.equal(status.coins,250000);
   await page.evaluate(()=>window.__rrOpenGuestProfile('profile'));
   assert.equal(await page.locator('#coinsProfile').innerText(),'25');
   // Entering as guest after a full reload cannot inherit tester balance.
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#authGuest').click();
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   assert.equal(await page.locator('#coinsProfile').innerText(),'25');
   // Old v34 tester seed stored in rr_coins (without real reward evidence):
   // migrate it only once, preserve backup for diagnosis, don't mint for guest.
   await page.evaluate(()=>{
     localStorage.setItem('rr_coins','250000');
     localStorage.setItem('rr_level','50');
     localStorage.removeItem('rr_tester_wallet_migration_v35');
     localStorage.removeItem('rr_verified_events_v1');
     localStorage.removeItem('rr_user_session_v31');
     localStorage.removeItem('rr_user_profile');
   });
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#authGuest').click();
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   status=await page.evaluate(()=>({
     coins:window.state.coins,level:window.state.level,
     mode:window.__rrWalletMode(),
     guest:localStorage.getItem('rr_coins'),
     backup:localStorage.getItem('rr_legacy_tester_coins_backup_v35'),
     levelBackup:localStorage.getItem('rr_legacy_tester_level_backup_v35'),
     marker:localStorage.getItem('rr_tester_wallet_migration_v35'),
     shown:document.querySelector('#coinsProfile').textContent
   }));
   assert.equal(status.coins,0);
   assert.equal(status.level,1);
   assert.equal(status.mode,'normal');
   assert.equal(status.guest,'0');
   assert.equal(status.backup,'250000');
   assert.equal(status.levelBackup,'50');
   assert.equal(status.marker,'1');
   assert.equal(status.shown,'0');
   // Small earned balances never get touched by the legacy migration.
   await page.evaluate(()=>{
     localStorage.setItem('rr_coins','75');
     localStorage.removeItem('rr_tester_wallet_migration_v35');
   });
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#authGuest').click();
   await page.evaluate(()=>window.__rrOpenScreen('profile',{restoreScroll:false}));
   assert.equal(await page.locator('#coinsProfile').innerText(),'75');
   assert.equal(errors.filter(e=>/TypeError|ReferenceError/.test(e)).length,0,errors.join(' | '));
   console.log('TESTER_WALLET_BROWSER_OK '+device.name+' isolated 250k demo, guest 0, real 25 retained, legacy migration');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
