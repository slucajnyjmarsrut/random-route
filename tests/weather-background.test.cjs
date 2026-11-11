'use strict';
const assert=require('node:assert/strict');
const mod=require('../weather-background.js');
const c=(temp,code,day=1,snow=0,precip=0)=>mod.classify({
 temperature_2m:temp,weather_code:code,is_day:day,snowfall:snow,precipitation:precip
});
assert.deepEqual(mod.classify(null),{mode:'unknown',night:false});
assert.deepEqual(mod.classify({}),{mode:'unknown',night:false});
assert.deepEqual(c(19,0),{mode:'sun',night:false});
assert.deepEqual(c(19,1),{mode:'sun',night:false});
assert.deepEqual(c(19,2),{mode:'cloud',night:false});
assert.deepEqual(c(19,3),{mode:'cloud',night:false});
assert.deepEqual(c(19,45),{mode:'cloud',night:false});
assert.deepEqual(c(10,61),{mode:'rain',night:false});
assert.deepEqual(c(10,80),{mode:'rain',night:false});
assert.deepEqual(c(10,95),{mode:'rain',night:false});
assert.deepEqual(c(10,0,1,0,1),{mode:'rain',night:false});
assert.deepEqual(c(-10,71),{mode:'snow',night:false});
assert.deepEqual(c(-10,0,1,1,1),{mode:'snow',night:false});
assert.deepEqual(c(-16,0),{mode:'winter',night:false});
assert.deepEqual(c(-16,3),{mode:'winter',night:false});
assert.deepEqual(c(-1,61),{mode:'winter',night:false});
assert.deepEqual(c(18,0,0),{mode:'sun',night:true});
assert.deepEqual(c(-13,73,0),{mode:'snow',night:true});
assert.match(mod.sceneLabel({mode:'winter',night:false}),/Морозная погода/);
assert.match(mod.sceneLabel({mode:'snow',night:false}),/снег/i);
assert.match(mod.sceneLabel({mode:'unknown',night:false}),/нет данных/);
assert(!mod.sceneLabel({mode:'winter',night:false}).includes('Снегопад'));
assert.equal(mod.classify({temperature_2m:null,weather_code:null}).mode,'unknown');

class Fake{
 constructor(tag,cls=''){
  this.tagName=tag;this.className=cls;this.children=[];this.attributes={};this.style={setProperty:(k,v)=>{this.style[k]=v;}};
  this.textContent='';
 }
 setAttribute(k,v){this.attributes[k]=String(v);}
 appendChild(c){this.children.push(c);return c;}
 insertBefore(c){this.children.unshift(c);}
 querySelector(selector){
  const key=selector.replace('.','');
  const find=(node)=>{if(node.className.split(' ').includes(key))return node;
   for(const c of node.children){const x=find(c);if(x)return x;}return null;};
  return find(this);
 }
}
const app=new Fake('div','app'),hero=new Fake('div','hero');
const doc={
 querySelector(sel){return sel==='.app'?app:sel==='#home .hero'?hero:null;},
 getElementById(){return null;},
 createElement(tag){return new Fake(tag);}
};
global.window={SmartSafety:{getPreferences:()=>({animatedBackground:true})}};
mod.mount(doc);
assert.equal(app.children.length,1);
const scene=app.children[0];
assert.equal(scene.attributes['aria-hidden'],'true');
assert.equal(scene.querySelector('.rr-wb-particles').children.length,18);
assert.equal(app.attributes['data-weather-mode'],'unknown');
assert.match(hero.children[0].textContent,/нет данных/);
mod.setConditions({temperature_2m:20,weather_code:0,is_day:1,snowfall:0,precipitation:0});
assert.equal(app.attributes['data-weather-mode'],'sun');
assert.match(hero.children[0].textContent,/Ясно/);
mod.setConditions({temperature_2m:8,weather_code:61,is_day:0,snowfall:0,precipitation:2});
assert.equal(app.attributes['data-weather-mode'],'rain');
assert.equal(app.attributes['data-weather-night'],'true');
mod.setAnimationEnabled(false);
assert.equal(app.attributes['data-weather-animation'],'off');
mod.setConditions(null);
assert.equal(app.attributes['data-weather-mode'],'unknown');
assert.match(hero.children[0].textContent,/нет данных/);
console.log('Weather background: classification, day/night, failure, motion toggle and scene DOM checks passed');
