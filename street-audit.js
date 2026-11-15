/* Route-specific OSM audit, initiated by user. Not a street-safety guarantee.
 * Only the bounding box of the planned route is shared with Overpass, not GPS traces.
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
function mount(doc){
 const route=doc.getElementById("route"),card=doc.getElementById("srs-route");
 if(!route||!card)return;
 const panel=doc.createElement("section");panel.className="sra-panel";
 const heading=doc.createElement("strong");heading.textContent="🔎 Проверить улицы маршрута";panel.append(heading);
 const intro=doc.createElement("p");intro.textContent="Проверяем настоящие отметки об освещении, тротуарах и зимнем обслуживании из OpenStreetMap. Это не проверка гололёда или фактической уборки снега.";panel.append(intro);
 const button=doc.createElement("button");button.type="button";button.className="sra-btn";button.textContent="Проверить маршрут по OSM";panel.append(button);
 const note=doc.createElement("p");note.className="sra-note";note.textContent="По нажатию область построенного маршрута (не GPS-трек) отправляется в OpenStreetMap Overpass. Для точной проверки уборки снега нужны свежие данные городских служб.";panel.append(note);
 const result=doc.createElement("div");result.className="sra-result";result.setAttribute("aria-live","polite");result.textContent="Сначала постройте маршрут, затем нажмите кнопку проверки.";panel.append(result);
 const source=doc.createElement("a");source.href="https://www.openstreetmap.org/copyright";source.rel="noopener noreferrer";source.target="_blank";source.textContent="Источник картографических данных: © OpenStreetMap";source.className="sra-source";panel.append(source);
 card.append(panel);
 let state={status:"idle"},busy=false;
 function line(t,cls){
   const e=doc.createElement("p");e.className="sra-line"+(cls?" "+cls:"");e.textContent=t;result.append(e);
 }
 function setState(s){state=s;result.replaceChildren();}
 async function check(){
   if(busy)return;
   const rr=window.__yakutskRR,pts=getRouteGeometry(rr?.legs),id=String(rr?.routeId||"");
   if(pts.length<2){setState({status:"idle"});line("Сначала постройте маршрут по пешеходным дорогам.");return;}
   let bbox;
   try{bbox=routeBbox(pts);}catch(e){setState({status:"error"});line(e.message,"warn");return;}
   busy=true;button.disabled=true;button.textContent="Проверяем данные OSM…";
   setState({status:"loading"});line("Запрашиваем отмеченные на карте улицы и сопоставляем их с маршрутом.");
   try{
     const samples=sampleRoute(pts),query=queryFor(bbox);
     let ways=null,date=null,source="online",remoteProblem=null;
     for(const endpoint of ENDPOINTS){
       const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
       try{
         // A form POST avoids oversized URLs and is accepted by Overpass.
         // The request sends ONLY the route bounding box, never user's GPS log.
         const response=await fetch(endpoint,{
           method:"POST",body:"data="+encodeURIComponent(query),signal:controller.signal,
           cache:"no-store",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"}
         });
         if(!response.ok)throw Error("Overpass HTTP "+response.status);
         const json=await response.json();
         if(!Array.isArray(json.elements))throw Error("Invalid Overpass response");
         const candidate=json.elements.filter(e=>e.type==="way"&&Array.isArray(e.geometry));
         if(!candidate.length)throw Error("Empty Overpass road extract");
         ways=candidate;date=json.osm3s?.timestamp_osm_base||null;
         break;
       }catch(e){remoteProblem=e;}
       finally{clearTimeout(timer);}
     }
     if(!ways){
       let local=null;
       try{local=await bundledOsmForRoute(pts);}
       catch(e){console.warn("Bundled OSM audit unavailable",e?.message||e);}
       if(!local)throw remoteProblem||Error("Overpass unavailable");
       ways=local.ways;date=local.createdAt;source="bundled";
     }
     const report=analyze(samples,ways);
     const status=source==="bundled"?"partial":report.matched?"ok":"insufficient";
     setState({status,source,report,routeId:id,date});
     result.dataset.source=source;
     if(source==="bundled"){
       line("⚠️ Онлайн-проверка не ответила. Показаны только сохранённые данные OSM для центра Якутска (снимок от "+snapshotDateLabel(date)+"). Это ограниченная справка, не актуальная проверка маршрута.","warn");
     }else{
       line("Получены отметки улиц из OpenStreetMap Overpass. Наличие меток не подтверждает обстановку на месте.","small");
     }
     if(report.matched===0){
       line("Не удалось сопоставить линию маршрута с дорожными объектами. Проверка условий не выполнена.","warn");
     }else{
       for(const item of summaries(report))line(item);
       if(report.lighting.no>0)line("⚠️ В OSM есть участки с lit=no. В темноте лучше проверить альтернативный маршрут.","warn");
       if(report.sidewalk.no>0)line("⚠️ Часть участков помечена как не имеющая тротуара.","warn");
       if(report.stairs>0)line("⚠️ На пути нанесены лестницы — зимой они могут быть скользкими.","warn");
       if(report.restricted>0)line("⚠️ Есть объекты OSM с ограничениями доступа. Проверьте маршрут на месте.","warn");
       if(report.service>0)line("⚠️ Часть пути совпадает со служебными проездами; возможен проход через двор.","warn");
       if(report.winter.no+report.winter.limited>0)line("⚠️ Есть участки с отсутствующим или ограниченным зимним обслуживанием по данным OSM.","warn");
     }
     if(source==="bundled"){
       line("В сохранённом снимке могли отсутствовать сведения об освещении и зимней уборке. Неизвестные значения НЕ означают, что улица освещена или очищена.","warn");
     }
     line("Важно: OSM не подтверждает работающие сейчас фонари, уборку снега сегодня, отсутствие льда или происшествий. Безопасность не гарантируется.","small");
     if(date)line((source==="bundled"?"Дата создания локального снимка":"Дата состояния базы OSM")+": "+snapshotDateLabel(date)+".","small");
   }catch(e){
     result.removeAttribute("data-source");
     setState({status:"error",routeId:id,source:"none"});
     line("Онлайн-серверы OSM сейчас не ответили, а сохранённая карта не покрывает этот маршрут или недоступна. Проверка улиц не выполнена. Повторите запрос позже.","warn");
     line("Не считайте маршрут проверенным: оцените реальные условия, особенно освещение, мороз и гололёд.","small");
   }finally{
     busy=false;button.disabled=false;
     button.textContent=state.status==="ok"?"Обновить проверку по OSM":"↻ Повторить онлайн-проверку";
   }
 }
 button.addEventListener("click",check);
 window.SmartRouteAudit.check=check;
 window.SmartRouteAudit.getState=function(){return state;};
}
return {getRouteGeometry,sampleRoute,routeBbox,queryFor,analyze,summaries,routeWithinBounds,parseBundledOsm,bundledOsmForRoute,mount};
});