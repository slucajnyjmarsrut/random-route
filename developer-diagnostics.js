/* Honest tester-only diagnostics. Does not mutate profile, rewards or GPS state.
 * Uses public runtime hooks from the existing app and tests real services on demand.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.RRDeveloperDiagnostics=api;
   if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document);},{once:true});
   else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
"use strict";
function classify(value,warning=""){
 if(value===true)return {kind:"ok",title:"Работает"};
 if(value===false)return {kind:"error",title:"Ошибка"};
 return {kind:"unknown",title:warning||"Не проверено"};
}
function summarizeCatalog(c){
 if(!c||!Number.isFinite(c.listed)||!Number.isFinite(c.available))return [];
 return [
  ["Город",String(c.city||"Якутск")],
  ["Всего в каталоге",String(c.listed)],
  ["Включены в приложение",String(c.available)],
  ["Исключены из каталога",String(c.disabled)],
  ["С координатами в Якутске",String(c.withCoordinates)],
  ["С указанным источником",String(c.withReference)],
  ["С прямой ссылкой на фото",String(c.photoReferences)]
 ];
}
function makeCheck(name,state,description){
 return {name,kind:classify(state).kind,text:String(description||"")};
}
async function withTimeout(work,ms){
 const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Превышено время ожидания "+Math.round(ms/1000)+" с")),ms));
 return Promise.race([Promise.resolve().then(work),timeout]);
}
async function checkHTTP(url,validate,ms=9000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
 try{
   const res=await fetch(url,{cache:"no-store",signal:controller.signal});
   if(!res.ok)throw Error("HTTP "+res.status);
   const payload=await res.text();
   if(!validate(payload))throw Error("Ответ не соответствует ожидаемому формату");
   return true;
 }finally{clearTimeout(timer);}
}
function mount(doc){
 const panel=doc.getElementById("developerDiagnostics"),
 counts=doc.getElementById("developerCityCounts"),
 results=doc.getElementById("developerCheckResults");
 const checkBtn=doc.getElementById("developerRunChecks"),
 poiBtn=doc.getElementById("developerCheckPoi");
 if(!panel||!counts||!results||!checkBtn||!poiBtn)return;
 const developer=()=>window.__isDeveloperMode?.()===true;
 function entry(parent,label,value,cls){
   const row=doc.createElement("div");row.className="devdiag-row"+(cls?" "+cls:"");
   const name=doc.createElement("span");name.textContent=label;
   const detail=doc.createElement("strong");detail.textContent=value;
   row.append(name,detail);parent.append(row);return row;
 }
 function visibility(){
   const active=developer();
   panel.hidden=!active;
   if(active)renderCounts();
 }
 function renderCounts(){
   if(!developer())return;
   const c=window.__rrDeveloperCatalog?.();
   counts.replaceChildren();
   const rows=summarizeCatalog(c);
   if(!rows.length){entry(counts,"Каталог","Нет доступа","devdiag-bad");return;}
   for(const [name,value] of rows)entry(counts,name,value);
   const hint=doc.createElement("p");hint.className="devdiag-note";
   hint.textContent="Источник: локальный белый список проекта. Это не реестр всех объектов города; сведения могут быть неполными.";
   counts.append(hint);
 }
 function renderChecks(checks){
   results.replaceChildren();
   let okay=0,error=0;
   for(const item of checks){
     const className=item.kind==="ok"?"devdiag-ok":item.kind==="error"?"devdiag-bad":"devdiag-warn";
     if(item.kind==="ok")okay++;
     if(item.kind==="error")error++;
     entry(results,(item.kind==="ok"?"✓ ":item.kind==="error"?"× ":"• ")+item.name,
       (item.kind==="ok"?"Проверено":item.kind==="error"?"Ошибка":"Не проверено")+
       (item.text?" · "+item.text:""),className);
   }
   const summary=doc.createElement("p");summary.className="devdiag-note";
   summary.textContent="Автопроверок успешно: "+okay+"; ошибок: "+error+
    ". Реальные GPS, фотоснимки и безопасность улиц автоматическим тестом не подтверждаются.";
   results.append(summary);
 }
 async function runChecks(){
   if(!developer())return;
   checkBtn.disabled=true;poiBtn.disabled=true;
   results.textContent="Проверяем модули и доступность внешних сервисов…";
   const checks=[];
   function add(name,state,text){checks.push(makeCheck(name,state,text));}
   const has=(id)=>!!doc.getElementById(id);
   add("Экраны и чат",has("home")&&has("route")&&has("smartChatForm")&&has("smartRouteChatForm"),"Элементы интерфейса");
   add("Библиотека карты",!!(window.ymaps||window.L),window.ymaps?"Яндекс Карты загружены":window.L?"Leaflet загружен":"Библиотека карты не загружена");
   add("Генератор маршрутов",typeof window.__rrDeveloperRouteProbe==="function", "Код тестового запроса доступен");
   const offers=window.DailyRouteQuests?.offersForDay?.(window.DailyRouteQuests.dayKey(Date.now()))||[];
   add("Маршруты дня",offers.length===3&&offers.every(o=>o.id&&o.reward>0),"Сформированы "+offers.length+" предложения");
   add("RouteCoin",typeof window.__recordVerifiedEvent==="function"&&typeof window.__syncApp==="function",
     "Учет событий доступен. Начисление и защиту от накрутки здесь не проверяем.");
   add("Пешеходные данные",typeof window.SmartRouteAudit?.check==="function","Модуль проверки OSM загружен");
   add("Погодные предупреждения",!!doc.getElementById("srs-home"),"Панель на главной странице");
   add("GPS и камера",null,"В тестовом режиме виртуальный GPS. Нужна проверка на телефоне.");
   add("Фотоконтроль",null,"Нужны настоящий GPS и реальное фото объекта.");
   add("Безопасность улиц",null,"Не подтверждает уборку снега, работу фонарей или отсутствие гололёда.");
   const live=await Promise.all([
     withTimeout(()=>window.__rrDeveloperRouteProbe?.(),15500).then(x=>
       makeCheck("Пешеходный маршрут Дейкстры",!!(x&&x.mode==="pedestrian"&&x.engine==="dijkstra-osm"&&x.distanceM>0),x?"Длина тестового пути "+x.distanceM+" м":"Ответ не получен"))
       .catch(e=>makeCheck("Пешеходный маршрут Дейкстры",false,String(e.message||e))),
     checkHTTP("https://api.open-meteo.com/v1/forecast?latitude=62.027&longitude=129.732&current=temperature_2m&timezone=Asia%2FYakutsk",s=>{
       try{return Number.isFinite(JSON.parse(s)?.current?.temperature_2m)}catch(_){return false;}
     }).then(()=>makeCheck("Сервис погоды Open-Meteo",true,"Температура получена с сервера"))
       .catch(e=>makeCheck("Сервис погоды Open-Meteo",false,String(e.message||e))),
     checkHTTP(new URL("icons/smart-route.svg?v=3",location.href).href,s=>s.includes("<svg")&&s.includes("Маршик"),8000)
       .then(()=>makeCheck("Иконка сайта",true,"Крупный Маршик загружается"))
       .catch(e=>makeCheck("Иконка сайта",false,String(e.message||e)))
   ]);
   checks.push(...live);
   renderChecks(checks);
   checkBtn.disabled=false;poiBtn.disabled=false;
 }
 async function checkPOIs(){
   if(!developer())return;
   checkBtn.disabled=true;poiBtn.disabled=true;
   results.textContent="Проверяем небольшую выборку достопримечательностей; весь городской список не сканируется.";
   let check;
   try{
     const c=await withTimeout(()=>window.__rrDeveloperPoiProbe?.(),17000);
     check=makeCheck("Проверка объектов каталога",c&&c.loaded>0,
       c?"Ответило "+c.loaded+" из "+c.sample+" выбранных объектов; фототочки: "+c.photoEligible:"Нет ответа");
   }catch(e){check=makeCheck("Проверка объектов каталога",false,String(e.message||e));}
   renderChecks([check,makeCheck("Полный каталог города",null,"Вне охвата приложения; доступно только количество объектов белого списка")]);
   checkBtn.disabled=false;poiBtn.disabled=false;renderCounts();
 }
 checkBtn.addEventListener("click",runChecks);
 poiBtn.addEventListener("click",checkPOIs);
 const observer=new MutationObserver(()=>visibility());
 observer.observe(doc.body,{attributes:true,attributeFilter:["class"]});
 visibility();
 window.RRDeveloperDiagnostics.refresh=visibility;
 window.RRDeveloperDiagnostics.runChecks=runChecks;
}
return {classify,summarizeCatalog,makeCheck,mount};
});
