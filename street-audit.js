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
 "https://overpass.private.coffee/api/interpreter",
 "https://overpass-api.de/api/interpreter"
];
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
 let lastId="",state={status:"idle"},busy=false;
 function line(t,cls){
   const e=doc.createElement("p");e.className="sra-line"+(cls?" "+cls:"");e.textContent=t;result.append(e);
 }
 function setState(s){state=s;result.replaceChildren();}
 async function check(){
   if(busy)return;
   const rr=window.__yakutskRR,pts=getRouteGeometry(rr?.legs),id=String(rr?.routeId||"");
   if(pts.length<2){setState({status:"idle"});line("Сначала постройте маршрут по пешеходным дорогам.");return;}
   if(id&&id===lastId&&state.status==="ok"){line("Повторная проверка не нужна: результат относится к этому же маршруту.");return;}
   let bbox;
   try{bbox=routeBbox(pts);}catch(e){setState({status:"error"});line(e.message,"warn");return;}
   busy=true;button.disabled=true;button.textContent="Проверяем данные OSM…";
   setState({status:"loading"});line("Запрашиваем отмеченные на карте улицы и сопоставляем их с маршрутом.");
   try{
     const samples=sampleRoute(pts),query=queryFor(bbox);
     let json=null,fail=null;
     for(const endpoint of ENDPOINTS){
       const controller=new AbortController(),t=setTimeout(()=>controller.abort(),12500);
       try{
         const response=await fetch(endpoint+"?data="+encodeURIComponent(query),{signal:controller.signal,cache:"no-store"});
         if(!response.ok)throw Error("HTTP "+response.status);
         json=await response.json();
         if(!Array.isArray(json.elements))throw Error("Пустой ответ Overpass");
         break;
       }catch(e){fail=e;}
       finally{clearTimeout(t);}
     }
     if(!json)throw fail||Error("Overpass недоступен");
     const ways=json.elements.filter(e=>e.type==="way"&&Array.isArray(e.geometry));
     const report=analyze(samples,ways),date=json.osm3s?.timestamp_osm_base||null;
     setState({status:"ok",report,routeId:id,date});lastId=id;
     if(report.matched===0){line("Недостаточно нанесённых на карту объектов рядом с маршрутом. Проверка не дала результата.","warn");}
     else{
       for(const item of summaries(report))line(item);
       if(report.lighting.no>0)line("⚠️ В OSM есть участки с lit=no. В темноте лучше проверить альтернативный маршрут.","warn");
       if(report.sidewalk.no>0)line("⚠️ Часть участков помечена как не имеющая тротуара.","warn");
       if(report.stairs>0)line("⚠️ На пути нанесены лестницы — зимой они могут быть скользкими.","warn");
       if(report.restricted>0)line("⚠️ Есть объекты OSM с ограничениями доступа. Проверьте маршрут на месте.","warn");
       if(report.service>0)line("⚠️ Часть пути совпадает со служебными проездами; возможен проход через двор.","warn");
       if(report.winter.no+report.winter.limited>0)line("⚠️ Есть участки с отсутствующим или ограниченным зимним обслуживанием по данным OSM.","warn");
     }
     line("Важно: разметка OSM не подтверждает, что фонари сейчас работают, улица сегодня очищена, нет льда или происшествий. Безопасность не гарантируется.","small");
     if(date)line("Дата состояния базы OSM: "+new Date(date).toLocaleDateString("ru-RU")+".","small");
   }catch(e){
     setState({status:"error"});line("Не удалось получить картографические данные. Попробуйте повторить позже. Без проверки маршрут нельзя считать безопасным.","warn");
   }finally{busy=false;button.disabled=false;button.textContent="Проверить маршрут по OSM";}
 }
 button.addEventListener("click",check);
 window.SmartRouteAudit.check=check;
 window.SmartRouteAudit.getState=function(){return state;};
}
return {getRouteGeometry,sampleRoute,routeBbox,queryFor,analyze,summaries,mount};
});