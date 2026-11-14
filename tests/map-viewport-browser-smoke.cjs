'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT='http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
   for(const device of [
     {name:'phone',width:390,height:844,phone:true},
     {name:'desktop',width:1440,height:900,phone:false},
     {name:'landscape',width:844,height:390,phone:true}
   ]){
     const context=await browser.newContext({
       viewport:{width:device.width,height:device.height},
       isMobile:device.phone,hasTouch:device.phone,deviceScaleFactor:device.phone?2:1,
       serviceWorkers:'block'
     });
     const page=await context.newPage();
     const errors=[];
     page.on('pageerror',e=>errors.push(String(e.message)));
     await page.route('**/*',r=>r.request().url().startsWith(ROOT+'/')?r.continue():r.abort());
     await page.goto(ROOT+'/index.html?demo=1',{waitUntil:'domcontentloaded',timeout:20000});
     await page.locator('#homeOpenCreateBtn').waitFor({state:'visible'});
     await page.locator('#homeOpenCreateBtn').click();
     await page.locator('#rrStartSettings > summary').click();
     await page.locator('#createMapDetails summary').click();
     const home=page.locator('#homeMap');
     await page.locator('#rrHomeMapExpand').click();
     const homeOpen=await home.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),pressed:el.querySelector('#rrHomeMapExpand')?.getAttribute('aria-pressed'),inApp:el.parentElement?.classList.contains('app')}));
     assert.equal(homeOpen.pressed,'true');
     assert.equal(homeOpen.inApp,true);
     assert.equal(await page.locator('#rrMapNavigationHud').isVisible(),false,'start map must not show route directions');
     assert.ok(homeOpen.rect.width>=device.width-3&&homeOpen.rect.height>=device.height-3,'home map not full screen: '+JSON.stringify(homeOpen));
     await page.keyboard.press('Escape');
     assert.equal(await page.locator('#rrHomeMapExpand').getAttribute('aria-pressed'),'false');
     assert.equal(await home.evaluate(el=>el.parentElement?.classList.contains('rr-map-inner')),true,'home map restored to start panel');
     await page.evaluate(()=>{
       document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='route'));
       document.querySelector('.app').dataset.rrScreen='route';
       document.querySelector('.app .content').scrollTop=0;
     });
     await page.locator('#rrRouteMapExpand').waitFor({state:'visible'});
     const before=await page.evaluate(()=>{
       const map=document.querySelector('#route .map').getBoundingClientRect();
       const nav=document.querySelector('#rrNavPanel').getBoundingClientRect();
       return {map:map.toJSON(),nav:nav.toJSON(),screenWidth:innerWidth};
     });
     if(device.name==='phone'){
       assert.ok(before.map.height>=500,'phone map too short: '+JSON.stringify(before));
       assert.ok(before.map.top<before.nav.top,'phone must show the map above navigation');
     }else if(device.name==='desktop'){
       assert.ok(before.map.height>=600,'PC map too short');
       assert.ok(before.map.width>=700,'PC map must be wide: '+JSON.stringify(before));
       assert.ok(before.map.left<before.nav.left,'PC navigation must be beside the map');
     }else{
       assert.ok(before.map.height>=260,'landscape map too short');
       assert.ok(before.map.top<before.nav.top,'landscape map must be first');
     }
     await page.evaluate(()=>{
       document.querySelector('#rrNavArrow').textContent='↱';
       document.querySelector('#rrNavInstruction').textContent='Через 80 м — направо';
       document.querySelector('#rrNavStepDistance').textContent='Следуйте зелёной линии к точке';
       document.querySelector('#rrNavNext').textContent='180 м';
       document.querySelector('#rrNavTotal').textContent='2,7 км';
       document.querySelector('#rrNavGpsStatus').textContent='GPS активен';
     });
     await page.locator('#rrRouteMapExpand').click();
     const opened=await page.locator('.app>.rr-map-expanded').evaluate(el=>({bounds:el.getBoundingClientRect().toJSON(),pressed:el.querySelector('.rr-map-toggle').getAttribute('aria-pressed')}));
     assert.ok(opened.bounds.width>=device.width-3&&opened.bounds.height>=device.height-3,'route map not full screen '+JSON.stringify(opened));
     assert.equal(opened.pressed,'true');
     await page.waitForFunction(()=>{
       const hud=document.querySelector('#rrMapNavigationHud');
       return hud && getComputedStyle(hud).display!=='none'
         && hud.querySelector('.rr-map-hud-instruction')?.textContent==='Через 80 м — направо'
         && hud.querySelector('.rr-map-hud-next')?.textContent==='180 м'
         && hud.querySelector('.rr-map-hud-remaining')?.textContent==='2,7 км';
     });
     const hud=await page.locator('#rrMapNavigationHud').evaluate(el=>{
       const rect=el.getBoundingClientRect();
       const map=el.closest('.map').getBoundingClientRect();
       return {gps:el.querySelector('.rr-map-hud-gps').textContent,
         symbol:el.querySelector('.rr-map-hud-arrow').textContent,
         rect:rect.toJSON(),pointerEvents:getComputedStyle(el).pointerEvents,
         map:map.toJSON()};
     });
     assert.equal(hud.gps,'GPS активен');
     assert.equal(hud.symbol,'↱');
     assert.equal(hud.pointerEvents,'none','guidance must not block map drag');
     assert.ok(hud.rect.top>=0&&hud.rect.bottom<hud.map.bottom-50,'full-screen HUD out of map: '+JSON.stringify(hud));
     // GPS and direction updates while the full-screen map stays open.
     await page.evaluate(()=>{
       document.querySelector('#rrNavInstruction').textContent='Вы отошли от линии маршрута';
       document.querySelector('#rrNavNext').textContent='—';
       document.querySelector('#rrNavGpsStatus').textContent='Вне маршрута';
       document.querySelector('#rrNavPanel').classList.add('rr-nav-offtrack');
     });
     await page.waitForFunction(()=>{
       const hud=document.querySelector('#rrMapNavigationHud');
       return hud.classList.contains('rr-map-hud-offtrack')
         && hud.querySelector('.rr-map-hud-gps')?.textContent==='Вне маршрута'
         && hud.querySelector('.rr-map-hud-instruction')?.textContent==='Вы отошли от линии маршрута';
     });
     await page.locator('#rrRouteMapExpand').click();
     assert.equal(await page.locator('#rrMapNavigationHud').isVisible(),false,'guidance must hide outside fullscreen');
     assert.equal(await page.locator('#rrRouteMapExpand').getAttribute('aria-pressed'),'false');
     assert.equal(await page.locator('#route .map').count(),1,'map returned to route section');
     assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,'runtime errors '+errors.join(' | '));
     console.log('MAP_VIEWPORT_OK '+device.name+' '+JSON.stringify({height:Math.round(before.map.height),width:Math.round(before.map.width),fullScreen:true}));
     await context.close();
   }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
