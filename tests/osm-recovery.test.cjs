'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const route=require('../walking-dijkstra.js');
const snapshot=JSON.parse(fs.readFileSync('data/yakutsk-center-walking.json','utf8'));
const originalFetch=global.fetch;
(async()=>{
  const center={lat:62.0274,lng:129.732};
  let remoteAttempts=0,localLoads=0;
  try{
    global.fetch=async input=>{
      const url=String(input);
      if(url.includes('data/yakutsk-center-walking.json')){
        localLoads++;
        return {ok:true,json:async()=>snapshot};
      }
      remoteAttempts++;
      throw new Error('Network unreachable');
    };
    assert.equal(route.canUseStatic(center,7),false,
      '7 km should still try live OSM for its wider coverage');
    const graph=await route.loadGraph(center,7);
    assert.ok(graph.nodes.size>100,'fallback must be a real bundled OSM graph');
    assert.ok(remoteAttempts>=2,'two independent OSM Overpass servers are tried before a local fallback');
    assert.equal(localLoads,1,'load bundled snapshot once');
    assert.equal(route.hasWarmGraph(center,7),true,'fallback graph is reused');
    const calls=remoteAttempts;
    await route.loadGraph(center,7);
    assert.equal(remoteAttempts,calls,'cached fallback avoids extra requests');
    await route.loadGraph(center,7,{retry:true});
    assert.ok(remoteAttempts>calls,'explicit retry must retry the network instead of repeating the same cache');
    await assert.rejects(route.loadGraph({lat:62.20,lng:130.1},7,{retry:true}),/OSMUnavailable/,
      'outside the bundled coverage, never invent a walking graph');
    console.log('OSM recovery: true local graph, controlled manual retry, no fake out-of-area route OK');
  }finally{
    global.fetch=originalFetch;
  }
})().catch(e=>{console.error(e);process.exitCode=1});
