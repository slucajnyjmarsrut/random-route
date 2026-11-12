'use strict';
/* Public-data smoke test: exercises a REAL OSM Overpass request for central Yakutsk.
 * It is not a substitute for a walk or an Android/iOS browser test.
 */
const assert=require('node:assert/strict');
const walk=require('../walking-dijkstra.js');
const start={lat:62.030715,lng:129.724493};
(async()=>{
  const begin=Date.now();
  const graph=await walk.loadGraph(start,2);
  assert.ok(graph.nodes.size>=20,'OSM walking graph must contain real nodes');
  const points=walk.walkingWaypoints(graph,start,2);
  assert.ok(points.length>=2,'Street graph needs reachable walking points');
  const viable=points.filter((p,i)=>i%Math.max(1,Math.ceil(points.length/45))===0);
  let found=null;
  for(let i=0;i<Math.min(viable.length,25)&&!found;i++){
    const p=viable[i],q=viable[(i+Math.max(2,Math.floor(viable.length/3)))%viable.length];
    if(!p||!q||p.id===q.id)continue;
    try{
      const result=walk.route(graph,[start,p,q,start]);
      const distance=result.routes?.[0]?.distance;
      if(distance>250&&result.routes[0].legs.length===3)found=result;
    }catch(e){}
  }
  assert.ok(found,'Dijkstra should find a real closed walking loop in central Yakutsk');
  assert.equal(found.source,'dijkstra-osm');
  assert.ok(found.routes[0].geometry.coordinates.length>2);
  console.log(JSON.stringify({result:'LIVE_OSM_LOOP_OK',nodes:graph.nodes.size,edges:graph.edgeCount,metres:Math.round(found.routes[0].distance),ms:Date.now()-begin}));
})().catch(err=>{console.error('LIVE_OSM_LOOP_FAILED:',err.message);process.exitCode=1});
