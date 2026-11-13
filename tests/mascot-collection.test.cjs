'use strict';
const assert=require('node:assert/strict');
const M=require('../mascot-collection.js');
const now=new Date(2026,10,13,12).getTime(),day=86400000;
const event=(type,id,daysAgo=0,eligible=true)=>({
 key:type+':'+id,type,at:now-daysAgo*day,
 data:{dailyEligible:eligible,routeDistanceM:3000}
});
const routes=n=>Array.from({length:n},(_,i)=>event('route_completed','walk-'+i,Math.min(i,60)));
assert.equal(M.mascots.length,20);
assert.equal(new Set(M.mascots.map(x=>x.id)).size,20);
assert.deepEqual(Object.values(M.rarities).map(x=>x.name),
 ['Обычные','Необычные','Редкие','Эпические','Легендарные']);
const starter=M.mascots.find(x=>x.starter);
assert.equal(starter.id,'traveller-puppy');
const hamster=M.mascots.find(x=>x.id==='tourist-hamster');
assert.equal(hamster.requires.routes,10);
const nine=M.statsOf(routes(9)),ten=M.statsOf(routes(10));
assert.equal(M.unlocked(hamster,nine),false);
assert.equal(M.unlocked(hamster,ten),true);
assert.equal(M.progressOf(hamster,nine),0.9);
assert.match(M.requirement(hamster,nine),/9\/10 прогулок/);
const noise=[event('route_completed','demo',0,false),event('photo_verified','demo-photo',0,false),
 event('quest_correct','test-quest',0,false)];
assert.deepEqual(M.statsOf(noise),{routes:0,photos:0,quests:0,streak:0,km:0});
const valid=[
 event('route_completed','a',3),event('route_completed','b',2),
 event('route_completed','c',1),event('route_completed','d',0),
 event('photo_verified','p'),event('quest_correct','q')
];
const st=M.statsOf(valid);
assert.equal(st.routes,4);
assert.equal(st.photos,1);
assert.equal(st.quests,1);
assert.equal(st.streak,4);
const progress=M.applyEvents({},valid);
assert.equal(progress.selected,starter.id);
assert.equal(progress.xp[starter.id],500);
assert.equal(M.levelFor(progress.xp[starter.id]),2);
assert.equal(M.applyEvents(progress,valid).xp[starter.id],500,'refresh never duplicates XP');
const duplicated=[...valid,valid[0],event('quest_correct','q')];
assert.equal(M.statsOf(duplicated).routes,4);
assert.equal(M.eventExperience(duplicated).length,6);
assert.equal(M.select(progress,hamster.id,st).selected,starter.id,'locked mascot cannot equip');
const unlockedProgress=M.applyEvents({},routes(10));
const equip=M.select(unlockedProgress,hamster.id,ten);
assert.equal(equip.selected,hamster.id);
const next=M.applyEvents(equip,[...routes(10),event('route_completed','eleven',0)]);
assert.equal(next.xp[hamster.id],100);
assert.equal(next.xp[starter.id],unlockedProgress.xp[starter.id]);
const seven=Array.from({length:7},(_,i)=>event('route_completed','week-'+i,6-i));
assert.equal(M.statsOf(seven).streak,7);
assert.equal(M.eventExperience(seven).reduce((sum,x)=>sum+x.xp,0),900,'7th consecutive day grants 200XP');
const seals=M.mascots.find(m=>m.id==='traveller-seal');
assert.equal(M.unlocked(seals,M.statsOf(seven)),true);
assert.equal(M.unlocked(M.mascots.find(m=>m.id==='taiga-spirit'),ten),false);
assert.equal(M.levelStage(1),'Путник');
assert.equal(M.levelStage(4),'Исследователь');
assert.equal(M.levelStage(7),'Звезда');
console.log('MASCOTS_CORE_OK 20 characters, rarity, 10 walks, XP, streak bonuses, demo exclusion and selection');
