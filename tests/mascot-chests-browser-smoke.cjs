'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
  await page.locator('.nav [data-screen="mascots"]').click();
  await page.locator('[data-mascot-tab="chests"]').click();
  await page.locator('#mascotChestGrid .mascot-chest-card').first().waitFor();
  assert.equal(await page.locator('#mascotChestGrid .mascot-chest-card').count(),3);
  assert.equal(await page.locator('#mascotOwnedCount').innerText(),'1/145');
  await page.evaluate(()=>{window.state.coins=1000;window.__rrChestRefresh()});
  await page.locator('[data-open-mascot-chest="trail"]').click();
  assert.match(await page.locator('#mascotChestResult').innerText(),/Новый спутник|Дубликат/);
  const first=await page.evaluate(()=>({
   data:JSON.parse(localStorage.getItem('rr_mascot_chests_v2')),
   coins:window.state.coins
  }));
  assert.equal(first.coins,920);
  assert.equal(first.data.opened,1);
  assert.equal(Object.values(first.data.copies).reduce((a,b)=>a+b,0),1);
  await page.locator('[data-mascot-tab="inventory"]').click();
  assert.match(await page.locator('#mascotInventoryCapacity').innerText(),/1 из 50/);
  assert.equal(await page.locator('#mascotInventoryGrid .mascot-inventory-card').count(),1);
  await page.evaluate(()=>{window.state.coins=500;window.__rrChestRefresh()});
  await page.locator('#mascotExpandCapacity').click();
  assert.match(await page.locator('#mascotInventoryCapacity').innerText(),/1 из 60/);
  assert.equal(await page.evaluate(()=>window.state.coins),350);
  await page.evaluate(()=>{
   const k='rr_mascot_chests_v2',s=JSON.parse(localStorage.getItem(k));
   s.owned.push('student-cat');s.copies['student-cat']=2;
   localStorage.setItem(k,JSON.stringify(s));window.__rrMascotInventoryRefresh();
  });
  await page.locator('[data-mascot-tab="upgrades"]').click();
  await page.locator('[data-upgrade-mascot="student-cat"]').click();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('rr_mascot_chests_v2')));
  assert.equal(after.ranks['student-cat'],2);
  assert.equal(after.copies['student-cat'],1,'base copy is preserved');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.nav [data-screen="mascots"]').click();
  await page.locator('[data-mascot-tab="inventory"]').click();
  assert.match(await page.locator('#mascotInventoryCapacity').innerText(),/60/);
  await page.locator('.nav [data-screen="shop"]').click();
  assert.equal(await page.locator('#shop [data-buy-type], #purchaseModal').count(),0);
  assert.doesNotMatch(await page.locator('#shop').innerText(),/\d+\s*₽/);
  await page.evaluate(()=>{window.__rrSwitchWallet('tester');window.state.coins=200;window.__rrChestRefresh()});
  await page.locator('.nav [data-screen="mascots"]').click();
  await page.locator('[data-mascot-tab="chests"]').click();
  await page.locator('[data-open-mascot-chest="trail"]').click();
  const separated=await page.evaluate(()=>({
   normal:JSON.parse(localStorage.getItem('rr_mascot_chests_v2')),
   tester:JSON.parse(localStorage.getItem('rr_mascot_chests_tester_v2'))
  }));
  assert.ok(separated.normal.opened>=1);
  assert.equal(separated.tester.opened,1);
  assert.equal(errors.length,0,errors.join(' | '));
  console.log('MASCOT_CHESTS_BROWSER_OK new inventory, 145 catalog, star upgrades, RC slots, free shop and tester isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
