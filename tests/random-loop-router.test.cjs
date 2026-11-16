/* Run: node --test tests/random-loop-router.test.cjs (Node 20+) */
const test=require('node:test'),assert=require('node:assert/strict');
const walk=require('../walking-dijkstra.js');
const random=require('../random-loop-router.js');
function grid(){
  const n=17,lat0=62.022,lon0=129.724,dlat=.00035,dlng=.00072,ways=[];
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const id=i*n+j,a={lat:lat0+i*dlat,lon:lon0+j*dlng};
    if(i<n-1)ways.push({nodes:[id,(i+1)*n+j],geometry:[a,{lat:lat0+(i+1)*dlat,lon:a.lon}],tags:{highway:'footway'}});
    if(j<n-1)ways.push({nodes:[id,i*n+j+1],geometry:[a,{lat:a.lat,lon:lon0+(j+1)*dlng}],tags:{highway:'footway'}});
  }
  const graph=walk.makeGraph(ways),start={lat:lat0+8*dlat,lng:lon0+8*dlng};
  const pois=[];
  for(let i=2;i<n-2;i++)for(let j=2;j<n-2;j++)
    if((i+j)%2===0&&!(i===8&&j===8))pois.push({id:'p'+i+'-'+j,
      _lat:lat0+i*dlat,_lng:lon0+j*dlng,type:'tourist_guide',_isTouristGuide:true,
      tags:{name:'Парк '+i},_referenceUrl:(i+j)%3===0?'test-photo':null});
  return {graph,start,pois};
}
function seeded(seed){let x=seed>>>0;return ()=>((x=(Math.imul(1664525,x)+1013904223)>>>0)/4294967296);}
test('random Dijkstra loop closes and respects distance ±5% without a model',async()=>{
  const fixture=grid();
  const result=await random.findRoute({...fixture,routing:walk,distanceKm:1,rng:seeded(4),maxAttempts:35,timeBudgetMs:20000});
  assert.ok(result.attempts>0);
  assert.ok(result.best);
  assert.equal(result.best.metrics.withinTolerance,true);
  assert.ok(Math.abs(result.best.route.distance-1000)<=50);
  assert.equal(result.best.data.waypoints[0].location.join(','),result.best.data.waypoints.at(-1).location.join(','));
  assert.ok(result.best.metrics.repeatPercent>=0);
});
test('out and back counts reversed physical streets as repeated metres',()=>{
  const {graph,start}=grid(),end=graph.nodes.get(String(8*17+10));
  const data=walk.route(graph,[start,end,start]),m=random.evaluate(data,start,data.routes[0].distance);
  assert.equal(m.withinTolerance,true);
  assert.ok(m.repeatM>0);
});
test('fake distance and broken route are rejected',()=>{
  const {graph,start}=grid(),end=graph.nodes.get(String(8*17+10));
  const original=walk.route(graph,[start,end,start]);
  const data=JSON.parse(JSON.stringify(original));
  data.routes[0].distance+=100;
  assert.throws(()=>random.evaluate(data,start,original.routes[0].distance),/DistanceMismatch/);
  const bad=JSON.parse(JSON.stringify(original));
  bad.routes[0].legs[1].steps[0].geometry.coordinates[0]=[0,0];
  assert.throws(()=>random.evaluate(bad,start,original.routes[0].distance),/DisconnectedWalkingRoute/);
});
test('no candidate is falsely accepted when the required length is impossible',async()=>{
  const {graph,start}=grid();
  const pois=[
    {id:'a',_lat:start.lat+.00035,_lng:start.lng},
    {id:'b',_lat:start.lat,_lng:start.lng+.00072}
  ];
  const result=await random.findRoute({graph,start,pois,routing:walk,distanceKm:1,rng:seeded(8),maxAttempts:35,timeBudgetMs:20000});
  assert.ok(!result.best || result.best.metrics.withinTolerance===false);
});
test('duplicate POIs and missing reachable points are rejected',async()=>{
  const {graph,start}=grid();
  const result=await random.findRoute({graph,start,pois:[{id:'a',_lat:start.lat+.00035,_lng:start.lng},
    {id:'a',_lat:start.lat+.00070,_lng:start.lng}],routing:walk,distanceKm:1});
  assert.equal(result.best,null);
});
