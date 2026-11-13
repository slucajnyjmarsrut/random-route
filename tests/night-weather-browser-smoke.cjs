'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const weather=require('../yakutsk-weather.js');
// Clear sky is a condition, not a guarantee of sunshine at night.
assert.equal(weather.condition(0,-24,0),'🌙 Ясно');
assert.equal(weather.condition(1,-24,1),'☀️ Ясно');
assert.equal(weather.condition(0,-24,null),'Ясно');
const met=symbol=>weather.parseMetNorway({properties:{timeseries:[{
  data:{instant:{details:{air_temperature:-24,wind_speed:2}},
    next_1_hours:{summary:{symbol_code:symbol}}}
}]}});
assert.equal(met('clearsky_night').current.is_day,0);
assert.equal(met('clearsky_day').current.is_day,1);
assert.equal(met('clearsky').current.is_day,null);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];let night=true;
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('**/*',route=>{
     const u=route.request().url();
     if(u.includes('api.open-meteo.com/v1/forecast')){
       return route.fulfill({status:200,contentType:'application/json',
         headers:{'access-control-allow-origin':'*'},
         body:JSON.stringify({current:{
           temperature_2m:-24,apparent_temperature:-29,
           wind_speed_10m:8,wind_gusts_10m:14,snowfall:0,
           precipitation:0,weather_code:0,is_day:night?0:1
         }})
       });
     }
     return u.startsWith('http://127.0.0.1:8765/')?route.continue():route.abort();
   });
   await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForFunction(()=>
     document.querySelector('#rrHomeWeatherValue')?.textContent.includes('🌙 Ясно')
     &&document.querySelector('.app')?.getAttribute('data-weather-night')==='true',{timeout:12000});
   await page.waitForFunction(()=>{
     const moon=document.querySelector('.rr-wb-moon'),sun=document.querySelector('.rr-wb-sun');
     return moon&&sun&&getComputedStyle(moon).opacity==='1'&&getComputedStyle(sun).opacity==='0';
   },null,{timeout:5000});
   const nighttime=await page.evaluate(()=>({
     weather:document.querySelector('#rrHomeWeatherValue').textContent,
     night:document.querySelector('.app').dataset.weatherNight,
     moonOpacity:getComputedStyle(document.querySelector('.rr-wb-moon')).opacity,
     sunOpacity:getComputedStyle(document.querySelector('.rr-wb-sun')).opacity
   }));
   assert.equal(nighttime.night,'true');
   assert.equal(nighttime.moonOpacity,'1');
   assert.equal(nighttime.sunOpacity,'0');
   assert.doesNotMatch(nighttime.weather,/☀️/);
   night=false;
   await page.evaluate(()=>window.RRYakutskWeather.refresh(true));
   await page.waitForFunction(()=>
     document.querySelector('#rrHomeWeatherValue')?.textContent.includes('☀️ Ясно')
     &&document.querySelector('.app')?.getAttribute('data-weather-night')==='false',{timeout:12000});
   await page.waitForFunction(()=>{
     const moon=document.querySelector('.rr-wb-moon'),sun=document.querySelector('.rr-wb-sun');
     return moon&&sun&&getComputedStyle(moon).opacity==='0';
   },null,{timeout:5000});
   const daytime=await page.evaluate(()=>({
     weather:document.querySelector('#rrHomeWeatherValue').textContent,
     night:document.querySelector('.app').dataset.weatherNight,
     moonOpacity:getComputedStyle(document.querySelector('.rr-wb-moon')).opacity
   }));
   assert.equal(daytime.night,'false');
   assert.equal(daytime.moonOpacity,'0');
   assert.equal(errors.filter(x=>/TypeError|ReferenceError/.test(x)).length,0,errors.join(' | '));
   console.log('NIGHT_WEATHER_BROWSER_OK clear night = moon both weather card and background; day = sun; MET fallback day/night');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
