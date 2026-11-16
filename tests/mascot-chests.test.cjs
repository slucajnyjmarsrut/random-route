'use strict';
const assert=require('node:assert/strict'),M=require('../mascot-collection.js'),C=require('../mascot-chests.js');
assert.equal(M.mascots.length,145);
assert.equal(C.CHESTS.length,3);
assert.deepEqual(C.CHESTS.map(c=>c.price),[80,240,600]);
assert.deepEqual(C.CHESTS.map(c=>c.weights),[
 {common:70,uncommon:22,rare:7,epic:1,legendary:0},
 {common:60,uncommon:22,rare:13,epic:4,legendary:1},
 {common:55,uncommon:20,rare:14,epic:8,legendary:3}
]);
assert.equal('PITY_LIMIT' in C,false);
const pool=C.availableMascots(M.mascots,M.statsOf([]),['traveller-puppy'],M.unlocked);
assert.equal(pool.length,145,'all mascots remain available: duplicates are intended');
for(const c of C.CHESTS){
 const w=C.weightMap(c,pool).weights;
 assert.ok(w.common>w.uncommon+w.rare+w.epic+w.legendary);
 assert.ok(Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-100)<1e-7);
 assert.equal(C.draw(c,pool,()=>0).rarity,'common');
}
const starter=M.mascots.find(m=>m.starter);
assert.equal(C.draw(C.CHESTS[0],[starter],()=>0.1).mascot.id,starter.id);
const previous=C.normalize({owned:['taiga-spirit','taiga-spirit','invalid'],opened:55,pity:100,
 last:{mascotId:'taiga-spirit',chestId:'aurora',guaranteed:true}},M.mascots);
assert.deepEqual(previous.owned,['taiga-spirit']);
assert.equal(previous.copies['taiga-spirit'],1,'legacy chest creates one inventory copy');
assert.equal(previous.opened,55);
assert.equal(previous.capacity,50);
assert.equal('pity' in previous,false);
assert.equal('guaranteed' in previous.last,false);
assert.notEqual(C.KEY,C.TESTER_KEY);
assert.notEqual(C.LEGACY_KEY,C.LEGACY_TESTER_KEY);
console.log('MASCOT_CHESTS_OK: 145-drop pool, duplicates, fixed rarity odds, migration, separate tester storage');
