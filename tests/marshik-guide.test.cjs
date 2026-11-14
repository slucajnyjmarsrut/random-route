'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('marshik-guide.js','utf8');
const css=fs.readFileSync('marshik-guide.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
assert.ok(html.includes('marshik-guide.js?v=1.1')&&html.includes('marshik-guide.css?v=1.0'));
assert.ok(sw.includes('marshik-guide.js')&&sw.includes('marshik-guide.css'),'PWA caches the coach');
for(const key of ['create:distance','create:interest','create:gps','create:build','route:walk','route:photo','route:verify','route:next','route:finish','route:done'])
  assert.ok(js.includes(key),'Missing guidance step: '+key);
assert.ok(js.includes('rr_marshik_creator_stage_v41'),'progress should survive reload');
assert.ok(js.includes('clearStep()'),'previous hint must be removed');
assert.ok(js.includes("document.createElement('aside')"),'single contextual guidance bubble');
assert.ok(css.includes('prefers-reduced-motion:reduce'),'respect reduced motion');
assert.ok(!js.includes('Шаг 3 · Всё готово!'),'do not claim the route is ready before it exists');
assert.ok(js.indexOf('if (buildError) return')<js.indexOf('if (creatorStage === 0)'),
  'show real build errors before optional onboarding stages');
assert.equal((html.match(/serviceWorker\.register\(/g)||[]).length,1,'only one service worker registration');
assert.ok(html.includes("register('sw.js?v=44',{updateViaCache:'none'})"));
assert.ok(sw.includes('req.destination==="script"||req.destination==="style"'));
assert.ok(sw.includes('fetch(req,{cache:"no-store"})'));
console.log('Progressive Marshik stages, single target and offline assets OK');
