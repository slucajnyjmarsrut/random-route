'use strict';
const assert=require('node:assert/strict');
const route=require('../walking-dijkstra.js');
const p={lat:62.03,lng:129.70};
assert.match(route.osmQuery(route.bbox(p,1000)),/highway/);
assert.equal(route.allowed({highway:'footway'}),true);
assert.equal(route.allowed({highway:'residential'}),true);
assert.equal(route.allowed({highway:'motorway'}),false);
assert.equal(route.allowed({highway:'service',access:'private'}),false);
assert.equal(route.allowed({highway:'service'}),false);
assert.equal(route.allowed({highway:'service',foot:'yes'}),true);
assert.equal(route.allowed({highway:'primary',sidewalk:'no'}),false);
assert.equal(route.allowed({highway:'primary',sidewalk:'yes'}),true);
const vertices=Array.from({length:24},(_,i)=>({lat:p.lat+i*.00007,lon:p.lng}));
const ways=[{type:'way',nodes:vertices.map((_,i)=>i+101),geometry:vertices,tags:{highway:'footway'}}];
const graph=route.makeGraph(ways);
assert.equal(graph.nodes.size,24);
assert.equal(graph.edgeCount,23);
const first=vertices[0],last=vertices.at(-1);
const start={lat:first.lat,lng:first.lon},finish={lat:last.lat,lng:last.lon};
assert.equal(route.nearestNode(graph,start),String(101));
assert.equal(route.nearestNode(graph,finish),String(124));
const path=route.shortest(graph,'101','124');
assert.equal(path.ids.length,24);
assert.ok(path.length>150&&path.length<250);
const output=route.route(graph,[start,finish]);
assert.equal(output.source,'dijkstra-osm');
assert.equal(output.routes.length,1);
assert.equal(output.routes[0].legs.length,1);
assert.equal(output.routes[0].geometry.type,'LineString');
assert.equal(output.routes[0].geometry.coordinates.length,24,'zone checks use real Dijkstra geometry');
assert.equal(output.routes[0].legs[0].steps[0].geometry.coordinates.length,24);
assert.equal(output.waypoints.length,2);
const zone={lat:p.lat+.0008,lng:p.lng,radius:20};
assert.equal(route.shortest(graph,'101','124',[zone]),null,'avoid zone must prevent crossing');
assert.throws(()=>route.route(graph,[start,finish],{zones:[zone]}),/DisconnectedWalkingGraph/);
assert.throws(()=>route.makeGraph([{nodes:[1,2],geometry:vertices.slice(0,2),tags:{highway:'footway'}}]),/GraphIncomplete/);
// Penalty weights influence shortest-path selection but measured distance stays actual.
const manual={nodes:new Map([['A',{lat:62,lng:129}],['B',{lat:62.0001,lng:129}],['C',{lat:62,lng:129.0001}]]),
adj:new Map([['A',[{to:'B',cost:200,metres:100},{to:'C',cost:80,metres:120}]],['B',[]],['C',[{to:'B',cost:80,metres:120}]]])};
const chosen=route.shortest(manual,'A','B');assert.deepEqual(chosen.ids,['A','C','B']);assert.equal(chosen.length,240);
const costly=new Map([['A:C',1],['B:C',1]]);
assert.deepEqual(route.shortest(manual,'A','B',[],costly).ids,['A','B'],'repeat penalty should avoid used physical edges');
console.log('OSM walking Dijkstra: graph creation, pedestrian tags, shortest path, no-go zones, route geometry OK');

// First tap can use a cached graph without any repeat HTTP requests.
(async()=>{
  const prior=global.fetch;
  let requests=0;
  try{
    global.fetch=async()=>{requests++;return {ok:true,json:async()=>({elements:ways})};};
    assert.equal(route.hasWarmGraph(start,3),false);
    assert.equal(await route.preload(start,3),true);
    assert.equal(route.hasWarmGraph(start,3),true);
    const count=requests;
    const fast=await route.requestRoute([start,finish],{distanceKm:3});
    assert.equal(fast.source,'dijkstra-osm');
    assert.equal(requests,count,'warm graph should not fetch OSM again');
    assert.equal(await route.preload(start,3),true);
    assert.equal(requests,count,'repeated graph prewarm uses the cached graph');
    // A second radius should coexist without overwriting the first graph.
    assert.equal(await route.preload(start,5),true);
    assert.equal(route.hasWarmGraph(start,5),true);
    assert.equal(route.hasWarmGraph(start,3),true);
    console.log('Dijkstra warm-cache: no second Overpass request required');
  }finally{global.fetch=prior;}
})().catch(e=>{console.error(e);process.exitCode=1});
