'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('marshik-guide.js','utf8');
const css=fs.readFileSync('marshik-guide.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
assert.ok(html.includes('marshik-guide.js?v=1.0')&&html.includes('marshik-guide.css?v=1.0'));
assert.ok(sw.includes('marshik-guide.js')&&sw.includes('marshik-guide.css'),'PWA caches the coach');
for(const key of ['create:distance','create:interest','create:gps','create:build','route:walk','route:photo','route:verify','route:next','route:finish','route:done'])
  assert.ok(js.includes(key),'Missing guidance step: '+key);
assert.ok(js.includes('rr_marshik_creator_stage_v41'),'progress should survive reload');
assert.ok(js.includes('clearStep()'),'previous hint must be removed');
assert.ok(js.includes("document.createElement('aside')"),'single contextual guidance bubble');
assert.ok(css.includes('prefers-reduced-motion:reduce'),'respect reduced motion');
console.log('Progressive Marshik stages, single target and offline assets OK');
