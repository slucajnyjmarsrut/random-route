'use strict';
// Test actual form behavior for the two regression screenshots; no jsdom dependency.
const assert=require('node:assert/strict');
global.window={SmartRouteChat:null,__yakutskRR:{legs:[{}],stage:'walking'},state:{},__isDeveloperMode:()=>false};
const events={};
global.localStorage={getItem:()=>null,setItem:()=>{}};
let clicks=0;
class Element{
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.children=[];this.classes=new Set();this.handlers={};this.scrollTop=0;}
 get classList(){return {add:x=>this.classes.add(x),contains:x=>this.classes.has(x),toggle:x=>this.classes.has(x)?(this.classes.delete(x),false):(this.classes.add(x),true)};}
 addEventListener(name,fn){this.handlers[name]=fn;}
 appendChild(child){this.children.push(child);}
 removeChild(child){const i=this.children.indexOf(child);if(i>=0)this.children.splice(i,1);}
 closest(){return null;}
 setAttribute(){}
 dispatchEvent(){}
 click(){clicks++;}
 requestSubmit(){this.handlers.submit?.({preventDefault(){}});}
}
const cache=new Map();
const get=id=>{if(!cache.has(id))cache.set(id,new Element(id));return cache.get(id);};
const doc={
 getElementById:get,createElement:()=>new Element(),
 querySelector(sel){
  if(sel==='#typeChoices .choice.active')return {dataset:{type:'parks'}};
  if(sel.startsWith('#typeChoices .choice[data-type='))return get('type-choice');
  return null;
 }
};
const moduleApi=require('../smart-route-chat.js');
window.SmartRouteChat=moduleApi;
moduleApi.mount(doc);
function ask(msg){
 const inp=get('smartRouteChatInput');inp.value=msg;get('smartRouteChatForm').requestSubmit();
 return get('smartRouteChatLog').children.at(-1)?.textContent||'';
}
let response=ask('почему полтора часа это 2 км');
assert.match(response,/6,5 км/);
assert.match(response,/не менял/);
assert.equal(clicks,0);
response=ask('нет я не хочу 2км');
assert.match(response,/не меняю маршрут/);
assert.equal(clicks,0);
assert.equal(get('distanceInput').value,'');
response=ask('нет, не хочу 2 км, а 6 км');
assert.match(response,/6 км/);
assert.equal(clicks,0);
assert.equal(get('distanceInput').value,'6');
console.log('Chat UI regression: 9 checks passed');
