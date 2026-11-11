'use strict';
const assert=require('node:assert/strict');
const tap=require('../tap-targets.js');
class Fake{
 constructor(tag='div',attrs={}){
  this.tag=tag;this.dataset=attrs;this.attributes={};this.listeners={};this.children=[];
  this.parent=null;this.disabled=false;this.tabIndex=0;this.count=0;this.textContent='';
  this.classNames=new Set();
  this.classList={add:name=>this.classNames.add(name),toggle:(name,enabled)=>enabled?this.classNames.add(name):this.classNames.delete(name)};
 }
 append(child){this.children.push(child);child.parent=this;}
 setAttribute(k,v){this.attributes[k]=String(v);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 matches(selector){return this.tag==='button' && selector==='button[data-buy-type]';}
 contains(other){return other===this||this.children.some(c=>c.contains(other));}
 querySelector(sel){
  if(sel==='button,input,select,textarea,a[href]')return this.children.find(c=>['button','a','input','select','textarea'].includes(c.tag))||null;
  if(sel==='button[data-buy-type="coins"]'||sel==='button[data-buy-type="feature"]')return this.children.find(c=>c.tag==='button'&&c.dataset.buyType===sel.match(/="(\w+)"/)[1])||null;
  if(sel==='h3'||sel==='b,strong')return {textContent:'Проверка'};
  return null;
 }
 querySelectorAll(sel){
  if(sel==='button,a[href],input,select,textarea')return this.children.filter(c=>['button','a','input','select','textarea'].includes(c.tag));
  return [];
 }
 click(){
  this.count++;
  const e={target:this,preventDefault(){},stopPropagation(){},closest(){}};
  this.listeners.click?.(e);
  // Bubble child button click to parent just as native DOM does.
  if(this.parent)this.parent.listeners.click?.({target:this});
 }
 press(key,opts={}){
  const e={key,target:this,repeat:!!opts.repeat,preventDefault(){this.prevented=true},prevented:false};
  this.listeners.keydown?.(e);return e;
 }
}
const info=new Fake('div',{infoTitle:'Как работает'});
let modal=0;info.addEventListener('click',()=>modal++);
assert(tap.makeInfoButton(info));
assert.equal(info.attributes.role,'button');
assert.equal(info.attributes.tabindex,'0');
assert(info.press('Enter').prevented);
assert.equal(modal,1);
assert(info.press(' ').prevented);
assert.equal(modal,2);
assert.equal(info.press('Enter',{repeat:true}).prevented);
assert.equal(modal,2);
assert(!tap.makeInfoButton(info));

const card=new Fake('div'),btn=new Fake('button',{buyType:'coins',title:'500 RouteCoin',price:'99 ₽'});
card.append(btn);
let opens=0;btn.addEventListener('click',()=>opens++);
assert(tap.makeOneActionCard(card,'button[data-buy-type="coins"]'));
assert.equal(card.attributes.role,'button');
assert.equal(btn.attributes['aria-hidden'],'true');
assert.equal(btn.tabIndex,-1);
assert.equal(card.attributes['aria-disabled'],'false');
card.click(); // anywhere in card
assert.equal(opens,1);
card.press('Enter');
assert.equal(opens,2);
card.press(' ');
assert.equal(opens,3);
btn.click(); // direct click should NOT repeat action through card
assert.equal(opens,4);
btn.disabled=true;
card.click();card.press('Enter');
assert.equal(opens,4);
const multiple=new Fake('div');multiple.append(new Fake('button',{buyType:'coins'}));multiple.append(new Fake('button',{buyType:'coins'}));
assert.equal(tap.makeOneActionCard(multiple,'button[data-buy-type="coins"]'),false);
assert.equal(multiple.attributes.role,undefined);

const badge=new Fake('div');let details=0;badge.addEventListener('click',()=>details++);
assert(tap.makeMultiActionDetail(badge));
assert.equal(badge.attributes.role,'group');
badge.press('Enter');assert.equal(details,1);
badge.press(' ');assert.equal(details,2);
assert(!tap.makeMultiActionDetail(badge));
console.log('Touch-target tests: informational, purchase-preview, keyboard and multi-action safety OK');
