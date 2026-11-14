'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await page.route('**/*',route=>
   route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
  await page.locator('#homeOpenCreateBtn').click();
  await page.locator('#create.active').waitFor({state:'visible'});
  await page.evaluate(()=>{
    window.__savedLoadGraph=window.RRWalkingDijkstra.loadGraph;
    window.RRWalkingDijkstra.loadGraph=async()=>{throw Error('OSMUnavailable');};
  });
  await page.locator('#buildBtn').click();
  await page.waitForFunction(()=>document.querySelector('#routeBuildStatus')?.dataset.state==='error');
  assert.equal(await page.locator('#tryDemoRouteBtn').isVisible(),true);
  await page.evaluate(()=>{
    window.RRWalkingDijkstra.loadGraph=window.__savedLoadGraph;
    // Simulate a saved location outside the bundled OSM area.
    window.__yakutskRR.start={lat:62.12,lng:130.10};
  });
  await page.locator('#tryDemoRouteBtn').click();
  await page.locator('#route.active').waitFor({state:'visible',timeout:30000});
  const data=await page.evaluate(()=>({
    mode:window.__yakutskRR.startMode,
    origin:window.__yakutskRR.start,
    distance:window.__yakutskRR.routeDistance,
    legs:window.__yakutskRR.legs.length,
    engine:window.__yakutskRR.routeEngine,
    preview:document.getElementById('rrDemoNotice')?.textContent||''
  }));
  assert.equal(data.mode,'demo','must explicitly use a demo, not claim GPS');
  assert.ok(Math.abs(data.origin.lat-62.0274)<.0001&&Math.abs(data.origin.lng-129.732)<.0001,
    'demo must reset the start to centre of Yakutsk');
  assert.equal(data.engine,'dijkstra-osm');
  assert.ok(data.legs>=2&&data.distance>500,'real Dijkstra geometry must be found');
  assert.match(data.preview,/ДЕМОНСТРАЦИЯ/);
  console.log('OSM_ERROR_RECOVERY_BROWSER_OK '+JSON.stringify(data));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
