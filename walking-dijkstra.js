/* Experimental production routing: Dijkstra on real OSM pedestrian ways.
 * Map remains Yandex; live OSM is retrieved from public Overpass endpoints.
 * On errors the caller must fall back to Valhalla. No straight-line route substitution.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RRWalkingDijkstra=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const ENDPOINTS=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
  const ROAD_TYPES='footway|path|pedestrian|steps|living_street|residential|service|unclassified|tertiary|secondary|primary|track|cycleway';
  const LIMIT_NODES=55000,LIMIT_EDGES=145000;
  const cached={value:null,key:'',expires:0,promise:null,unavailableUntil:0};
  function distance(a,b){
    const lat=(a.lat+b.lat)*Math.PI/360;
    return Math.hypot((a.lat-b.lat)*111195,(a.lng-b.lng)*111195*Math.cos(lat));
  }
  function bbox(start,radius){
    if(!Number.isFinite(start?.lat)||!Number.isFinite(start?.lng)||Math.abs(start.lat)>85)throw Error('InvalidLocation');
    const dLat=radius/111195,dLon=radius/(111195*Math.cos(start.lat*Math.PI/180));
    return [start.lat-dLat,start.lng-dLon,start.lat+dLat,start.lng+dLon];
  }
  function osmQuery(bounds){
    return '[out:json][timeout:19];way["highway"~"^('+ROAD_TYPES+')$"]('+bounds.map(v=>Number(v).toFixed(6)).join(',')+');out body geom qt;';
  }
  function allowed(tags){
    const t=tags||{},h=t.highway;
    if(!h||!(new RegExp('^('+ROAD_TYPES+')$')).test(h))return false;
    if(['no','private','customers','delivery'].includes(t.foot)||['no','private'].includes(t.access))return false;
    if(t.area==='yes'||t.construction==='yes'||t.disused==='yes')return false;
    if(h==='service'&&t.foot!=='yes'&&t.foot!=='designated'&&t.sidewalk!=='yes'&&t.sidewalk!=='both')return false;
    if(['primary','secondary','tertiary','track','cycleway'].includes(h)&&t.foot!=='yes'&&t.foot!=='designated'&&!['yes','both','left','right','separate'].includes(t.sidewalk))return false;
    return true;
  }
  function factor(tags){
    const h=tags.highway;
    if(['footway','pedestrian','path'].includes(h))return .88;
    if(h==='steps')return 1.30;
    if(h==='living_street')return 1.05;
    if(h==='residential')return 1.20;
    if(h==='service')return 2.5;
    if(h==='track')return 2.2;
    return 1.65;
  }
  function makeGraph(ways){
    if(!Array.isArray(ways))throw Error('InvalidOSM');
    const nodes=new Map(),adj=new Map();
    let edgeCount=0;
    for(const way of ways){
      const tags=way.tags||{},ids=way.nodes||[],geometry=way.geometry||[];
      if(!allowed(tags)||ids.length<2||ids.length!==geometry.length)continue;
      for(let i=0;i<ids.length;i++){
        const p=geometry[i],id=String(ids[i]);
        if(!Number.isFinite(p?.lat)||!Number.isFinite(p?.lon))continue;
        if(!nodes.has(id)){nodes.set(id,{lat:p.lat,lng:p.lon});adj.set(id,[]);}
      }
      for(let i=1;i<ids.length;i++){
        const a=String(ids[i-1]),b=String(ids[i]),pa=nodes.get(a),pb=nodes.get(b);
        if(!pa||!pb||a===b)continue;
        const metres=distance(pa,pb);if(metres<.25||metres>3000)continue;
        const cost=metres*factor(tags);
        const f=String(tags['oneway:foot']||'').toLowerCase();
        const directed=f==='yes'||f==='1'||f==='-1';
        if(f!=='-1')adj.get(a).push({to:b,metres,cost});
        if(!directed||f==='-1')adj.get(b).push({to:a,metres,cost});
        edgeCount++;
      }
      if(nodes.size>LIMIT_NODES||edgeCount>LIMIT_EDGES)throw Error('GraphTooLarge');
    }
    if(nodes.size<20||edgeCount<20)throw Error('GraphIncomplete');
    return {nodes,adj,edgeCount};
  }
  function nearestNode(graph,p,maxDistance=100){
    let nearest=null,best=maxDistance;
    for(const [id,node] of graph.nodes){
      if(Math.abs(p.lat-node.lat)>.0015||Math.abs(p.lng-node.lng)>.004)continue;
      const d=distance(p,node);
      if(d<best){best=d;nearest=id;}
    }
    return nearest;
  }
  class Heap{
    constructor(){this.a=[];}
    push(item){const a=this.a;let i=a.length;a.push(item);while(i>0){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p;}a[i]=item;}
    pop(){const a=this.a,head=a[0],tail=a.pop();if(!a.length)return head;let i=0;while(true){let child=i*2+1;if(child>=a.length)break;if(child+1<a.length&&a[child+1][0]<a[child][0])child++;if(tail[0]<=a[child][0])break;a[i]=a[child];i=child;}a[i]=tail;return head;}
    get size(){return this.a.length;}
  }
  function intersectZone(a,b,z){
    const radius=Number(z.radius||300)+8;
    if(distance(a,z)<radius||distance(b,z)<radius)return true;
    const clat=(a.lat+b.lat)/2*Math.PI/180;
    const mx=111195*Math.cos(clat),my=111195;
    const ax=(a.lng-z.lng)*mx,ay=(a.lat-z.lat)*my,bx=(b.lng-z.lng)*mx,by=(b.lat-z.lat)*my;
    const vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy;
    const t=den?Math.max(0,Math.min(1,-(ax*vx+ay*vy)/den)):0;
    return Math.hypot(ax+t*vx,ay+t*vy)<radius;
  }
  const edgeKey=(a,b)=>String(a)<String(b)?String(a)+":"+String(b):String(b)+":"+String(a);
  function shortest(graph,from,to,zones=[],usedEdges=new Map()){
    if(!graph.nodes.has(from)||!graph.nodes.has(to))return null;
    if(from===to)return {ids:[from],length:0};
    const d=new Map([[from,0]]),prev=new Map(),visited=new Set(),heap=new Heap();
    heap.push([0,from]);
    while(heap.size){
      const [score,id]=heap.pop();
      if(visited.has(id)||score>d.get(id))continue;
      visited.add(id);if(id===to)break;
      const a=graph.nodes.get(id);
      for(const edge of graph.adj.get(id)||[]){
        if(visited.has(edge.to))continue;
        const b=graph.nodes.get(edge.to);
        if(zones.length&&zones.some(z=>intersectZone(a,b,z)))continue;
        // Hybrid research repeat penalty p=2; count the physical segment in either direction.
        const next=score+edge.cost*(1+2*(usedEdges.get(edgeKey(id,edge.to))||0));
        if(next<(d.get(edge.to)??Infinity)){
          d.set(edge.to,next);prev.set(edge.to,{id,length:edge.metres});
          heap.push([next,edge.to]);
        }
      }
    }
    if(!d.has(to))return null;
    let at=to,total=0;const ids=[at],guard=graph.nodes.size+1;
    for(let i=0;at!==from&&i<guard;i++){
      const step=prev.get(at);if(!step)return null;total+=step.length;at=step.id;ids.push(at);
    }
    if(ids.at(-1)!==from)return null;
    return {ids:ids.reverse(),length:total};
  }
  function pathToLeg(graph,path){
    const coordinates=path.ids.map(id=>{const p=graph.nodes.get(id);return [p.lng,p.lat];});
    const metres=path.length;
    return {distance:metres,duration:metres/1.3,steps:[{name:'',geometry:{coordinates}}]};
  }
  function route(graph,points,options={}){
    if(!Array.isArray(points)||points.length<2)throw Error('NoPoints');
    const zones=(options.zones||[]).map(z=>({lat:Number(z.lat),lng:Number(z.lng),radius:Number(z.radius||300)})).filter(z=>Number.isFinite(z.lat)&&Number.isFinite(z.lng)&&z.radius>0);
    const ids=points.map((p,i)=>nearestNode(graph,p,i===0||i===points.length-1?75:120));
    if(ids.some(id=>id===null))throw Error('NoNearbyFootpath');
    const legs=[];let full=0;const usedEdges=new Map();
    for(let i=1;i<ids.length;i++){
      const p=shortest(graph,ids[i-1],ids[i],zones,usedEdges);
      if(!p||p.ids.length<2)throw Error('DisconnectedWalkingGraph');
      legs.push(pathToLeg(graph,p));full+=p.length;
      for(let j=1;j<p.ids.length;j++){
        const k=edgeKey(p.ids[j-1],p.ids[j]);usedEdges.set(k,(usedEdges.get(k)||0)+1);
      }
    }
    const locs=ids.map(id=>{const p=graph.nodes.get(id);return {location:[p.lng,p.lat],name:''};});
    return {code:'Ok',source:'dijkstra-osm',routes:[{distance:full,duration:full/1.3,legs}],waypoints:locs};
  }
  async function loadGraph(start,requestedKm){
    const radius=Math.min(3000,Math.max(1200,Math.ceil(requestedKm*570)));
    const area=bbox(start,radius),key=area.map(v=>v.toFixed(2)).join(':')+':'+radius;
    if(cached.value&&cached.key===key&&cached.expires>Date.now())return cached.value;
    if(cached.unavailableUntil>Date.now())throw Error('OSMUnavailable');
    if(cached.promise&&cached.key===key)return cached.promise;
    cached.key=key;
    cached.promise=(async()=>{
      const query=osmQuery(area),urlQuery='?data='+encodeURIComponent(query);
      let lastError;
      for(const endpoint of ENDPOINTS){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8700);
        try{
          const response=await fetch(endpoint+urlQuery,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
          if(!response.ok)throw Error('Overpass '+response.status);
          const result=await response.json();
          const graph=makeGraph(result?.elements?.filter(e=>e.type==='way')||[]);
          cached.value=graph;cached.expires=Date.now()+5*60*1000;
          return graph;
        }catch(e){lastError=e;}
        finally{clearTimeout(timer);}
      }
      cached.unavailableUntil=Date.now()+2*60*1000;
      throw lastError||Error('OSMUnavailable');
    })();
    try{return await cached.promise;}finally{cached.promise=null;}
  }
  async function requestRoute(points,options={}){
    const lengthKm=Number(options.distanceKm||3);
    if(lengthKm>12)throw Error('GraphRegionTooLarge');
    const graph=await loadGraph(points[0],lengthKm);
    return route(graph,points,options);
  }
  return {distance,bbox,osmQuery,allowed,factor,makeGraph,nearestNode,shortest,route,loadGraph,requestRoute};
});
