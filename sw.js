/* Offline app shell only. Maps, GPS, routes and weather require services. */
const CACHE="random-route-shell-soft-welcome-v33";
const SHELL=["./","./index.html","./smart-safety.js","./yakutsk-weather.js","./smart-safety.css","./weather-background.js","./weather-background.css","./responsive-layout.js","./responsive-layout.css","./dijkstra-lab.js","./walking-dijkstra.js","./data/yakutsk-center-walking.json","./mobile-ux.css","./map-viewport.css","./map-viewport.js","./mascot-collection.css","./mascot-collection.js","./welcome-auth.css","./route-ai.js","./interface-interactions.css","./graphite-theme.css","./graphite-theme.js","./simple-home.css","./route-navigation.js","./route-navigation.css","./map-fallback.js","./smart-route-chat.js","./smart-route-chat.css","./street-audit.js","./street-audit.css","./daily-quests.js","./daily-quests.css","./developer-diagnostics.js","./developer-diagnostics.css","./tap-targets.js","./tap-targets.css","./manifest.webmanifest","./icons/smart-route.svg","./icons/favicon.svg","./icons/smart-route-maskable.svg","./icons/mascot-marshik.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("random-route-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin)return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy));}return res;}).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok && SHELL.some(p=>url.pathname.endsWith(p.replace("./","")))){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;})));
});
