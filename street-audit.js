/* Automatic unobtrusive route street-tag audit, not a safety guarantee.
 * Only the planned route's bounding box is shared, not GPS logs.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){
   root.SmartRouteAudit=api;
   if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document);},{once:true});
   else api.mount(root.document);
 }
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const ENDPOINTS=[
 "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
 "https://overpass.private.coffee/api/interpreter",
 "https://overpass-api.de/api/interpreter"
];
// The site ships a real OSM snapshot for a bounded downtown area. It has no
// reliable live lighting/snow-clearance readings; use only as *partial* evidence.
const LOCAL_OSM_PATH="./data/yakutsk-center-walking.json?v=1";
const LOCAL_OSM_BOUNDS={south:62.016,west:129.708,north:62.046,east:129.760};
const RADIUS=12,MAX_SAMPLES=220,LAT_CELL=.001,LON_CELL=.002;
function finite(n){return typeof n==="number"&&Number.isFinite(n);}
function dist(a,b){
 const scale=Math.cos((a.lat+b.lat)*Math.PI/360);
 return Math.hypot((a.lat-b.lat)*111195,(a.lon-b.lon)*111195*scale);
}
function getRouteGeometry(legs){
 const out=[];
 for(const leg of legs||[])for(const step of leg.steps||[])
 for(const c of step.geometry?.coordinates||[]){
   if(!Array.isArray(c)||c.length<2)continue;
   const lon=Number(c[0]),lat=Number(c[1]);
   if(!finite(lat)||!finite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
   const p={lat,lon};
   if(!out.length||dist(out[out.length-1],p)>.5)out.push(p);
 }
 return out;
}
function sampleRoute(pts,spacing=45){
 if(!Array.isArray(pts)||pts.length<2)return [];
 const pieces=[],full=[0];let length=0;
 for(let i=1;i<pts.length;i++){
   const d=dist(pts[i-1],pts[i]);pieces.push(d);length+=d;full.push(length);
 }
 if(length<20)return [];
 const count=Math.max(2,Math.min(MAX_SAMPLES,Math.ceil(length/spacing)));
 const samples=[];let j=1;
 for(let k=0;k<count;k++){
   const target=(k+.5)*length/count;
   while(j<full.length-1&&full[j]<target)j++;
   const span=pieces[j-1]||1,f=Math.max(0,Math.min(1,(target-full[j-1])/span));
   samples.push({lat:pts[j-1].lat+(pts[j].lat-pts[j-1].lat)*f,lon:pts[j-1].lon+(pts[j].lon-pts[j-1].lon)*f});
 }
 return samples;
}
function routeBbox(pts){
 if(!pts.length)throw Error("Маршрут ещё не построен.");
 let south=90,north=-90,west=180,east=-180;
 for(const p of pts){south=Math.min(south,p.lat);north=Math.max(north,p.lat);west=Math.min(west,p.lon);east=Math.max(east,p.lon)}
 const kmLat=(north-south)*111.2,kmLon=(east-west)*111.2*Math.cos(((north+south)/2)*Math.PI/180);
 if(kmLat>6||kmLon>6||kmLat*kmLon>16)throw Error("Маршрут слишком большой для точечной проверки в открытом OSM-сервисе.");
 return {south:south-.00035,west:west-.0007,north:north+.00035,east:east+.0007};
}
function queryFor(b){
 const f=x=>x.toFixed(6);
 return '[out:json][timeout:22];way["highway"~"^(footway|path|pedestrian|steps|living_street|residential|service|tertiary|secondary|primary|unclassified|track|cycleway)$"]('+[b.south,b.west,b.north,b.east].map(f).join(",")+');out tags geom qt;';
}

function routeWithinBounds(pts,bounds=LOCAL_OSM_BOUNDS){
 if(!Array.isArray(pts)||pts.length<2||!bounds)return false;
 return pts.every(p=>finite(p.lat)&&finite(p.lon)
  &&p.lat>=bounds.south+.00001&&p.lat<=bounds.north-.00001
  &&p.lon>=bounds.west+.00001&&p.lon<=bounds.east-.00001);
}
function parseBundledOsm(data,pts){
 if(data?.version!==1||!Array.isArray(data.ways)||data.ways.length<100
    ||!routeWithinBounds(pts,data.bbox)||!routeWithinBounds(pts,LOCAL_OSM_BOUNDS))
   throw Error("LocalSnapshotOutOfCoverage");
 return {ways:data.ways.filter(w=>Array.isArray(w.geometry)&&w.geometry.length>=2),
         createdAt:data.created_at||null,source:"bundled"};
}
async function bundledOsmForRoute(pts){
 // Never make a small downtown snapshot appear to cover another district.
 if(!routeWithinBounds(pts))return null;
 if(typeof caches!=="undefined"&&typeof caches.match==="function"){
   try{
     const cached=await caches.match("./data/yakutsk-center-walking.json",{ignoreSearch:true});
     if(cached?.ok)return parseBundledOsm(await cached.clone().json(),pts);
   }catch(e){console.warn("OSM audit cache unavailable",e?.message||e);}
 }
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
   const response=await fetch(LOCAL_OSM_PATH,{signal:controller.signal,cache:"force-cache"});
   if(!response.ok)throw Error("LocalSnapshotHTTP"+response.status);
   return parseBundledOsm(await response.json(),pts);
 }finally{clearTimeout(timer);}
}
function snapshotDateLabel(value){
 const d=new Date(value||"");
 return Number.isFinite(d.getTime())?d.toLocaleDateString("ru-RU"):"неизвестной даты";
}
function getTags(way){return way?.tags||{};}
function mkIndex(ways){
 const cells=new Map();let edges=0;
 for(const w of ways){
   const g=w.geometry||[];
   for(let i=1;i<g.length;i++){
     const a=g[i-1],b=g[i];if(!finite(a?.lat)||!finite(a?.lon)||!finite(b?.lat)||!finite(b?.lon))continue;
     const edge={a:{lat:a.lat,lon:a.lon},b:{lat:b.lat,lon:b.lon},tags:getTags(w)};
     const y0=Math.floor((Math.min(a.lat,b.lat)-.00017)/LAT_CELL),y1=Math.floor((Math.max(a.lat,b.lat)+.00017)/LAT_CELL);
     const x0=Math.floor((Math.min(a.lon,b.lon)-.00035)/LON_CELL),x1=Math.floor((Math.max(a.lon,b.lon)+.00035)/LON_CELL);
     if((y1-y0+1)*(x1-x0+1)>500)continue;
     for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
       const key=y+":"+x;if(!cells.has(key))cells.set(key,[]);
       cells.get(key).push(edge);
     }
     edges++;if(edges>85000)throw Error("Картографических объектов слишком много для проверки на телефоне.");
   }
 }
 return cells;
}
function nearestTags(p,index){
 const key=Math.floor(p.lat/LAT_CELL)+":"+Math.floor(p.lon/LON_CELL);
 const arr=index.get(key)||[];let closest=Infinity,chosen=null;
 const cy=Math.cos(p.lat*Math.PI/180)*111195;
 for(const e of arr){
   const ax=(e.a.lon-p.lon)*cy,ay=(e.a.lat-p.lat)*111195;
   const bx=(e.b.lon-p.lon)*cy,by=(e.b.lat-p.lat)*111195;
   const dx=bx-ax,dy=by-ay,n=dx*dx+dy*dy;
   const t=n?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/n)):0;
   const d=Math.hypot(ax+t*dx,ay+t*dy);
   if(d<closest){closest=d;chosen=e.tags}
 }
 return closest<=RADIUS?chosen:null;
}
function lighting(t){
 const v=String(t?.lit||"").toLowerCase();
 if(["yes","automatic","24/7","sunset-sunrise"].includes(v))return "yes";
 if(v==="no")return "no";
 return "unknown";
}
function sidewalk(t){
 if(!t)return "unknown";
 const hw=String(t.highway||"");
 if(["footway","pedestrian","path","steps"].includes(hw))return "yes";
 const v=String(t.sidewalk||"").toLowerCase();
 if(["yes","both","left","right","separate"].includes(v))return "yes";
 if(v==="no"||v==="none")return "no";
 return "unknown";
}
function winter(t){
 const v=String(t?.winter_service||t?.snowplowing||"").toLowerCase();
 if(v==="yes")return "yes";
 if(v==="no")return "no";
 if(v==="limited")return "limited";
 return "unknown";
}
function analyze(samples,ways){
 if(!samples.length)throw Error("Нет корректной линии пешеходного маршрута.");
 const index=mkIndex(ways);
 const counts={matched:0,lighting:{yes:0,no:0,unknown:0},sidewalk:{yes:0,no:0,unknown:0},
               winter:{yes:0,no:0,limited:0,unknown:0},service:0,stairs:0,restricted:0,rough:0};
 for(const p of samples){
   const t=nearestTags(p,index);
   if(t)counts.matched++;
   counts.lighting[lighting(t)]++;counts.sidewalk[sidewalk(t)]++;counts.winter[winter(t)]++;
   if(t?.highway==="service")counts.service++;
   if(t?.highway==="steps")counts.stairs++;
   if(["no","private"].includes(t?.access)||["no","private"].includes(t?.foot))counts.restricted++;
   if(["dirt","earth","mud","gravel","sand","unpaved"].includes(t?.surface))counts.rough++;
 }
 counts.total=samples.length;
 return counts;
}
function pct(n,d){return d?Math.round(100*n/d):0;}
function summaries(c){
 const n=c.total;
 return [
  "Освещение по OSM: "+pct(c.lighting.yes,n)+"% маршрута отмечено lit=yes; "+pct(c.lighting.no,n)+"% — lit=no; остальное без подтверждения.",
  "Пешеходная инфраструктура: "+pct(c.sidewalk.yes,n)+"% отмечено как пешеходная дорожка/тротуар; "+pct(c.sidewalk.no,n)+"% — без тротуара по метке; остальное неизвестно.",
  "Зимнее обслуживание: "+pct(c.winter.yes,n)+"% с отметкой winter_service=yes или snowplowing=yes; "+pct(c.winter.no+c.winter.limited,n)+"% с ограниченным/отсутствующим обслуживанием; на остальных участках сведений нет.",
  "Совпадение линии с дорожными объектами OSM: "+pct(c.matched,n)+"%. Это приблизительная геометрическая проверка, не осмотр на месте."
 ];
}
/* Quiet route audit: no manual button, technical reports or safety claims. */
function importantMessages(c){
 if(!c?.matched||!c.total)return [];
 const messages=[];
 if(c.lighting.no>0)messages.push("⚠️ На пути отмечены улицы без освещения. Будь осторожен в темноте.");
 if(c.restricted>0)messages.push("⚠️ На части маршрута по OSM ограничен проход.");
 if(c.sidewalk.no>0)messages.push("⚠️ На части маршрута по OSM нет тротуара.");
 if(c.stairs>0)messages.push("⚠️ На пути есть лестницы. В мороз возможен лёд.");
 if(c.winter.no+c.winter.limited>0)messages.push("⚠️ На отдельных участках может не быть зимней уборки.");
 if(c.rough>0)messages.push("⚠️ Есть участки с неровным покрытием по данным OSM.");
 if(c.lighting.unknown>c.total*.6||c.winter.unknown>c.total*.6)
  messages.push("Освещение и уборка подтверждены не везде — проверь условия на месте.");
 return messages.slice(0,3);
}
function mount(doc){
 const route=doc.getElementById("route"),card=doc.getElementById("srs-route");
 if(!route||!card)return;
 const panel=doc.createElement("aside");panel.className="sra-panel";panel.hidden=true;
 panel.setAttribute("aria-label","Важные сведения об улицах");
 const result=doc.createElement("div");result.className="sra-result";
 result.setAttribute("role","status");result.setAttribute("aria-live","polite");
 panel.append(result);card.append(panel);
 let state={status:"idle"},signature="",generation=0,controller=null;
 function showWarnings(messages){
  result.replaceChildren();panel.hidden=!messages.length;
  for(const text of messages){
   const node=doc.createElement("p");node.className="sra-alert";
   node.textContent=text;result.append(node);
  }
 }
 function reportFor(sig,version,pts,id,ways,source,date){
  if(version!==generation||sig!==signature)return;
  const report=analyze(sampleRoute(pts),ways);
  state={status:report.matched?(source==="bundled"?"partial":"ok"):"insufficient",
   source,report,routeId:id,date};
  panel.dataset.source=source;
  showWarnings(importantMessages(report));
 }
 async function check(){
  const rr=window.__yakutskRR,pts=getRouteGeometry(rr?.legs);
  if(!route.classList.contains("active")||pts.length<2)return;
  const id=String(rr.routeId||"");
  const sig=[id,pts.length,rr.legs.length,
   pts[0].lat.toFixed(6),pts[0].lon.toFixed(6),
   pts[pts.length-1].lat.toFixed(6),pts[pts.length-1].lon.toFixed(6)].join(":");
  if(sig===signature)return;
  signature=sig;const version=++generation;
  if(controller)controller.abort();
  controller=null;showWarnings([]);delete panel.dataset.source;
  state={status:"loading",routeId:id};
  let bbox;
  try{bbox=routeBbox(pts);}
  catch(_){state={status:"unavailable",routeId:id};return;}
  // Start with bundled real street tags; no connection needed for this part.
  try{
   const bundled=await bundledOsmForRoute(pts);
   if(bundled)reportFor(sig,version,pts,id,bundled.ways,"bundled",bundled.createdAt);
  }catch(_){/* No technical error appears to the walker. */}
  if(version!==generation)return;
  // Background refresh: only the planned-route bounding box, never GPS traces.
  const query=queryFor(bbox);
  for(const endpoint of ENDPOINTS){
   if(version!==generation)return;
   const task=new AbortController();controller=task;
   const timer=setTimeout(()=>task.abort(),5500);
   try{
    const response=await fetch(endpoint,{
     method:"POST",body:"data="+encodeURIComponent(query),signal:task.signal,
     cache:"no-store",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"}
    });
    if(!response.ok)continue;
    const json=await response.json();
    if(!Array.isArray(json.elements))continue;
    const ways=json.elements.filter(e=>e.type==="way"&&Array.isArray(e.geometry));
    if(!ways.length)continue;
    reportFor(sig,version,pts,id,ways,"online",json.osm3s?.timestamp_osm_base||null);
    return;
   }catch(_){/* Retry another Overpass server silently. */}
   finally{clearTimeout(timer);if(controller===task)controller=null;}
  }
  if(version===generation&&state.status==="loading"){
   state={status:"unavailable",routeId:id,source:"none"};
   showWarnings([]); // Data unavailable does not imply a safe street.
  }
 }
 window.SmartRouteAudit.check=check;
 window.SmartRouteAudit.getState=()=>state;
 window.addEventListener("rr:route-built",()=>{check().catch(()=>{});});
 // A saved route is restored asynchronously on page load.
 setTimeout(()=>{check().catch(()=>{});},650);
}

return {getRouteGeometry,sampleRoute,routeBbox,queryFor,analyze,summaries,importantMessages,routeWithinBounds,parseBundledOsm,bundledOsmForRoute,mount};
});