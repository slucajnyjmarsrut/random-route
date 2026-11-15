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
   assert.equal(await page.locator('#rrAiStart').isVisible(),true,'one clear action before download');
   assert.equal(await page.locator('#rrAiIntro').isVisible(),true,'show first-launch download cost');
   assert.equal(await page.locator('#rrAiQuestion').isVisible(),false,'hide disabled input for first-time users');
   assert.equal(await page.locator('#rrAiLog').isVisible(),false,'hide empty conversation before first launch');
   assert.equal(await page.locator('#rrAiStatus').isVisible(),false,'no redundant status on initial screen');
   assert.equal(await page.locator('#rrAiStop').isVisible(),false,'no shutdown control before activation');
   assert.equal(await page.locator('#rrAiQuestion').isDisabled(),true,'explicit start/consent');
   await page.locator('#rrAiStart').click();
   await page.waitForFunction(()=>window.RRMarshikAI?.getStatus()?.ready);
   assert.equal(await page.locator('#rrAiIntro').isVisible(),false,'first-launch explanation disappears after model loads');
   assert.equal(await page.locator('#rrAiStart').isVisible(),false,'no start prompt after model is ready');
   assert.equal(await page.locator('#rrAiStatus').isVisible(),false,'do not show repetitive Qwen-ready label');
   assert.equal(await page.locator('#rrAiLog').isVisible(),true);
   assert.equal(await page.locator('#rrAiForm').isVisible(),true);
   assert.equal(await page.locator('#rrAiStop').isVisible(),true);
   assert.equal(await page.locator('#rrAiEmpty').count(),1,'single short greeting');
   await page.locator('#rrAiQuestion').fill('Как мне начать прогулку?');
   await page.locator('#rrAiSend').click();
   await page.locator('.rr-ai-bubble.assistant').filter({hasText:'Привет! Я локальный Qwen.'}).waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>window.__modelRequests),2,'one model boot and one generated response');
   assert.equal(await page.locator('#rrAiEmpty').count(),0,'short greeting disappears after first question');
   assert.equal(await page.locator('#rrAiStatus').isVisible(),false,'no redundant status after reply');
   assert.equal(await page.locator('.rr-ai-footnote').count(),0,'no repeated safety footnote');
   await page.locator('#rrAiClose').click();
   assert.equal(await page.locator('#rrAiDialog').isVisible(),false);
   await page.locator('.rr-ai-home-open').click();
   assert.equal(await page.locator('#rrAiIntro').isVisible(),false,'no repeated first-run notice on reopening');
   await page.locator('#rrAiClose').click();
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
  assert.equal(await page.locator('#rrAiForm').isVisible(),false);
  assert.equal(await page.locator('#rrAiStatus').isVisible(),true,'WebGPU error visible without technical clutter');
  await page.locator('#rrAiClose').click();
  await page.locator('#homeOpenCreateBtn').click();
  await page.locator('#create.active').waitFor({state:'visible'});
  console.log('MARSHIK_QWEN_UNSUPPORTED_OK no fake AI response, route wizard still works');
 }finally{await browser.close()}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
