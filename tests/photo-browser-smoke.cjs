'use strict';
/* Browser integration for real UI handlers, GPS, photo checking and rewards.
 * Model scores and camera files are mocked (not a MobileNet accuracy test). */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root='http://127.0.0.1:8765';
const svg=color=>'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="'+color+'"/></svg>';
const reference=svg('#ea3323');
const modelMock='window.mobilenet={load:async()=>({infer(img){const c=document.createElement("canvas");c.width=c.height=1;const ctx=c.getContext("2d");ctx.drawImage(img,0,0,1,1);const p=ctx.getImageData(0,0,1,1).data;return {array:async()=>[p[0]>p[2]?[1,0]:[0,1]],dispose(){}}},async classify(img){const c=document.createElement("canvas");c.width=c.height=1;const ctx=c.getContext("2d");ctx.drawImage(img,0,0,1,1);const p=ctx.getImageData(0,0,1,1).data;return [{className:p[0]>p[2]?"red statue":"blue building"}]}})};';
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
      serviceWorkers:'block',
      geolocation:{latitude:62.0274,longitude:129.732,accuracy:12},
      permissions:['geolocation']
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=route.request().url();
      if(url.includes('/@tensorflow/tfjs@'))return route.fulfill({
        status:200,contentType:'application/javascript',body:'window.tf={ready:async()=>{}};'
      });
      if(url.includes('/@tensorflow-models/mobilenet@'))return route.fulfill({
        status:200,contentType:'application/javascript',body:modelMock
      });
      if(url.includes('/tests/photo-reference-test.svg'))return route.fulfill({
        status:200,contentType:'image/svg+xml',body:reference
      });
      return url.startsWith(root+'/')?route.continue():route.abort();
    });
    await page.goto(root+'/index.html',{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>!!window.__yakutskRR&&!!window.state);
    await page.evaluate(()=>{
      // The routing smoke test above checks Chromium's geolocation permission.
      // Here we make individual GPS readings deterministic so photo + reward
      // checks cannot fail because of the headless provider timing out.
      window.__photoTestLat=62.0274;
      Object.defineProperty(navigator.geolocation,'getCurrentPosition',{
        configurable:true,value:success=>success({coords:{
          latitude:window.__photoTestLat,longitude:129.732,accuracy:12,speed:0
        },timestamp:Date.now()})
      });
      const rr=window.__yakutskRR;
      rr.routeId='photo-e2e-gps-2026';rr.startMode='gps';rr.usePhotoOptional=false;
      rr.current=1;rr.stage='photo';rr.currentPhotoFile=null;
      rr.livePos={lat:62.0274,lng:129.732,accuracy:12};
      rr.lastGpsPos=null;rr.lastGpsAt=0;
      rr.checkpoints=[{lat:62.0274,lng:129.732,guideName:'Тестовый памятник'}];
      rr.legs=[{distance:700}];
      rr.currentPoi={type:'test',id:'photo-1',_lat:62.0274,_lng:129.732,
        _referenceUrl:'http://127.0.0.1:8765/tests/photo-reference-test.svg',
        _verifyMode:'image',tags:{name:'Тестовый памятник'}};
      document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='route'));
      document.querySelector('.app').dataset.rrScreen='route';
      document.querySelector('#photoBlock').classList.remove('hidden');
      document.querySelector('#cameraInput').disabled=false;
      document.querySelector('#verifyBtn').classList.remove('hidden');
    });
    async function verify(color,name){
      await page.locator('#cameraInput').setInputFiles({
        name,mimeType:'image/svg+xml',buffer:Buffer.from(svg(color))
      });
      await page.locator('#verifyBtn').click();
      await page.waitForFunction(()=>/^(message (error|success))$/.test(
        document.querySelector('#verificationMessage')?.className||''
      ),null,{timeout:15000});
      return page.evaluate(()=>({
        text:document.querySelector('#verificationMessage').textContent,
        stage:window.__yakutskRR.stage,
        coins:window.state.coins,
        photoEvents:window.__verifiedStats().photos,
        nextVisible:!document.querySelector('#nextBtn').classList.contains('hidden')
      }));
    }
    // Even a matching-looking picture cannot unlock a distant checkpoint.
    await page.evaluate(()=>{window.__photoTestLat=62.035;window.__yakutskRR.lastGpsPos=null});
    const far=await verify('#ea3323','far.svg');
    assert.match(far.text,/слишком далеко/i);
    assert.equal(far.coins,0);
    assert.equal(far.nextVisible,false);
    await page.evaluate(()=>{window.__photoTestLat=62.0274;window.__yakutskRR.lastGpsPos=null});
    const invalid=await verify('#2365ef','wrong.svg');
    assert.match(invalid.text,/не похоже/i);
    assert.equal(invalid.stage,'photo_ready');
    assert.equal(invalid.coins,0);
    assert.equal(invalid.photoEvents,0);
    assert.equal(invalid.nextVisible,false);
    const valid=await verify('#ea3323','correct.svg');
    assert.match(valid.text,/подтверждён/i);
    assert.equal(valid.stage,'verified');
    assert.equal(valid.coins,25);
    assert.equal(valid.photoEvents,1);
    assert.equal(valid.nextVisible,true);
    // Replaying the same photo for the same checkpoint may not mint again.
    await page.evaluate(()=>document.querySelector('#verifyBtn').classList.remove('hidden'));
    await page.locator('#verifyBtn').click();
    await page.waitForTimeout(350);
    const repeat=await page.evaluate(()=>({coins:window.state.coins,photos:window.__verifiedStats().photos}));
    assert.deepEqual(repeat,{coins:25,photos:1});
    assert.equal(errors.filter(e=>/TypeError|ReferenceError/.test(e)).length,0,errors.join(' | '));
    console.log('PHOTO_GPS_BROWSER_OK wrong photo rejected; matching photo accepted; 25 RC once; next leg unlocked');
    await context.close();
  }finally{await browser.close()}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
