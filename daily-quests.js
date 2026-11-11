/* Daily quests v1 — rewards only from the existing verified-event ledger.
 * One claim per task per Yakutsk calendar day; no server, no GPS data uploads.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.DailyRouteQuests=api;
   if(root.document.readyState==="loading")
     root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document);},{once:true});
   else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const EVENTS_KEY="rr_verified_events_v1",CLAIMS_KEY="rr_daily_quest_claims_v1",TZ="Asia/Yakutsk";
const MISSIONS=Object.freeze([
 {id:"photo",event:"photo_verified",goal:1,reward:15,icon:"📷",title:"Открой фототочку",subtitle:"Подтверди GPS и фото объекта на маршруте"},
 {id:"history",event:"quest_correct",goal:1,reward:20,icon:"🏛️",title:"Знаток Якутска",subtitle:"Правильно ответь на исторический вопрос у точки"},
 {id:"route",event:"route_completed",goal:1,reward:50,icon:"🚶",title:"Финишируй круг",subtitle:"Заверши кольцевой маршрут с реальным GPS"}
]);
function dayKey(t){
 const date=t instanceof Date?t:new Date(t);
 if(!Number.isFinite(date.getTime()))return "";
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,day:"2-digit",month:"2-digit",year:"numeric"}).formatToParts(date);
 const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return [obj.year,obj.month,obj.day].join("-");
}
function safeLedger(value){
 if(!Array.isArray(value))return [];
 return value.filter(e=>e&&typeof e==="object"&&
   ["photo_verified","quest_correct","route_completed"].includes(e.type)&&
   e.data?.dailyEligible===true &&
   typeof e.key==="string"&&e.key.length>0&&
   Number.isFinite(e.at)&&e.at>0);
}
function dailyProgress(events,day){
 const unique=new Set();
 const counters={photo_verified:0,quest_correct:0,route_completed:0};
 for(const e of safeLedger(events)){
   if(dayKey(e.at)!==day||unique.has(e.key))continue;
   unique.add(e.key);counters[e.type]++;
 }
 return MISSIONS.map(m=>({...m,progress:Math.min(m.goal,counters[m.event]),ready:counters[m.event]>=m.goal}));
}
function readJson(key,fallback){
 try{const v=JSON.parse(localStorage.getItem(key)||"null");return v??fallback}catch(_){return fallback}
}
function readClaims(){
 const claims=readJson(CLAIMS_KEY,{});
 return claims&&typeof claims==="object"&&!Array.isArray(claims)?claims:{};
}
function blocked(){
 try{
   return !!(window.__isDeveloperMode?.() ||
     window.__yakutskRR?.startMode==="demo" ||
     window.__yakutskRR?.startMode==="developer" ||
     localStorage.getItem("rr_preview_city_mode")==="1");
 }catch(_){return true}
}
function gain(m,day){
 if(!window.state||typeof window.__syncApp!=="function"||blocked())return false;
 const current=readClaims();
 if(current?.[day]?.[m.id])return false;
 if(!current[day])current[day]={};
 current[day][m.id]={reward:m.reward,claimedAt:Date.now()};
 const dates=Object.keys(current).sort();
 for(const old of dates.slice(0,Math.max(0,dates.length-120)))delete current[old];
 try{localStorage.setItem(CLAIMS_KEY,JSON.stringify(current));}
 catch(_){return false;}
 const balance=Number(window.state.coins);
 window.state.coins=(Number.isFinite(balance)?Math.max(0,balance):0)+m.reward;
 try{window.__syncApp();}catch(_){try{localStorage.setItem("rr_coins",String(window.state.coins))}catch(__){}}
 return true;
}
function mount(doc){
 const home=doc.getElementById("home"),route=doc.getElementById("route");
 if(!home||!route)return;
 function panel(id){
   const root=doc.createElement("section");root.className="rdq-card";root.id="rdq-"+id;root.setAttribute("aria-label","Ежедневные задания");
   const head=doc.createElement("div");head.className="rdq-heading";
   const h=doc.createElement("strong");h.textContent="🎯 Ежедневные задания";
   const amount=doc.createElement("span");amount.className="rdq-count";amount.setAttribute("data-rdq-count","");amount.textContent="0 из 3";
   head.append(h,amount);root.append(head);
   const desc=doc.createElement("p");desc.className="rdq-desc";desc.textContent="Выполняй задания на настоящих прогулках и получай дополнительные RouteCoin.";root.append(desc);
   const list=doc.createElement("div");list.className="rdq-list";list.setAttribute("data-rdq-list","");root.append(list);
   const notice=doc.createElement("p");notice.className="rdq-notice";notice.setAttribute("data-rdq-notice","");
   root.append(notice);
   const foot=doc.createElement("p");foot.className="rdq-foot";foot.textContent="Задания обновляются в полночь по Якутску. Штрафов за пропуск нет. Во время сильного мороза не нужно выходить ради награды. В демо и режиме тестировщика коины за задания не выдаются.";root.append(foot);
   return root;
 }
 const homePanel=panel("home"),routePanel=panel("route");
 const info=doc.getElementById("quickInfoGrid");
 if(info)info.insertAdjacentElement("afterend",homePanel);
 else home.prepend(homePanel);
 const routeAnchor=doc.getElementById("srs-route")||doc.querySelector("#route .route-summary");
 if(routeAnchor)routeAnchor.insertAdjacentElement("afterend",routePanel);
 else route.prepend(routePanel);
 let currentDate="";
 function render(){
   const date=dayKey(Date.now()),claims=readClaims(),events=readJson(EVENTS_KEY,[]);
   const today=dailyProgress(events,date),finished=today.filter(m=>!!claims[date]?.[m.id]).length;
   for(const root of [homePanel,routePanel]){
     const list=root.querySelector("[data-rdq-list]");list.replaceChildren();
     const number=root.querySelector("[data-rdq-count]");number.textContent=finished+" из "+MISSIONS.length;
     for(const m of today){
       const claimed=!!claims[date]?.[m.id];
       const item=doc.createElement("div");item.className="rdq-task"+(claimed?" rdq-done":"");
       const icon=doc.createElement("span");icon.className="rdq-icon";icon.textContent=claimed?"✅":m.icon;
       const info=doc.createElement("div");info.className="rdq-task-info";
       const title=doc.createElement("strong");title.textContent=m.title;
       const caption=doc.createElement("span");caption.textContent=m.subtitle;
       const progress=doc.createElement("small");progress.textContent=claimed?"Выполнено · коины начислены":m.progress+" из "+m.goal;
       info.append(title,caption,progress);
       const reward=doc.createElement("b");reward.className="rdq-reward";reward.textContent=claimed?"✓ +"+m.reward:"+ "+m.reward+" RC";
       item.append(icon,info,reward);list.append(item);
     }
     const note=root.querySelector("[data-rdq-notice]");
     note.textContent=blocked()?"🧪 Пробный режим: ежедневные награды отключены. Для получения коинов используйте настоящий GPS.":"Бонусы начисляются автоматически после подтверждения заданий.";
     currentDate=date;
   }
 }
 function process(){
   const day=dayKey(Date.now());
   if(!blocked()){
     const events=readJson(EVENTS_KEY,[]),today=dailyProgress(events,day);
     const gained=[];
     for(const m of today)if(m.ready&&gain(m,day))gained.push(m);
     if(gained.length){
       const text="За ежедневные задания: +"+gained.reduce((sum,m)=>sum+m.reward,0)+" RouteCoin!";
       const toast=doc.getElementById("toast");
       if(toast){toast.textContent=text;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2500);}
     }
   }
   render();
 }
 doc.addEventListener("visibilitychange",function(){if(!doc.hidden)process()});
 window.addEventListener("rr:verified-event",process);
 window.addEventListener("storage",function(e){if([EVENTS_KEY,CLAIMS_KEY,"rr_preview_city_mode"].includes(e.key))render()});
 window.setInterval(function(){if(dayKey(Date.now())!==currentDate)process()},60000);
 window.DailyRouteQuests.refresh=process;
 render();
 // If a real GPS quest was finished earlier today, credit it once.
 process();
}
return {MISSIONS,dayKey,safeLedger,dailyProgress,mount};
});