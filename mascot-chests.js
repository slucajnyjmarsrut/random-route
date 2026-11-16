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
 const KEY="rr_mascot_chests_v1",TESTER_KEY="rr_mascot_chests_tester_v1",PITY_LIMIT=12;
 const TIERS=["common","uncommon","rare","epic","legendary"];
 const LABELS={common:"Обычный",uncommon:"Необычный",rare:"Редкий",epic:"Эпический",legendary:"Легендарный"};
 const CHESTS=[
   {id:"trail",name:"Походный",icon:"🎒",price:80,description:"Для первых открытий",weights:{common:60,uncommon:30,rare:9,epic:1,legendary:0}},
   {id:"polar",name:"Северный",icon:"🧊",price:240,description:"Больше редких спутников",weights:{common:20,uncommon:40,rare:29,epic:10,legendary:1}},
   {id:"aurora",name:"Сияние",icon:"🌌",price:600,description:"Повышенный шанс эпических",weights:{common:0,uncommon:10,rare:45,epic:35,legendary:10}}
 ];
 function normalize(raw,mascots){
   const ids=new Set((mascots||[]).map(m=>m.id));
   const obj=raw&&typeof raw==="object"?raw:{};
   const owned=[...new Set((Array.isArray(obj.owned)?obj.owned:[]).filter(id=>ids.has(id)))];
   const opened=Number.isSafeInteger(obj.opened)?Math.min(1000000,Math.max(0,obj.opened)):0;
   const pity=Number.isSafeInteger(obj.pity)?Math.min(PITY_LIMIT-1,Math.max(0,obj.pity)):0;
   const v=obj.last&&typeof obj.last==="object"?obj.last:null;
   const last=v&&ids.has(v.mascotId)&&CHESTS.some(c=>c.id===v.chestId)
     ?{mascotId:v.mascotId,chestId:v.chestId,guaranteed:v.guaranteed===true}:null;
   return {owned,opened,pity,last};
 }
 function availableMascots(mascots,stats,owned,unlocked){
   const granted=new Set(owned);
   return mascots.filter(m=>!granted.has(m.id)&&!unlocked(m,stats));
 }
 function weightMap(chest,available,pity){
   const counts=Object.fromEntries(TIERS.map(t=>[t,available.filter(m=>m.rarity===t).length]));
   let weights=Object.fromEntries(TIERS.map(t=>[t,counts[t]>0?chest.weights[t]||0:0]));
   const guaranteed=pity>=PITY_LIMIT-1&&(weights.epic>0||weights.legendary>0);
   if(guaranteed)weights=Object.fromEntries(TIERS.map(t=>[t,(t==="epic"||t==="legendary")?weights[t]:0]));
   const sum=Object.values(weights).reduce((n,x)=>n+x,0);
   return {guaranteed,weights:Object.fromEntries(TIERS.map(t=>[t,sum?weights[t]*100/sum:0]))};
 }
 function randomFraction(rng){
   const v=Number(rng());
   return Number.isFinite(v)?Math.min(0.9999999999999999,Math.max(0,v)):0;
 }
 function draw(chest,available,pity,rng=Math.random){
   if(!chest||!Array.isArray(available))return null;
   const {weights,guaranteed}=weightMap(chest,available,pity);
   let value=randomFraction(rng)*100,tier=null;
   for(const name of TIERS){
     if(weights[name]<=0)continue;
     value-=weights[name];
     if(value<0){tier=name;break}
   }
   if(!tier)return null;
   const candidates=available.filter(m=>m.rarity===tier);
   const mascot=candidates[Math.floor(randomFraction(rng)*candidates.length)];
   return {mascot,rarity:tier,guaranteed,nextPity:(tier==="epic"||tier==="legendary")?0:Math.min(PITY_LIMIT-1,pity+1)};
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
     try{return normalize(JSON.parse(storage.getItem(key())||"null"),M.mascots)}
     catch(e){return normalize(null,M.mascots)}
   }
   function collect(){
     let events=[];try{events=JSON.parse(storage.getItem(M.LEDGER)||"[]")}catch(e){}
     const state=read();
     return {state,available:availableMascots(M.mascots,M.statsOf(events),state.owned,M.unlocked)};
   }
   function report(message,rarity){
     status.hidden=false;
     status.className="mascot-chest-result"+(rarity?" rarity-"+rarity:"");
     status.textContent=message;
   }
   function refresh(){
     const {state,available}=collect(),balance=Number(win.state?.coins)||0;
     const counter=doc.getElementById("mascotChestProgress");
     if(counter)counter.textContent="Открыто сундуков: "+state.opened+" · До гарантии эпического или легендарного: "+(PITY_LIMIT-state.pity);
     const wallet=doc.getElementById("mascotChestBalance");
     if(wallet)wallet.textContent="Баланс: "+balance+" RC";
     grid.replaceChildren();
     for(const chest of CHESTS){
       const odds=weightMap(chest,available,state.pity);
       const hasPool=Object.values(odds.weights).some(w=>w>0);
       const card=doc.createElement("article");card.className="mascot-chest-card chest-"+chest.id;
       const icon=doc.createElement("div");icon.className="mascot-chest-icon";icon.textContent=chest.icon;
       const title=doc.createElement("h3");title.textContent=chest.name;
       const description=doc.createElement("p");description.textContent=chest.description;
       const chance=doc.createElement("div");chance.className="mascot-chest-odds";
       chance.textContent=hasPool?TIERS.filter(t=>odds.weights[t]>0).map(t=>
         LABELS[t]+": "+odds.weights[t].toFixed(1).replace(/\.0$/,"")+"%").join(" · "):"Все доступные награды этого сундука уже собраны";
       const button=doc.createElement("button");button.type="button";button.dataset.openMascotChest=chest.id;
       button.textContent="Открыть за "+chest.price+" RC";button.disabled=!hasPool;
       if(hasPool&&balance<chest.price)button.title="Не хватает RouteCoin";
       if(odds.guaranteed){const note=doc.createElement("strong");note.className="mascot-chest-guarantee";note.textContent="✨ Гарантирован эпический или легендарный";card.append(note)}
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
       if(!available.length){report("Коллекция уже собрана!");return}
       if((Number(win.state?.coins)||0)<chest.price){report("Недостаточно RouteCoin для этого сундука.");return}
       if(typeof win.__rrSpendForMascotChest!=="function"){report("Кошелёк ещё не готов. Откройте раздел повторно.");return}
       const result=draw(chest,available,state.pity,secureRandom);
       if(!result){report("В этом сундуке больше нет новых маскотов. Попробуйте другой.");return}
       const saveKey=key(),before=storage.getItem(saveKey);
       const next={...state,owned:[...state.owned,result.mascot.id],opened:state.opened+1,
         pity:result.nextPity,last:{mascotId:result.mascot.id,chestId:chest.id,guaranteed:result.guaranteed}};
       try{storage.setItem(saveKey,JSON.stringify(next))}
       catch(e){report("Не удалось сохранить коллекцию. Монеты не списаны.");return}
       if(!win.__rrSpendForMascotChest(chest.price)){
         try{if(before===null)storage.removeItem(saveKey);else storage.setItem(saveKey,before)}catch(e){}
         report("Не удалось списать RouteCoin. Попробуйте ещё раз.");return;
       }
       report("🎉 "+result.mascot.emoji+" "+result.mascot.name+" — "+LABELS[result.rarity].toLowerCase()+" спутник!"+(result.guaranteed?" Сработала гарантия.":""),result.rarity);
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
 return {KEY,TESTER_KEY,PITY_LIMIT,CHESTS,TIERS,LABELS,normalize,availableMascots,weightMap,draw,mount};
});
