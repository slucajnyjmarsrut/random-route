'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({
   viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'
  });
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
  await page.locator('#homeOpenCreateBtn').click();
  await page.locator('[data-distance-km="2"]').click();
  assert.equal(await page.locator('#distanceInput').inputValue(),'2','clicked 2 km must update the actual input');
  assert.equal(await page.locator('[data-distance-km="2"]').getAttribute('aria-pressed'),'true');
  await page.locator('#buildBtn').click();
  await page.waitForFunction(()=>document.querySelector('#route.active')||
    document.querySelector('#routeBuildStatus')?.dataset.state==='error',null,{timeout:45000});
  const route=await page.evaluate(()=>({
   legs:window.__yakutskRR?.legs?.length||0,
   chosen:window.__yakutskRR?.requestedDistance,
   metres:window.__yakutskRR?.routeDistance,
   active:!!document.querySelector('#route.active'),
   error:document.querySelector('#routeBuildStatus')?.textContent||'',
   total:document.querySelector('#rrNavTotal')?.textContent||''
  }));
  if(route.active){
   assert.equal(route.chosen,2);
   assert.ok(route.metres>=1840&&route.metres<=2160,'2 km selection must never become 2.8 km: '+JSON.stringify(route));
   assert.ok(!/2,8|2,9|3 км/.test(route.total),'navigation cannot display an oversized total');
  }else{
   assert.match(route.error,/длин|маршрут|расстояние|пешеходн/i,
    'failed build must clearly ask for another distance instead of showing 2.8 km');
  }
  console.log('TWO_KM_BROWSER_OK '+JSON.stringify(route));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
