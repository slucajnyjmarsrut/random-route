/* Random Route — graph-verified walking loops.
 * Random choices propose existing waypoints; Dijkstra alone decides where
 * the route goes. No LLM, proxy, API key or invented road geometry.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RRRandomLoopRouter=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const TOLERANCE=.05,MAX_ATTEMPTS=35;
  const radians=n=>n*Math.PI/180;
  const point=p=>({lat:Number(p._lat??p.lat),lng:Number(p._lng??p.lng)});
  function metres(a,b){
    const lat=radians((a.lat+b.lat)/2);
    return Math.hypot((a.lat-b.lat)*111195,(a.lng-b.lng)*111195*Math.cos(lat));
  }
  function bearing(start,p){
    const phi1=radians(start.lat),phi2=radians(p.lat),dl=radians(p.lng-start.lng);
    return (Math.atan2(Math.sin(dl)*Math.cos(phi2),
      Math.cos(phi1)*Math.sin(phi2)-Math.sin(phi1)*Math.cos(phi2)*Math.cos(dl))*180/Math.PI+360)%360;
  }
  function angularGap(a,b){const d=Math.abs(a-b)%360;return Math.min(d,360-d);}
  const coordKey=c=>Number(c[1]).toFixed(8)+','+Number(c[0]).toFixed(8);
  const physicalKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  function evaluate(data,start,targetM){
    const route=data?.routes?.[0],legs=route?.legs||[];
    if(!legs.length||!Array.isArray(data?.waypoints)||data.waypoints.length!==legs.length+1)
      throw Error('InvalidWalkingRoute');
    let first=null,previous=null,total=0,repeats=0;
    const used=new Set();
    for(const leg of legs){
      const coords=(leg?.steps||[]).flatMap(step=>step?.geometry?.coordinates||[]);
      if(coords.length<2)throw Error('DisconnectedWalkingRoute');
      const begin=coordKey(coords[0]);
      if(previous&&previous!==begin)throw Error('DisconnectedWalkingRoute');
      if(!first)first=begin;
      for(let i=1;i<coords.length;i++){
        const a=coords[i-1],b=coords[i];
        if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)
          throw Error('InvalidRouteGeometry');
        const len=metres({lat:Number(a[1]),lng:Number(a[0])},{lat:Number(b[1]),lng:Number(b[0])});
        if(!Number.isFinite(len)||len<.001||len>3000)throw Error('InvalidRouteGeometry');
        const key=physicalKey(coordKey(a),coordKey(b));
        if(used.has(key))repeats+=len;
        used.add(key);total+=len;
      }
      previous=coordKey(coords.at(-1));
    }
    if(first!==previous)throw Error('WalkingRouteNotClosed');
    if(!Number.isFinite(route.distance)||Math.abs(total-route.distance)>Math.max(2,total*.005))
      throw Error('WalkingRouteDistanceMismatch');
    const startOnGraph=data.waypoints[0]?.location,endOnGraph=data.waypoints.at(-1)?.location;
    if(!startOnGraph||!endOnGraph||coordKey(startOnGraph)!==coordKey(endOnGraph)||
      metres(start,{lat:Number(startOnGraph[1]),lng:Number(startOnGraph[0])})>70)
      throw Error('WalkingRouteNotClosed');
    const diff=Math.abs(total-targetM);
    return {distanceM:total,deltaM:diff,repeatM:repeats,
      repeatPercent:100*repeats/total,errorPercent:100*diff/targetM,
      withinTolerance:diff<=targetM*TOLERANCE+1e-6};
  }
  function normalize(pois,start,targetM){
    const ids=new Set(),out=[];
    for(const p of pois||[]){
      if(!p)continue;
      const pos=point(p),id=String(p.id??'');
      if(!id||ids.has(id)||!Number.isFinite(pos.lat)||!Number.isFinite(pos.lng))continue;
      const radius=metres(start,pos);
      if(radius<55||radius>targetM*.54)continue;
      ids.add(id);
      out.push({original:p,id,pos,radius,angle:bearing(start,pos),photo:!!p._referenceUrl});
    }
    return out;
  }
  function shuffle(items,rng){
    const a=items.slice();
    for(let i=a.length-1;i>0;i--){
      const j=Math.min(i,Math.floor(Math.max(0,rng())*(i+1)));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }
  function propose(pool,start,targetM,radialScale,rng,settings={}){
    const aim=targetM/(2*Math.PI)*radialScale;
    const kmax=Math.min(pool.length,Math.min(5,Math.max(2,Math.ceil(targetM/700)+1))),k=kmax===2?2:2+Math.floor(rng()*(kmax-1));
    // Use a random sample with a preference for plausible distances, not
    // an assumption that straight-line distance is the real road distance.
    const ranked=pool.map(p=>({p,score:Math.abs(p.radius-aim)/targetM+
      rng()*.25-(p.photo?.025:0)})).sort((a,b)=>a.score-b.score);
    const selected=[];
    if(ranked.some(x=>x.p.photo)&&rng()<.8){
      const favorite=ranked.find(x=>x.p.photo&&x.p.radius<=Math.max(150,aim*1.4));
      if(favorite)selected.push(favorite.p);
    }
    for(const {p} of ranked){
      if(selected.length>=k)break;
      if(selected.some(x=>x.id===p.id||metres(x.pos,p.pos)<Math.min(125,targetM*.065)))continue;
      selected.push(p);
    }
    if(selected.length<2)return null;
    const clock=rng()<.5?1:-1,offset=rng()*360;
    selected.sort((a,b)=>((clock*(a.angle-offset)+720)%360)-((clock*(b.angle-offset)+720)%360));
    if(settings.avoidFirstPoint){
      const first=selected[0].pos,old=settings.avoidFirstPoint,
        minMove=Math.max(120,Math.min(260,targetM*.09)),
        minAngle=Number(settings.minDirectionChangeDeg||42);
      if(metres(first,old)<minMove||angularGap(bearing(start,first),bearing(start,old))<minAngle)
        return null;
    }
    const rough=[start,...selected.map(p=>p.pos),start]
      .reduce((acc,p,i,list)=>i?acc+metres(list[i-1],p):0,0);
    if(rough>targetM*(1+TOLERANCE))return null;
    return {selected,rough,signature:selected.map(p=>p.id).join('|')};
  }
  function now(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
  async function findRoute(options){
    const {graph,routing,start,pois,zones=[],distanceKm,rng=Math.random,onStatus=()=>{},
      timeBudgetMs=9000,maxAttempts=MAX_ATTEMPTS,avoidFirstPoint,minDirectionChangeDeg}=options||{};
    const km=Number(distanceKm),targetM=km*1000;
    if(!Number.isFinite(km)||km<1||km>12)throw Error('InvalidWalkingDistance');
    if(!graph?.nodes||!routing?.route||!start||!Number.isFinite(start.lat)||!Number.isFinite(start.lng))
      throw Error('RandomRouterGraphUnavailable');
    const pool=normalize(pois,start,targetM);
    if(pool.length<2)return {best:null,attempts:0,rejectedDirection:0,rejectedZones:0};
    const unique=new Set(),started=now();
    let radialScale=1,attempts=0,best=null,rejectedDirection=0,rejectedZones=0;
    for(let i=0;i<Math.min(60,Math.max(1,Math.trunc(maxAttempts)));i++){
      if(i>0&&now()-started>=timeBudgetMs)break;
      const c=propose(pool,start,targetM,radialScale,rng,{avoidFirstPoint,minDirectionChangeDeg});
      if(!c){if(avoidFirstPoint)rejectedDirection++;continue;}
      if(unique.has(c.signature))continue;
      unique.add(c.signature);
      attempts++;
      onStatus('Проверяем дороги Дейкстрой · вариант '+attempts);
      try{
        const points=[start,...c.selected.map(p=>p.pos),start];
        const data=routing.route(graph,points,{zones});
        const metrics=evaluate(data,start,targetM);
        const route=data.routes[0];
        const score=metrics.deltaM+.25*metrics.repeatM;
        const chosen={data,route,pois:c.selected.map(p=>p.original),
          diff:metrics.deltaM,actual:metrics.distanceM/1000,rank:score,metrics,
          synthetic:c.selected.every(p=>!p.original._isTouristGuide&&p.original.type==='walk_node')};
        if(!best||(metrics.withinTolerance&&!best.metrics.withinTolerance)||
          (metrics.withinTolerance===best.metrics.withinTolerance&&score<best.rank))
          best=chosen;
        // Long -> sample nearer points; short -> sample farther points.
        radialScale=Math.max(.55,Math.min(1.7,radialScale*
          Math.max(.78,Math.min(1.27,Math.sqrt(targetM/metrics.distanceM)))));
        // We are allowed to stop early only for a close, low-repeat loop.
        if(metrics.withinTolerance&&metrics.deltaM<=targetM*.016&&metrics.repeatPercent<=3)
          break;
      }catch(e){
        if(e?.message==='DisconnectedWalkingGraph')continue;
        if(e?.message==='NoNearbyFootpath')continue;
        if(zones.length&&/Zone|DisconnectedWalkingGraph/.test(String(e?.message||'')))rejectedZones++;
      }
      // Keep map/GPS UI responsive during a bounded search on mobile.
      if(attempts%4===0&&typeof setTimeout==='function')
        await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {best,attempts,rejectedDirection,rejectedZones};
  }
  return {findRoute,evaluate,normalize,propose,tolerance:TOLERANCE,maxAttempts:MAX_ATTEMPTS};
});