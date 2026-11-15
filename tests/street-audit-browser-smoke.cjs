'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [{name:'phone',width:390,height:844,mobile:true},
    {name:'desktop',width:1440,height:900,mobile:false}]){
   const page=await browser.newPage({viewport:{width:device.width,height:device.height},
     isMobile:device.mobile,hasTouch:device.mobile,serviceWorkers:'block'});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.sra-btn').count(),0,'no manual street-check button');
   assert.equal(await page.locator('.sra-panel').isVisible(),false,'no audit clutter before route');
   await page.locator('#homeOpenCreateBtn').click();
   await page.locator('[data-distance-km="3"]').click();
   await page.locator('#buildBtn').click();
   await page.locator('#route.active').waitFor({state:'visible',timeout:30000});
   await page.waitForFunction(()=>{
    const s=window.SmartRouteAudit?.getState()?.status;
    return ['partial','ok','insufficient','unavailable'].includes(s);
   },null,{timeout:35000});
   const s=await page.evaluate(()=>window.SmartRouteAudit.getState());
   assert.equal(s.status,'partial','local real streets are checked without clicking');
   assert.equal(s.source,'bundled');
   assert.ok(s.report.matched>0);
   const alerts=page.locator('.sra-alert'),count=await alerts.count();
   assert.ok(count>=1&&count<=3,'show only concise useful warnings');
   const text=(await page.locator('.sra-result').innerText()).trim();
   assert.ok(text.length<400,'no lengthy technical result: '+text);
   assert.ok(!/lit=yes|lit=no|winter_service=|снимок от|Повторить онлайн-проверку/i.test(text));
   assert.equal(await page.locator('.sra-panel').isVisible(),true);
   await page.evaluate(()=>window.dispatchEvent(new Event('rr:route-built')));
   assert.equal(await alerts.count(),count,'no duplicated notices for same route');
   assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError/.test(x)),[],errors.join(' | '));
   console.log('STREET_AUDIT_AUTO_OK '+device.name+' without buttons or verbose report');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
