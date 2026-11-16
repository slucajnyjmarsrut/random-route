/* H1 hybrid router: an LLM selects existing POI IDs; the OSM graph is authoritative.
 * No LLM-generated geometry, fake lengths, or client-side API secrets.
 * Real H1 requires a configured same-origin/proxied chat endpoint.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RRH1Planner=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const MAX_MODEL_CALLS=8,MAX_TOOL_CALLS=24,MAX_CANDIDATES=3,MAX_POIS=30;
  const MAX_ERROR=.05;
  const schemas=[
    {type:'function',function:{name:'search_pois',description:'Search reachable existing places by name or category. Returns allowed IDs only.',parameters:{type:'object',properties:{query:{type:'string'},limit:{type:'integer'}},additionalProperties:false}}},
    {type:'function',function:{name:'get_graph_distances',description:'Get actual shortest pedestrian-network metres between named POI IDs or start. Up to 24 pairs.',parameters:{type:'object',properties:{pairs:{type:'array',items:{type:'object',properties:{from:{type:'string'},to:{type:'string'}},required:['from','to'],additionalProperties:false}}},required:['pairs'],additionalProperties:false}}},
    {type:'function',function:{name:'build_candidate',description:'Build a loop by Dijkstra with repeat penalties through 2-5 distinct POI IDs. At most 3 candidates.',parameters:{type:'object',properties:{poi_ids:{type:'array',items:{type:'string'},minItems:2,maxItems:5}},required:['poi_ids'],additionalProperties:false}}},
    {type:'function',function:{name:'evaluate_candidate',description:'Independently verify a previously built candidate: real edges, closure, metres, repeated segments.',parameters:{type:'object',properties:{candidate_id:{type:'string'}},required:['candidate_id'],additionalProperties:false}}},
    {type:'function',function:{name:'submit_waypoints',description:'Finalize only a validated, successful candidate, never coordinates or invented POIs.',parameters:{type:'object',properties:{candidate_id:{type:'string'}},required:['candidate_id'],additionalProperties:false}}}
  ];
  function error(code){const e=new Error(code);e.code=code;return e;}
  const physicalEdge=(a,b)=>String(a)<String(b)?String(a)+':'+String(b):String(b)+':'+String(a);
  function idMap(graph){
    const map=new Map();
    for(const [id,p] of graph.nodes)map.set(Number(p.lat).toFixed(8)+','+Number(p.lng).toFixed(8),id);
    return map;
  }
  // Independent of reported route.distance and model claims.
  function evaluate(graph,data,start,targetMetres){
    const route=data?.routes?.[0],legs=route?.legs||[];
    if(!route||!legs.length||!Array.isArray(data.waypoints))throw error('H1InvalidCandidate');
    const map=idMap(graph),seen=new Map();
    let previous=null,first=null,total=0,repeated=0,steps=0;
    for(const leg of legs){
      const coords=(leg.steps||[]).flatMap(s=>s.geometry?.coordinates||[]);
      if(coords.length<2)throw error('H1InvalidEdge');
      for(let i=0;i<coords.length;i++){
        const c=coords[i],id=map.get(Number(c[1]).toFixed(8)+','+Number(c[0]).toFixed(8));
        if(!id)throw error('H1InventedRoadNode');
        if(first===null)first=id;
        if(i===0&&previous!==null&&id!==previous)throw error('H1Disconnected');
        if(i>0){
          const a=map.get(Number(coords[i-1][1]).toFixed(8)+','+Number(coords[i-1][0]).toFixed(8));
          const edge=(graph.adj.get(a)||[]).find(e=>e.to===id);
          if(!edge)throw error('H1InventedRoadEdge');
          const key=physicalEdge(a,id),count=seen.get(key)||0;
          if(count)repeated+=edge.metres;
          seen.set(key,count+1);total+=edge.metres;steps++;
        }
        previous=id;
      }
    }
    if(first!==previous)throw error('H1NotClosed');
    const origin=data.waypoints[0]?.location,finish=data.waypoints.at(-1)?.location;
    if(!origin||!finish||Math.abs(origin[0]-finish[0])>1e-9||Math.abs(origin[1]-finish[1])>1e-9)throw error('H1NotClosed');
    if(!steps||total<=0||Math.abs(total-route.distance)>Math.max(.5,total*.001))throw error('H1DistanceMismatch');
    const distanceError=Math.abs(total-targetMetres)/targetMetres;
    return {distanceM:Math.round(total),targetM:targetMetres,errorPercent:Number((100*distanceError).toFixed(2)),repeatPercent:Number((100*repeated/total).toFixed(2)),closed:true,connected:true,success:distanceError<=MAX_ERROR,score:distanceError+(.25*repeated/total)};
  }
  function candidates(graph,start,targetKm,pois,zones,routing){
    if(!graph?.nodes||!routing?.shortest||!routing?.route)throw error('H1GraphUnavailable');
    const startId=routing.nearestNode(graph,start,70,{safeStop:true});
    if(startId===null)throw error('H1StartNotOnFootpath');
    const unique=new Set(),results=[];
    const target=targetKm*1000;
    const sorted=(pois||[]).filter(p=>p&&Number.isFinite(Number(p._lat??p.lat))&&Number.isFinite(Number(p._lng??p.lng)))
      .sort((a,b)=>routing.distance(start,{lat:Number(a._lat??a.lat),lng:Number(a._lng??a.lng)})-routing.distance(start,{lat:Number(b._lat??b.lat),lng:Number(b._lng??b.lng)}));
    // Bound graph work. Results are measured with Dijkstra, never straight-line guesses.
    for(const p of sorted.slice(0,80)){
      const id=String(p.id||'');
      if(!id||unique.has(id))continue;
      unique.add(id);
      const lat=Number(p._lat??p.lat),lng=Number(p._lng??p.lng);
      if(routing.distance(start,{lat,lng})>target*.56)continue;
      const node=routing.nearestNode(graph,{lat,lng},55,{safeStop:true});
      if(node===null||node===startId)continue;
      const out=routing.shortest(graph,startId,node,zones);
      if(!out||out.length*2>target*.98)continue;
      const back=routing.shortest(graph,node,startId,zones);
      if(!back||out.length+back.length>target*.98)continue;
      if(results.some(poi=>poi.node===node))continue;
      results.push({id,name:String(p.tags?.name||p.name||id).slice(0,100),category:String(p.type||''),lat,lng,node,toM:Math.round(out.length),backM:Math.round(back.length),original:p});
      if(results.length===MAX_POIS)break;
    }
    return results;
  }
  function chatEndpoint(){
    if(typeof document==='undefined')return '';
    const v=document.querySelector('meta[name="rr-h1-api"]')?.content?.trim()||'';
    if(!v)return '';
    try{
      const url=new URL(v,location.href);
      if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')return '';
      return url.href;
    }catch(e){return '';}
  }
  async function callProxy(endpoint,messages,tools,signal){
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,tools}),signal,credentials:'omit'});
    if(!response.ok)throw error('H1ModelHTTP'+response.status);
    const data=await response.json();
    if(!data?.message||data.message.role!=='assistant')throw error('H1InvalidModelResponse');
    return data.message;
  }
  async function plan(options){
    const {graph,routing,start,pois,zones=[],distanceKm,preferences='',signal,onStatus=()=>{}}=options||{};
    const km=Number(distanceKm);
    if(!Number.isFinite(km)||km<1||km>12)throw error('H1InvalidDistance');
    if(!start||!Number.isFinite(start.lat)||!Number.isFinite(start.lng))throw error('H1InvalidStart');
    const available=candidates(graph,start,km,pois,zones,routing);
    if(available.length<2)throw error('H1InsufficientPOI');
    const byId=new Map(available.map(p=>[p.id,p]));
    const messages=[
      {role:'system',content:'You plan a walk using only tool-provided existing POI IDs. A route must return to start, be within 5 percent of target metres, minimize repeated physical streets, and meet user preferences. Call search_pois/get_graph_distances, build_candidate, evaluate_candidate, then submit_waypoints with a successful candidate_id. Never invent coordinates, lengths, or IDs. You have at most three build_candidate attempts; use tool errors and evaluations to improve. Answer and tool arguments must be valid.'},
      {role:'user',content:JSON.stringify({targetMetres:Math.round(km*1000),preferences:String(preferences).slice(0,400),availablePOIs:available.map(p=>({id:p.id,name:p.name,category:p.category,toM:p.toM,backM:p.backM}))})}
    ];
    const built=new Map(),evaluated=new Set();
    const runTool=(name,args)=>{
      if(name==='search_pois'){
        const query=String(args.query||'').toLocaleLowerCase('ru'),limit=Math.max(1,Math.min(MAX_POIS,Math.trunc(Number(args.limit)||MAX_POIS)));
        return {pois:available.filter(p=>(p.name+' '+p.category).toLocaleLowerCase('ru').includes(query)).slice(0,limit).map(p=>({id:p.id,name:p.name,category:p.category,toM:p.toM,backM:p.backM}))};
      }
      if(name==='get_graph_distances'){
        if(!Array.isArray(args.pairs)||args.pairs.length>24)throw error('H1DistanceQueryLimit');
        return {pairs:args.pairs.map(pair=>{
          const from=pair?.from==='start'?null:byId.get(String(pair?.from));
          const to=pair?.to==='start'?null:byId.get(String(pair?.to));
          if((pair?.from!=='start'&&!from)||(pair?.to!=='start'&&!to))throw error('H1UnknownPOI');
          const a=from?.node||routing.nearestNode(graph,start,70,{safeStop:true});
          const b=to?.node||routing.nearestNode(graph,start,70,{safeStop:true});
          return {from:String(pair.from),to:String(pair.to),metres:routing.shortest(graph,a,b,zones)?.length??null};
        })};
      }
      if(name==='build_candidate'){
        if(built.size>=MAX_CANDIDATES)throw error('H1CandidateLimit');
        const ids=args.poi_ids;
        if(!Array.isArray(ids)||ids.length<2||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(String(id))))throw error('H1InvalidPOISelection');
        const picked=ids.map(id=>byId.get(String(id)));
        const pointList=[start,...picked.map(p=>({lat:p.lat,lng:p.lng})),start];
        const data=routing.route(graph,pointList,{zones});
        const metrics=evaluate(graph,data,start,Math.round(km*1000));
        const candidateId='c'+(built.size+1);
        built.set(candidateId,{data,metrics,pois:picked.map(p=>p.original),ids});
        return {candidate_id:candidateId,routeLengthM:metrics.distanceM,errorPercent:metrics.errorPercent,repeatPercent:metrics.repeatPercent,withinTolerance:metrics.success};
      }
      if(name==='evaluate_candidate'){
        const id=String(args.candidate_id||''),candidate=built.get(id);
        if(!candidate)throw error('H1UnknownCandidate');
        candidate.metrics=evaluate(graph,candidate.data,start,Math.round(km*1000));
        evaluated.add(id);
        return {candidate_id:id,...candidate.metrics};
      }
      if(name==='submit_waypoints'){
        const id=String(args.candidate_id||''),candidate=built.get(id);
        if(!candidate||!evaluated.has(id)||!candidate.metrics.success)throw error('H1UnverifiedSubmission');
        return {submitted:true,candidate_id:id};
      }
      throw error('H1UnknownTool');
    };
    const endpoint=options?.endpoint||chatEndpoint();
    const caller=options?.callModel||((msgs,tools)=>callProxy(endpoint,msgs,tools,signal));
    if(!options?.callModel&&!endpoint)throw error('H1BackendNotConfigured');
    let count=0,finished=null;
    for(let turn=0;turn<MAX_MODEL_CALLS&&!finished;turn++){
      if(signal?.aborted)throw error('H1Aborted');
      onStatus('ИИ H1 подбирает маршрут · шаг '+(turn+1)+' из '+MAX_MODEL_CALLS);
      const message=await caller(messages,schemas,signal);
      if(!message||message.role!=='assistant')throw error('H1InvalidModelResponse');
      const calls=Array.isArray(message.tool_calls)?message.tool_calls:[];
      if(!calls.length)break;
      messages.push({role:'assistant',content:message.content||null,tool_calls:calls});
      for(const tool of calls){
        if(++count>MAX_TOOL_CALLS)throw error('H1ToolLimit');
        const name=String(tool.function?.name||'');
        let result;
        try{
          const args=JSON.parse(tool.function?.arguments||'{}');
          result=runTool(name,args);
        }catch(e){result={error:String(e?.code||e?.message||'H1ToolError')};}
        messages.push({role:'tool',tool_call_id:tool.id,content:JSON.stringify(result)});
        if(name==='submit_waypoints'&&result.submitted)finished=built.get(result.candidate_id);
      }
    }
    if(!finished)throw error('H1NoSubmittedRoute');
    return {data:finished.data,route:finished.data.routes[0],pois:finished.pois,
      diff:Math.abs(finished.metrics.distanceM-km*1000),actual:finished.metrics.distanceM/1000,
      rank:finished.metrics.score,metrics:finished.metrics,h1:true};
  }
  return {plan,evaluate,candidates,chatEndpoint,callProxy,schemas,limits:{model:MAX_MODEL_CALLS,tools:MAX_TOOL_CALLS,candidates:MAX_CANDIDATES,pois:MAX_POIS,error:MAX_ERROR}};
});