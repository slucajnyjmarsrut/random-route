'use strict';
const assert=require('node:assert/strict');
const {parseRequest,placeScore}=require('../smart-route-chat.js');
function check(prompt,expected,awaiting=false){
 const got=parseRequest(prompt,awaiting);
 for(const [key,val] of Object.entries(expected)){
   const actual=key==='errors'?got.errors.length:got[key];
   assert.deepEqual(actual,val,JSON.stringify({prompt,key,got}));
 }
}
check('Построй кольцо 3 км через парки, без дворов',{distanceKm:3,type:'parks',wantsNoYards:true,wantsRoute:true,poiWish:'parks'});
check('Хочу погулять 40 минут',{distanceKm:2.9,estimatedMinutes:40});
check('Пройди 500 метров',{errors:1,distanceKm:null});
check('Хочу 1,5 км, без кафе',{distanceKm:1.5,coffee:false});
check('Обойти улицу Лермонтова',{wantsExcludedPlace:true});
check('Построй по освещённым улицам',{wantsLight:true,wantsRoute:true});
check('Музей и памятник',{poiWish:'culture',type:'city'});
check('Пойди в парк',{type:'parks'});
check('Не хочу в парк',{type:null});
check('Хочу на час',{distanceKm:4.3,estimatedMinutes:60});
check('Построй 3',{distanceKm:null,wantsRoute:true});
check('3',{distanceKm:3},true);
check('Пройди 60 км',{errors:1,distanceKm:null});
check('На полчаса',{distanceKm:2.2,estimatedMinutes:30});
check('Кофейня по пути',{coffee:true,poiWish:'coffee'});
assert.equal(placeScore({tags:{name:'Центральный парк культуры'}},{type:'parks',coffee:false,poiWish:'parks'}),1);
assert.equal(placeScore({tags:{name:'Кафе на улице Ленина'}},{type:'city',coffee:true,poiWish:'coffee'}),1);
assert.equal(placeScore({tags:{name:'Центральный парк культуры'}},{type:'city',coffee:false,poiWish:null}),0);

check('почему полтора часа это 2 км',{intent:'question',distanceKm:null,mentionedDistanceKm:2,estimatedMinutes:90,wantsRoute:false});
check('нет я не хочу 2км',{intent:'reject',distanceKm:null,rejectedDistanceKm:2,wantsRoute:false});
check('нет, я не хочу 2 км',{intent:'reject',distanceKm:null,wantsRoute:false});
check('хочу гулять полтора часа',{intent:'build',distanceKm:6.5,estimatedMinutes:90,wantsRoute:true});
check('Перестрой на 1,5 часа',{intent:'build',distanceKm:6.5,estimatedMinutes:90,wantsRoute:true});
check('почему 90 минут — это 2 км?',{intent:'question',distanceKm:null,estimatedMinutes:90,mentionedDistanceKm:2});
check('нет, не хочу 2 км, а 6 км',{intent:'settings',distanceKm:6,isCorrection:true,wantsRoute:false});
check('нет, хочу 5 км',{intent:'settings',distanceKm:5,isCorrection:true,wantsRoute:false});
check('сколько займёт 5 км?',{intent:'question',distanceKm:null,mentionedDistanceKm:5});
check('Построй на 1 час 30 минут',{intent:'build',distanceKm:6.5,estimatedMinutes:90});
check('Не надо 5 км',{intent:'reject',distanceKm:null,wantsRoute:false});
check('полтора часа',{intent:'settings',distanceKm:6.5,estimatedMinutes:90});
check('Хочу 2 км',{intent:'build',distanceKm:2,wantsRoute:true});
check('на 45 минут',{intent:'settings',distanceKm:3.2,estimatedMinutes:45});
check('Построй по освещённым улицам',{intent:'build',wantsLight:true,wantsRoute:true});
console.log('Smart Route Chat: 33 checks passed');
