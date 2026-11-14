'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [
   {name:'phone',width:390,height:844,mobile:true},
   {name:'short-phone',width:375,height:667,mobile:true},
   {name:'desktop',width:1440,height:900,mobile:false}
  ]){
   const context=await browser.newContext({viewport:{width:device.width,height:device.height},
    isMobile:device.mobile,hasTouch:device.mobile,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
   const tip=page.locator('#rrMarshikGuide');
   const target=page.locator('.rr-marshik-current-target');
   const expectStep=async step=>{
     await page.waitForFunction(value=>document.querySelector('#rrMarshikGuide')?.dataset.rrGuideStep===value,step);
     assert.equal(await tip.count(),1,'only one Marshik bubble at '+step);
     assert.equal(await target.count(),step==='route:done'?0:1,'only one highlighted target at '+step);
   };
   assert.equal(await tip.count(),0,'home uses its existing Marshik card');
   await page.locator('#homeOpenCreateBtn').click();
   await page.locator('#create.active').waitFor({state:'visible'});
   await expectStep('create:distance');
   assert.equal(await page.locator('.rr-distance-options').evaluate(x=>x.classList.contains('rr-marshik-current-target')),true);
   // Regression: a restored earlier wizard stage must NOT override an error,
   // including an error message from an older cached build handler.
   if(device.name==='phone'){
     await page.locator('#routeBuildStatus').evaluate(el=>{
       el.hidden=false;el.textContent='Маршрут не найден. Попробуйте выбрать другую длину прогулки.';
     });
     await expectStep('create:error');
     assert.match(await page.locator('#rrMarshikGuideText').innerText(),/Не удалось подобрать/);
     await page.locator('#routeBuildStatus').evaluate(el=>{el.hidden=true;el.textContent='';});
     await expectStep('create:distance');
   }
   await page.locator('[data-distance-km="3"]').click();
   await expectStep('create:interest');
   assert.equal(await page.locator('.rr-distance-options').evaluate(x=>x.classList.contains('rr-marshik-current-target')),false);
   await page.locator('[data-type="city"]').click();
   await expectStep('create:build');
   if(device.name==='phone'){
     // Force an OSM outage without changing geolocation or the rest of the app.
     await page.evaluate(()=>{
       window.__originalOsmLoad=window.RRWalkingDijkstra.loadGraph;
       window.RRWalkingDijkstra.loadGraph=async()=>{throw new Error('OSMUnavailable');};
     });
     await page.locator('#buildBtn').click();
     await page.waitForFunction(()=>document.querySelector('#routeBuildStatus')?.dataset.state==='error',null,{timeout:20000});
     await expectStep('create:error');
     assert.match(await page.locator('#buildBtn').innerText(),/Повторить построение/);
     assert.match(await page.locator('#rrMarshikGuideText').innerText(),/Дороги временно недоступны/);
     assert.equal(await page.locator('#routeBuildStatus').isVisible(),true);
     assert.equal(await page.locator('#tryDemoRouteBtn').isVisible(),true,
       'show a clearly labelled demo alternative after an OSM outage');
     assert.equal(await page.locator('#buildBtn').isEnabled(),true);
     // The Retry button must trigger another real attempt, not a dead label.
     await page.locator('#buildBtn').click();
     await page.waitForFunction(()=>document.querySelector('#routeBuildStatus')?.dataset.state==='error',null,{timeout:20000});
     assert.match(await page.locator('#buildBtn').innerText(),/Повторить построение/);
     await page.locator('[data-distance-km="5"]').click();
     await expectStep('create:build');
     assert.equal(await page.locator('#routeBuildStatus').isVisible(),false,
       'old errors must disappear after the user changes their route');
     assert.equal(await page.locator('#tryDemoRouteBtn').isVisible(),false);
     assert.match(await page.locator('#buildBtn').innerText(),/Построить прогулку/);
     await page.evaluate(()=>{window.RRWalkingDijkstra.loadGraph=window.__originalOsmLoad;});
   }
   const gpsPanel=page.locator('#rrStartSettings');
   assert.equal(await gpsPanel.evaluate(el=>el.open),false,'GPS settings must start collapsed');
   assert.ok((await gpsPanel.boundingBox()).height<80,'GPS summary must be compact, not a full card');
   assert.equal(await page.locator('#locateYakutskBtn').isVisible(),false,'GPS actions hidden until requested');
   assert.equal(await page.locator('#createMapDetails').count(),1,'map settings remain available');
   // A user without GPS can expand the same compact row; the guide changes to the GPS action.
   await page.locator('#demoGpsBtn').evaluate(el=>el.classList.add('hidden'));
   await page.locator('#yakutskLocationStatus').evaluate(el=>{el.className='location-status warn';el.textContent='GPS ожидается';});
   await expectStep('create:gps');
   assert.equal(await page.locator('#rrStartSettings > summary').evaluate(el=>el.classList.contains('rr-marshik-current-target')),true);
   await page.locator('#rrStartSettings > summary').click();
   await expectStep('create:gps-action');
   assert.equal(await page.locator('#locateYakutskBtn').isVisible(),true);
   await page.locator('#yakutskLocationStatus').evaluate(el=>{el.className='location-status ok';el.textContent='GPS определён';});
   await expectStep('create:build');
   await page.locator('#rrStartSettings > summary').click();
   await page.locator('#demoGpsBtn').evaluate(el=>el.classList.remove('hidden'));
   await page.reload({waitUntil:'domcontentloaded'});
   // The app restores the last active screen (often 'create') on reload.
   await page.waitForFunction(()=>document.querySelector('.app')?.dataset.rrScreen==='create');
   await page.evaluate(()=>window.__rrOpenScreen('create',{restoreScroll:false}));
   await expectStep('create:build');
   await page.evaluate(()=>window.__rrOpenScreen('route',{restoreScroll:false}));
   await expectStep('route:demo-arrival');
   await page.locator('#demoGpsBtn').evaluate(el=>el.classList.add('hidden'));
   await expectStep('route:walk');
   await page.locator('#photoBlock').evaluate(el=>el.classList.remove('hidden'));
   await expectStep('route:photo');
   await page.locator('#verifyBtn').evaluate(el=>el.classList.remove('hidden'));
   await expectStep('route:verify');
   await page.locator('#nextBtn').evaluate(el=>el.classList.remove('hidden'));
   await expectStep('route:next');
   await page.locator('#nextBtn').evaluate(el=>el.classList.add('hidden'));
   await page.locator('#photoBlock').evaluate(el=>el.classList.add('hidden'));
   await page.locator('#gpsBtn').evaluate(el=>el.textContent='Подтвердить возвращение к старту');
   await expectStep('route:finish');
   await page.locator('#gpsCheck b').evaluate(el=>el.textContent='Финиш подтверждён');
   await expectStep('route:done');
   await page.emulateMedia({reducedMotion:'reduce'});
   const style=await tip.evaluate(x=>getComputedStyle(x).animationName);
   assert.equal(style,'none');
   await page.evaluate(()=>window.__rrOpenScreen('shop',{restoreScroll:false}));
   await page.waitForFunction(()=>!document.querySelector('#rrMarshikGuide'));
   assert.equal(await target.count(),0,'no previous highlight in shop');
   assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError/.test(e)),[],errors.join(' | '));
   console.log('MARSHIK_GUIDE_BROWSER_OK '+device.name+' forward stages, no stale bubbles, done, reduced motion');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
