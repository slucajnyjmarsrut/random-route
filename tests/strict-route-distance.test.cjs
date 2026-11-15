'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/function routeDistanceToleranceM\(km\)\{[\s\S]*?\n  \}/);
assert.ok(match,'distance tolerance must be defined independently of navigation display');
const tolerance=new Function('return ('+match[0]+')')();
assert.equal(tolerance(2),160,'2 km permits only a 160m variation, not 800m');
assert.ok(2800-2000>tolerance(2),'previous 2.8km error must fail');
assert.ok(2100-2000<tolerance(2),'reasonable OSM metres still permitted');
assert.ok(tolerance(3)<300&&tolerance(7)<=500);
const walk=require('../walking-dijkstra.js');
const data=JSON.parse(fs.readFileSync('data/yakutsk-center-walking.json','utf8'));
const graph=walk.makeGraph(data.ways),start={lat:62.0274,lng:129.732};
const options=walk.returnTripStops(graph,start,2);
assert.ok(options.length>0,'real Yakutsk pedestrian network has return-trip candidates');
let matched=null;
for(const p of options){
 try{
  const r=walk.route(graph,[start,{lat:p.lat,lng:p.lng},start]);
  if(Math.abs(r.routes[0].distance-2000)<=tolerance(2)){matched=r;break}
 }catch(_){}
}
assert.ok(matched,'measured walking graph must offer an approximately 2 km route');
assert.ok(matched.routes[0].distance<=2160,'returned distance respects the clicked option');
assert.equal(matched.routes[0].legs.length,2,'return walk has real outbound/inbound paths');
assert.match(html,/retiredDistanceRoute/,'old oversized routes must not stay visible after an update');
console.log('STRICT_DISTANCE_OK 2km selection, ≤160m difference, measured OSM return, stale routes retired');
