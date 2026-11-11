'use strict';
const assert=require('node:assert/strict');
const layout=require('../responsive-layout.js');

assert.equal(layout.viewClass(1920,1080),'desktop');
assert.equal(layout.viewClass(1440,900),'desktop');
assert.equal(layout.viewClass(1024,768),'desktop');
assert.equal(layout.viewClass(800,1180),'tablet');
assert.equal(layout.viewClass(390,844),'phone');
assert.equal(layout.viewClass(360,640),'phone'); // 9:16 portrait
assert.equal(layout.viewClass(414,896),'phone'); // taller modern portrait
assert.equal(layout.viewClass(844,390),'landscape');
assert.equal(layout.viewClass(700,440),'landscape');
assert.equal(layout.viewClass(0,0),'unknown');

const listeners={},queue=[];
let yandexResizes=0,leafletResizes=0,observed=0;
const app={dataset:{},clientWidth:390,clientHeight:844};
const win={
 innerWidth:390,innerHeight:844,
 addEventListener(name,callback){listeners[name]=callback},
 requestAnimationFrame(fn){queue.push(fn);return queue.length},
 visualViewport:{addEventListener(name,fn){listeners['visual-'+name]=fn}},
 __rrResizeMaps(){yandexResizes++},
 __rrResizeFallbackMaps(){leafletResizes++}
};
global.window=win;
global.ResizeObserver=class{
 constructor(callback){listeners.ro=callback}
 observe(){observed++}
};
const doc={defaultView:win,querySelector(selector){return selector==='.app'?app:null},
 getElementById(id){return id==='homeMap'||id==='realMap'?{id}:null}};
layout.mount(doc);
assert.equal(app.dataset.layout,'phone');
assert.equal(app.dataset.orientation,'portrait');
assert.equal(yandexResizes,1);
assert.equal(leafletResizes,1);
assert.equal(observed,2);

win.innerWidth=1200;win.innerHeight=780;
listeners.resize();assert.equal(queue.length,1);
queue.shift()();
assert.equal(app.dataset.layout,'desktop');
assert.equal(app.dataset.orientation,'landscape');
assert.equal(yandexResizes,2);
assert.equal(leafletResizes,2);
win.innerWidth=844;win.innerHeight=390;
listeners.orientationchange();queue.shift()();
assert.equal(app.dataset.layout,'landscape');
win.innerWidth=390;win.innerHeight=844;
listeners['visual-resize']();queue.shift()();
assert.equal(app.dataset.layout,'phone');
console.log('Responsive layout: viewport, orientation, resize and both map providers OK');
