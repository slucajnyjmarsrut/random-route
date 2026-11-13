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
       form:get('.rr-entry-form-wrap'),head:get('.rr-entry-welcome'),foot:get('#authNote'),
       tabs:get('.rr-entry-tabs'),activeTab:get('.rr-entry-tabs .auth-tab.active'),
       guest:get('#authGuest'),description:get('#authDescription'),
       gradient:getComputedStyle(document.querySelector('.rr-entry-welcome')).backgroundImage,
       sheet:getComputedStyle(document.querySelector('.rr-entry-sheet')).backgroundColor,
       scheme:getComputedStyle(document.querySelector('.rr-entry-form-wrap')).colorScheme
      };
    });
    assert.ok(contrast(visual.title.color,visual.form.background)>=7,
      theme+' title contrast '+JSON.stringify(visual));
    assert.ok(contrast(visual.email.color,visual.email.background)>=7,
      theme+' email input contrast '+JSON.stringify(visual));
    assert.ok(contrast(visual.password.color,visual.password.background)>=7,
      theme+' password input contrast '+JSON.stringify(visual));
    const DARK='rgb(33, 52, 58)';
    const BRIGHTNESS_LIMIT=105;
    for(const [name,part] of [
       ['card',{background:visual.sheet}],['form',visual.form],['email input',visual.email],
       ['password input',visual.password],['tabs',visual.tabs],['guest button',visual.guest]
    ]){
      assert.ok(channels(part.background).every(x=>x<BRIGHTNESS_LIMIT),
        theme+' '+name+' must stay dark and comfortable at night: '+JSON.stringify(part));
    }
    assert.equal(visual.scheme,'dark',theme+' form must use native dark controls');
    assert.ok(contrast(visual.activeTab.color,visual.activeTab.background)>=4.5,
      theme+' active tab must remain readable');
    assert.ok(contrast(visual.guest.color,visual.guest.background)>=7,
      theme+' guest button must remain readable');
    assert.ok(contrast(visual.description.color,visual.form.background)>=4.5,
      theme+' description must remain readable');
    assert.ok(visual.title.rect.width>100,'welcome heading must be visible');
    assert.match(visual.gradient,/linear-gradient\(/,'header must blend gradually, not end in a bright stripe');
    assert.match(visual.gradient,/rgb\(33, 52, 58\) 100%/,'gradient must finish in same dark color as form');
    assert.equal(visual.form.background,DARK,'form must be dark muted teal');
    assert.equal(visual.sheet,DARK,'card and form must share seamless dark surface');
    assert.ok(Math.abs(visual.head.rect.bottom-visual.form.rect.top)<2,'no gap between header and form');
    assert.ok(visual.head.rect.height>=105,'gradient needs enough room to fade');
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
