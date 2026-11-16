const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../mascot-collection.js'),C=require('../mascot-chests.js');
const I=require('../mascot-inventory.js'),Art=require('../mascot-art.js');
const stats={routes:0,photos:0,quests:0,streak:0,km:0};
test('145 unique illustrated mascots',()=>{
 assert.equal(M.mascots.length,145);
 assert.equal(new Set(M.mascots.map(x=>x.id)).size,145);
 assert.equal(new Set(M.mascots.map(x=>x.name)).size,145);
 const sources=new Set(M.mascots.map(x=>Art.avatar(x)));
 assert.ok(sources.size>=55,'distinct premium and fallback character portraits');
 assert.match(Art.avatar(M.mascots.find(x=>x.id==='traveller-puppy')),/^assets\/mascots\/3d\/wolf\.webp$/);
 assert.match(Art.avatar(M.mascots.find(x=>x.id==='gourmet-panda')),/^assets\/mascots\/3d\/panda\.webp$/);
 assert.match(Art.avatar(M.mascots.find(x=>x.id==='runner-rabbit')),/^data:image\/svg\+xml/);
});
test('duplicate chests keep existing mascots in the drop pool',()=>{
 const id='traveller-puppy',item=M.mascots.find(x=>x.id===id);
 const pool=C.availableMascots(M.mascots,stats,[id],M.unlocked);
 assert.equal(pool.length,145);
 assert.equal(C.draw(C.CHESTS[0],[item],()=>.5).mascot.id,id);
 for(const chest of C.CHESTS){
  const odds=C.weightMap(chest,pool);
  assert.ok(Math.abs(Object.values(odds.weights).reduce((a,b)=>a+b,0)-100)<1e-6);
 }
});
test('v1 chest ownership migrates as one copy with old open count',()=>{
 const m=C.normalize({owned:['traveller-puppy','student-cat'],opened:8},M.mascots);
 assert.equal(m.copies['traveller-puppy'],1);
 assert.equal(m.copies['student-cat'],1);
 assert.equal(C.occupied(m),2);
 assert.equal(m.opened,8);
});
test('duplicate upgrades retain base and consume extra copies',()=>{
 const id='student-cat';
 const state=C.normalize({owned:[id],copies:{[id]:2}},M.mascots);
 assert.equal(I.canUpgrade(state,id,stats,M),true);
 const result=I.upgrade(state,id,stats,M);
 assert.equal(result.ranks[id],2);
 assert.equal(result.copies[id],1);
 assert.equal(state.copies[id],2);
 assert.equal(I.canUpgrade(C.normalize({owned:[id],copies:{[id]:1}},M.mascots),id,stats,M),false);
 assert.equal(I.canUpgrade(C.normalize({owned:[id],copies:{[id]:20},ranks:{[id]:5}},M.mascots),id,stats,M),false);
});
test('earned starter upgrades with one dropped copy',()=>{
 const id='traveller-puppy';
 const state=C.normalize({copies:{[id]:1}},M.mascots);
 const result=I.upgrade(state,id,stats,M);
 assert.equal(result.ranks[id],2);
 assert.equal(result.copies[id],undefined);
});
test('inventory expands from 50 to 150 with separate tester keys',()=>{
 let s=C.normalize(null,M.mascots);
 for(let i=0;i<10;i++)s=I.expand(s);
 assert.equal(s.capacity,150);
 assert.equal(I.expand(s),null);
 assert.notEqual(C.KEY,C.TESTER_KEY);
 assert.notEqual(C.LEGACY_KEY,C.LEGACY_TESTER_KEY);
});
