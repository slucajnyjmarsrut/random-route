'use strict';
const assert=require('node:assert/strict');
const M=require('../mascot-collection.js');
const C=require('../mascot-chests.js');
assert.equal(M.mascots.length,20);
assert.equal(C.CHESTS.length,3);
assert.deepEqual(C.CHESTS.map(c=>c.price),[80,240,600]);
for(const c of C.CHESTS){
 assert.equal(Object.values(c.weights).reduce((a,b)=>a+b,0),100,'all base odds sum to 100');
 assert.ok(Object.values(C.weightMap(c,M.mascots,0).weights).reduce((a,b)=>a+b,0)>99.99);
}
const empty=M.statsOf([]);
const available=C.availableMascots(M.mascots,empty,[],M.unlocked);
assert.equal(available.length,19,'starter mascot is excluded');
assert.ok(!available.some(m=>m.id==='traveller-puppy'));
const first=C.draw(C.CHESTS[0],available,0,()=>0);
assert.equal(first.rarity,'common');
assert.equal(first.nextPity,1);
assert.notEqual(first.mascot.id,'traveller-puppy');
assert.equal(M.select({},first.mascot.id,empty).selected,'traveller-puppy');
assert.equal(M.select({},first.mascot.id,empty,new Set([first.mascot.id])).selected,first.mascot.id,
 'chest mascot can be equipped without meeting achievement requirement');
const after=C.availableMascots(M.mascots,empty,[first.mascot.id],M.unlocked);
assert.equal(after.length,18);
assert.ok(!after.some(m=>m.id===first.mascot.id),'no duplicates');
const allLegendary=M.mascots.filter(m=>m.rarity==='legendary');
const onlyLegendary=C.weightMap(C.CHESTS[1],allLegendary,0);
assert.equal(onlyLegendary.weights.legendary,100,'empty rarity pools are renormalized');
assert.equal(C.draw(C.CHESTS[0],allLegendary,0,()=>0),null,
 'a chest without remaining available tiers is blocked');
assert.equal(C.draw(C.CHESTS[2],allLegendary,0,()=>0).rarity,'legendary');
for(const c of C.CHESTS){
 const g=C.weightMap(c,available,C.PITY_LIMIT-1);
 assert.equal(g.guaranteed,true);
 assert.equal(g.weights.common+g.weights.uncommon+g.weights.rare,0);
 const prize=C.draw(c,available,C.PITY_LIMIT-1,()=>0);
 assert.ok(['epic','legendary'].includes(prize.rarity),'12th opening guarantees high rarity');
 assert.equal(prize.guaranteed,true);
 assert.equal(prize.nextPity,0);
}
assert.equal(C.weightMap(C.CHESTS[0],allLegendary,11).guaranteed,false);
const historic=C.normalize({owned:['taiga-spirit','taiga-spirit','invalid'],opened:3,pity:100,
 last:{mascotId:'taiga-spirit',chestId:'aurora',guaranteed:true}},M.mascots);
assert.deepEqual(historic.owned,['taiga-spirit']);
assert.equal(historic.opened,3);
assert.equal(historic.pity,11);
assert.equal(historic.last.guaranteed,true);
assert.notEqual(C.KEY,C.TESTER_KEY,'tester rewards do not leak into normal collection');
console.log('MASCOT_CHESTS_OK three prices/odds, no duplicates, achievement sync, pity, isolated storage and persisted drop');
