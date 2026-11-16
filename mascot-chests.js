/* Virtual RouteCoin mascot chests. Local-only collection; no real-money payments. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.RRMascotChests=api;
   const start=()=>api.mount(root.document,root);
   if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",start,{once:true});
   else start();
 }
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const KEY="rr_mascot_chests_v2",TESTER_KEY="rr_mascot_chests_tester_v2";
 const LEGACY_KEY="rr_mascot_chests_v1",LEGACY_TESTER_KEY="rr_mascot_chests_tester_v1";
 const START_CAPACITY=50,MAX_CAPACITY=150;
 const TIERS=["common","uncommon","rare","epic","legendary"];
 const LABELS={common:"Обычный",uncommon:"Необычный",rare:"Редкий",epic:"Эпический",legendary:"Легендарный"};
 const CHESTS=[
   {id:"trail",name:"Походный",icon:"🎒",price:80,description:"Для первых открытий",weights:{common:70,uncommon:22,rare:7,epic:1,legendary:0}},
   {id:"polar",name:"Северный",icon:"🧊",price:240,description:"Больше редких спутников",weights:{common:60,uncommon:22,rare:13,epic:4,legendary:1}},
   {id:"aurora",name:"Сияние",icon:"🌌",price:600,description:"Повышенный шанс эпических",weights:{common:55,uncommon:20,rare:14,epic:8,legendary:3}}
 ];
 function normalize(raw,mascots){
   const ids=new Set((mascots||[]).map(m=>m.id)),obj=raw&&typeof raw==="object"?raw:{};
   const owned=[...new Set((Array.isArray(obj.owned)?obj.owned:[]).filter(id=>ids.has(id)))];
   const copies={};
   if(obj.copies&&typeof obj.copies==="object"){
     for(const [id,n] of Object.entries(obj.copies))
       if(ids.has(id)&&Number.isSafeInteger(n)&&n>0)copies[id]=Math.min(10000,n);
   }else{
     // One-time migration from no-repeat chests: every previously collected
     // mascot remains owned and has one inventory copy.
     for(const id of owned)copies[id]=1;
   }
   const ranks={};
   if(obj.ranks&&typeof obj.ranks==="object")
     for(const [id,n] of Object.entries(obj.ranks))
       if(ids.has(id)&&Number.isSafeInteger(n)&&n>=2)ranks[id]=Math.min(5,n);
   const opened=Number.isSafeInteger(obj.opened)?Math.min(1000000,Math.max(0,obj.opened)):0;
   const v=obj.last&&typeof obj.last==="object"?obj.last:null;
   const last=v&&ids.has(v.mascotId)&&CHESTS.some(c=>c.id===v.chestId)
     ?{mascotId:v.mascotId,chestId:v.chestId,duplicate:!!v.duplicate}:null;
   const capacity=Math.min(MAX_CAPACITY,Math.max(START_CAPACITY,Number.isSafeInteger(obj.capacity)?obj.capacity:START_CAPACITY));
   return {owned,copies,ranks,capacity,opened,last};
 }
 function occupied(state){return Object.values(state.copies||{}).reduce((sum,n)=>sum+n,0)}
 function availableMascots(mascots){return Array.isArray(mascots)?mascots:[]}
 function weightMap(chest,available){
   const counts=Object.fromEntries(TIERS.map(t=>[t,available.filter(m=>m.rarity===t).length]));
   const weights=Object.fromEntries(TIERS.map(t=>[t,counts[t]>0?chest.weights[t]||0:0]));
   const sum=Object.values(weights).reduce((n,x)=>n+x,0);
   return {weights:Object.fromEntries(TIERS.map(t=>[t,sum?weights[t]*100/sum:0]))};
 }
 function randomFraction(rng){
   const v=Number(rng());
   return Number.isFinite(v)?Math.min(0.9999999999999999,Math.max(0,v)):0;
 }
 function draw(chest,available,rng=Math.random){
   if(!chest||!Array.isArray(available))return null;
   const {weights}=weightMap(chest,available);
   let value=randomFraction(rng)*100,tier=null;
   for(const name of TIERS){
     if(weights[name]<=0)continue;
     value-=weights[name];
     if(value<0){tier=name;break}
   }
   if(!tier)return null;
   const candidates=available.filter(m=>m.rarity===tier);
   const mascot=candidates[Math.floor(randomFraction(rng)*candidates.length)];
   return {mascot,rarity:tier};
 }
 function secureRandom(){
   try{
     if(typeof crypto!=="undefined"&&crypto.getRandomValues){
       const data=new Uint32Array(1);
       crypto.getRandomValues(data);
       return data[0]/4294967296;
     }
   }catch(e){}
   return Math.random();
 }
 function mount(doc,win){
   const M=win.RRMascots,storage=win.localStorage;
   const grid=doc.getElementById("mascotChestGrid"),status=doc.getElementById("mascotChestResult");
   if(!M||!storage||!grid||!status)return;
   let busy=false;
   const mode=()=>win.__rrWalletMode?.()==="tester"?"tester":"normal";
   const key=()=>mode()==="tester"?TESTER_KEY:KEY;
   function read(){
     try{
       const actual=storage.getItem(key());
       if(actual!==null)return normalize(JSON.parse(actual),M.mascots);
       const prior=storage.getItem(mode()==="tester"?LEGACY_TESTER_KEY:LEGACY_KEY);
       return normalize(prior===null?null:JSON.parse(prior),M.mascots);
     }catch(e){return normalize(null,M.mascots)}
   }
   function collect(){
     let events=[];try{events=JSON.parse(storage.getItem(M.LEDGER)||"[]")}catch(e){}
     const state=read();
     return {state,available:availableMascots(M.mascots)};
   }
   function report(message,rarity,mascot){
     status.hidden=false;
     status.className="mascot-chest-result"+(rarity?" rarity-"+rarity:"");
     status.replaceChildren();
     if(!mascot){status.textContent=message;return;}
     const reveal=doc.createElement("div");
     reveal.className="mascot-chest-reveal";
     const art=doc.createElement("img");
     art.className="mascot-chest-reveal-art";
     art.src=win.RRMascotArt?.avatar?.(mascot)||"";
     art.alt="";art.width=130;art.height=130;art.loading="eager";
     const details=doc.createElement("div");
     const heading=doc.createElement("strong");heading.textContent=message;
     const rarityLabel=doc.createElement("span");
     rarityLabel.textContent="★ "+LABELS[rarity]+" · Открыть коллекцию →";
     details.append(heading,rarityLabel);
     reveal.append(art,details);
     status.append(reveal);
   }
   function refresh(){
     const {state,available}=collect(),balance=Number(win.state?.coins)||0;
     const counter=doc.getElementById("mascotChestProgress");
     if(counter)counter.textContent="Открыто сундуков: "+state.opened+" · Инвентарь "+occupied(state)+"/"+state.capacity+" · Повторы возможны, гарантий нет.";
     const wallet=doc.getElementById("mascotChestBalance");
     if(wallet)wallet.textContent="Баланс: "+balance+" RC";
     grid.replaceChildren();
     for(const chest of CHESTS){
       const odds=weightMap(chest,available);
       const hasPool=Object.values(odds.weights).some(w=>w>0);
       const card=doc.createElement("article");card.className="mascot-chest-card chest-"+chest.id;
       const icon=doc.createElement("div");icon.className="mascot-chest-icon";icon.textContent=chest.icon;
       const title=doc.createElement("h3");title.textContent=chest.name;
       const description=doc.createElement("p");description.textContent=chest.description;
       const chance=doc.createElement("div");chance.className="mascot-chest-odds";
       chance.textContent=hasPool?TIERS.filter(t=>odds.weights[t]>0).map(t=>
         LABELS[t]+": "+odds.weights[t].toFixed(1).replace(/\.0$/,"")+"%").join(" · "):"Все доступные награды этого сундука уже собраны";
       const button=doc.createElement("button");button.type="button";button.dataset.openMascotChest=chest.id;
       button.textContent="Открыть за "+chest.price+" RC";button.disabled=!hasPool||occupied(state)>=state.capacity;
       if(occupied(state)>=state.capacity)button.title="Инвентарь заполнен — используйте дубликаты или расширьте слоты";
       else if(hasPool&&balance<chest.price)button.title="Не хватает RouteCoin";
       card.append(icon,title,description,chance,button);
       grid.append(card);
     }
   }
   function open(id){
     if(busy)return;
     const chest=CHESTS.find(c=>c.id===id);if(!chest)return;
     busy=true;
     try{
       const {state,available}=collect();
       if(occupied(state)>=state.capacity){report("Инвентарь заполнен! Улучшите маскота или расширьте вместимость.");return}
       if((Number(win.state?.coins)||0)<chest.price){report("Недостаточно RouteCoin для этого сундука.");return}
       if(typeof win.__rrSpendForMascotChest!=="function"){report("Кошелёк ещё не готов. Откройте раздел повторно.");return}
       const result=draw(chest,available,secureRandom);
       if(!result){report("В этом сундуке сейчас нет награды.");return}
       const saveKey=key(),before=storage.getItem(saveKey);
       const duplicate=state.owned.includes(result.mascot.id)||M.unlocked(result.mascot,M.statsOf(JSON.parse(storage.getItem(M.LEDGER)||"[]")));
       const next={...state,owned:[...new Set([...state.owned,result.mascot.id])],
         copies:{...state.copies,[result.mascot.id]:(state.copies[result.mascot.id]||0)+1},opened:state.opened+1,
         last:{mascotId:result.mascot.id,chestId:chest.id,duplicate}};
       try{storage.setItem(saveKey,JSON.stringify(next))}
       catch(e){report("Не удалось сохранить коллекцию. Монеты не списаны.");return}
       if(!win.__rrSpendForMascotChest(chest.price)){
         try{if(before===null)storage.removeItem(saveKey);else storage.setItem(saveKey,before)}catch(e){}
         report("Не удалось списать RouteCoin. Попробуйте ещё раз.");return;
       }
       report((duplicate?"🔁 Дубликат! ":"🎉 Новый спутник! ")+result.mascot.name+" · "+LABELS[result.rarity].toLowerCase()+" · теперь копий: "+next.copies[result.mascot.id],result.rarity,result.mascot);
       win.dispatchEvent(new Event("rr:mascot-chest-opened"));
       refresh();
     }finally{busy=false}
   }
   grid.addEventListener("click",function(e){
     const button=e.target.closest("[data-open-mascot-chest]");
     if(button&&!button.disabled)open(button.dataset.openMascotChest);
   });
   win.addEventListener("rr:coins-changed",refresh);
   win.addEventListener("rr:verified-event",refresh);
   win.addEventListener("rr:wallet-changed",function(){status.hidden=true;refresh()});
   win.addEventListener("storage",function(e){if(e.key===KEY||e.key===TESTER_KEY||e.key===M.LEDGER)refresh()});
   win.__rrChestRefresh=refresh;
   refresh();
 }
 return {KEY,TESTER_KEY,LEGACY_KEY,LEGACY_TESTER_KEY,CHESTS,TIERS,LABELS,START_CAPACITY,MAX_CAPACITY,occupied,normalize,availableMascots,weightMap,draw,mount};
});
