'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const theme=require('../graphite-theme.js');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('graphite-theme.css','utf8');
assert.equal(theme.normalize('graphite'),'graphite');
assert.equal(theme.normalize('light'),'light');
assert.equal(theme.normalize(undefined),'graphite');
assert.equal(theme.normalize('other'),'graphite');
assert.ok(html.includes('graphite-theme.css?v=1.1'));
assert.match(css,/#questBlock \.quest-option/,'quest answers must have readable dark-theme colors');
assert.ok(html.includes('graphite-theme.js?v=1.0'));
assert.ok(html.includes('data-rr-theme'));
assert.ok(html.includes('id="rrThemeSelect"'));
assert.ok(html.includes('value="graphite" selected'));
assert.ok(css.includes('html[data-rr-theme="graphite"]'));
for(const klass of ['.topbar','.nav','.card','.schat-card','.rdq-card','.srs-card',
  '.streak-card','.rr-settings-options','.photo-task-card','.purchase-modal',
  '.auth-sheet','.info-modal','.lab-card']){
  assert.ok(css.includes(klass),'Dark styling absent for '+klass);
}
assert.ok(css.includes('rr-graphite-wave-one'));
assert.ok(css.includes('rr-graphite-wave-two'));
assert.ok(css.includes('prefers-reduced-motion:reduce'));
assert.ok(css.includes('pointer-events:none'));
const nodes={};
function elem(id){
  if(!nodes[id])nodes[id]={id,attrs:{},value:null,dataset:{},handlers:{},
    setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.handlers[k]=fn;}};
  return nodes[id];
}
const doc={
 documentElement:elem('root'),
 querySelector(selector){return selector==='meta[name="theme-color"]'?elem('meta'):null;},
 getElementById(id){return id==='rrThemeSelect'?elem(id):null;}
};
const records={};
const storage={
 getItem(k){return records[k]??null;},
 setItem(k,v){records[k]=v;}
};
theme.mount(doc,storage);
assert.equal(elem('root').attrs['data-rr-theme'],'graphite');
assert.equal(elem('meta').attrs.content,'#20262e');
assert.equal(elem('rrThemeSelect').value,'graphite');
assert.equal(Object.keys(records).length,0,'default mode should not write');
elem('rrThemeSelect').value='light';
elem('rrThemeSelect').handlers.change();
assert.equal(records[theme.KEY],'light');
assert.equal(elem('root').attrs['data-rr-theme'],'light');
assert.equal(elem('meta').attrs.content,'#f7faf8');
theme.mount(doc,storage);
assert.equal(elem('rrThemeSelect').value,'light','stored mode persists');
assert.equal(Object.keys(elem('rrThemeSelect').handlers).length,1);
elem('rrThemeSelect').value='graphite';
elem('rrThemeSelect').handlers.change();
assert.equal(records[theme.KEY],'graphite');
assert.equal(elem('root').attrs['data-rr-theme'],'graphite');
assert.equal(elem('meta').attrs.content,'#20262e');
assert.equal(theme.read({getItem(){throw Error('privacy');}}),'graphite');
console.log('Graphite theme: default, preferences, accessible toggle and styling OK');
