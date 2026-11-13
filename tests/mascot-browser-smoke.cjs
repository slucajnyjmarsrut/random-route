'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
   await page.locator('#home .mascot-home-current [data-open-screen="mascots"]').click();
   await page.locator('#mascotCollectionGrid .mascot-card').first().waitFor();
   assert.equal(await page.locator('#mascotCollectionGrid .mascot-card').count(),20);
   assert.match(await page.locator('#mascotEquipped').innerText(),/Щенок-путник/);
   assert.equal(await page.locator('[data-mascot-id="tourist-hamster"] button').isDisabled(),true);
   assert.equal(await page.locator('#mascotOwnedCount').innerText(),'1/20');
   // Simulate verified events from the real ledger, including ten completed
   // GPS walks. This tests UI display but not GPS itself.
   await page.evaluate(()=>{
     const stamp=Date.now();
     const ev=Array.from({length:10},(_,i)=>({
       key:'route_completed:verified-'+i,type:'route_completed',
       at:stamp-i*86400000,
       data:{dailyEligible:true,routeDistanceM:3000}
     }));
     ev.push({key:'photo_verified:demo-test',type:'photo_verified',at:stamp,
       data:{dailyEligible:false}});
     localStorage.setItem('rr_verified_events_v1',JSON.stringify(ev));
     dispatchEvent(new Event('rr:verified-event'));
   });
   await page.waitForFunction(()=>document.querySelector('#mascotOwnedCount')?.textContent==='6/20'
     ||document.querySelector('#mascotOwnedCount')?.textContent==='5/20'
     ||document.querySelector('[data-mascot-id="tourist-hamster"] .mascot-action')?.disabled===false);
   assert.equal(await page.locator('[data-mascot-id="tourist-hamster"] .mascot-action').isEnabled(),true);
   assert.equal(await page.locator('#mascotCollectionGrid .mascot-card').count(),20);
   await page.locator('[data-mascot-id="tourist-hamster"] .mascot-action').click();
   assert.match(await page.locator('#mascotEquipped').innerText(),/Хомяк-турист/);
   await page.evaluate(()=>{
     const events=JSON.parse(localStorage.getItem('rr_verified_events_v1'));
     events.push({key:'route_completed:walk-eleven',type:'route_completed',at:Date.now()+1000,
       data:{dailyEligible:true,routeDistanceM:3100}});
     localStorage.setItem('rr_verified_events_v1',JSON.stringify(events));
     dispatchEvent(new Event('rr:verified-event'));
   });
   await page.waitForFunction(()=>document.querySelector('#mascotEquipped')?.textContent.includes('Опыт: 100 XP'));
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('rr_mascot_collection_v1')));
   assert.equal(before.xp['tourist-hamster'],100);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.evaluate(()=>window.__rrOpenScreen('mascots',{restoreScroll:false}));
   await page.waitForFunction(()=>document.querySelector('#mascotEquipped')?.textContent.includes('Хомяк-турист'));
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('rr_mascot_collection_v1')));
   assert.equal(after.xp['tourist-hamster'],100,'XP must survive reload without double credit');
   assert.equal(after.selected,'tourist-hamster');
   await page.locator('[data-mascot-filter="legendary"]').click();
   assert.equal(await page.locator('#mascotCollectionGrid .mascot-card').count(),4);
   assert.equal(await page.locator('#mascotCollectionGrid button:enabled').count(),0);
   await page.locator('[data-mascot-filter="all"]').click();
   assert.equal(await page.locator('#mascotCollectionGrid .mascot-card').count(),20);
   // Profile is correctly gated by the existing local sign-in dialog.
   // The mascot collection itself remains freely accessible.
   await page.locator('.nav [data-screen="profile"]').click();
   await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
   assert.match(await page.locator('#mascotProfileCurrent').innerText(),/Хомяк-турист/);
   await page.locator('#authCancel').click();
   await page.locator('.nav [data-screen="mascots"]').click();
   await page.locator('#mascotCollectionGrid .mascot-card').first().waitFor();
   assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,errors.join(' | '));
   console.log('MASCOTS_BROWSER_OK 20 cards, 10 verified routes unlock hamster, equip, future XP, reload and rarity filter');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
