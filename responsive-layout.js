/* Responsive orientation & map canvas resizer.
 * CSS determines layout; this only refreshes Yandex/Leaflet map canvas dimensions.
 * Never forces orientation or changes GPS, coordinates, routes or RouteCoin.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.RRResponsiveLayout=api;
   if(root.document.readyState==="loading")
      root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document);},{once:true});
   else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
"use strict";
function viewClass(width,height){
 const w=Number(width),h=Number(height);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return "unknown";
 if(w>=900)return "desktop";
 if(w>=600&&w>h&&h<=600)return "landscape";
 if(w>=600)return "tablet";
 return w>h?"landscape":"phone";
}
function mount(doc){
 const app=doc.querySelector(".app");
 if(!app)return;
 let raf=0;
 const win=doc.defaultView||window;
 function update(){
   raf=0;
   const w=win.innerWidth||app.clientWidth;
   const h=win.innerHeight||app.clientHeight;
   const mode=viewClass(w,h);
   app.dataset.layout=mode;
   // A noninteractive diagnostic hook, helpful for responsive tests.
   app.dataset.orientation=w>h?"landscape":"portrait";
   try{win.__rrResizeMaps?.()}catch(_){}
   try{win.__rrResizeFallbackMaps?.()}catch(_){}
 }
 function schedule(){
   if(raf)return;
   if(typeof win.requestAnimationFrame==="function")raf=win.requestAnimationFrame(update);
   else update();
 }
 win.addEventListener("resize",schedule,{passive:true});
 win.addEventListener("orientationchange",schedule,{passive:true});
 win.visualViewport?.addEventListener?.("resize",schedule,{passive:true});
 if(typeof ResizeObserver!=="undefined"){
   const observer=new ResizeObserver(schedule);
   for(const id of ["homeMap","realMap"]){
     const elem=doc.getElementById(id);if(elem)observer.observe(elem);
   }
   api.observer=observer;
 }
 update();
 api.refresh=schedule;
}
return {viewClass,mount};
});
