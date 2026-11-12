
/* Smart Route NPK 2026 — safety/real-weather layer.
 * Uses Yakutsk city forecast; never uploads GPS or claims segment safety.
 * Works independently from route generator, route coins, and photo checkpoints.
 */
(function(){
"use strict";
var KEY="rr_safety_preferences_v1";
var CITY={lat:62.03545,lon:129.6755,label:"Якутск"};
var defaults={weather:true,darkness:true,animatedBackground:true};
var prefs=defaults;
try {prefs=Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(_){}
var latest=null, lastChecked=null, busy=false;
function get(id){return document.getElementById(id);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(_){}}
function el(tag,cls,text){var x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
function makeCard(suffix){
  var card=el("section","srs-card");card.id="srs-"+suffix;card.setAttribute("aria-label","Безопасность прогулки");
  var header=el("div","srs-head");header.append(el("strong",null,"🛡️ Безопасная прогулка"),el("span","srs-tag","Smart Route • НПК"));card.append(header);
  card.append(el("p","srs-intro","Проверяйте погоду и условия до выхода. Маршруты по-прежнему строятся по пешеходным дорогам; участки, которые вы запретили, исключаются существующим генератором."));
  var status=el("div","srs-status");status.id="srs-status-"+suffix;status.setAttribute("aria-live","polite");card.append(status);
  var weather=el("div","srs-weather");var info=el("div");var title=el("b");title.id="srs-weather-"+suffix;title.textContent="Получаем погоду…";
  var detail=el("small");detail.id="srs-detail-"+suffix;detail.textContent="Текущие условия в Якутске, а не на каждом участке";
  info.append(title,detail);
  var refresh=el("button","srs-refresh","↻ Обновить");refresh.type="button";refresh.addEventListener("click",refreshForecast);weather.append(info,refresh);card.append(weather);
  var alerts=el("div","srs-alerts");alerts.id="srs-alerts-"+suffix;alerts.setAttribute("aria-live","polite");card.append(alerts);
  var opt=el("div","srs-options");
  [["weather","Погодные предупреждения"],["darkness","Предупреждать о темноте"],["animatedBackground","Движущийся погодный фон"]].forEach(function(k){
    var lab=el("label");var box=el("input");box.type="checkbox";box.checked=!!prefs[k[0]];
    box.addEventListener("change",function(){prefs[k[0]]=box.checked;persist();document.querySelectorAll("[data-srs-pref='"+k[0]+"']").forEach(function(e){e.checked=box.checked;});render();});
    box.setAttribute("data-srs-pref",k[0]);lab.append(box,document.createTextNode(k[1]));opt.append(lab);
  });card.append(opt);
  var actions=el("div","srs-actions");
  var avoid=el("button","srs-action","🚫 Исключить опасный участок");avoid.type="button";avoid.addEventListener("click",function(){
    var activeRoute=!!(window.__yakutskRR?.legs?.length && !["idle","completed"].includes(window.__yakutskRR.stage));
    var useRoute=suffix==="route"||activeRoute;
    var target=get(useRoute?"avoidRerouteBtn":"avoidHomeCard");
    if(useRoute&&target)target=target.closest(".route-avoid-inline")||target;
    if(!useRoute){const extra=get("createMapDetails");if(extra)extra.open=true;}
    if(typeof window.__rrOpenScreen==="function")window.__rrOpenScreen(useRoute?"route":"create",{restoreScroll:false});
    if(target)requestAnimationFrame(function(){target.scrollIntoView({behavior:"smooth",block:"center"});});
  });
  var sos=el("button","srs-action srs-sos","SOS · 112");sos.type="button";sos.addEventListener("click",function(){
    if(window.confirm("Открыть приложение телефона для звонка 112? Звонок не выполняется автоматически.")){
      window.location.href="tel:112";
    }
  });
  actions.append(avoid,sos);card.append(actions);
  card.append(el("p","srs-foot","Проверка OpenStreetMap показывает только внесённые в карту сведения и не гарантирует работающие фонари, очищенные тротуары или отсутствие гололёда сегодня. SOS только открывает набор номера."));
  return card;
}
function insert(){
  var safetyScreen=get("safety"), route=document.querySelector("#route .route-summary");
  if(safetyScreen&&!get("srs-home"))safetyScreen.appendChild(makeCard("home"));
  if(route&&!get("srs-route"))route.insertAdjacentElement("afterend",makeCard("route"));
}
function addAlert(target,severity,message){var a=el("div","srs-alert "+severity,message);target.append(a);}
function n(v){if(v===null||v===undefined||v==="")return null;return Number.isFinite(Number(v))?Number(v):null;}
function fmt(v){return v==null?"—":Math.round(v)+"°C";}
function renderCard(suffix){
  var st=get("srs-status-"+suffix),w=get("srs-weather-"+suffix),d=get("srs-detail-"+suffix),a=get("srs-alerts-"+suffix);
  if(!st||!w||!a)return;
  a.replaceChildren();
  st.textContent=suffix==="route"
   ?"Проверка улиц: используйте кнопку «Проверить маршрут по OSM» ниже"
   :"Погода по Якутску. Данные улиц можно проверить после построения маршрута.";
  if(!latest){
    w.textContent=busy?"Получаем прогноз…":"Погода недоступна";
    d.textContent=busy?"Запрос к Open-Meteo":"Проверьте прогноз перед прогулкой";
    addAlert(a,"unknown","Прогноз временно недоступен. Проверить отмеченные в OSM тротуары и фонари можно после построения маршрута.");
    return;
  }
  var c=latest.current||{},t=n(c.temperature_2m),feel=n(c.apparent_temperature),wind=n(c.wind_speed_10m),gust=n(c.wind_gusts_10m),snow=n(c.snowfall);
  w.textContent="🌡️ "+fmt(t)+" · ощущается "+fmt(feel);
  d.textContent="Якутск · ветер "+(wind===null?"—":Math.round(wind)+" км/ч")+" · обновлено "+(lastChecked||"сейчас");
  if(prefs.weather){
    if(feel!==null&&feel<=-35)addAlert(a,"critical","Сильный холод по ощущению (≤ −35 °C). Подумайте о переносе прогулки и сокращении времени на улице.");
    else if(feel!==null&&feel<=-25)addAlert(a,"warn","Сильный мороз: ограничьте длительность прогулки, возьмите тёплую одежду и проверьте возможность обогрева.");
    else if(feel!==null&&feel<=-15)addAlert(a,"warn","Холодная погода. Следите за временем и самочувствием.");
    if(gust!==null&&gust>=45)addAlert(a,"warn","Порывы ветра от "+Math.round(gust)+" км/ч. На открытых участках может быть некомфортно.");
    if(snow!==null&&snow>0)addAlert(a,"warn","Идёт снег. Состояние тротуаров и наличие льда по этим данным неизвестны.");
  }
  if(prefs.darkness && (c.is_day===0 || c.is_day==="0"))addAlert(a,"warn","Сейчас темно. Проверьте доступные отметки об освещении маршрута по OSM и обязательно оцените реальные условия на месте.");
  if(suffix==="home")addAlert(a,"unknown","Ниже после построения маршрута доступна проверка улиц по данным OpenStreetMap. Состояние снега, льда и происшествия сервис не подтверждает.");
}
function renderHomeWeather(){
  var title=get("rrHomeWeatherValue"),detail=get("rrHomeWeatherDetail"),advice=get("rrHomeWeatherAdvice");
  if(!title||!detail||!advice)return;
  advice.removeAttribute("data-severity");
  if(!latest){
    title.textContent=busy?"Узнаём погоду…":"Прогноз недоступен";
    detail.textContent=busy?"Получаем данные для Якутска":"Нажмите «Обновить» или посмотрите прогноз перед выходом";
    advice.textContent="Погода может влиять на безопасность прогулки.";
    return;
  }
  var c=latest.current||{},temp=n(c.temperature_2m),feels=n(c.apparent_temperature),wind=n(c.wind_speed_10m),gust=n(c.wind_gusts_10m);
  title.textContent="🌡️ "+fmt(temp);
  detail.textContent="Ощущается "+fmt(feels)+" · ветер "+(wind===null?"—":Math.round(wind)+" км/ч")+
    (lastChecked?" · обновлено "+lastChecked:"");
  var message="Проверьте состояние дорожек и одевайтесь по погоде.",severity="";
  if(feels!==null&&feels<=-35){message="Очень сильный мороз. Лучше отложить прогулку.";severity="critical";}
  else if(feels!==null&&feels<=-25){message="Сильный мороз. Не проводите долгое время на улице.";severity="warn";}
  else if(feels!==null&&feels<=-15){message="Холодно. Одевайтесь тепло и следите за самочувствием.";severity="warn";}
  if(gust!==null&&gust>=45){message="Сильные порывы ветра. Продумайте, стоит ли выходить.";severity="warn";}
  if(c.is_day===0||c.is_day==="0")message+=" Сейчас темно.";
  advice.textContent=message;
  if(severity)advice.setAttribute("data-severity",severity);
}
function render(){
  renderCard("home");renderCard("route");if(!window.RRYakutskWeather)renderHomeWeather();
  // The ambient scene consumes the SAME forecast as safety warnings.
  // If the external service fails, the background becomes neutral.
  if(window.RRWeatherBackground){
    window.RRWeatherBackground.setAnimationEnabled(prefs.animatedBackground!==false);
    window.RRWeatherBackground.setConditions(latest?.current||null);
  }
}
async function refreshForecast(){
  if(window.RRYakutskWeather)return window.RRYakutskWeather.refresh(true);
  if(busy)return;busy=true;render();
  try{
    var url="https://api.open-meteo.com/v1/forecast?latitude="+CITY.lat+"&longitude="+CITY.lon+
      "&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,snowfall,precipitation,weather_code,is_day"+
      "&timezone=Asia%2FYakutsk&forecast_days=1";
    var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},9000);
    var res;
    try{res=await fetch(url,{signal:controller.signal,cache:"no-store"});}finally{clearTimeout(timeout);}
    if(!res.ok)throw Error("HTTP "+res.status);
    var json=await res.json();if(!json||!json.current)throw Error("No current forecast");
    latest=json;lastChecked=new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Yakutsk"});
  }catch(_){latest=null;lastChecked=null;}
  finally{busy=false;render();}
}
function boot(){
  insert();
  var homeRefresh=get("rrHomeWeatherRefresh");
  if(homeRefresh)homeRefresh.addEventListener("click",refreshForecast);
  document.querySelectorAll("#settings [data-srs-pref]").forEach(function(box){
    var key=box.getAttribute("data-srs-pref");
    if(!Object.prototype.hasOwnProperty.call(defaults,key))return;
    box.checked=!!prefs[key];
    box.addEventListener("change",function(){
      prefs[key]=box.checked;persist();
      document.querySelectorAll("[data-srs-pref='"+key+"']").forEach(function(other){other.checked=box.checked;});
      render();
    });
  });
  if(window.RRYakutskWeather){
    window.RRYakutskWeather.subscribe(function(snapshot){
      latest=snapshot.forecast;
      lastChecked=snapshot.updatedAt?new Date(snapshot.updatedAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Yakutsk"}):null;
      busy=!!snapshot.loading;
      render();
    });
  }else{
    render();refreshForecast();
  }
  var route=get("route");if(route){new MutationObserver(function(){if(route.classList.contains("active"))render();}).observe(route,{attributes:true,attributeFilter:["class"]});}
}
window.SmartSafety={getPreferences:function(){return Object.assign({},prefs);},refresh:refreshForecast};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
