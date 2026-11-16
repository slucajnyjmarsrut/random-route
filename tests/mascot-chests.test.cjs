'use strict';
const assert=require('node:assert/strict');
const M=require('../mascot-collection.js');
const C=require('../mascot-chests.js');
assert.equal(M.mascots.length,20);
assert.equal(C.CHESTS.length,3);
assert.deepEqual(C.CHESTS.map(c=>c.price),[80,240,600]);
assert.deepEqual(C.CHESTS.map(c=>c.weights),[
 {common:70,uncommon:22,rare:7,epic:1,legendary:0},
 {common:60,uncommon:22,rare:13,epic:4,legendary:1},
 {common:55,uncommon:20,rare:14,epic:8,legendary:3}
]);
assert.equal('PITY_LIMIT' in C,false,'there is no guaranteed-drop counter');
for(const c of C.CHESTS){
 const w=c.weights;
 assert.equal(Object.values(w).reduce((a,b)=>a+b,0),100,'base odds sum to 100');
 assert.ok(w.common>w.uncommon+w.rare+w.epic+w.legendary,'common is more than half of all base odds');
 assert.ok(Object.values(C.weightMap(c,M.mascots).weights).reduce((a,b)=>a+b,0)>99.99);
}
const empty=M.statsOf([]);
const available=C.availableMascots(M.mascots,empty,[],M.unlocked);
assert.equal(available.length,19,'starter mascot is excluded');
assert.ok(!available.some(m=>m.id==='traveller-puppy'));
for(const chest of C.CHESTS){
 const w=C.weightMap(chest,available).weights;
 assert.ok(w.common>w.uncommon+w.rare+w.epic+w.legendary,'common most likely with unsold pool');
 const first=C.draw(chest,available,()=>0);
 assert.equal(first.rarity,'common','the first percentile is common in every chest');
 assert.equal('guaranteed' in first,false);
 assert.equal('nextPity' in first,false);
}
const first=C.draw(C.CHESTS[0],available,()=>0);
assert.notEqual(first.mascot.id,'traveller-puppy');
assert.equal(M.select({},first.mascot.id,empty).selected,'traveller-puppy');
assert.equal(M.select({},first.mascot.id,empty,new Set([first.mascot.id])).selected,first.mascot.id,
 'a chest mascot can be equipped without the achievement requirement');
const after=C.availableMascots(M.mascots,empty,[first.mascot.id],M.unlocked);
assert.equal(after.length,18);
assert.ok(!after.some(m=>m.id===first.mascot.id),'no duplicates');
const allLegendary=M.mascots.filter(m=>m.rarity==='legendary');
const onlyLegendary=C.weightMap(C.CHESTS[1],allLegendary);
assert.equal(onlyLegendary.weights.legendary,100,'when common mascots are exhausted, remaining odds normalize');
assert.equal(C.draw(C.CHESTS[0],allLegendary,()=>0),null,
 'a chest without remaining available tiers is blocked');
assert.equal(C.draw(C.CHESTS[2],allLegendary,()=>0).rarity,'legendary');
const historic=C.normalize({owned:['taiga-spirit','taiga-spirit','invalid'],opened:55,pity:11,
 last:{mascotId:'taiga-spirit',chestId:'aurora',guaranteed:true}},M.mascots);
assert.deepEqual(historic.owned,['taiga-spirit']);
assert.equal(historic.opened,55);
assert.equal('pity' in historic,false,'old pity is discarded');
assert.equal('guaranteed' in historic.last,false,'old guarantee data is discarded');
assert.equal(C.draw(C.CHESTS[2],available,()=>0).rarity,'common',
 'even after many openings the roll still favors common mascots');
assert.notEqual(C.KEY,C.TESTER_KEY,'tester rewards do not leak into normal collection');
console.log('MASCOT_CHESTS_OK common-first odds, no pity, no duplicates, achievement sync, isolated storage and persisted drop');
