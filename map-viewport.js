/* Full screen map control. Keeps the same Yandex/Leaflet map instance and
 * does not change route geometry, GPS state, or coins. */
(function(root){
 "use strict";
 if(!root||!root.document)return;
 var doc=root.document, open=null, previousFocus=null;
 // The route navigation card stays under the map in normal view. Its
 // instructions are mirrored into a small non-interactive HUD in full screen.
 // We never invent turns: guidance is taken from the existing OSM geometry
 // and updated by the normal GPS/navigation pipeline.
 var hud=null, navigationObserver=null;
 function byId(id){return doc.getElementById(id)}
 function navText(id,fallback){
   var value=byId(id)?.textContent?.trim();
   return value||fallback;
 }
 function syncRouteHud(){
   if(!hud)return;
   var arrow=hud.querySelector(".rr-map-hud-arrow");
   var instruction=hud.querySelector(".rr-map-hud-instruction");
   var detail=hud.querySelector(".rr-map-hud-detail");
   var next=hud.querySelector(".rr-map-hud-next");
   var remaining=hud.querySelector(".rr-map-hud-remaining");
   var gps=hud.querySelector(".rr-map-hud-gps");
   arrow.textContent=navText("rrNavArrow","↑");
   instruction.textContent=navText("rrNavInstruction","Идите по зелёной линии");
   detail.textContent=navText("rrNavStepDistance","Следуйте маршруту на карте");
   next.textContent=navText("rrNavNext","—");
   remaining.textContent=navText("rrNavTotal","—");
   gps.textContent=navText("rrNavGpsStatus","GPS ожидается");
   var off=byId("rrNavPanel")?.classList.contains("rr-nav-offtrack")===true;
   var poor=/неточн|ожидается|вне маршрута|ошибка/i.test(gps.textContent);
   hud.classList.toggle("rr-map-hud-offtrack",off);
   hud.classList.toggle("rr-map-hud-poor",poor);
 }
 function mountRouteHud(target){
   if(hud||!target)return;
   hud=doc.createElement("section");
   hud.id="rrMapNavigationHud";
   hud.className="rr-map-hud";
   hud.setAttribute("role","group");
   hud.setAttribute("aria-label","Направление и расстояние поверх полноэкранной карты");
   hud.innerHTML='<div class="rr-map-hud-main"><span class="rr-map-hud-arrow" aria-hidden="true">↑</span>'
     +'<div class="rr-map-hud-copy"><strong class="rr-map-hud-instruction">Идите по зелёной линии</strong>'
     +'<span class="rr-map-hud-detail">Следуйте маршруту на карте</span></div></div>'
     +'<div class="rr-map-hud-stats"><span>До точки <b class="rr-map-hud-next">—</b></span>'
     +'<span>До конца <b class="rr-map-hud-remaining">—</b></span>'
     +'<span class="rr-map-hud-gps">GPS ожидается</span></div>'
     +'<small class="rr-map-hud-legend">Зелёная линия — путь · оранжевая метка — следующая точка</small>';
   target.appendChild(hud);
   var nav=byId("rrNavPanel");
   if(nav&&root.MutationObserver){
     navigationObserver=new root.MutationObserver(syncRouteHud);
     navigationObserver.observe(nav,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
   }
   syncRouteHud();
 }
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
   if(target.querySelector("#rrMapNavigationHud"))syncRouteHud();
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
   mountRouteHud(doc.querySelector("#route .map"));
   doc.addEventListener("keydown",function(e){if(e.key==="Escape"&&open){e.preventDefault();close()}});
   doc.addEventListener("visibilitychange",function(){if(!doc.hidden)frame()});
   root.addEventListener("resize",function(){if(open)frame()});
 }
 if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})(typeof window!=="undefined"?window:null);
