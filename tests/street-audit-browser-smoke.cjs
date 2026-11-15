'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.route('**/*',route=>{
   const u=route.request().url();
   // Simulate Overpass CORS/network failures; the bundled graph still loads.
   return u.startsWith('http://127.0.0.1:8765/')?route.continue():route.abort();
  });
  await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
  await page.locator('#homeOpenCreateBtn').click();
  await page.locator('[data-distance-km="3"]').click();
  await page.locator('#buildBtn').click();
  await page.locator('#route.active').waitFor({state:'visible',timeout:30000});
  await page.locator('.sra-btn').click();
  await page.waitForFunction(()=>['partial','error','ok'].includes(window.SmartRouteAudit?.getState()?.status),null,{timeout:35000});
  const state=await page.evaluate(()=>window.SmartRouteAudit.getState());
  assert.equal(state.status,'partial','downtown Yakutsk uses a clearly limited cached OSM source');
  assert.equal(state.source,'bundled');
  assert.ok(state.report.matched>0,'real route matches local streets');
  const text=await page.locator('.sra-result').innerText();
  assert.match(text,/Онлайн-проверка не ответила/);
  assert.match(text,/не актуальная проверка маршрута/);
  assert.match(text,/Безопасность не гарантируется/);
  assert.match(await page.locator('.sra-btn').innerText(),/Повторить онлайн-проверку/);
  await page.locator('.sra-btn').click();
  await page.waitForFunction(()=>window.SmartRouteAudit?.getState()?.status==='partial',null,{timeout:35000});
  assert.equal(await page.locator('.sra-line').filter({hasText:'Онлайн-проверка не ответила'}).count(),1,
    'repeat must replace previous warning, not append duplicates');
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError/.test(x)),[],errors.join(' | '));
  console.log('STREET_AUDIT_BROWSER_OK mobile offline fallback + honest limited safety + retry');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
