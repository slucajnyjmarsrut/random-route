/* Free, locally stored mascot inventory and duplicate-based upgrades. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document){root.RRMascotInventory=api;
  const boot=()=>api.mount(root.document,root);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 }
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const EXPAND_PRICE=150;
 function copiesNeeded(rank,isEarned){return isEarned?rank:rank+1}
 function canUpgrade(state,id,stats,M){
   const m=M.mascots.find(m=>m.id===id);
   if(!m||!(state.owned.includes(id)||M.unlocked(m,stats)))return false;
   const rank=state.ranks[id]||1;
   return rank<5&&(state.copies[id]||0)>=copiesNeeded(rank,M.unlocked(m,stats));
 }
 function upgrade(state,id,stats,M){
   if(!canUpgrade(state,id,stats,M))return null;
   const m=M.mascots.find(m=>m.id===id),rank=state.ranks[id]||1,
     need=copiesNeeded(rank,M.unlocked(m,stats));
   const next={...state,copies:{...state.copies},ranks:{...state.ranks}};
   next.copies[id]-=rank; // Consume duplicates; keep the base chest copy.
   if(next.copies[id]===0)delete next.copies[id];
   next.ranks[id]=rank+1;return next;
 }
 function expand(state){
   if(state.capacity>=150)return null;
   return {...state,capacity:Math.min(150,state.capacity+10)};
 }
 function mount(doc,win){
   const M=win.RRMascots,C=win.RRMascotChests,storage=win.localStorage;
   if(!M||!C||!storage)return;
   const $=s=>doc.querySelector(s),panels=['collection','chests','inventory','upgrades'];
   const key=()=>win.__rrWalletMode?.()==='tester'?C.TESTER_KEY:C.KEY;
   const legacy=()=>win.__rrWalletMode?.()==='tester'?C.LEGACY_TESTER_KEY:C.LEGACY_KEY;
   function read(){
     try{
       const s=storage.getItem(key())??storage.getItem(legacy());
       return C.normalize(s===null?null:JSON.parse(s),M.mascots);
     }catch(e){return C.normalize(null,M.mascots)}
   }
   function ledger(){try{return JSON.parse(storage.getItem(M.LEDGER)||'[]')}catch(e){return []}}
   function stats(){return M.statsOf(ledger())}
   function save(state){storage.setItem(key(),JSON.stringify(state))}
   function feedback(message,warning=false){
     const el=$('#mascotInventoryMessage');
     if(el){el.hidden=false;el.textContent=message;el.dataset.warning=warning?'1':'0';}
   }
   let active='collection';
   function switchTab(panel){
     active=panels.includes(panel)?panel:'collection';
     for(const name of panels){
       const el=$('#mascot'+name[0].toUpperCase()+name.slice(1)+'Panel');
       if(el)el.hidden=name!==active;
     }
     doc.querySelectorAll('[data-mascot-tab]').forEach(b=>{
       const chosen=b.dataset.mascotTab===active;
       b.classList.toggle('active',chosen);b.setAttribute('aria-selected',String(chosen));
     });
     refresh();
   }
   function createCard(m,state,stats,forUpgrade){
     const item=doc.createElement('article');item.className='mascot-inventory-card rarity-'+m.rarity;
     const image=doc.createElement('img');image.alt='';image.loading='lazy';
     image.className='mascot-inventory-art';image.src=win.RRMascotArt?.avatar?.(m)||'';
     const copy=Number(state.copies[m.id]||0),rank=Number(state.ranks[m.id]||1),isEarned=M.unlocked(m,stats),
       cost=copiesNeeded(rank,isEarned),eligible=canUpgrade(state,m.id,stats,M);
     const name=doc.createElement('h3');name.textContent=m.name;
     const text=doc.createElement('p');
     text.textContent='★ '+rank+'/5 · '+copy+' '+(copy===1?'копия':'копий')+' · '+M.rarities[m.rarity].name;
     const action=doc.createElement('button');action.type='button';action.dataset.upgradeMascot=m.id;
     action.textContent=rank>=5?'Максимальный ранг':eligible?'Улучшить ★ '+(rank+1):'Нужно копий: '+cost;
     action.disabled=!eligible;
     item.append(image,name,text);
     if(forUpgrade){
       const desc=doc.createElement('small');desc.textContent='Нужно иметь '+cost+' копий; улучшение расходует '+rank+' дубликат(ов). '+(isEarned?'Базовый маскот открыт за достижения.':'Одна базовая копия сохраняется.');
       item.append(desc,action);
     }else{
       const jump=doc.createElement('button');jump.type='button';jump.dataset.jumpUpgrade=m.id;
       jump.textContent='Улучшить';jump.className='mascot-inventory-secondary';
       item.append(jump);
     }
     return item;
   }
   function refresh(){
     const state=read(),status=stats(),used=C.occupied(state),owned=new Set(state.owned);
     const summary=$('#mascotInventoryStatus');
     if(summary)summary.textContent='Инвентарь: '+used+'/'+state.capacity+' мест · получено '+state.opened+' сундуков';
     const capacity=$('#mascotInventoryCapacity');
     if(capacity)capacity.textContent='Занято '+used+' из '+state.capacity+' · максимум 150';
     const more=$('#mascotExpandCapacity');
     if(more){more.disabled=state.capacity>=150;more.textContent=state.capacity>=150?'Максимум 150 слотов':'Добавить 10 мест за '+EXPAND_PRICE+' RC';}
     const list=M.mascots.filter(m=>(state.copies[m.id]||0)>0)
       .sort((a,b)=>(state.copies[b.id]||0)-(state.copies[a.id]||0)||a.name.localeCompare(b.name,'ru'));
     const inventory=$('#mascotInventoryGrid');
     if(inventory){
       inventory.replaceChildren();
       if(!list.length){const p=doc.createElement('p');p.textContent='Инвентарь пуст. Получите первого спутника из сундука за заработанные RouteCoin.';inventory.append(p);}
       for(const m of list)inventory.append(createCard(m,state,status,false));
     }
     const upgrades=$('#mascotUpgradesGrid');
     if(upgrades){
       upgrades.replaceChildren();
       const candidates=M.mascots.filter(m=>owned.has(m.id)||M.unlocked(m,status))
        .sort((a,b)=>Number(canUpgrade(state,b.id,status,M))-Number(canUpgrade(state,a.id,status,M))||
          (state.copies[b.id]||0)-(state.copies[a.id]||0));
       for(const m of candidates)upgrades.append(createCard(m,state,status,true));
     }
     const full=$('#mascotInventoryFull');
     if(full)full.hidden=used<state.capacity;
     return {state,status,used};
   }
   doc.addEventListener('click',function(e){
     const tab=e.target.closest('[data-mascot-tab]');
     if(tab){switchTab(tab.dataset.mascotTab);return;}
     const jump=e.target.closest('[data-jump-upgrade]');
     if(jump){switchTab('upgrades');const card=$('[data-upgrade-mascot="'+jump.dataset.jumpUpgrade+'"]');card?.focus?.();return;}
     const upgradeButton=e.target.closest('[data-upgrade-mascot]');
     if(upgradeButton){
       const id=upgradeButton.dataset.upgradeMascot,old=read(),next=upgrade(old,id,stats(),M);
       if(!next){feedback('Для улучшения не хватает дубликатов или достигнут максимальный ранг.',true);return;}
       try{save(next);feedback('Улучшение успешно: ★ '+(next.ranks[id]||1)+'!');}
       catch(err){feedback('Ошибка сохранения. Улучшение не применено.',true);return;}
       win.dispatchEvent(new Event('rr:mascot-upgraded'));refresh();return;
     }
     const expandButton=e.target.closest('#mascotExpandCapacity');
     if(expandButton){
       const old=read(),next=expand(old);
       if(!next){feedback('Достигнут максимальный инвентарь.',true);return;}
       if((Number(win.state?.coins)||0)<EXPAND_PRICE){feedback('Не хватает заработанных RouteCoin.',true);return;}
       if(typeof win.__rrSpendForMascotChest!=='function'){feedback('Кошелёк пока недоступен.',true);return;}
       const oldRaw=storage.getItem(key());
       try{save(next)}catch(err){feedback('Не удалось сохранить новые слоты.',true);return;}
       if(!win.__rrSpendForMascotChest(EXPAND_PRICE)){
         try{if(oldRaw===null)storage.removeItem(key());else storage.setItem(key(),oldRaw)}catch(err){}
         feedback('Списание не выполнено. Инвентарь не изменён.',true);return;
       }
       feedback('Добавлено 10 мест в инвентаре!');refresh();return;
     }
   });
   win.addEventListener('rr:mascot-chest-opened',refresh);
   win.addEventListener('rr:mascot-upgraded',refresh);
   win.addEventListener('rr:wallet-changed',refresh);
   win.addEventListener('rr:verified-event',refresh);
   win.addEventListener('storage',function(e){if(e.key===C.KEY||e.key===C.TESTER_KEY||e.key===C.LEGACY_KEY||e.key===C.LEGACY_TESTER_KEY||e.key===M.LEDGER)refresh()});
   win.__rrMascotInventoryRefresh=refresh;
   switchTab('collection');
 }
 return {EXPAND_PRICE,copiesNeeded,canUpgrade,upgrade,expand,mount};
});