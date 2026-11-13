'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const css=fs.readFileSync('mobile-ux.css','utf8');
const dijkstra=fs.readFileSync('walking-dijkstra.js','utf8');
const data=JSON.parse(fs.readFileSync('data/yakutsk-center-walking.json','utf8'));
const walk=require('../walking-dijkstra.js');
assert.match(data.source,/OpenStreetMap API 0.6/);
assert.ok(data.ways.length>2000,'actual roads must be bundled for Yakutsk');
assert.ok(sw.includes('./data/yakutsk-center-walking.json'),'offline/PWA shell must cache real roads');
assert.ok(sw.includes('./mobile-ux.css'),'mobile stylesheet must be cached');
assert.ok(html.includes('mobile-ux.css?v=1.1'),'mobile CSS should be activated on live site');
assert.ok(html.includes('walking-dijkstra.js?v=2.1'),'browser must use new OSM loader');
assert.ok(css.includes('position:sticky')&&css.includes('.rr-create-go'),'build button remains reachable on phones');
assert.match(css,/@media\(max-width:599px\)/);
assert.match(css,/safe-area-inset-bottom/);
assert.match(css,/\.rr-wish-buttons/);
assert.match(css,/\.map-follow/);
assert.match(css,/max-height:calc\(100dvh/);
assert.ok(html.includes('id="rrRouteExtras"')&&html.includes('<summary>⚙️ Изменить маршрут'),'advanced route actions can be expanded');
assert.match(html,/requestLocation\(true,\(\)=>buildYakutsk\(options\)\)/,'after GPS permission walk should build without second tap');
assert.match(html,/reachableStops\(streetGraph,rr.start,near/,'only connected OSM tourist points');
assert.match(html,/walkingWaypoints\(streetGraph,rr.start,input/,'walking fallback must be drawn on real streets');
assert.match(html,/syntheticWalk\)toast/,'street walks must be clearly named');
assert.match(html,/usePhotoOptional=usePhotoOptional\|\|syntheticWalk/,'no invented photo rewards');
assert.ok(!/valhalla/i.test(html),'external pedestrian engine must remain removed');
assert.ok(dijkstra.includes('loadStaticGraph')&&dijkstra.includes('canUseStatic'),'static graph must be preferred to public Overpass');
assert.equal(walk.canUseStatic({lat:62.0274,lng:129.732},3),true,'city centre avoids Overpass');
assert.equal(walk.canUseStatic({lat:62.081,lng:129.684},3),false,'do not pretend static graph covers suburbs');
const graph=walk.makeGraph(data.ways);
assert.ok(graph.nodes.size>3000);
const start={lat:62.0274,lng:129.732};
const viable=walk.walkingWaypoints(graph,start,3).filter((x,i)=>i%Math.max(1,Math.ceil(walk.walkingWaypoints(graph,start,3).length/35))===0);
assert.ok(viable.length>2,'walkable OSM nodes near default demo start');
let result=null;
for(let i=0;i<Math.min(viable.length,24)&&!result;i++){
 for(let j=i+1;j<Math.min(viable.length,i+7);j++){
  try{const r=walk.route(graph,[start,viable[i],viable[j],start]);
   if(r.routes[0].distance>=1750&&r.routes[0].distance<=4250){result=r;break;}
  }catch(e){}
 }
}
assert.ok(result,'default Yakutsk location must support a real ~3km loop');
assert.equal(result.source,'dijkstra-osm');
console.log('Mobile UX and actual Yakutsk Dijkstra: real centre loop, GPS, touch targets, OSM fallback and cached data OK');
