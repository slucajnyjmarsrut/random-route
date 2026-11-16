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
  await page.locator('.nav [data-screen="mascots"]').click();
  await page.locator('#mascotChestGrid .mascot-chest-card').first().waitFor();
  assert.equal(await page.locator('#mascotChestGrid .mascot-chest-card').count(),3);
  await page.evaluate(()=>{window.state.coins=1000;window.__rrChestRefresh()});
  await page.locator('[data-open-mascot-chest="trail"]').click();
  assert.match(await page.locator('#mascotChestResult').innerText(),/спутник!/);
  let before=await page.evaluate(()=>({
    data:JSON.parse(localStorage.getItem('rr_mascot_chests_v1')),
    coins:window.state.coins,
    count:document.querySelector('#mascotOwnedCount').textContent
  }));
  assert.equal(before.coins,920);
  assert.equal(before.count,'2/20');
  assert.equal(before.data.owned.length,1);
  const mascot=before.data.owned[0];
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.nav [data-screen="mascots"]').click();
  assert.equal(await page.locator('#mascotOwnedCount').innerText(),'2/20');
  assert.equal(await page.locator('[data-mascot-id="'+mascot+'"] .mascot-action').isEnabled(),true);
  await page.locator('[data-mascot-id="'+mascot+'"] .mascot-action').click();
  assert.match(await page.locator('#mascotEquipped').innerText(),/ВАШ СПУТНИК/);
  await page.evaluate(()=>{
    const k='rr_mascot_chests_v1',x=JSON.parse(localStorage.getItem(k));
    x.pity=11;localStorage.setItem(k,JSON.stringify(x));window.__rrChestRefresh();
  });
  await page.locator('[data-open-mascot-chest="aurora"]').click();
  assert.match(await page.locator('#mascotChestResult').innerText(),/Сработала гарантия/);
  const forced=await page.evaluate(()=>{
    const x=JSON.parse(localStorage.getItem('rr_mascot_chests_v1'));
    return {last:x.last,coins:window.state.coins,owned:x.owned};
  });
  assert.equal(forced.coins,320);
  assert.equal(forced.last.guaranteed,true);
  assert.equal(new Set(forced.owned).size,2);
  assert.ok(['epic','legendary'].includes(windowRarity(forced.last.mascotId)));
  // A tester wallet may buy test chests, but its rewards stay isolated.
  await page.evaluate(()=>{window.__rrSwitchWallet('tester');window.state.coins=200;window.__rrChestRefresh()});
  await page.locator('[data-open-mascot-chest="trail"]').click();
  const separated=await page.evaluate(()=>({
    normal:JSON.parse(localStorage.getItem('rr_mascot_chests_v1')).owned,
    tester:JSON.parse(localStorage.getItem('rr_mascot_chests_tester_v1')).owned
  }));
  assert.equal(separated.normal.length,2);
  assert.equal(separated.tester.length,1);
  assert.equal(errors.length,0,errors.join(' | '));
  console.log('MASCOT_CHESTS_BROWSER_OK purchase, RouteCoin, persistence, equip, pity and tester isolation');
  function windowRarity(id){return ({
    'polar-dog':'epic','photographer-bear':'epic','cartographer-raven':'epic','snow-leopard':'epic',
    'northern-deer':'legendary','yakut-bull':'legendary','robot-tourist':'legendary','taiga-spirit':'legendary'
  })[id]}
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
