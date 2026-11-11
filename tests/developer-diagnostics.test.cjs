'use strict';
const assert=require('node:assert/strict');
const {classify,summarizeCatalog,makeCheck}=require('../developer-diagnostics.js');
assert.deepEqual(classify(true),{kind:'ok',title:'Работает'});
assert.deepEqual(classify(false),{kind:'error',title:'Ошибка'});
assert.equal(classify(null).kind,'unknown');
assert.equal(makeCheck('GPS',null,'Проверка только на устройстве').kind,'unknown');
assert.equal(makeCheck('Маршрут',false,'Сервис недоступен').kind,'error');
const catalog={city:'Якутск',listed:137,available:130,disabled:7,withCoordinates:115,withReference:110,photoReferences:22};
assert.deepEqual(summarizeCatalog(catalog),[
 ['Город','Якутск'],['Всего в каталоге','137'],['Включены в приложение','130'],
 ['Исключены из каталога','7'],['С координатами в Якутске','115'],
 ['С указанным источником','110'],['С прямой ссылкой на фото','22']
]);
assert.deepEqual(summarizeCatalog({listed:'137',available:130}),[]);
assert.deepEqual(summarizeCatalog(null),[]);
console.log('Developer diagnostics: 8 checks passed');
