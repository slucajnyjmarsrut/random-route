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
    await page.waitForFunction(()=>!document.querySelector('#historyBlock').classList.contains('hidden')
      &&document.querySelectorAll('#questOptions .quest-option').length>=3,null,{timeout:7000});
    const readable=async()=>{
      return page.evaluate(()=>{
        const btn=document.querySelector('#questOptions .quest-option');
        const history=document.querySelector('#historyBlock');
        const css=getComputedStyle(btn),card=getComputedStyle(history);
        return {
          option:btn.textContent.trim(),foreground:css.color,background:css.backgroundColor,
          historyForeground:getComputedStyle(document.querySelector('#historyText')).color,
          historyBackground:card.backgroundColor
        };
      });
    };
    const luminance=color=>{
      const rgb=color.match(/[0-9.]+/g).slice(0,3).map(x=>Number(x)/255);
      const vals=rgb.map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
      return 0.2126*vals[0]+0.7152*vals[1]+0.0722*vals[2];
    };
    const ratio=(a,b)=>{const [l1,l2]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (l1+.05)/(l2+.05)};
    const dark=await readable();
    assert.ok(dark.option.length>=5,'empty quest label under graphite');
    assert.ok(ratio(dark.foreground,dark.background)>=4.5,'quest button not readable in graphite: '+JSON.stringify(dark));
    assert.ok(ratio(dark.historyForeground,dark.historyBackground)>=4.5,'history text not readable in graphite: '+JSON.stringify(dark));
    await page.evaluate(()=>document.documentElement.setAttribute('data-rr-theme','light'));
    const light=await readable();
    assert.ok(ratio(light.foreground,light.background)>=4.5,'quest button unreadable in light theme: '+JSON.stringify(light));
    await page.evaluate(()=>document.documentElement.setAttribute('data-rr-theme','graphite'));
    // Replaying the same photo for the same checkpoint may not mint again.
    await page.evaluate(()=>document.querySelector('#verifyBtn').classList.remove('hidden'));
    await page.locator('#verifyBtn').click();
    await page.waitForTimeout(350);
    const repeat=await page.evaluate(()=>({coins:window.state.coins,photos:window.__verifiedStats().photos}));
    assert.deepEqual(repeat,{coins:25,photos:1});
    // A genuinely matched photo and its event-ledger proof survive reload.
    await page.reload({waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>window.__yakutskRR?.stage==='verified'
      &&!document.querySelector('#historyBlock').classList.contains('hidden'),null,{timeout:13000});
    const resumed=await page.evaluate(()=>({
      proof:window.__yakutskRR.photoProof,
      photos:window.__verifiedStats().photos,
      history:document.querySelector('#historyTitle').textContent,
      quiz:document.querySelectorAll('#questOptions .quest-option').length
    }));
    assert.ok(resumed.proof&&resumed.proof.routeId==='photo-e2e-gps-2026');
    assert.equal(resumed.photos,1);
    assert.match(resumed.history,/Тестовый памятник/);
    assert.ok(resumed.quiz>=3);
    assert.equal(errors.filter(e=>/TypeError|ReferenceError/.test(e)).length,0,errors.join(' | '));
    console.log('PHOTO_GPS_BROWSER_OK wrong photo rejected; matching photo accepted; 25 RC once; next leg unlocked');
    // Regression: a previously saved "photo optional" route with a NAMED
    // checkpoint must still try to show a real reference, not auto-skip it.
    const demo=await context.newPage();
    await demo.route('**/*',route=>{
      const url=route.request().url();
      if(url.includes('commons.wikimedia.org/w/api.php')){
        return route.fulfill({status:200,contentType:'application/json',
          headers:{'access-control-allow-origin':'*'},
          body:JSON.stringify({query:{pages:{1:{imageinfo:[{thumburl:root+'/tests/photo-reference-test.svg'}]}}}})
        });
      }
      if(url.includes('/tests/photo-reference-test.svg')){
        return route.fulfill({status:200,contentType:'image/svg+xml',body:reference});
      }
      return url.startsWith(root+'/')?route.continue():route.abort();
    });
    await demo.goto(root+'/index.html?demo=1',{waitUntil:'domcontentloaded',timeout:20000});
    await demo.waitForFunction(()=>!!window.__yakutskRR);
    await demo.evaluate(()=>{
      const rr=window.__yakutskRR;
      rr.routeId='legacy-optional-circus';rr.usePhotoOptional=true;rr.routeSynthetic=false;
      rr.current=1;rr.stage='walking';rr.startMode='demo';
      rr.checkpoints=[{lat:62.0324,lng:129.7243,guideName:'Государственный цирк Республики Саха (Якутия)'}];
      rr.legs=[{distance:800}];
      document.querySelector('#demoGpsBtn').click();
    });
    await demo.waitForFunction(()=>window.__yakutskRR?.stage==='photo'
      && document.querySelector('#photoTaskReference')?.classList.contains('show'),null,{timeout:15000});
    const named=await demo.evaluate(()=>({
      stage:window.__yakutskRR.stage,
      title:document.querySelector('#checkpointTitle').textContent,
      photoVisible:!document.querySelector('#photoBlock').classList.contains('hidden'),
      gps:document.querySelector('#gpsCheck b').textContent,
      next:!document.querySelector('#nextBtn').classList.contains('hidden')
    }));
    assert.equal(named.stage,'photo');
    assert.match(named.title,/цирк/i);
    assert.equal(named.photoVisible,true);
    assert.equal(named.gps,'Тестовое прибытие');
    assert.equal(named.next,false);
    // A named site with NO verifiable reference must show retry/replace,
    // not "Пропущено" as if the site had no photo requirements.
    await demo.evaluate(()=>{
      const rr=window.__yakutskRR;
      rr.routeId='legacy-optional-fence';rr.currentPoi=null;rr.current=1;
      rr.usePhotoOptional=true;rr.routeSynthetic=false;rr.stage='walking';
      rr.checkpoints=[{lat:62.022376,lng:129.724729,guideName:'Памятная ограда Реального училища'}];
      rr.currentPhotoFile=null;
      // Mimic stale HTML left by an old build; selecting a missing photo
      // MUST hide the old "История: Точка 1" and empty mini-quest.
      document.querySelector('#historyBlock').classList.remove('hidden');
      document.querySelector('#historyTitle').textContent='История: Точка 1';
      document.querySelector('#questBlock').classList.remove('hidden');
      document.querySelector('#demoGpsBtn').click();
    });
    await demo.waitForFunction(()=>window.__yakutskRR?.stage==='photo_unavailable',null,{timeout:18000});
    const noRef=await demo.evaluate(()=>({
      title:document.querySelector('#checkpointTitle').textContent,
      photo:document.querySelector('#photoCheck b').textContent,
      retry:!document.querySelector('#retryPhotoBtn').classList.contains('hidden'),
      history:!document.querySelector('#historyBlock').classList.contains('hidden')
    }));
    assert.match(noRef.title,/Реального училища/);
    assert.match(noRef.photo,/Нет эталона/);
    assert.equal(noRef.retry,true);
    assert.equal(noRef.history,false);
    console.log('PHOTO_NAMED_CHECKPOINT_OK old optional flag cannot skip an available image, missing image offers retry and fake GPS is labeled');
    await demo.close();
    await context.close();
  }finally{await browser.close()}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
