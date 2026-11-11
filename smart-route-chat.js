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
// Numbers in a question or a rejected route must never silently change an active walk.
function distanceMention(s){
 const km=s.match(/(\d+(?:[.,]\d+)?)\s*(?:км|километр(?:ов|а)?)(?![а-яё])/iu);
 if(km)return Number(km[1].replace(",","."));
 const meters=s.match(/(\d+(?:[.,]\d+)?)\s*(?:метр(?:ов|а)?)(?![а-яё])/iu);
 return meters?Number(meters[1].replace(",","."))/1000:null;
}
function timeMention(s){
 const text=String(s||"").toLocaleLowerCase("ru-RU");
 const hours=text.match(/(\d+(?:[.,]\d+)?)\s*(?:час(?:ов|а)?|ч)(?![а-яё])/iu);
 const minutes=text.match(/(\d+(?:[.,]\d+)?)\s*(?:минут(?:ы|у)?|мин)(?![а-яё])/iu);
 const oneHalfHour=/(?:полтора|полторы)\s*(?:час(?:а)?|ч)(?![а-яё])/iu.test(text);
 const halfHour=/(?:^|[\s,])пол\s*часа(?=$|[\s,.!?])/iu.test(text);
 const fullHour=!hours&&!oneHalfHour&&/(?:^|[\s,])(?:на\s+)?час(?:ик)?(?=$|[\s,.!?]|и\s)/iu.test(text);
 const total=(hours?Number(hours[1].replace(",","."))*60:oneHalfHour?90:fullHour?60:0)
    +(minutes?Number(minutes[1].replace(",",".")):0)+(halfHour?30:0);
 return total>0&&Number.isFinite(total)?total:null;
}
function distanceFromMinutes(minutes){
 return Math.round(minutes*WALKING_KMH/60*10)/10;
}
function parseRequest(raw,askDistance=false){
 const original=String(raw||"").trim().slice(0,500),s=original.toLocaleLowerCase("ru-RU").replace(/\u00a0/g," ");
 const found={original,understood:false,errors:[],notes:[],distanceKm:null,estimatedMinutes:null,type:null,coffee:null,area:null,
  wantsRoute:false,wantsSafety:false,wantsNoYards:false,wantsLight:false,wantsExcludedPlace:false,wantsReturn:false,poiWish:null,
  needsDistance:false,intent:"unknown",isCorrection:false,rejectedDistanceKm:null,mentionedDistanceKm:null};
 if(!s)return found;
 const negative=(noun)=>new RegExp("(?:без|не\\s+хочу|избега[йють]|обойти)(?:\\s+\\S+){0,3}\\s+(?:"+noun+")","iu").test(s);
 const question=/^(?:ну\s+|а\s+)?(?:почему|зачем|отчего|как|сколько|что|откуда|разве|когда)(?![а-яё])/iu.test(s)
  || (/\?\s*$/.test(s) && !/(?:^|[\s,])(?:построй|перестрой|проложи|создай)(?![а-яё])/iu.test(s));
 const reject=/(?:^|[\s,])(?:нет(?:[,\s.!]|$)|не\s+(?:хочу|надо|нужен|нужна|подходит|строй|построй)|я\s+не\s+хочу|мне\s+не\s+нужно|мне\s+не\s+нужны|отмени|не\s+подходит|слишком\s+(?:мало|коротк))/iu.test(s);
 const explicitCommand=/(?:^|[\s,])(?:построй|перестрой|проложи|создай|сгенерируй|подбери|составь|дай\s+маршрут)(?![а-яё])/iu.test(s);
 const time=timeMention(s),distance=distanceMention(s);
 found.mentionedDistanceKm=distance;
 found.estimatedMinutes=time;
 if(question){
    found.intent="question";found.understood=true;
    return found;
 }
 let parseText=s;
 if(reject){
   // Contrast ("не 2 км, а 6 км") and corrections ("нет, хочу 6 км")
   // are new settings; the rejected number is NOT a new target.
   const contrast=s.match(/(?:[,;]?\s+)(?:а|лучше|вместо)\s+(.+)$/iu);
   const afterComma=s.match(/[,;]\s*(?:хочу|мне\s+нужно|нужно|надо|давай)\s+(.+)$/iu);
   const newText=(contrast||afterComma)?.[1]||"";
   const wanted=distanceMention(newText)!==null||timeMention(newText)!==null;
   if(!wanted){
     found.intent="reject";found.understood=true;found.rejectedDistanceKm=distance;
     return found;
   }
   parseText=newText;
   found.isCorrection=true;
   found.rejectedDistanceKm=distanceMention(s.slice(0,s.indexOf(newText)));
 }
 let km=distanceMention(parseText),mins=timeMention(parseText);
 if(km===null&&mins!==null)km=distanceFromMinutes(mins);
 if(km===null&&askDistance&&/^\d+(?:[.,]\d+)?$/.test(parseText))km=Number(parseText.replace(",","."));
 if(km!==null){
   if(!Number.isFinite(km)||km<KM_MIN||km>KM_MAX){
     found.errors.push("Укажите расстояние от 1 до 50 км (или подходящую длительность).");
     km=null;
   }else found.understood=true;
   found.distanceKm=km;
 }
 if(mins!==null && (distanceMention(parseText)===null)){
   found.estimatedMinutes=mins;
   found.notes.push("Время приблизительное: "+mins+" мин при скорости около "+WALKING_KMH+" км/ч; остановки увеличивают длительность.");
 }
 const parks=pattern(parseText,/парк|сквер|алле|набережн|зел[её]н/iu);
 const nature=pattern(parseText,/природ|лес|дерев|рек[ауе]|озер|вод[ыуе]|лесн/iu);
 const city=pattern(parseText,/город|архитектур|улиц|памятник|музе|истор|центральн/iu);
 const coffee=pattern(parseText,/кафе|кофе|кофейн|ресторан|перекус|чай/iu);
 if(nature&&!negative("природ|лес|рек"))found.type="nature";
 else if(parks&&!negative("парк|сквер"))found.type="parks";
 else if(city&&!negative("улиц|центр"))found.type="city";
 if(found.type)found.understood=true;
 if(coffee){found.coffee=!negative("кафе|кофе|ресторан");found.understood=true;}
 if(pattern(parseText,/музе|памятник|истор|собор|театр/iu)){found.poiWish="culture";found.understood=true;}
 if(pattern(parseText,/парк|сквер|алле|набережн/iu)&&!negative("парк|сквер")){found.poiWish="parks";found.understood=true;}
 if(coffee && found.coffee===true)found.poiWish="coffee";
 found.wantsNoYards=pattern(parseText,/двор|подворот|переул|промзон|тупик|служебн.{0,6}проезд/iu)&&pattern(parseText,/без|избеж|избега|обойти|не\s+хочу|не\s+веди|миним/iu);
 found.wantsLight=pattern(parseText,/освещ|фонар|светл|т[её]мн|ноч[ьюи]|вечер/iu);
 found.wantsSafety=pattern(parseText,/безопас|риск|голол[её]д|снег|мороз|очищ|почищ|тротуар/iu);
 found.wantsExcludedPlace=pattern(parseText,/(не\s+веди|избегай|обойти|не\s+заходи|без)\s+(?:через\s+|на\s+|в\s+)?(?:улиц|район|адрес|двор\s+на)/iu);
 found.wantsReturn=pattern(parseText,/кольц|круг|верну(?:ться|сь)|обратно|назад|к\s+старт/iu);
 const routeWords=pattern(parseText,/погуля|прогулк|маршрут|пройти|прогуляться|пешком|ходьб/iu);
 const wantsWalk=/(?:^|[\s,])(?:хочу|хотелось\s+бы|давай|давайте|погулять|прогуляться)(?![а-яё])/iu.test(parseText)
     && !/(?:^|[\s,])не\s+хочу/iu.test(parseText);
 found.wantsRoute=!found.isCorrection && (explicitCommand || (wantsWalk && km!==null && (routeWords || /хочу/iu.test(parseText))));
 if(found.wantsRoute||found.wantsNoYards||found.wantsLight||found.wantsSafety||found.wantsReturn||found.wantsExcludedPlace||routeWords)found.understood=true;
 found.intent=found.wantsRoute?"build":found.understood?"settings":"unknown";
 if(found.wantsExcludedPlace)found.notes.push("Конкретные улицы и районы можно исключить вручную, отметив зону на карте.");
 if(found.wantsLight)found.notes.push("Отметки об освещении можно проверить по OSM после построения, но работа фонарей сегодня не подтверждена.");
 if(found.wantsNoYards)found.notes.push("Маршрутизатор старается обходить дворовые и служебные проезды, но не исключает их полностью.");
 if(found.wantsSafety)found.notes.push("Снег, гололёд и состояние каждого тротуара не проверяются в реальном времени; гарантии безопасности нет.");
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
 function reply(result,autostart=false){
   if(result.intent==="question"){
     const t=result.estimatedMinutes,km=result.mentionedDistanceKm;
     if(t!==null){
       const computed=distanceFromMinutes(t);
       const hours=t>=60&&t%60===0?(t/60)+" ч":t+" мин";
       const disagreement=km!==null&&Math.abs(km-computed)>0.5?" "+km.toLocaleString("ru-RU")+" км за "+hours+" — значительно медленнее принятой скорости.":"";
       return "Поясню расчёт: "+hours+" прогулки при средней скорости "+WALKING_KMH+" км/ч — примерно "+computed.toLocaleString("ru-RU")+" км, а не "+(km!==null?km.toLocaleString("ru-RU")+" км":"фиксированное расстояние")+"."+disagreement+
         " Это оценка: остановки, фото и мороз меняют реальное время. Настройки маршрута я не менял. Если хотите, напишите «Перестрой на "+computed.toLocaleString("ru-RU")+" км».";
     }
     if(km!==null){
       return "При средней скорости "+WALKING_KMH+" км/ч "+km.toLocaleString("ru-RU")+" км займут примерно "+Math.round(km/WALKING_KMH*60)+" минут без длительных остановок. Это расчёт, не гарантия. Маршрут я не изменял.";
     }
     return "Это помощник по параметрам маршрута, а не полноценный ИИ-чат. Я могу объяснить примерное время прогулки, подобрать расстояние и перестроить путь по явной команде. Ваш маршрут не менял.";
   }
   if(result.intent==="reject"){
     return "Понял: "+(result.rejectedDistanceKm!==null?result.rejectedDistanceKm.toLocaleString("ru-RU")+" км вам не подходят. ":"предложенный вариант не подходит. ")+
       "Я не меняю маршрут и не запускаю перестроение. Напишите, сколько хотите идти: например, «Перестрой на 6,5 км» или «Хочу погулять полтора часа».";
   }
   if(result.errors.length)return result.errors.join(" ");
   if(!result.understood)return "Пока понимаю расстояние, время, парки, природу, город, кафе и просьбу о маршруте. Например: «Перестрой на 6,5 км» или «Хочу погулять полтора часа». Конкретные адреса нельзя вводить как точки.";
   const bits=[];
   if(result.distanceKm!==null)bits.push(result.distanceKm.toLocaleString("ru-RU")+" км");
   if(result.type)bits.push(({parks:"парки",nature:"природа",city:"город"})[result.type]);
   if(result.coffee===true)bits.push("попробуем включить кафе");
   if(result.coffee===false)bits.push("без кафе");
   if(result.poiWish==="culture")bits.push("интерес к музеям и памятникам");
   let t=bits.length?"Учёл пожелания: "+bits.join(", ")+". ":"Понял запрос. ";
   t+="Используется кольцевой пешеходный маршрут с возвращением к старту.";
   if(result.isCorrection)t+=" Исправил настройки, но не перестраивал маршрут без команды.";
   if(result.poiWish||result.coffee===true)t+=" Подходящие объекты выбираются только при наличии в каталоге.";
   if(result.notes.length)t+=" "+result.notes.join(" ");
   if(autostart)t+=" Пробую построить маршрут. Для реального старта нужен GPS; доступен и пробный режим из центра Якутска.";
   else t+=" Для построения напишите «Построй маршрут» или «Перестрой на 6,5 км».";
   return t;
 }
 function onMessage(raw,targetLog){
   addBubble("user",raw,targetLog);
   const result=parseRequest(raw,awaitingDistance);
   if(result.distanceKm!==null||result.errors.length)awaitingDistance=false;
   if((result.intent==="build"||result.intent==="settings")&&!result.errors.length)updatePrefs(result);
   const directBuild=result.intent==="build"&&!result.errors.length;
   // Never silently ignore text-based safety exclusions.
   const unverified=result.wantsLight||result.wantsExcludedPlace||(/голол[её]д|снег\s+по\s+колено|нечищ|не\s+почищ/iu.test(raw)&&/без|избег|обой|безопас/iu.test(raw));
   addBubble("assistant",reply(result,directBuild&&!unverified),targetLog);
   if(directBuild && unverified){
      addBubble("assistant","По этим условиям автоматический фильтр пока не готов, поэтому маршрут не запускаю. Отметьте запретные зоны на карте либо ослабьте условие. Погодные предупреждения доступны отдельно.",targetLog);
   }
   if(!result.errors.length&&directBuild&&!unverified){
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
