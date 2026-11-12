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
     await page.locator('#createMapDetails summary').click();
     const home=page.locator('#homeMap');
     await page.locator('#rrHomeMapExpand').click();
     const homeOpen=await home.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),pressed:el.querySelector('#rrHomeMapExpand')?.getAttribute('aria-pressed'),inApp:el.parentElement?.classList.contains('app')}));
     assert.equal(homeOpen.pressed,'true');
     assert.equal(homeOpen.inApp,true);
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
     await page.locator('#rrRouteMapExpand').click();
     const opened=await page.locator('.app>.rr-map-expanded').evaluate(el=>({bounds:el.getBoundingClientRect().toJSON(),pressed:el.querySelector('.rr-map-toggle').getAttribute('aria-pressed')}));
     assert.ok(opened.bounds.width>=device.width-3&&opened.bounds.height>=device.height-3,'route map not full screen '+JSON.stringify(opened));
     assert.equal(opened.pressed,'true');
     await page.locator('#rrRouteMapExpand').click();
     assert.equal(await page.locator('#rrRouteMapExpand').getAttribute('aria-pressed'),'false');
     assert.equal(await page.locator('#route .map').count(),1,'map returned to route section');
     assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,'runtime errors '+errors.join(' | '));
     console.log('MAP_VIEWPORT_OK '+device.name+' '+JSON.stringify({height:Math.round(before.map.height),width:Math.round(before.map.width),fullScreen:true}));
     await context.close();
   }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
