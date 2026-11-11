/* OSM fallback for the Yakutsk explorer when Yandex JS maps do not initialize.
 * Shows the real routed geometry from the existing Valhalla engine; no fake roads.
 * Tile use is online only and always attributed.
 */
(function(){
"use strict";
var ready=false, loading=false, started=false, maps={}, lines={}, pins={}, zonePick=null;
window.__rrResizeFallbackMaps=function(){
 if(!ready)return;
 Object.values(maps).forEach(function(m){try{m.invalidateSize({pan:false})}catch(_){}});
};
function id(x){return document.getElementById(x)}
function status(text){["homeMapCredit","routeMapCredit"].forEach(function(name){var n=id(name);if(n)n.textContent=text})}
function addCss(url){var l=document.createElement("link");l.rel="stylesheet";l.href=url;document.head.appendChild(l)}
function loadLeaflet(){
  if(window.L && window.L.map)return Promise.resolve();
  return new Promise(function(resolve,reject){
    addCss("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css");
    var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
    s.onload=function(){window.L?resolve():reject(new Error("Leaflet missing"))};s.onerror=reject;document.head.appendChild(s)
  });
}
function mapAvailable(){return !!(id("homeYandexMap")&&id("realYandexMap"))}
function pointOK(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))}
function show(){
 var rr=window.__yakutskRR;if(!rr||!ready)return;
 var center=pointOK(rr.livePos)?rr.livePos:pointOK(rr.start)?rr.start:{lat:62.0274,lng:129.732};
 var lineCoords=[];
 (rr.legs||[]).forEach(function(leg){
   (leg.steps||[]).forEach(function(step){
     ((step.geometry||{}).coordinates||[]).forEach(function(c){
       if(Array.isArray(c)&&Number.isFinite(Number(c[0]))&&Number.isFinite(Number(c[1])))lineCoords.push([Number(c[1]),Number(c[0])])
     })
   })
 });
 ["home","route"].forEach(function(k){
    var map=maps[k];if(!map)return;
    if(!pins[k])pins[k]=L.circleMarker([center.lat,center.lng],{radius:8,color:"#fff",fillColor:"#1387cc",fillOpacity:1,weight:3}).addTo(map);
    else pins[k].setLatLng([center.lat,center.lng]);
    if(lines[k]){map.removeLayer(lines[k]);lines[k]=null}
    if(lineCoords.length)lines[k]=L.polyline(lineCoords,{color:"#0c7555",weight:6,opacity:.86}).addTo(map);
    if(k==="route"&&lineCoords.length&&!map._srsFitted){map.fitBounds(L.latLngBounds(lineCoords),{padding:[20,20],maxZoom:16});map._srsFitted=true}
    if(!map._srsZones)map._srsZones=L.layerGroup().addTo(map);
    map._srsZones.clearLayers();
    (rr.noGoZones||[]).forEach(function(z){if(pointOK(z))L.circle([z.lat,z.lng],{radius:Number(z.radius)||300,color:"#c94343",fillOpacity:.15,weight:2}).addTo(map._srsZones)});
 });
}
function init(){
 if(started||loading||mapAvailable())return;
 if(!id("homeMap")||!id("realMap"))return;
 loading=true;
 loadLeaflet().then(function(){
   if(mapAvailable()){loading=false;return;}
   ["home","route"].forEach(function(k){
     var parent=id(k==="home"?"homeMap":"realMap"),host=document.createElement("div");host.className="srs-map-fallback";host.style.cssText="position:absolute;inset:0;z-index:2";parent.style.position="relative";parent.appendChild(host);
     var rr=window.__yakutskRR,p=pointOK(rr&&rr.start)?rr.start:{lat:62.0274,lng:129.732};
     maps[k]=L.map(host,{zoomControl:true,attributionControl:true}).setView([p.lat,p.lng],14);
     L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(maps[k]);
     maps[k].on("click",function(e){
       if(!zonePick)return;
       var r=window.__yakutskRR;if(!r)return;
       var select=id(zonePick==="home"?"avoidRadiusHome":"avoidRadiusRoute");
       var radius=Math.min(800,Math.max(150,Number(select&&select.value)||300));
       if(!Array.isArray(r.noGoZones))r.noGoZones=[];
       r.noGoZones.push({lat:e.latlng.lat,lng:e.latlng.lng,radius:radius});
       if(window.__routeRenderZones)window.__routeRenderZones();
       if(window.__routeSave)window.__routeSave();
       zonePick=null;show();
       alert("Зона исключена. Нажмите «Построить» или «Перестроить», чтобы маршрут учитывал её.");
     });
   });
   ready=true;started=true;loading=false;status("Карта: OpenStreetMap · при недоступности Яндекс.Карт");
   show();
   setInterval(show,2500);
   document.addEventListener("visibilitychange",function(){if(!document.hidden){Object.values(maps).forEach(function(m){m.invalidateSize()});show()}});
 }).catch(function(){loading=false;status("Карта недоступна: нет подключения к картографическим сервисам");});
}
function attach(){
 ["home","route"].forEach(function(k){
  var b=id(k==="home"?"avoidAddHomeBtn":"avoidAddRouteBtn");
  if(b)b.addEventListener("click",function(){if(started)zonePick=k});
 });
}
function boot(){
 attach();
 setTimeout(init,4500);
 document.addEventListener("rr-map-failed",init);
 setTimeout(function(){if(!started)init()},12000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();