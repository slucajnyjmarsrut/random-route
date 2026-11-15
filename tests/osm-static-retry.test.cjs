'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const snapshot=JSON.parse(fs.readFileSync('data/yakutsk-center-walking.json','utf8'));
const path=require.resolve('../walking-dijkstra.js');
(async()=>{
 const prevFetch=global.fetch,prevCache=global.caches;
 try{
  delete global.caches;
  delete require.cache[path];
  const routes=require('../walking-dijkstra.js');
  let calls=0;
  global.fetch=async input=>{
   assert.match(String(input),/yakutsk-center-walking\.json/);
   calls++;
   if(calls===1)throw new Error('brief network outage');
   return {ok:true,json:async()=>snapshot};
  };
  await assert.rejects(routes.loadStaticGraph(),/brief network outage/);
  const graph=await routes.loadStaticGraph({retry:true});
  assert.ok(graph.nodes.size>100,'Retry should work immediately after offline error');
  assert.equal(calls,2);
  assert.equal(await routes.loadStaticGraph(),graph);
  // New tab/runtime with a pre-cached real street snapshot and no internet.
  delete require.cache[path];
  const offline=require('../walking-dijkstra.js');
  global.fetch=async()=>{throw Error('offline')};
  let cacheReads=0;
  global.caches={match:async uri=>{
    assert.match(uri,/yakutsk-center-walking\.json/);
    cacheReads++;
    return {ok:true,clone:()=>({json:async()=>snapshot})};
  }};
  const stored=await offline.loadGraph({lat:62.0274,lng:129.732},3);
  assert.ok(stored.nodes.size>100,'use only genuine cached OSM streets');
  assert.equal(cacheReads,1);
  assert.equal(offline.canUseStatic({lat:62.20,lng:130.10},3),false,'no invented coverage');
  console.log('OSM local network recovery: immediate retry, cached snapshot, coverage guard OK');
 }finally{
  global.fetch=prevFetch;
  if(prevCache===undefined)delete global.caches;else global.caches=prevCache;
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});