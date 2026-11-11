/* Удобные зоны нажатия — один смысл, одна кнопка.
 * Цена/RouteCoin сами по себе не являются кнопкой там, где выбран весь блок.
 * Сложные формы, карты, настройки, списания монет и подтверждения НЕ перехватываются.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.RRClickTargets=api;
   if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",()=>api.mount(root.document),{once:true});
   else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const ACTIVATION_KEYS=new Set(["Enter"," ","Spacebar"]);
 function makeInfoButton(card){
   if(!card||card.dataset?.tapReady==="1")return false;
   if(card.querySelector("button,input,select,textarea,a[href]"))return false;
   card.dataset.tapReady="1";
   card.classList.add("tap-info-card");
   card.setAttribute("role","button");
   card.setAttribute("tabindex","0");
   card.setAttribute("aria-label","Подробнее: "+(card.dataset.infoTitle||card.querySelector("b")?.textContent||"информация"));
   card.addEventListener("keydown",e=>{
     if(e.target!==card||!ACTIVATION_KEYS.has(e.key))return;
     e.preventDefault();
     if(e.repeat)return;
     card.click();
   });
   return true;
 }
 function makeOneActionCard(card,selector){
   if(!card||card.dataset?.tapReady==="1")return false;
   const controls=card.querySelectorAll("button,a[href],input,select,textarea");
   const button=card.querySelector(selector);
   // Never choose between multiple controls or relay a destructive action.
   if(!button||controls.length!==1||!button.matches('button[data-buy-type]'))return false;
   const title=button.dataset.title||card.querySelector("h3")?.textContent||"предложение";
   const label="Подробнее о "+title+(button.dataset.price?", "+button.dataset.price:"");
   card.dataset.tapReady="1";
   card.classList.add("tap-whole-card");
   card.setAttribute("role","button");
   card.setAttribute("tabindex","0");
   card.setAttribute("aria-label",label);
   button.setAttribute("aria-hidden","true");
   button.tabIndex=-1;
   button.classList.add("tap-delegated-button");
   const sync=()=>{
     const disabled=!!button.disabled;
     card.classList.toggle("tap-card-disabled",disabled);
     card.setAttribute("aria-disabled",String(disabled));
   };
   card.addEventListener("click",e=>{
     // Programmatic button.click() bubbles here: never click twice.
     if(e.target===button||button.contains(e.target)||e.target.closest("button,a[href],input,select,textarea"))return;
     if(!button.disabled)button.click();
   });
   card.addEventListener("keydown",e=>{
     if(e.target!==card||!ACTIVATION_KEYS.has(e.key))return;
     e.preventDefault();
     if(e.repeat)return;
     if(!button.disabled)button.click();
   });
   sync();
   if(typeof MutationObserver!=="undefined"){
     const ob=new MutationObserver(sync);
     ob.observe(button,{attributes:true,attributeFilter:["disabled"]});
   }
   return true;
 }
 function makeMultiActionDetail(card){
   if(!card||card.dataset?.tapDetailReady==="1")return false;
   card.dataset.tapDetailReady="1";
   card.classList.add("tap-detail-card");
   // A distinct secondary action may be present: keep it independently focusable.
   card.setAttribute("role","group");
   card.setAttribute("tabindex","0");
   const name=card.querySelector("b,strong")?.textContent?.trim()||"объект";
   card.setAttribute("aria-label","Подробнее об объекте: "+name+"; дополнительные действия доступны внутри карточки");
   card.addEventListener("keydown",e=>{
     if(e.target!==card||!ACTIVATION_KEYS.has(e.key))return;
     e.preventDefault();if(!e.repeat)card.click();
   });
   return true;
 }
 function mount(doc){
   doc.querySelectorAll("#quickInfoGrid .quick-info-card").forEach(makeInfoButton);
   doc.querySelectorAll(".coin-pack").forEach(card=>makeOneActionCard(card,'button[data-buy-type="coins"]'));
   doc.querySelectorAll(".feature-card").forEach(card=>makeOneActionCard(card,'button[data-buy-type="feature"]'));
   function detailCards(root){
     if(!root)return;
     root.querySelectorAll?.("[data-badge-card],[data-discovery-name]").forEach(makeMultiActionDetail);
     if(root.matches?.("[data-badge-card],[data-discovery-name]"))makeMultiActionDetail(root);
   }
   detailCards(doc);
   if(typeof MutationObserver!=="undefined"){
     for(const id of ["abilityBadgeList","yakutskDiscoveries"]){
       const container=doc.getElementById(id);if(!container)continue;
       const obs=new MutationObserver(mutations=>{
         for(const m of mutations)for(const node of m.addedNodes||[])if(node.nodeType===1)detailCards(node);
       });
       obs.observe(container,{childList:true,subtree:true});
     }
   }
 }
 return {makeInfoButton,makeOneActionCard,makeMultiActionDetail,mount};
});
