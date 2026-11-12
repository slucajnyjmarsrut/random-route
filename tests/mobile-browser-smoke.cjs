'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',err=>errors.push(String(err.message)));
 await page.route('**/*',route=>{
   const url=route.request().url();
   return url.startsWith('http://127.0.0.1:8765/')?route.continue():route.abort();
 });
 try{
  await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('#homeOpenCreateBtn').waitFor({state:'visible',timeout:10000});
  assert.equal(await page.locator('#smartRouteChat').count(),0,'chat should not appear');
  const width=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
  assert.ok(width[0]<=width[1]+2,'mobile page must not scroll horizontally: '+width);
  await page.locator('#homeOpenCreateBtn').click();
  await page.locator('#demoYakutskBtn').waitFor({state:'visible',timeout:9000});
  await page.locator('#demoYakutskBtn').click();
  await page.locator('[data-distance-km="3"]').click();
  const summary=await page.locator('#buildBtn').evaluate(el=>{
    const r=el.getBoundingClientRect();return {height:r.height,width:r.width};
  });
  assert.ok(summary.height>=60,'route button too small for a finger: '+JSON.stringify(summary));
  await page.locator('#buildBtn').click();
  let built=false;
  for(let i=0;i<3;i++){
   try{
    await page.waitForFunction(()=>document.getElementById('route')?.classList.contains('active'),{timeout:10000});
    built=true;break;
   }catch(e){
    const msg=await page.locator('#routeBuildStatus').textContent().catch(()=>'');
    console.warn('Route attempt',i+1,'status:',msg);
    if(i<2){await page.locator('#buildBtn').click();}
   }
  }
  assert.ok(built,'could not construct OSM Dijkstra walk in demo from the real central Yakutsk graph');
  const state=await page.evaluate(()=>({
    engine:window.__yakutskRR?.routeEngine,
    legs:window.__yakutskRR?.legs?.length,
    routeMetres:window.__yakutskRR?.routeDistance,
    banner:document.getElementById('routeEngineStatus')?.textContent||'',
    panelVisible:!!document.getElementById('rrNavPanel')?.offsetParent,
    screen:document.querySelector('.app')?.dataset.rrScreen
  }));
  assert.equal(state.engine,'dijkstra-osm');
  assert.ok(state.legs>=2&&state.routeMetres>500);
  assert.equal(state.screen,'route');
  assert.ok(state.panelVisible,'mobile navigation card should be visible');
  assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,'uncaught runtime JS errors: '+errors.join(' | '));
  console.log('MOBILE_BROWSER_DIJKSTRA_OK '+JSON.stringify(state));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
