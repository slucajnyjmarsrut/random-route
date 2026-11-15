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
   await page.addInitScript(()=>{
    window.__modelRequests=0;
    Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>({})}});
    const ActualWorker=window.Worker;
    window.Worker=class{
     constructor(url,opts){
      if(!String(url).includes('marshik-ai-worker'))return new ActualWorker(url,opts);
      this.url=url;
     }
     postMessage(msg){
      window.__modelRequests++;
      if(msg.type==='start')setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),0);
      if(msg.type==='ask')setTimeout(()=>this.onmessage?.({data:{type:'answer',text:'Привет! Я локальный Qwen.'}}),0);
     }
     terminate(){}
    };
   });
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#rrAiDialog').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.__modelRequests),0,'model must not load on page entry');
   await page.locator('.rr-ai-home-open').click();
   assert.equal(await page.locator('#rrAiDialog').isVisible(),true);
   assert.equal(await page.locator('#rrAiQuestion').isDisabled(),true,'explicit start/consent');
   await page.locator('#rrAiStart').click();
   await page.waitForFunction(()=>window.RRMarshikAI?.getStatus()?.ready);
   await page.locator('#rrAiQuestion').fill('Как мне начать прогулку?');
   await page.locator('#rrAiSend').click();
   await page.locator('.rr-ai-bubble.assistant').filter({hasText:'Привет! Я локальный Qwen.'}).waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>window.__modelRequests),2,'one model boot and one generated response');
   await page.locator('#rrAiClose').click();
   assert.equal(await page.locator('#rrAiDialog').isVisible(),false);
   await page.locator('#homeOpenCreateBtn').click();
   await page.locator('#create.active').waitFor({state:'visible'});
   await page.locator('.rr-ai-guide-open').click();
   assert.equal(await page.locator('#rrAiDialog').isVisible(),true);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#rrAiDialog').isVisible(),false);
   assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError/.test(x)),[],errors.join(' | '));
   console.log('MARSHIK_QWEN_BROWSER_OK '+device.name+' opt-in, mock worker, replies, coach, close, no interference');
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:375,height:667},serviceWorkers:'block'});
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined}));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8765/index.html?demo=1',{waitUntil:'domcontentloaded'});
  await page.locator('.rr-ai-home-open').click();await page.locator('#rrAiStart').click();
  await page.waitForFunction(()=>document.querySelector('#rrAiStatus')?.textContent.includes('WebGPU недоступен'));
  assert.equal(await page.locator('#rrAiQuestion').isDisabled(),true);
  await page.locator('#rrAiClose').click();
  await page.locator('#homeOpenCreateBtn').click();
  await page.locator('#create.active').waitFor({state:'visible'});
  console.log('MARSHIK_QWEN_UNSUPPORTED_OK no fake AI response, route wizard still works');
 }finally{await browser.close()}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
