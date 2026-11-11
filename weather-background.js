/* Случайный маршрут — animated weather scenery (Yakutsk Open-Meteo conditions).
 * The forecast is already fetched by smart-safety.js; no extra request, GPS or cookies.
 * If current weather is unknown, show NEUTRAL visuals, never fabricate sunshine.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.RRWeatherBackground=api;
   if(root.document.readyState==="loading")
     root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document);},{once:true});
   else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const SNOW_CODES=new Set([71,73,75,77,85,86]);
const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const CLOUD_CODES=new Set([2,3,45,48]);
const modes={
 unknown:{icon:"◌",label:"Данные о погоде загружаются",name:"Нейтральный фон"},
 sun:{icon:"☀️",label:"Ясно",name:"Солнце и зелень"},
 cloud:{icon:"☁️",label:"Облачно",name:"Облачное небо"},
 rain:{icon:"🌧️",label:"Осадки: дождь",name:"Дождливое небо"},
 snow:{icon:"🌨️",label:"Осадки: снег",name:"Снегопад"},
 winter:{icon:"❄️",label:"Морозная погода",name:"Зимний фон"}
};
function n(v){return v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;}
function classify(current){
 if(!current||typeof current!=="object")return {mode:"unknown",night:false};
 const t=n(current.temperature_2m),code=n(current.weather_code),
       snow=n(current.snowfall),precip=n(current.precipitation),isDay=n(current.is_day);
 // A missing number of temperature / weather observations is NOT evidence of clear sky.
 if(t===null&&code===null&&snow===null&&precip===null)
   return {mode:"unknown",night:false};
 const night=isDay===0;
 // Explicit observations outrank temperature. Cold alone means a winter ILLUSTRATION,
 // never a claim that snow is currently falling or lying on a sidewalk.
 if((snow!==null&&snow>0)||SNOW_CODES.has(code))return {mode:"snow",night};
 if(RAIN_CODES.has(code)||(precip!==null&&precip>0))
   return {mode:t!==null&&t<=0?"winter":"rain",night};
 if(t!==null&&t<=0)return {mode:"winter",night};
 if(CLOUD_CODES.has(code))return {mode:"cloud",night};
 if(code===0||code===1)return {mode:"sun",night};
 return {mode:"cloud",night};
}
function sceneLabel(state){
 const base=modes[state?.mode]||modes.unknown;
 return state?.mode==="unknown"?"◌ Погода Якутска: нет данных":
   base.icon+" Якутск · "+base.label+(state.night?" · ночь":"");
}
function mount(doc){
 const app=doc.querySelector(".app");
 if(!app)return;
 let scene=doc.getElementById("rrWeatherScene");
 if(!scene){
   scene=doc.createElement("div");
   scene.id="rrWeatherScene";scene.className="rr-weather-scene";
   scene.setAttribute("aria-hidden","true");
   const pieces=[
     ["rr-wb-sun",""],["rr-wb-moon",""],["rr-wb-cloud rr-wb-cloud-a",""],
     ["rr-wb-cloud rr-wb-cloud-b",""],["rr-wb-cloud rr-wb-cloud-c",""],
     ["rr-wb-hill rr-wb-hill-far",""],["rr-wb-hill rr-wb-hill-near",""],
     ["rr-wb-grass",""],["rr-wb-particles",""]
   ];
   for(const [cls] of pieces){const item=doc.createElement("div");item.className=cls;scene.appendChild(item);}
   const flakes=scene.querySelector(".rr-wb-particles");
   // Deterministic tiny number of spans; GPU transform + pointer-events:none.
   for(let i=0;i<18;i++){
      const dot=doc.createElement("i");
      dot.style.setProperty("--x",String((i*37+9)%100)+"%");
      dot.style.setProperty("--delay",String((i*7)%19/-2)+"s");
      dot.style.setProperty("--dur",String(7+i%6*1.4)+"s");
      flakes.appendChild(dot);
   }
   app.insertBefore(scene,app.firstChild);
 }
 let chip=doc.getElementById("rrWeatherSceneLabel");
 const hero=doc.querySelector("#home .hero");
 if(hero&&!chip){
   chip=doc.createElement("span");chip.id="rrWeatherSceneLabel";
   chip.className="rr-weather-label";
   chip.textContent="◌ Погода Якутска: нет данных";
   hero.appendChild(chip);
 }
 let animated=true,initialized=false;
 function apply(state){
   const x=state&&modes[state.mode]?state:{mode:"unknown",night:false};
   app.setAttribute("data-weather-mode",x.mode);
   app.setAttribute("data-weather-night",x.night?"true":"false");
   app.setAttribute("data-weather-animation",animated?"on":"off");
   if(chip)chip.textContent=sceneLabel(x);
   initialized=true;
 }
 api.setConditions=function(current){api.current=classify(current);apply(api.current);};
 api.setAnimationEnabled=function(yes){animated=!!yes;if(initialized)apply(api.current);};
 api.getVisualState=function(){return api.current||{mode:"unknown",night:false};};
 apply({mode:"unknown",night:false});
 if(window.SmartSafety?.getPreferences){
   const s=window.SmartSafety.getPreferences();
   api.setAnimationEnabled(s.animatedBackground!==false);
 }
}
const api={classify,sceneLabel,modes,mount};
return api;
});
