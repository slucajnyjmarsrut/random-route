/* Случайный маршрут — локальный чат настроек. Без AI API и передачи текста на сервер.
 * Парсер изолирован: require('./smart-route-chat.js') можно тестировать в Node.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports)module.exports=api;
  if(root && root.document){root.SmartRouteChat=api;api.mount(root.document);}
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const KM_MIN=1,KM_MAX=50, WALKING_KMH=4.3;
const pattern=(s,re)=>re.test(s);
function parseRequest(raw,askDistance=false){
 const original=String(raw||"").trim().slice(0,500),s=original.toLocaleLowerCase("ru-RU").replace(/\u00a0/g," ");
 const found={original,understood:false,errors:[],notes:[],distanceKm:null,estimatedMinutes:null,type:null,coffee:null,area:null,
  wantsRoute:false,wantsSafety:false,wantsNoYards:false,wantsLight:false,wantsExcludedPlace:false,wantsReturn:false,poiWish:null,
  needsDistance:false};
 if(!s)return found;
 const negative=(noun)=>new RegExp("(?:без|не\\s+хочу|избега[йють]|обойти)(?:\\s+\\S+){0,3}\\s+(?:"+noun+")","iu").test(s);
 let m=s.match(/(\d+(?:[.,]\d+)?)\s*(?:км|километр(?:ов|а)?)(?![а-яё])/iu);
 if(!m){let mt=s.match(/(\d+(?:[.,]\d+)?)\s*(?:метр(?:ов|а)?)(?![а-яё])/iu);if(mt){m=mt;found.distanceKm=Number(mt[1].replace(",","."))/1000;}}
 else found.distanceKm=Number(m[1].replace(",","."));
 if(!m){
    const hr=s.match(/(\d+(?:[.,]\d+)?)\s*(?:час(?:ов|а)?|ч)(?![а-яё])/iu);
    const min=s.match(/(\d+(?:[.,]\d+)?)\s*(?:минут(?:ы|у)?|мин)(?![а-яё])/iu);
    const plainHour=!hr&&!min&&/(?:^|\s)(?:на\s+)?час(?:ик)?(?=$|\s|[.,!?])/iu.test(s);
    if(hr||min||plainHour||/полчаса|пол\s+часа/iu.test(s)){
      const mins=(hr?Number(hr[1].replace(",","."))*60:plainHour?60:0)+(min?Number(min[1].replace(",",".")):0)+(/полчаса|пол\s+часа/iu.test(s)?30:0);
      if(mins>0){found.estimatedMinutes=mins;found.distanceKm=Math.round(Math.min(KM_MAX,Math.max(0,mins*WALKING_KMH/60))*10)/10;found.notes.push("Время приблизительное: расчёт из скорости около "+WALKING_KMH+" км/ч.");}
    }
 }
 if(!m && found.distanceKm===null && askDistance && /^\d+(?:[.,]\d+)?$/.test(s)){found.distanceKm=Number(s.replace(",","."));}
 if(found.distanceKm!==null){
   if(!Number.isFinite(found.distanceKm)||found.distanceKm<KM_MIN||found.distanceKm>KM_MAX){found.errors.push("Укажите расстояние от 1 до 50 км (или подходящую длительность).");found.distanceKm=null;}
   else found.understood=true;
 }
 const parks=pattern(s,/парк|сквер|алле|набережн|зел[её]н/iu);
 const nature=pattern(s,/природ|лес|дерев|рек[ауе]|озер|вод[ыуе]|лесн/iu);
 const city=pattern(s,/город|архитектур|улиц|памятник|музе|истор|центральн/iu);
 const coffee=pattern(s,/кафе|кофе|кофейн|ресторан|перекус|чай/iu);
 if(nature&&!negative("природ|лес|рек"))found.type="nature";
 else if(parks&&!negative("парк|сквер"))found.type="parks";
 else if(city&&!negative("улиц|центр"))found.type="city";
 if(found.type)found.understood=true;
 if(coffee){found.coffee=!negative("кафе|кофе|ресторан");found.understood=true;}
 if(pattern(s,/музе|памятник|истор|собор|театр/iu)){found.poiWish="culture";found.understood=true;}
 if(pattern(s,/парк|сквер|алле|набережн/iu)&&!negative("парк|сквер")){found.poiWish="parks";found.understood=true;}
 if(coffee && found.coffee===true)found.poiWish="coffee";
 found.wantsNoYards=pattern(s,/двор|подворот|переул|промзон|тупик|служебн.{0,6}проезд/iu)&&pattern(s,/без|избеж|избега|обойти|не\s+хочу|не\s+веди|миним/iu);
 found.wantsLight=pattern(s,/освещ|фонар|светл|т[её]мн|ноч[ьюи]|вечер/iu);
 found.wantsSafety=pattern(s,/безопас|риск|голол[её]д|снег|мороз|очищ|почищ|тротуар/iu);
 found.wantsExcludedPlace=pattern(s,/(не\s+веди|избегай|обойти|не\s+заходи|без)\s+(?:через\s+|на\s+|в\s+)?(?:улиц|район|адрес|двор\s+на)/iu);
 found.wantsReturn=pattern(s,/кольц|круг|верну(?:ться|сь)|обратно|назад|к\s+старт/iu);
 found.wantsRoute=pattern(s,/построй|проложи|создай|сгенерируй|подбери|составь|перестрой|новый\s+маршрут|дай\s+маршрут/iu);
 if(found.wantsRoute||found.wantsNoYards||found.wantsLight||found.wantsSafety||found.wantsReturn||found.wantsExcludedPlace)found.understood=true;
 if(pattern(s,/погуля|прогулк|маршрут|пройти|прогуляться|пешком|ходьб/iu))found.understood=true;
 if(found.wantsExcludedPlace)found.notes.push("Конкретные улицы и районы можно исключить вручную, отметив зону на карте.");
 if(found.wantsLight)found.notes.push("Нельзя подтвердить освещение каждой улицы. Доступны лишь погодные предупреждения и предпочтение пешеходных дорожек.");
 if(found.wantsNoYards)found.notes.push("Маршрутизатор старается обходить дворовые и служебные проезды, но не исключает их полностью.");
 if(found.wantsSafety)found.notes.push("Снег, гололёд и состояние каждого тротуара не проверяются автоматически; гарантии безопасности нет.");
 return found;
}
function placeScore(p,pref){
 const src=[p?.tags?.name,p?._description,p?._fullAddress,p?._sourceText,p?.description].filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
 let v=0;
 if((pref.type==="parks"||pref.poiWish==="parks")&&/парк|сквер|сад|алле|набережн/iu.test(src))v+=1;
 if(pref.type==="nature"&&/парк|сквер|река|берег|озеро|природ|лес/iu.test(src))v+=1;
 if((pref.type==="city"||pref.poiWish==="culture")&&/музей|театр|памятник|собор|истор|стел|площадь/iu.test(src))v+=1;
 if(pref.coffee===true&&/кафе|ресторан|кофейн|чай|кофе/iu.test(src))v+=1;
 return Math.min(2,v);
}
function mount(doc){
 const home=doc.getElementById("home"),log=doc.getElementById("smartChatLog"),form=doc.getElementById("smartChatForm"),input=doc.getElementById("smartChatInput");
 if(!home||!log||!form||!input)return;
 const distance=doc.getElementById("distanceInput"), activeDistance=doc.getElementById("activeDistanceInput");
 const summary=doc.getElementById("smartChatSummary"),details=doc.getElementById("smartChatSettings");
 let awaitingDistance=false,latestPref={type:null,coffee:null,poiWish:null};
 [distance,doc.getElementById("typeChoices"),doc.getElementById("partnerToggle")].forEach(function(el){
   const card=el&&el.closest(".card");if(card)card.classList.add("schat-legacy");
 });
 home.classList.add("schat-compact");
 function addBubble(role,text,target=log){
   const b=doc.createElement("div");b.className="schat-bubble "+(role==="user"?"schat-user":"schat-bot");b.textContent=text;
   target.appendChild(b);if(target.children.length>14)target.removeChild(target.children[0]);
   target.scrollTop=target.scrollHeight;
 }
 function refreshSummary(){
   const ty=doc.querySelector("#typeChoices .choice.active")?.dataset.type||"city";
   const names={parks:"парки",nature:"природа",city:"город"};
   if(summary)summary.textContent="Настройки: "+(Number(distance?.value)||6.5)+" км · "+(names[ty]||"город")+" · только пешеходные пути";
 }
 function updatePrefs(result){
   if(result.distanceKm!==null){
     const v=String(result.distanceKm);if(distance){distance.value=v;distance.dispatchEvent(new Event("input",{bubbles:true}));}
     if(activeDistance)activeDistance.value=v;
     try{localStorage.setItem("rr_distance",v);}catch(_){}
   }
   if(result.type){
     const b=doc.querySelector('#typeChoices .choice[data-type="'+result.type+'"]');
     if(b)b.click();
     try{localStorage.setItem("rr_type",result.type)}catch(_){}
   }
   if(result.coffee!==null){
     const toggle=doc.getElementById("partnerToggle");
     if(toggle && toggle.classList.contains("on")!==result.coffee)toggle.click();
   }
   if(result.poiWish)latestPref.poiWish=result.poiWish;
   if(result.type)latestPref.type=result.type;
   if(result.coffee!==null)latestPref.coffee=result.coffee;
   refreshSummary();
 }
 function reply(result){
   if(result.errors.length)return result.errors.join(" ");
   if(!result.understood)return "Пока понимаю расстояние, время, парки, природу, город, кафе и просьбу о маршруте. Например: «Построй кольцо 3 км через парки». Конкретные адреса пока нельзя вводить как точки.";
   const bits=[];
   if(result.distanceKm!==null)bits.push(result.distanceKm.toLocaleString("ru-RU")+" км");
   if(result.type)bits.push(({parks:"парки",nature:"природа",city:"город"})[result.type]);
   if(result.coffee===true)bits.push("попробуем включить кафе");
   if(result.coffee===false)bits.push("без кафе");
   if(result.poiWish==="culture")bits.push("интерес к музеям и памятникам");
   let t=bits.length?"Учёл пожелания: "+bits.join(", ")+". ":"Понял запрос. ";
   t+="Строю кольцо по пешеходной сети, с возвращением к старту.";
   if(result.poiWish||result.coffee===true)t+=" Подходящие объекты выбираются только при наличии в каталоге.";
   if(result.notes.length)t+=" "+result.notes.join(" ");
   if(result.wantsRoute)t+=" Для настоящего маршрута потребуется GPS; также доступен пробный режим из центра Якутска.";
   else t+=" Нажмите «Построить маршрут», когда будете готовы.";
   return t;
 }
 function onMessage(raw,targetLog){
   addBubble("user",raw,targetLog);
   const result=parseRequest(raw,awaitingDistance);
   if(result.distanceKm!==null||result.errors.length)awaitingDistance=false;
   if(result.understood&&!result.errors.length)updatePrefs(result);
   addBubble("assistant",reply(result),targetLog);
   // Never silently ignore text-based safety exclusions.
   const unverified=result.wantsLight||result.wantsExcludedPlace||(/голол[её]д|снег\s+по\s+колено|нечищ|не\s+почищ/iu.test(raw)&&/без|избег|обой|безопас/iu.test(raw));
   if(result.wantsRoute && unverified){
      addBubble("assistant","По этим условиям автоматический фильтр пока не готов, поэтому маршрут не запускаю. Отметьте запретные зоны на карте либо ослабьте условие. Погодные предупреждения доступны отдельно.",targetLog);
   }
   if(!result.errors.length&&result.wantsRoute&&!unverified){
     const rr=window.__yakutskRR;
     const active=!!(rr&&rr.legs&&rr.legs.length&&rr.stage!=="idle"&&rr.stage!=="completed");
     const target=doc.getElementById(active?"applyDistanceBtn":"buildBtn");
     if(target&&!target.disabled)setTimeout(function(){if(!target.disabled)target.click()},150);
   }
 }
 function bindChat(chatForm,chatInput,chatLog){
   if(!chatForm||!chatInput||!chatLog)return;
   chatForm.addEventListener("submit",function(e){
      e.preventDefault();const raw=chatInput.value.trim();if(!raw)return;
      chatInput.value="";onMessage(raw,chatLog);
   });
   chatInput.addEventListener("keydown",function(e){
      if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();chatForm.requestSubmit();}
   });
 }
 bindChat(form,input,log);
 bindChat(doc.getElementById("smartRouteChatForm"),doc.getElementById("smartRouteChatInput"),doc.getElementById("smartRouteChatLog"));
 if(details){
   details.addEventListener("click",function(){
     const expand=home.classList.toggle("schat-compact");
     const opened=!expand;
     details.setAttribute("aria-expanded",String(opened));
     details.textContent=opened?"Скрыть ручные настройки":"Показать ручные настройки";
   });
 }
 refreshSummary();
 window.SmartRouteChat.getPreferences=function(){return {...latestPref}};
 window.SmartRouteChat.preferenceBoost=function(p){
    const type=doc.querySelector("#typeChoices .choice.active")?.dataset.type||"city";
    const coffee=doc.getElementById("partnerToggle")?.classList.contains("on");
    return placeScore(p,{type,coffee,poiWish:latestPref.poiWish});
 };
}
return {parseRequest,placeScore,mount};
});
