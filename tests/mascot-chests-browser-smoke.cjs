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
  const odds=await page.evaluate(()=>window.RRMascotChests.CHESTS.map(c=>c.weights));
  for(const w of odds)assert.ok(w.common>w.uncommon+w.rare+w.epic+w.legendary);
  assert.doesNotMatch(await page.locator('#mascotChestProgress').innerText(),/до гарантии/i);
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
  assert.equal('pity' in before.data,false);
  const mascot=before.data.owned[0];
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.nav [data-screen="mascots"]').click();
  assert.equal(await page.locator('#mascotOwnedCount').innerText(),'2/20');
  assert.equal(await page.locator('[data-mascot-id="'+mascot+'"] .mascot-action').isEnabled(),true);
  await page.locator('[data-mascot-id="'+mascot+'"] .mascot-action').click();
  assert.match(await page.locator('#mascotEquipped').innerText(),/ВАШ СПУТНИК/);
  // Old saved pity values must not change the next roll or guarantee a prize.
  await page.evaluate(()=>{
    const k='rr_mascot_chests_v1',x=JSON.parse(localStorage.getItem(k));
    x.pity=999;localStorage.setItem(k,JSON.stringify(x));window.__rrChestRefresh();
  });
  await page.locator('[data-open-mascot-chest="aurora"]').click();
  assert.doesNotMatch(await page.locator('#mascotChestResult').innerText(),/гаранти/i);
  const second=await page.evaluate(()=>{
    const x=JSON.parse(localStorage.getItem('rr_mascot_chests_v1'));
    return {last:x.last,coins:window.state.coins,owned:x.owned,pity:x.pity};
  });
  assert.equal(second.coins,320);
  assert.equal('guaranteed' in second.last,false);
  assert.equal(second.pity,undefined);
  assert.equal(new Set(second.owned).size,2);
  // The developer tester wallet stays separate from the guest wallet.
  await page.evaluate(()=>{window.__rrSwitchWallet('tester');window.state.coins=200;window.__rrChestRefresh()});
  await page.locator('[data-open-mascot-chest="trail"]').click();
  const separated=await page.evaluate(()=>({
    normal:JSON.parse(localStorage.getItem('rr_mascot_chests_v1')).owned,
    tester:JSON.parse(localStorage.getItem('rr_mascot_chests_tester_v1')).owned
  }));
  assert.equal(separated.normal.length,2);
  assert.equal(separated.tester.length,1);
  assert.equal(errors.length,0,errors.join(' | '));
  console.log('MASCOT_CHESTS_BROWSER_OK common-first odds, no pity, purchase, persistence, equip and wallet isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
