/* Routes of the Day — one RouteCoin bonus for a completed daily walk.
 * Offers are deterministic by Yakutsk calendar day; actual routes are computed
 * by OSM Dijkstra, based on the chosen tourist points.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
  root.DailyRouteQuests=api;
  if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document);},{once:true});
  else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const EVENTS_KEY="rr_verified_events_v1",CLAIMS_KEY="rr_daily_route_claims_v2",TZ="Asia/Yakutsk";
const TYPES={city:"городские места",parks:"парки и скверы",nature:"природа"};
const VARIANTS=[
 {key:"short",icon:"🚶",title:"Небольшое открытие",subtitle:"Лёгкая прогулка",reward:30,base:2.5},
 {key:"explore",icon:"🧭",title:"Неизвестный Якутск",subtitle:"Новые места рядом",reward:50,base:3.5},
 {key:"long",icon:"🏞️",title:"Большой круг",subtitle:"Длинная прогулка",reward:70,base:4.5}
];
function dayKey(t){
 const d=t instanceof Date?t:new Date(t);
 if(!Number.isFinite(d.getTime()))return "";
 const p=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const a=Object.fromEntries(p.map(x=>[x.type,x.value]));
 return a.year+"-"+a.month+"-"+a.day;
}
function offersForDay(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return [];
 const [y,m,d]=day.split("-").map(Number);
 const ordinal=Math.floor(Date.UTC(y,m-1,d)/86400000);
 if(!Number.isFinite(ordinal))return [];
 const ts=Object.keys(TYPES);
 return VARIANTS.map((v,i)=>{
  const type=ts[(ordinal+i*2)%ts.length];
  const distanceKm=v.base+((ordinal+i)%2)*.5;
  return {id:day+":"+v.key,day,key:v.key,icon:v.icon,title:v.title,subtitle:v.subtitle,
          type,distanceKm,reward:v.reward,seed:day+":"+v.key+":pedestrian",
          label:distanceKm.toFixed(1).replace(".",",")+" км · "+TYPES[type]};
 });
}
function rngForOffer(offerId){
 let h=2166136261>>>0;
 for(const char of String(offerId)){h^=char.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
 return function(){
  h+=0x6D2B79F5;
  let t=h;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
function qualifiedCompletion(events,day,offers=offersForDay(day)){
 if(!Array.isArray(events))return null;
 const ids=new Set(offers.map(o=>o.id));
 return events.find(e=>e&&e.type==="route_completed"&&typeof e.key==="string"&&
   Number.isFinite(e.at)&&dayKey(e.at)===day&&e.data?.dailyEligible===true&&
   e.data?.dailyOfferDay===day&&ids.has(e.data?.dailyOfferId))||null;
}
function readJson(k,def){try{const v=JSON.parse(localStorage.getItem(k)||"null");return v??def;}catch(_){return def;}}
function claims(){const v=readJson(CLAIMS_KEY,{});return v&&typeof v==="object"&&!Array.isArray(v)?v:{};}
function blocked(){
 try{return !!(window.__isDeveloperMode?.()||window.__yakutskRR?.startMode==="demo"||
   window.__yakutskRR?.startMode==="developer"||localStorage.getItem("rr_preview_city_mode")==="1");
 }catch(_){return true;}
}
function award(day,event){
 if(!window.state||typeof window.__syncApp!=="function"||blocked())return false;
 const current=claims();if(current[day])return false;
 const offer=offersForDay(day).find(o=>o.id===event.data.dailyOfferId);
 if(!offer)return false;
 current[day]={offerId:offer.id,reward:offer.reward,at:Date.now(),eventKey:event.key};
 for(const old of Object.keys(current).sort().slice(0,Math.max(0,Object.keys(current).length-120)))delete current[old];
 try{localStorage.setItem(CLAIMS_KEY,JSON.stringify(current));}catch(_){return false;}
 const balance=Number(window.state.coins);
 window.state.coins=(Number.isFinite(balance)?Math.max(0,balance):0)+offer.reward;
 try{window.__syncApp();}catch(_){try{localStorage.setItem("rr_coins",String(window.state.coins));}catch(__){}}
 return offer.reward;
}
function mount(doc){
 const create=doc.getElementById("create"),route=doc.getElementById("route");
 if(!create||!route)return;
 function panel(name){
  const root=doc.createElement("section");root.className="rdq-card";root.id="rdq-"+name;root.setAttribute("aria-label","Маршруты дня");
  const head=doc.createElement("div");head.className="rdq-heading";
  const title=doc.createElement("strong");title.textContent="🗺️ Маршруты дня";
  const badge=doc.createElement("span");badge.className="rdq-count";badge.setAttribute("data-daily-status","");
  head.append(title,badge);root.append(head);
  const intro=doc.createElement("p");intro.className="rdq-desc";
  intro.textContent="Каждый день — три новых варианта прогулки по настоящим пешеходным дорогам. Выберите один и получите RouteCoin после прохождения.";
  root.append(intro);
  const list=doc.createElement("div");list.className="rdq-list";list.setAttribute("data-daily-options","");root.append(list);
  const msg=doc.createElement("p");msg.className="rdq-notice";msg.setAttribute("data-daily-msg","");root.append(msg);
  const foot=doc.createElement("p");foot.className="rdq-foot";
  foot.textContent="Варианты обновляются в полночь по Якутску. Маршрут строится после выбора, поэтому фактическая длина может немного отличаться. Один бонус за день. В мороз выходить ради монет не нужно.";
  root.append(foot);return root;
 }
 const a=panel("home"),b=panel("route"),target=doc.getElementById("rrDailyCreateMount");
 if(target)target.append(a);else create.append(a);
 const anchor=doc.getElementById("srs-route")||doc.querySelector("#route .route-summary");
 if(anchor)anchor.insertAdjacentElement("afterend",b);else route.prepend(b);
 let shownDay="",busy=false;
 async function start(offer){
  if(busy)return;
  const today=dayKey(Date.now());
  if(!offer||offer.day!==today){render();return;}
  if(typeof window.__buildDailyRoute!=="function"){alert("Генератор маршрутов недоступен. Перезагрузите страницу.");return;}
  const rr=window.__yakutskRR;
  if(rr?.legs?.length && !["idle","completed"].includes(rr.stage)){
   if(!confirm("Сейчас идёт прогулка. Построить маршрут дня вместо неё? Текущая прогулка будет заменена."))return;
  }
  busy=true;render();
  try{
   const ok=await window.__buildDailyRoute(offer);
   if(!ok)alert("Не удалось построить маршрут дня. Проверьте GPS, интернет или попробуйте другой вариант.");
  }finally{busy=false;render();}
 }
 function render(){
  const day=dayKey(Date.now()),offers=offersForDay(day),current=claims(),claim=current[day]||null,rr=window.__yakutskRR;
  const active=rr?.dailyOfferDay===day?rr?.dailyOfferId:null;
  for(const panel of [a,b]){
   const badge=panel.querySelector("[data-daily-status]");
   badge.textContent=claim?"✓ Пройден":(busy?"Строим…":"Сегодня · "+offers.length+" варианта");
   const list=panel.querySelector("[data-daily-options]");list.replaceChildren();
   for(const o of offers){
    // Entire card is a native button: full touch target, Enter/Space by browser,
    // no nested buttons, explicit reward is informational (not the only target).
    const item=doc.createElement("button");item.type="button";
    item.className="rdq-task rdq-route-button"+(active===o.id?" rdq-done":"");
    item.disabled=!!claim||busy||active===o.id;
    item.setAttribute("aria-label",
      (claim?.offerId===o.id?"Пройден":active===o.id?"Уже выбран":"Построить маршрут")+" «"+o.title+"», "+o.label+
      ", награда за прохождение "+o.reward+" RouteCoin");
    const icon=doc.createElement("span");icon.className="rdq-icon";icon.setAttribute("aria-hidden","true");icon.textContent=o.icon;
    const content=doc.createElement("span");content.className="rdq-task-info";
    const title=doc.createElement("strong");title.textContent=o.title;
    const desc=doc.createElement("span");desc.textContent=o.label+" · "+o.subtitle;
    const hint=doc.createElement("small");
    hint.textContent=claim?.offerId===o.id?"✓ Пройден и награда получена":(active===o.id?"✓ Выбранный маршрут":"Нажмите, чтобы построить маршрут");
    content.append(title,desc,hint);
    const side=doc.createElement("span");side.className="rdq-reward";
    side.setAttribute("aria-hidden","true");
    side.textContent=claim?.offerId===o.id?"✓ "+o.reward+" RC":"+ "+o.reward+" RC";
    const arrow=doc.createElement("span");arrow.className="rdq-arrow";arrow.textContent=active===o.id?"✓":"›";arrow.setAttribute("aria-hidden","true");
    item.addEventListener("click",function(){start(o);});
    item.append(icon,content,side,arrow);list.append(item);
   }
   panel.querySelector("[data-daily-msg]").textContent=claim
    ?"🎉 Сегодня маршрут дня пройден. Завтра появятся новые!"
    :blocked()?"🧪 В пробном режиме можно посмотреть маршрут дня, но бонусы выдаются только за настоящее GPS-прохождение."
    :active?"Пройдите выбранный круг с GPS до стартовой точки — бонус начислится автоматически."
    :"Выбери один из маршрутов. Награда выдаётся только за завершённую прогулку.";
  }
  shownDay=day;
 }
 function process(){
  const day=dayKey(Date.now());
  if(!blocked()&&!claims()[day]){
   const event=qualifiedCompletion(readJson(EVENTS_KEY,[]),day);
   if(event){
    const amount=award(day,event);
    if(amount){
      const toast=doc.getElementById("toast");
      if(toast){toast.textContent="Маршрут дня завершён: +"+amount+" RouteCoin!";toast.classList.add("show");
       setTimeout(()=>toast.classList.remove("show"),2600);}
    }
   }
  }
  render();
 }
 window.addEventListener("rr:verified-event",process);
 window.addEventListener("rr:daily-route-built",render);
 window.addEventListener("storage",function(e){if([CLAIMS_KEY,EVENTS_KEY].includes(e.key))render()});
 doc.addEventListener("visibilitychange",function(){if(!doc.hidden)process()});
 window.setInterval(function(){if(dayKey(Date.now())!==shownDay)process();},60000);
 window.DailyRouteQuests.refresh=process;
 window.DailyRouteQuests.start=start;
 process();
}
return {dayKey,offersForDay,rngForOffer,qualifiedCompletion,mount};
});
