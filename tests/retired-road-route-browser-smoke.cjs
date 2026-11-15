'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await page.addInitScript(()=>{
   // Emulate a route saved before pedestrian-only routing was introduced.
   localStorage.setItem('rr_active_screen','route');
   localStorage.setItem('rr_yakutsk_session_v8',JSON.stringify({
    start:{lat:62.0274,lng:129.732},startMode:'demo',
    legs:[{distance:150,steps:[{geometry:{coordinates:[[129.732,62.0274],[129.734,62.028]]}}]}],
    checkpoints:[{lat:62.028,lng:129.734,name:'Старая точка на проезжей части'}],
    current:1,routeDistance:150,routeEngine:'dijkstra-osm',stage:'walking',
    activeScreen:'route',routeId:'unsafe-route-v50',routeStartedAt:123,routeVariant:2
   }));
  });
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
  await page.locator('#home.active').waitFor({state:'visible'});
  const data=await page.evaluate(()=>{
   const rr=window.__yakutskRR;
   const s=JSON.parse(localStorage.getItem('rr_yakutsk_session_v8')||'null');
   return {legs:rr.legs.length,stage:rr.stage,routeId:rr.routeId,active:rr.activeScreen,
    schema:s?.routeSchema,savedLegs:s?.legs?.length,coins:localStorage.getItem('rr_coins')};
  });
  assert.equal(data.legs,0,'old vehicle-road walking line must not be displayed');
  assert.equal(data.stage,'idle');
  assert.equal(data.routeId,null);
  assert.equal(data.active,'home');
  assert.equal(data.schema,'pedestrian-only-v51','next saved session uses the new schema');
  assert.equal(data.savedLegs,0,'old unsafe geometry must not reappear on reload');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#home.active').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__yakutskRR.legs.length),0,'old route stays retired');
  await page.locator('#homeOpenCreateBtn').click();
  await page.locator('#create.active').waitFor({state:'visible'});
  console.log('OLD_ROAD_ROUTE_RETIRE_OK legacy car-road line cleared and safe route wizard available');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
