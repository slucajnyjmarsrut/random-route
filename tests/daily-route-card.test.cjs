'use strict';
const assert=require('node:assert/strict');
const daily=require('../daily-quests.js');

class FakeNode{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.events={};this.disabled=false;this.textContent='';this.className='';this.parent=null;}
 setAttribute(k,v){this.attributes[k]=String(v)}
 append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
 replaceChildren(...children){this.children=[];this.append(...children);}
 addEventListener(name,fn){this.events[name]=fn;}
 insertAdjacentElement(_where,node){this.append(node);}
 querySelector(selector){
   const m=selector.match(/^\[([a-z-]+)\]$/);
   if(!m)throw Error('Unexpected selector '+selector);
   function visit(node){if(Object.hasOwn(node.attributes,m[1]))return node;for(const child of node.children){const found=visit(child);if(found)return found;}return null}
   return visit(this);
 }
 click(){if(!this.disabled)this.events.click?.();}
}
function setup(){
 const nodes=Object.fromEntries(['home','route','quickInfoGrid','srs-route','toast'].map(id=>[id,new FakeNode('div')]));
 const doc={
  getElementById(id){return nodes[id]||null},
  createElement(tag){return new FakeNode(tag)},
  querySelector(){return null},
  addEventListener(){},
  hidden:false
 };
 return {nodes,doc};
}
global.localStorage={getItem:()=>null,setItem(){}};
global.window={DailyRouteQuests:daily,__isDeveloperMode:()=>false,__yakutskRR:{legs:[],stage:'idle',startMode:'gps'},addEventListener(){},setInterval(){}};
const nativeInterval=global.setInterval;
global.setInterval=()=>0;
async function test(){
 try{
  const {nodes,doc}=setup();
  let launched=null,count=0;
  window.__buildDailyRoute=async offer=>{launched=offer;count++;return true};
  daily.mount(doc);
  const panel=nodes.quickInfoGrid.children[0];
  assert.equal(panel.tagName,'SECTION');
  const cards=panel.querySelector('[data-daily-options]').children;
  assert.equal(cards.length,3);
  for(const card of cards){
    assert.equal(card.tagName,'BUTTON','Full route card must be a native button');
    assert.equal(card.disabled,false);
    assert.match(card.attributes['aria-label'],/Построить маршрут/);
    assert.equal(card.children.filter(child=>child.tagName==='BUTTON').length,0,'No nested buttons');
    assert.equal(card.children.length,4,'Icon, body, reward and arrow must all be inside one click target');
    assert.match(card.children[2].textContent,/\d+ RC/);
  }
  // Clicking the whole card builds a route, regardless of its visual reward label.
  cards[1].click();
  await Promise.resolve();
  assert.equal(count,1);
  assert.equal(launched.key,'explore');
  assert.equal(launched.reward,50);
  assert.equal(nodes['srs-route'].children.length,1,'Active route has same set of daily cards');
  console.log('Daily route card: full-size button and launch checks passed');
 }finally{global.setInterval=nativeInterval;}
}
test().catch(e=>{console.error(e);process.exitCode=1});
