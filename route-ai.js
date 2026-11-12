/* On-device adaptive ranking of randomly generated tourist stops.
 * No chat, external AI API, location collection, or fabricated road geometry.
 * This is a small online-learning preference model, NOT a language model.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RRRouteAI=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const KEY='rr_route_preference_model_v1';
  const THEMES=['parks','city','nature'];
  const DEFAULT_WEIGHTS=[.64,.22,.12];
  let state=null;
  function nameOf(p){return String(p?.tags?.name||p?.guideName||p?.name||'').trim().slice(0,160);}
  function category(name){
    if(/парк|сквер|сад|аллея|набережн|озер|роща|park|garden/i.test(name))return 'parks';
    if(/природ|лес|берег|рек|озер|озёр|ландшафт|nature|forest|river|lake/i.test(name))return 'nature';
    if(/памят|музей|цирк|театр|собор|храм|скульпт|стела|площад|истор|мемориал|арка|арт.?объект|monument|museum|statue/i.test(name))return 'city';
    return 'city';
  }
  function cleanModel(raw){
    const obj=raw&&typeof raw==='object'?raw:{};
    const weights={};
    for(const t of THEMES){
      const w=Array.isArray(obj.weights?.[t])?obj.weights[t]:DEFAULT_WEIGHTS;
      weights[t]=DEFAULT_WEIGHTS.map((def,i)=>{
        const v=Number(w[i]);return Number.isFinite(v)?Math.max(-.25,Math.min(1.25,v)):def;
      });
    }
    const seen=Array.isArray(obj.seen)?obj.seen.filter(x=>typeof x==='string').slice(-80):[];
    const n=Math.max(0,Math.min(10000,Math.floor(Number(obj.completed)||0)));
    return {weights,seen,completed:n};
  }
  function load(storage){
    try{return cleanModel(JSON.parse(storage?.getItem(KEY)||'null'));}
    catch(e){return cleanModel(null);}
  }
  function persist(model,storage){
    try{storage?.setItem(KEY,JSON.stringify(model));}catch(e){}
  }
  function memory(){
    if(!state)state=load(typeof localStorage!=='undefined'?localStorage:null);
    return state;
  }
  function features(points,theme='city',model=memory()){
    const list=Array.isArray(points)?points:[];
    if(!list.length)return [0,0,0];
    const names=list.map(nameOf);
    const desired=THEMES.includes(theme)?theme:'city';
    const affinity=names.reduce((sum,n)=>sum+(category(n)===desired?1:0),0)/names.length;
    const previous=new Set(model.seen.map(n=>n.toLowerCase()));
    const novelty=names.reduce((sum,n)=>sum+(previous.has(n.toLowerCase())?0:1),0)/names.length;
    const distinct=new Set(names.map(n=>category(n))).size;
    return [affinity,novelty,Math.min(1,distinct/3)];
  }
  function score(points,theme='city',model=memory()){
    const m=cleanModel(model),t=THEMES.includes(theme)?theme:'city';
    const f=features(points,t,m),w=m.weights[t];
    // bounded heuristic bonus (metre equivalents) to keep walking distance dominant
    const predicted=Math.max(0,Math.min(1.5,f.reduce((acc,v,i)=>acc+v*w[i],0)));
    return Math.round(predicted*180);
  }
  function learnCompleted(points,theme='city',storage){
    const userStorage=storage===undefined?(typeof localStorage!=='undefined'?localStorage:null):storage;
    const m=memory(),t=THEMES.includes(theme)?theme:'city';
    const names=(Array.isArray(points)?points:[]).map(nameOf).filter(Boolean);
    if(!names.length)return m;
    const f=features(points,t,m),w=m.weights[t];
    const prediction=f.reduce((sum,v,i)=>sum+w[i]*v,0);
    // Online stochastic gradient descent towards positive feedback on a verified walk.
    // Repetition is handled separately by seen-point novelty.
    const error=1-Math.max(-1,Math.min(2,prediction));
    for(let i=0;i<w.length;i++)w[i]=Math.max(-.25,Math.min(1.25,w[i]+.07*error*f[i]));
    m.completed+=1;
    m.seen=[...new Set([...m.seen,...names.map(n=>n.toLowerCase())])].slice(-80);
    state=m;persist(m,userStorage);
    return m;
  }
  function resetForTests(){state=null;}
  return {KEY,THEMES,nameOf,category,features,score,learnCompleted,load,resetForTests};
});
