/* Twenty collectible cosmetic companions. Progress is calculated from the
 * existing verified GPS/photo/quest ledger; demo events earn no XP.
 * Offline/local storage is not a tamper-proof server leaderboard.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.RRMascots=api;
   if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document,root)},{once:true});
   else api.mount(root.document,root);
 }
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const KEY="rr_mascot_collection_v1",LEDGER="rr_verified_events_v1",MAX_LEVEL=10;
 const rarities={
  common:{name:"Обычные",icon:"★"},
  uncommon:{name:"Необычные",icon:"🍃"},
  rare:{name:"Редкие",icon:"💎"},
  epic:{name:"Эпические",icon:"♛"},
  legendary:{name:"Легендарные",icon:"👑"}
 };
 const mascots=[
  {id:"runner-rabbit",name:"Заяц-бегун",emoji:"🐇",gear:"👟",rarity:"common",requires:{routes:1}},
  {id:"student-cat",name:"Кот-студент",emoji:"🐱",gear:"📚",rarity:"common",requires:{routes:3}},
  {id:"traveller-puppy",name:"Щенок-путник",emoji:"🐶",gear:"🎒",rarity:"common",requires:{},starter:true},
  {id:"tourist-hamster",name:"Хомяк-турист",emoji:"🐹",gear:"📷",rarity:"common",requires:{routes:10}},
  {id:"scholar-owl",name:"Сова-знаток",emoji:"🦉",gear:"🎓",rarity:"uncommon",requires:{quests:3}},
  {id:"collector-raccoon",name:"Енот-собиратель",emoji:"🦝",gear:"🍃",rarity:"uncommon",requires:{photos:5}},
  {id:"explorer-fox",name:"Лис-исследователь",emoji:"🦊",gear:"🧭",rarity:"uncommon",requires:{routes:12}},
  {id:"builder-beaver",name:"Бобр-мастер",emoji:"🦫",gear:"🔧",rarity:"uncommon",requires:{quests:10}},
  {id:"gamer-cat",name:"Геймер-кот",emoji:"🐈‍⬛",gear:"🎮",rarity:"rare",requires:{routes:20}},
  {id:"gourmet-panda",name:"Панда-гурман",emoji:"🐼",gear:"🥐",rarity:"rare",requires:{photos:10}},
  {id:"dino-explorer",name:"Дино-исследователь",emoji:"🦖",gear:"🎧",rarity:"rare",requires:{routes:25}},
  {id:"traveller-seal",name:"Тюлень-путешественник",emoji:"🦭",gear:"🧣",rarity:"rare",requires:{streak:7}},
  {id:"polar-dog",name:"Полярный пёс",emoji:"🐺",gear:"❄️",rarity:"epic",requires:{routes:30}},
  {id:"photographer-bear",name:"Фотограф-медведь",emoji:"🐻",gear:"📸",rarity:"epic",requires:{photos:20}},
  {id:"cartographer-raven",name:"Картограф-ворон",emoji:"🐦‍⬛",gear:"🗺️",rarity:"epic",requires:{quests:25}},
  {id:"snow-leopard",name:"Снежный барс",emoji:"🐆",gear:"🏔️",rarity:"epic",requires:{routes:35,streak:7}},
  {id:"northern-deer",name:"Северный олень",emoji:"🦌",gear:"✨",rarity:"legendary",requires:{routes:45,streak:14}},
  {id:"yakut-bull",name:"Якутский бычок",emoji:"🐂",gear:"🏆",rarity:"legendary",requires:{routes:50}},
  {id:"robot-tourist",name:"Робо-турист",emoji:"🤖",gear:"🧭",rarity:"legendary",requires:{quests:60}},
  {id:"taiga-spirit",name:"Дух тайги",emoji:"🐺",gear:"🌌",rarity:"legendary",requires:{routes:75,photos:25}}
 ];
 const byId=new Map(mascots.map(x=>[x.id,x]));
 const metricNames={routes:"прогулок",photos:"фотопроверок",quests:"заданий",streak:"дней подряд"};
 function localDay(timestamp){
   const d=new Date(timestamp);
   return Number.isFinite(d.getTime())?new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime():NaN;
 }
 function eventsFrom(value){
   const seen=new Set();
   return (Array.isArray(value)?value:[])
     .filter(e=>e&&["route_completed","photo_verified","quest_correct"].includes(e.type)
       &&e.data?.dailyEligible===true&&typeof e.key==="string"&&e.key.length>3
       &&Number.isFinite(Number(e.at))&&Number(e.at)>0)
     .sort((a,b)=>Number(a.at)-Number(b.at))
     .filter(e=>{if(seen.has(e.key))return false;seen.add(e.key);return true});
 }
 function statsOf(input){
   const st={routes:0,photos:0,quests:0,streak:0,km:0};
   const days=new Set();
   for(const e of eventsFrom(input)){
     if(e.type==="route_completed"){
       st.routes++;st.km+=Math.max(0,Number(e.data?.routeDistanceM)||0)/1000;
       days.add(localDay(Number(e.at)));
     }else if(e.type==="photo_verified")st.photos++;
     else if(e.type==="quest_correct")st.quests++;
   }
   const dates=[...days].filter(Number.isFinite).sort((a,b)=>a-b);
   let consecutive=0,previous=null;
   for(const d of dates){
     consecutive=previous!==null&&Math.round((d-previous)/86400000)===1?consecutive+1:1;
     st.streak=Math.max(st.streak,consecutive);previous=d;
   }
   return st;
 }
 function unlocked(m,stats){
   return !!m&&Object.entries(m.requires).every(([key,need])=>(Number(stats[key])||0)>=need);
 }
 function progressOf(m,stats){
   const needs=Object.entries(m.requires);if(!needs.length)return 1;
   return Math.max(0,Math.min(1,...needs.map(([key,need])=>(Number(stats[key])||0)/need)));
 }
 function requirement(m,stats){
   const needs=Object.entries(m.requires);if(!needs.length)return "Доступен с самого начала";
   return needs.map(([key,need])=>
     Math.min(need,Math.max(0,Number(stats[key])||0))+"/"+need+" "+(metricNames[key]||key)).join(" · ");
 }
 function eventExperience(raw){
   const out=[],events=eventsFrom(raw);let routes=0,consecutive=0,lastDay=null;
   for(const e of events){
     let xp=e.type==="route_completed"?100:50;
     if(e.type==="route_completed"){
       routes++;
       const today=localDay(Number(e.at));
       if(today!==lastDay){
         consecutive=lastDay!==null&&Math.round((today-lastDay)/86400000)===1?consecutive+1:1;
         lastDay=today;
         if(consecutive>0&&consecutive%7===0)xp+=200;
       }
       if(routes%25===0)xp+=300;
     }
     out.push({key:e.key,xp});
   }
   return out;
 }
 function initialProgress(raw){
   const x=raw&&typeof raw==="object"?raw:{},xp={};
   mascots.forEach(m=>xp[m.id]=Math.min(1000000,Math.max(0,Math.floor(Number(x.xp?.[m.id])||0))));
   const selected=byId.has(x.selected)?x.selected:"traveller-puppy";
   const seen=Array.isArray(x.seen)?[...new Set(x.seen.filter(y=>typeof y==="string"))].slice(-1600):[];
   return {selected,xp,seen};
 }
 function applyEvents(raw,events){
   const p=initialProgress(raw),seen=new Set(p.seen);
   for(const e of eventExperience(events)){
     if(seen.has(e.key))continue;
     seen.add(e.key);p.xp[p.selected]=Math.min(1000000,p.xp[p.selected]+e.xp);
   }
   p.seen=[...seen].slice(-1600);
   return p;
 }
 function levelFor(xp){return Math.min(MAX_LEVEL,1+Math.floor(Math.max(0,Number(xp)||0)/350))}
 function levelStage(level){return level>=7?"Звезда":level>=4?"Исследователь":"Путник"}
 function bar(xp){return levelFor(xp)===MAX_LEVEL?1:(Math.max(0,Number(xp)||0)%350)/350}
 function select(progress,id,stats){
   const candidate=byId.get(id);
   return candidate&&unlocked(candidate,stats)?{...initialProgress(progress),selected:id}:initialProgress(progress);
 }
 function safeJSON(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||"null")??fallback}catch(e){return fallback}}
 function mount(doc,win){
   const storage=win.localStorage;if(!storage)return;
   const $=s=>doc.querySelector(s);
   let filter="all",current=initialProgress(safeJSON(storage,KEY,{}));
   function events(){return safeJSON(storage,LEDGER,[])}
   function save(){try{storage.setItem(KEY,JSON.stringify(current))}catch(e){}}
   function refresh(){
     const raw=events(),stats=statsOf(raw);
     current=applyEvents(current,raw);
     if(!unlocked(byId.get(current.selected),stats))current.selected="traveller-puppy";
     save();
     const selected=byId.get(current.selected),lv=levelFor(current.xp[selected.id]);
     const owned=mascots.filter(m=>unlocked(m,stats)).length;
     const count=$("#mascotOwnedCount");if(count)count.textContent=owned+"/"+mascots.length;
     const statsNote=$("#mascotXPStatus");
     if(statsNote)statsNote.textContent="Подтверждено: "+stats.routes+" прогулок · "+stats.photos+" фото · "+stats.quests+" заданий";
     const hero=$("#mascotEquipped");
     if(hero){
       hero.innerHTML='<div class="mascot-equipped-avatar rarity-'+selected.rarity+' level-'+(lv>=7?'star':lv>=4?'explorer':'beginner')+'"><span aria-hidden="true">'+selected.emoji+'</span><b>'+(lv>=7?'🌟':lv>=4?'✨':selected.gear)+'</b></div>'
         +'<div class="mascot-equipped-copy"><small>ВАШ СПУТНИК</small><h2>'+selected.name+'</h2>'
         +'<p>'+rarities[selected.rarity].name+' · Уровень '+lv+' · '+levelStage(lv)+'</p>'
         +'<div class="mascot-xp-meter" aria-label="Прогресс уровня"><span style="width:'+Math.round(bar(current.xp[selected.id])*100)+'%"></span></div>'
         +'<small>Опыт: '+current.xp[selected.id]+' XP'+(lv===MAX_LEVEL?' · Максимальный уровень':' · до нового уровня '+(350-current.xp[selected.id]%350)+' XP')+'</small></div>';
     }
     const grid=$("#mascotCollectionGrid");
     if(grid){
       grid.replaceChildren();
       for(const m of mascots){
         if(filter!=="all"&&m.rarity!==filter)continue;
         const isOwned=unlocked(m,stats),isSelected=current.selected===m.id;
         const card=doc.createElement("article");
         card.className="mascot-card rarity-"+m.rarity+(isOwned?"":" locked")+(isSelected?" selected":"");
         card.dataset.mascotId=m.id;
         const tier=doc.createElement("div");tier.className="mascot-card-tier";tier.textContent=rarities[m.rarity].icon+" "+rarities[m.rarity].name;
         const avatar=doc.createElement("div");const mLevel=levelFor(current.xp[m.id]);avatar.className="mascot-card-avatar level-"+(mLevel>=7?"star":mLevel>=4?"explorer":"beginner");
         const face=doc.createElement("span");face.setAttribute("aria-hidden","true");face.textContent=m.emoji;
         const gear=doc.createElement("b");gear.textContent=mLevel>=7?"🌟":mLevel>=4?"✨":m.gear;avatar.append(face,gear);
         const title=doc.createElement("h3");title.textContent=m.name;
         const hint=doc.createElement("p");hint.className="mascot-card-condition";
         hint.textContent=isOwned?"Уровень "+levelFor(current.xp[m.id])+" · "+levelStage(levelFor(current.xp[m.id])):requirement(m,stats);
         const meter=doc.createElement("div");meter.className="mascot-mini-meter";
         const fill=doc.createElement("span");fill.style.width=Math.round((isOwned?bar(current.xp[m.id]):progressOf(m,stats))*100)+"%";
         meter.append(fill);
         const action=doc.createElement("button");
         action.type="button";action.className="mascot-action";
         action.textContent=!isOwned?"🔒 Не открыт":isSelected?"✓ Ваш спутник":"Выбрать спутника";
         action.disabled=!isOwned||isSelected;
         if(isOwned&&!isSelected){
           action.dataset.equipMascot=m.id;
           action.setAttribute("aria-label","Выбрать спутника "+m.name);
         }
         card.append(tier,avatar,title,hint,meter,action);
         grid.append(card);
       }
     }
     const home=$("#mascotHomeAvatar"),homeImage=$("#mascotHomeOriginal");
     if(home){home.textContent=selected.emoji;home.hidden=selected.id==="traveller-puppy"}
     if(homeImage)homeImage.hidden=selected.id!=="traveller-puppy";
     const homeTitle=$("#mascotHomeTitle");if(homeTitle)homeTitle.textContent=selected.name+" · ур. "+lv;
     const homeSub=$("#mascotHomeSubtitle");
     if(homeSub)homeSub.textContent="Ваш спутник в прогулках. Открывайте новых за маршруты и задания.";
     const buddy=$("#mascotRouteBuddy");
     if(buddy)buddy.innerHTML='<span aria-hidden="true">'+selected.emoji+'</span><div><b>'+selected.name+'</b><small>Ваш спутник · уровень '+lv+'</small></div>';
     const profile=$("#mascotProfileCurrent");
     if(profile)profile.textContent=selected.emoji+" "+selected.name+" · уровень "+lv;
     doc.querySelectorAll("[data-mascot-filter]").forEach(b=>{
       const active=b.dataset.mascotFilter===filter;
       b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
     });
     return {stats,selected:current.selected,owned,level:lv,progress:current};
   }
   doc.addEventListener("click",function(e){
     const filterButton=e.target.closest("[data-mascot-filter]");
     if(filterButton){filter=filterButton.dataset.mascotFilter||"all";refresh();return}
     const equip=e.target.closest("[data-equip-mascot]");
     if(!equip)return;
     const id=equip.dataset.equipMascot,stats=statsOf(events());
     if(!unlocked(byId.get(id),stats))return;
     current=select(current,id,stats);save();refresh();
   });
   win.addEventListener("rr:verified-event",refresh);
   win.addEventListener("storage",function(e){if(e.key===LEDGER||e.key===KEY){if(e.key===KEY)current=initialProgress(safeJSON(storage,KEY,{}));refresh()}});
   win.__rrMascotRefresh=refresh;
   refresh();
 }
 return {KEY,LEDGER,mascots,rarities,eventsFrom,statsOf,unlocked,progressOf,
   requirement,eventExperience,initialProgress,applyEvents,levelFor,levelStage,bar,select,mount};
});
