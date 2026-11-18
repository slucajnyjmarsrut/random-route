/* Offline app shell only. Maps, GPS, routes and weather require services. */
const CACHE="random-route-shell-mascot-aurora-v64";
const SHELL=["./","./index.html","./smart-safety.js","./yakutsk-weather.js","./smart-safety.css","./weather-background.js","./weather-background.css","./responsive-layout.js","./responsive-layout.css","./dijkstra-lab.js","./walking-dijkstra.js","./data/yakutsk-center-walking.json","./mobile-ux.css","./map-viewport.css","./map-viewport.js","./mascot-collection.css","./mascot-premium.css","./mascot-collection.js","./mascot-art.js","./mascot-inventory.css","./mascot-inventory.js","./mascot-chests.css","./mascot-chests.js","./welcome-auth.css","./route-ai.js","./interface-interactions.css","./graphite-theme.css","./graphite-theme.js","./simple-home.css","./marshik-guide.css","./marshik-guide.js","./marshik-ai.css","./marshik-ai.js","./marshik-ai-worker.js","./route-navigation.js","./route-navigation.css","./map-fallback.js","./smart-route-chat.js","./smart-route-chat.css","./street-audit.js","./street-audit.css","./daily-quests.js","./daily-quests.css","./developer-diagnostics.js","./developer-diagnostics.css","./tap-targets.js","./tap-targets.css","./manifest.webmanifest","./icons/smart-route.svg","./icons/favicon.svg","./icons/smart-route-maskable.svg","./icons/mascot-marshik.svg","./assets/mascots/3d/giraffe.webp","./assets/mascots/3d/gorilla.webp","./assets/mascots/3d/hyena.webp","./assets/mascots/3d/kangaroo.webp","./assets/mascots/3d/koala.webp","./assets/mascots/3d/leopard.webp","./assets/mascots/3d/lion.webp","./assets/mascots/3d/orca.webp","./assets/mascots/3d/panda.webp","./assets/mascots/3d/penguin.webp","./assets/mascots/3d/polarbear.webp","./assets/mascots/3d/redpanda.webp","./assets/mascots/3d/rhinoceros.webp","./assets/mascots/3d/toucan.webp","./assets/mascots/3d/turtle.webp","./assets/mascots/3d/wolf.webp","./assets/mascots/3d/zebra.webp","./assets/mascots/premium/runner-rabbit.webp","./assets/mascots/premium/student-cat.webp","./assets/mascots/premium/traveller-puppy.webp","./assets/mascots/premium/tourist-hamster.webp","./assets/mascots/premium/scholar-owl.webp","./assets/mascots/premium/collector-raccoon.webp","./assets/mascots/premium/explorer-fox.webp","./assets/mascots/premium/builder-beaver.webp","./assets/mascots/premium/gamer-cat.webp"];
self.addEventListener("install",event=>{
  // Cache the graph independently: one failed optional asset must not erase it.
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await cache.add("./data/yakutsk-center-walking.json").catch(()=>{});
    await Promise.allSettled(SHELL.filter(url=>url!=="./data/yakutsk-center-walking.json").map(url=>cache.add(url)));
  }).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("random-route-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin)return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy));}return res;}).catch(()=>caches.match("./index.html")));
    return;
  }
  // Critical JavaScript and CSS must be network-first so newer releases
  // cannot keep showing the previous Marshik/route handler from CacheStorage.
  if(req.destination==="script"||req.destination==="style"){
    event.respondWith(fetch(req,{cache:"no-store"}).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
      return res;
    }).catch(()=>caches.match(req,{ignoreSearch:true})));
    return;
  }
  // The bundled OSM snapshot is pre-cached without ?v=1.
  const match=url.pathname.endsWith("/data/yakutsk-center-walking.json")
    ? caches.match(req,{ignoreSearch:true}) : caches.match(req);
  event.respondWith(match.then(cached=>cached||fetch(req).then(res=>{
    if(res.ok&&SHELL.some(p=>url.pathname.endsWith(p.replace("./","")))){
      const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));
    }
    return res;
  })));
});
