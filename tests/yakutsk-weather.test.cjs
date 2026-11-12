'use strict';
const assert=require('node:assert/strict');
const mod=require('../yakutsk-weather.js');

const fixture={current:{temperature_2m:-24.3,apparent_temperature:-31.5,wind_speed_10m:12.8,
  wind_gusts_10m:17,snowfall:0,precipitation:0,weather_code:3,is_day:0}};
assert.equal(mod.parseOpenMeteo(fixture).current.temperature_2m,-24.3);
assert.equal(mod.parseOpenMeteo(fixture).current.is_day,0);
assert.throws(()=>mod.parseOpenMeteo({}),/temperature/i);
assert.throws(()=>mod.parseOpenMeteo({current:{temperature_2m:null}}),/temperature/i);
assert.equal(mod.tempLabel(-24.3),'-24°C');
assert.equal(mod.tempLabel(2.8),'+3°C');
assert.equal(mod.condition(71,-15),'🌨️ Снег');
assert.match(mod.adviceFor(fixture.current).text,/мороз/i);
const met={properties:{timeseries:[{time:'2026-11-12T11:00:00Z',data:{
 instant:{details:{air_temperature:-21.5,wind_speed:4.0,wind_speed_of_gust:7}},
 next_1_hours:{summary:{symbol_code:'snowshowers_day'}}
}}]}};
assert.equal(mod.parseMetNorway(met).current.wind_speed_10m,14.4);
assert.equal(mod.parseMetNorway(met).current.apparent_temperature,null);
assert.equal(mod.parseMetNorway(met).current.weather_code,71);
assert.throws(()=>mod.parseMetNorway({}),/forecast/i);
assert.equal(mod.metCode('partlycloudy_night'),2);
const mem={};const storage={getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v}};
const now=Date.now();
mem[mod.KEY]=JSON.stringify({forecast:fixture,source:'Open-Meteo',updatedAt:now-10*60*1000});
assert.equal(mod.readCache(storage,now).source,'Open-Meteo');
assert.equal(mod.readCache(storage,now+7*60*60*1000),null);
assert.equal(mod.readCache({getItem(){throw Error('denied')}},now),null);

const nodes=Object.fromEntries(['rrHomeWeatherValue','rrHomeWeatherDetail','rrHomeWeatherAdvice','rrHomeWeatherRefresh']
  .map(k=>[k,{id:k,textContent:'',attributes:{},disabled:false,handlers:{},
   setAttribute(name,v){this.attributes[name]=v;},removeAttribute(name){delete this.attributes[name]},
   addEventListener(k,fn){this.handlers[k]=fn}}]));
const doc={hidden:false,getElementById:id=>nodes[id]||null,addEventListener(){}};
let background=null;
global.window={addEventListener(){},setInterval(){},RRWeatherBackground:{setConditions(v){background=v;}}};
global.localStorage=storage;
let primaryCalls=0,backupCalls=0;
global.fetch=async url=>{
 if(url.includes('open-meteo')){primaryCalls++;return {ok:true,json:async()=>fixture};}
 throw Error('Unexpected URL');
};
async function run(){
 // Force initial auto-fetch by providing no cache before mounting.
 delete mem[mod.KEY];
 mod.mount(doc);
 await mod.refresh();
 assert.ok(primaryCalls>=1,'weather fetch must start without clicking');
 assert.match(nodes.rrHomeWeatherValue.textContent,/-24°C/);
 assert.match(nodes.rrHomeWeatherDetail.textContent,/Open-Meteo/);
 assert.equal(nodes.rrHomeWeatherRefresh.disabled,false);
 assert.equal(background.temperature_2m,-24.3);
 assert.ok(mem[mod.KEY],'weather cache saved');
 let notices=0;const unsubscribe=mod.subscribe(()=>notices++);
 assert.ok(notices>=1);
 global.fetch=async url=>{
   if(url.includes('open-meteo')){primaryCalls++;throw Error('Blocked');}
   backupCalls++;return {ok:true,json:async()=>met};
 };
 const updated=await mod.refresh(true);
 assert.equal(updated.source,'MET Norway');
 assert.equal(updated.forecast.current.temperature_2m,-21.5);
 assert.match(nodes.rrHomeWeatherDetail.textContent,/MET Norway/);
 assert.ok(backupCalls>=1);
 assert.ok(notices>=3);
 global.fetch=async()=>{throw Error('offline')};
 const offline=await mod.refresh(true);
 assert.equal(offline.stale,true);
 assert.equal(offline.forecast.current.temperature_2m,-21.5);
 assert.match(nodes.rrHomeWeatherAdvice.textContent,/Последний сохранённый прогноз/);
 unsubscribe();
 console.log('Yakutsk weather: auto boot, Open-Meteo, MET fallback, timeout-safe errors, cache, UI and scene OK');
}
run().catch(e=>{console.error(e);process.exitCode=1});
