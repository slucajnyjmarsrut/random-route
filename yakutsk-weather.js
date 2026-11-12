/* Self-contained Yakutsk weather widget: runs even when the optional safety layer fails.
 * Weather is for the CITY of Yakutsk, never inferred from the device's GPS.
 * Primary: Open-Meteo current values. Backup: MET Norway hourly forecast.
 * Cache avoids unnecessary API calls, stale values are explicitly labelled.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.RRYakutskWeather=api;
   if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",()=>api.mount(root.document),{once:true});
   else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const CITY={lat:62.03545,lon:129.6755},KEY="rr_yakutsk_weather_v2",CACHE_TTL=6*60*60*1000,FRESH_TTL=20*60*1000;
const subscriptions=new Set();
let current={forecast:null,source:null,updatedAt:0,loading:false,error:null,stale:false};
let mounted=false,inFlight=null,docRef=null;
function numberOrNull(x){return x===null||x===undefined||x===""?null:Number.isFinite(Number(x))?Number(x):null;}
function validTemperature(x){const v=numberOrNull(x);return v!==null&&v>=-90&&v<=65?v:null;}
function normalizedForecast(currentRaw){
 if(!currentRaw||typeof currentRaw!=="object")throw Error("Missing weather values");
 const t=validTemperature(currentRaw.temperature_2m);
 if(t===null)throw Error("Invalid temperature");
 return {current:{
  temperature_2m:t,
  apparent_temperature:validTemperature(currentRaw.apparent_temperature),
  wind_speed_10m:numberOrNull(currentRaw.wind_speed_10m),
  wind_gusts_10m:numberOrNull(currentRaw.wind_gusts_10m),
  snowfall:numberOrNull(currentRaw.snowfall),
  precipitation:numberOrNull(currentRaw.precipitation),
  weather_code:numberOrNull(currentRaw.weather_code),
  is_day:numberOrNull(currentRaw.is_day)
 }};
}
function parseOpenMeteo(json){
 return normalizedForecast(json?.current);
}
function metCode(symbol){
 const c=String(symbol||"").toLowerCase();
 if(c.includes("snow")||c.includes("sleet"))return 71;
 if(c.includes("rain")||c.includes("drizzle"))return 61;
 if(c.includes("fog"))return 45;
 if(c.includes("cloudy"))return c.includes("partly")?2:3;
 if(c.includes("fair"))return 1;
 if(c.includes("clearsky"))return 0;
 return null;
}
function parseMetNorway(json){
 const entries=json?.properties?.timeseries;
 if(!Array.isArray(entries)||!entries.length)throw Error("No forecast points");
 const first=entries[0],d=first?.data?.instant?.details||{};
 const temperature=validTemperature(d.air_temperature);
 if(temperature===null)throw Error("No air temperature");
 const wind=numberOrNull(d.wind_speed),gust=numberOrNull(d.wind_speed_of_gust);
 const summary=first?.data?.next_1_hours?.summary||first?.data?.next_6_hours?.summary||{};
 const symbol=String(summary.symbol_code||"");
 // A full-day is_day field is unavailable from MET; leave it unknown rather than guessing.
 return normalizedForecast({
  temperature_2m:temperature,apparent_temperature:null,
  wind_speed_10m:wind!==null?Math.round(wind*3.6*10)/10:null,
  wind_gusts_10m:gust!==null?Math.round(gust*3.6*10)/10:null,
  snowfall:null,precipitation:null,weather_code:metCode(symbol),is_day:null
 });
}
function snapshot(){return {...current};}
function notify(){
 const value=snapshot();render(docRef,value);
 for(const listener of subscriptions)try{listener(value)}catch(e){console.warn("Weather listener",e);}
 if(typeof window!=="undefined"&&window.RRWeatherBackground)
   try{window.RRWeatherBackground.setConditions(value.forecast?.current||null)}catch(e){}
}
function subscribe(fn){
 if(typeof fn!=="function")return ()=>{};
 subscriptions.add(fn);fn(snapshot());return ()=>subscriptions.delete(fn);
}
function readCache(storage,now=Date.now()){
 try{
  const x=JSON.parse(storage?.getItem(KEY)||"null");
  if(!x||!x.forecast||!Number.isFinite(x.updatedAt)||now-x.updatedAt<0||now-x.updatedAt>CACHE_TTL)return null;
  return {forecast:normalizedForecast(x.forecast.current),source:String(x.source||"Кэш"),updatedAt:x.updatedAt};
 }catch(e){return null;}
}
function storeCache(storage,data){
 try{storage?.setItem(KEY,JSON.stringify(data));}catch(e){}
}
function cityTime(dateMillis){
 try{return new Date(dateMillis).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Yakutsk"});}
 catch(e){return "";}
}
function tempLabel(t){const n=numberOrNull(t);return n===null?"—":(Math.round(n)>0?"+":"")+Math.round(n)+"°C";}
function condition(code,t){
 if([71,73,75,77,85,86].includes(code))return "🌨️ Снег";
 if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code))return "🌧️ Дождь или осадки";
 if([45,48].includes(code))return "🌫️ Туман";
 if([2,3].includes(code))return "☁️ Облачно";
 if([0,1].includes(code))return "☀️ Ясно";
 return t!==null&&t<=0?"❄️ Морозная погода":"Погода в Якутске";
}
function adviceFor(c){
 const feels=numberOrNull(c.apparent_temperature),t=numberOrNull(c.temperature_2m),
   effective=feels===null?t:feels,wind=numberOrNull(c.wind_gusts_10m);
 if(effective!==null&&effective<=-35)return {text:"Очень сильный мороз. Лучше отложить прогулку.",severity:"critical"};
 if(effective!==null&&effective<=-25)return {text:"Сильный мороз. Не гуляйте долго и выбирайте тёплую одежду.",severity:"warn"};
 if(wind!==null&&wind>=45)return {text:"Сильные порывы ветра. Учитывайте их перед выходом.",severity:"warn"};
 if(effective!==null&&effective<=-15)return {text:"Холодно. Одевайтесь тепло и следите за самочувствием.",severity:"warn"};
 return {text:"Проверьте дорожки и одевайтесь по погоде.",severity:""};
}
function render(doc,state=current){
 if(!doc)return;
 const value=doc.getElementById("rrHomeWeatherValue"),detail=doc.getElementById("rrHomeWeatherDetail"),
   advice=doc.getElementById("rrHomeWeatherAdvice"),refresh=doc.getElementById("rrHomeWeatherRefresh");
 if(!value||!detail||!advice)return;
 if(refresh){refresh.disabled=!!state.loading;refresh.setAttribute("aria-busy",String(!!state.loading));}
 advice.removeAttribute("data-severity");
 if(!state.forecast){
   value.textContent=state.loading?"Загружаем погоду…":"Не удалось загрузить погоду";
   detail.textContent=state.loading?"Якутск · получаем свежий прогноз":"Нет соединения с погодными сервисами";
   advice.textContent=state.loading?"Прогноз обновится автоматически.":"Нажмите «Обновить». Перед выходом проверьте погоду другим способом.";
   if(!state.loading)advice.setAttribute("data-severity","warn");
   return;
 }
 const c=state.forecast.current,info=adviceFor(c),checked=cityTime(state.updatedAt);
 value.textContent=tempLabel(c.temperature_2m)+" · "+condition(c.weather_code,c.temperature_2m);
 detail.textContent=(c.apparent_temperature===null?"":"Ощущается "+tempLabel(c.apparent_temperature)+" · ")+
  "ветер "+(c.wind_speed_10m===null?"—":Math.round(c.wind_speed_10m)+" км/ч")+
  (checked?" · "+checked:"")+" · "+(state.source||"Прогноз");
 const stale=!!state.stale||!!state.error;
 advice.textContent=stale?"Последний сохранённый прогноз. Свежие данные пока недоступны. "+info.text:info.text;
 if(stale||info.severity)advice.setAttribute("data-severity",stale?"warn":info.severity);
}
function urlOpenMeteo(){
 return "https://api.open-meteo.com/v1/forecast?latitude="+CITY.lat+"&longitude="+CITY.lon+
 "&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,snowfall,precipitation,weather_code,is_day"+
 "&timezone=Asia%2FYakutsk&forecast_days=1";
}
function urlMetNorway(){
 return "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat="+CITY.lat.toFixed(4)+"&lon="+CITY.lon.toFixed(4);
}
async function requestJson(url,timeoutMs,fetcher=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(url,{signal:controller.signal,cache:"no-store",mode:"cors"});
  if(!response.ok)throw Error("HTTP "+response.status);
  return await response.json();
 }finally{clearTimeout(timer);}
}
async function refresh(force=false){
 if(inFlight)return inFlight;
 const storage=typeof localStorage!=="undefined"?localStorage:null;
 if(!force&&current.forecast&&!current.error&&Date.now()-current.updatedAt<FRESH_TTL)return snapshot();
 current={...current,loading:true,error:null};notify();
 inFlight=(async()=>{
   let result=null,source="",error=null;
   try{result=parseOpenMeteo(await requestJson(urlOpenMeteo(),6500));source="Open-Meteo";}
   catch(e){
     error=e;
     try{result=parseMetNorway(await requestJson(urlMetNorway(),6500));source="MET Norway";error=null;}
     catch(backup){error=backup;}
   }
   if(result){
     const updatedAt=Date.now();
     current={forecast:result,source,updatedAt,loading:false,error:null,stale:false};
     storeCache(storage,{forecast:result,source,updatedAt});
   }else{
     current={...current,loading:false,error:error?.message||"Unavailable",stale:!!current.forecast};
   }
   notify();
   return snapshot();
 })();
 try{return await inFlight;}finally{inFlight=null;}
}
function mount(doc){
 if(mounted)return;
 mounted=true;docRef=doc;
 const button=doc.getElementById("rrHomeWeatherRefresh");
 if(button)button.addEventListener("click",()=>{refresh(true);});
 const storage=typeof localStorage!=="undefined"?localStorage:null;
 const saved=readCache(storage);
 if(saved)current={...current,...saved,stale:Date.now()-saved.updatedAt>FRESH_TTL};
 notify();
 refresh(false);
 // Free forecast APIs should not be polled aggressively.
 if(typeof window!=="undefined"){
   window.addEventListener("online",()=>refresh(false));
   doc.addEventListener("visibilitychange",()=>{if(!doc.hidden)refresh(false);});
   window.setInterval(()=>{if(!doc.hidden)refresh(false);},30*60*1000);
 }
}
return {CITY,KEY,parseOpenMeteo,parseMetNorway,metCode,tempLabel,condition,adviceFor,readCache,snapshot,subscribe,render,refresh,mount};
});
