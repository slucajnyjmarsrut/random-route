'use strict';
const assert=require('node:assert/strict');
const {nodes,edges,dijkstra,mount}=require('../dijkstra-lab.js');
assert.equal(nodes.length,5);
assert.equal(edges.length,7);
const result=dijkstra(nodes,edges,'A','E');
assert.deepEqual(result.path,['A','C','B','D','E']);
assert.equal(result.length,1100);
assert.equal(result.trace[0].distance.A,0);
assert.equal(result.trace[0].distance.E,Infinity);
assert.deepEqual(result.trace.slice(1).map(x=>x.current),['A','C','B','D','E']);
assert.equal(result.trace.at(-1).distance.E,1100);
assert.deepEqual(dijkstra(nodes,edges,'A','B').path,['A','C','B']);
assert.equal(dijkstra(nodes,edges,'D','D').length,0);
assert.deepEqual(dijkstra(nodes,edges,'D','D').path,['D']);
assert.throws(()=>dijkstra(nodes,[{a:'A',b:'B',weight:-1}],'A','B'),/Некорректное/);
assert.throws(()=>dijkstra(nodes,edges,'X','E'),/Неизвестная/);
assert.deepEqual(dijkstra(['A','B'],[],'A','B').path,[]);
class Element {
 constructor(id){this.id=id;this.value='';this.disabled=false;this.textContent='';this.innerHTML='';this.dataset={};this.handlers={};}
 addEventListener(name,fn){this.handlers[name]=fn;}
 click(){this.handlers.click?.();}
 change(){this.handlers.change?.();}
}
const elements=new Map();
const doc={getElementById(id){
 if(!elements.has(id))elements.set(id,new Element(id));
 return elements.get(id);
}};
const e=id=>doc.getElementById(id);
e('labStart').value='A';e('labEnd').value='E';
mount(doc);
assert.match(e('labStatus').textContent,/Шаг 0/);
assert.match(e('labDistanceTable').innerHTML,/∞/);
assert.equal(e('labPrevious').disabled,true);
e('labNext').click();
assert.match(e('labStatus').textContent,/Шаг 1/);
e('labRun').click();
assert.match(e('labResult').textContent,/1100 м/);
assert.match(e('labGraph').innerHTML,/lab-edge-route/);
assert.equal(e('labNext').disabled,true);
e('labPrevious').click();
assert.equal(e('labNext').disabled,false);
e('labEnd').value='B';e('labEnd').change();
e('labRun').click();
assert.match(e('labResult').textContent,/300 м/);
e('labReset').click();
assert.equal(e('laboratory').dataset.labComplete,'false');
mount(doc); // mounting twice must not register duplicate handlers
console.log('Dijkstra: paths, weights, snapshots and interactive controls OK');
