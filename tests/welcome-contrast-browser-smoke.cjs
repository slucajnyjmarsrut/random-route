'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
function channels(color){
 const found=color.match(/rgba?\(([^)]+)\)/);
 if(!found)throw Error('Unexpected CSS color '+color);
 const nums=found[1].match(/[0-9.]+/g).map(Number);
 return nums.slice(0,3);
}
function luminance(color){
 const linear=channels(color).map(n=>{
  const c=n/255;
  return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
 });
 return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
}
function contrast(a,b){
 const [high,low]=[luminance(a),luminance(b)].sort((a,b)=>b-a);
 return (high+.05)/(low+.05);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const device of [{name:'phone',width:390,height:844,mobile:true},{name:'desktop',width:1440,height:900,mobile:false}]){
   const context=await browser.newContext({
    viewport:{width:device.width,height:device.height},isMobile:device.mobile,
    hasTouch:device.mobile,serviceWorkers:'block'
   });
   const page=await context.newPage();
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.route('**/*',route=>
    route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
   await page.locator('#profileAuthModal.show').waitFor({state:'visible'});
   assert.equal(await page.locator('.rr-entry-emblem').count(),0,'crossed-out compass must be gone');
   assert.equal(await page.locator('.rr-entry-welcome-text small').count(),0,'overline must be gone');
   assert.equal(await page.locator('.rr-entry-note').count(),0,'boxed disclaimer must be gone');
   assert.equal(await page.locator('#authEmail').getAttribute('placeholder'),'name@yandex.ru');
   assert.equal(await page.locator('#authPassword').getAttribute('minlength'),'6');
   assert.equal(await page.locator('#authConfirm').getAttribute('minlength'),'6');
   assert.match(await page.locator('#authNote').innerText(),/только в этом браузере/);
   for(const theme of ['graphite','light']){
    await page.evaluate(theme=>document.documentElement.setAttribute('data-rr-theme',theme),theme);
    const visual=await page.evaluate(()=>{
      const get=id=>{
       const node=document.querySelector(id);
       const css=getComputedStyle(node);
       return {color:css.color,background:css.backgroundColor,rect:node.getBoundingClientRect().toJSON(),text:node.textContent.trim()};
      };
      return {
       title:get('#authTitle'),email:get('#authEmail'),password:get('#authPassword'),
       form:get('.rr-entry-form-wrap'),head:get('.rr-entry-welcome'),foot:get('#authNote')
      };
    });
    assert.ok(contrast(visual.title.color,visual.form.background)>=7,
      theme+' title contrast '+JSON.stringify(visual));
    assert.ok(contrast(visual.email.color,visual.email.background)>=7,
      theme+' email input contrast '+JSON.stringify(visual));
    assert.ok(contrast(visual.password.color,visual.password.background)>=7,
      theme+' password input contrast '+JSON.stringify(visual));
    assert.ok(channels(visual.email.background).every(c=>c>=235),
      theme+' email field must stay bright/white');
    assert.ok(visual.title.rect.width>100,'welcome heading must be visible');
    assert.ok(visual.foot.rect.height<46,'small disclaimer must not be a tall box');
    assert.ok(visual.head.rect.width>=340,'welcome banner must use card width');
    console.log('WELCOME_CONTRAST_OK '+device.name+' '+theme+' title '+contrast(visual.title.color,visual.form.background).toFixed(1)+':1');
   }
   await page.locator('#authRegisterTab').click();
   assert.equal(await page.locator('#authPassword').getAttribute('minlength'),'6');
   await page.locator('#authLoginTab').click();
   assert.equal(await page.locator('#authGuest').isVisible(),true);
   assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,errors.join(' | '));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
