'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const audit=require('../street-audit.js');
const data=JSON.parse(fs.readFileSync('data/yakutsk-center-walking.json','utf8'));
const bounds=data.bbox;
const center=data.ways.find(w=>w.geometry?.length>=2 &&
  w.geometry.slice(0,2).every(p=>p.lat>62.02&&p.lat<62.042&&p.lon>129.712&&p.lon<129.755));
assert.ok(center,'snapshot has a downtown road');
const pts=center.geometry.slice(0,2).map(p=>({lat:p.lat,lon:p.lon}));
assert.ok(audit.routeWithinBounds(pts),'route is inside the real bundle');
assert.ok(!audit.routeWithinBounds([{lat:62.17,lon:130.1},{lat:62.18,lon:130.11}]),
 'snapshot must not claim to cover another district');
const decoded=audit.parseBundledOsm(data,pts);
assert.equal(decoded.source,'bundled');
assert.ok(decoded.ways.length>100);
assert.equal(decoded.createdAt,data.created_at);
assert.throws(()=>audit.parseBundledOsm({...data,version:2},pts),/LocalSnapshotOutOfCoverage/);
assert.throws(()=>audit.parseBundledOsm(data,[{lat:62.2,lon:130.1},{lat:62.21,lon:130.11}]),
 /LocalSnapshotOutOfCoverage/);
(async()=>{
 const priorFetch=global.fetch,priorCaches=global.caches;
 try{
  delete global.caches;
  let reads=0;
  global.fetch=async uri=>{
   assert.match(String(uri),/yakutsk-center-walking\.json/);
   reads++;
   return {ok:true,json:async()=>data};
  };
  const bundle=await audit.bundledOsmForRoute(pts);
  assert.ok(bundle?.ways.length>100,'bundled real map must load without live Overpass');
  assert.equal(reads,1);
  const other=await audit.bundledOsmForRoute([{lat:62.2,lon:130.1},{lat:62.21,lon:130.11}]);
  assert.equal(other,null);
  assert.equal(reads,1,'out-of-coverage requests must not fetch misleading local data');
  global.caches={match:async()=>({ok:true,clone:()=>({json:async()=>data})})};
  global.fetch=async()=>{throw Error('offline')};
  assert.ok((await audit.bundledOsmForRoute(pts)).ways.length>100,'CacheStorage works without network');
  const samples=audit.sampleRoute(pts,20),report=audit.analyze(samples,bundle.ways);
  assert.ok(report.matched>0,'real OSM street evidence is matched');
  assert.equal(report.total,samples.length);
  assert.equal(report.lighting.yes+report.lighting.no+report.lighting.unknown,report.total);
  console.log('STREET_AUDIT_RECOVERY_OK cache, coverage, provenance, no fake street safety');
 }finally{
  global.fetch=priorFetch;
  if(priorCaches===undefined)delete global.caches;else global.caches=priorCaches;
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
