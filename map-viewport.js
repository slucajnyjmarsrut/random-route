/* Full screen map control. Keeps the same Yandex/Leaflet map instance and
 * does not change route geometry, GPS state, or coins. */
(function(root){
 "use strict";
 if(!root||!root.document)return;
 var doc=root.document, open=null, previousFocus=null;
 function refit(){
   try{root.__rrResizeMaps?.()}catch(e){}
   try{root.__rrResizeFallbackMaps?.()}catch(e){}
 }
 function frame(f){root.requestAnimationFrame(function(){refit();root.setTimeout(refit,150);root.setTimeout(refit,450)})}
 function close(){
   if(!open)return;
   var target=open.target,mark=open.placeholder,button=open.button;
   target.classList.remove("rr-map-expanded");
   if(mark.parentNode){mark.parentNode.insertBefore(target,mark);mark.remove()}
   doc.querySelector(".app")?.classList.remove("rr-map-modal-open");
   button.textContent="⛶ На весь экран";
   button.setAttribute("aria-pressed","false");
   button.setAttribute("aria-label","Развернуть карту на весь экран");
   open=null;
   frame();
   (previousFocus&&previousFocus.isConnected?previousFocus:button).focus({preventScroll:true});
   previousFocus=null;
 }
 function expand(target,button){
   if(open)close();
   var app=doc.querySelector(".app");
   if(!app||!target.parentNode)return;
   previousFocus=doc.activeElement;
   var placeholder=doc.createComment("map original position");
   target.parentNode.insertBefore(placeholder,target);
   app.appendChild(target);
   target.classList.add("rr-map-expanded");
   app.classList.add("rr-map-modal-open");
   button.textContent="✕ Закрыть карту";
   button.setAttribute("aria-pressed","true");
   button.setAttribute("aria-label","Закрыть карту и вернуться к прогулке");
   open={target:target,placeholder:placeholder,button:button};
   frame();
   button.focus({preventScroll:true});
 }
 function mountMap(selector,id){
   var target=doc.querySelector(selector);
   if(!target||target.querySelector("#"+id))return;
   var button=doc.createElement("button");
   button.id=id;button.type="button";button.className="rr-map-toggle";
   button.textContent="⛶ На весь экран";
   button.setAttribute("aria-pressed","false");
   button.setAttribute("aria-label","Развернуть карту на весь экран");
   button.addEventListener("click",function(){if(open&&open.target===target)close();else expand(target,button)});
   target.appendChild(button);
 }
 function mount(){
   mountMap("#homeMap","rrHomeMapExpand");
   mountMap("#route .map","rrRouteMapExpand");
   doc.addEventListener("keydown",function(e){if(e.key==="Escape"&&open){e.preventDefault();close()}});
   doc.addEventListener("visibilitychange",function(){if(!doc.hidden)frame()});
   root.addEventListener("resize",function(){if(open)frame()});
 }
 if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})(typeof window!=="undefined"?window:null);
