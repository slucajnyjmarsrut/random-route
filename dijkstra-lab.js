/* Research laboratory: real Dijkstra implementation on a documented illustrative graph.
 * Isolated from production Valhalla routing and GPS / rewards.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root&&root.document){
    root.RRDijkstraLab=api;
    if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document);},{once:true});
    else api.mount(root.document);
  }
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const nodes=[
    {id:"A",x:70,y:175},{id:"B",x:246,y:72},
    {id:"C",x:246,y:270},{id:"D",x:435,y:96},{id:"E",x:575,y:218}
  ];
  // Undirected graph from the research example; weights are illustrative metres, not OSM distances.
  const edges=[
    {a:"A",b:"B",weight:400},{a:"A",b:"C",weight:200},
    {a:"C",b:"B",weight:100},{a:"B",b:"D",weight:500},
    {a:"C",b:"D",weight:800},{a:"D",b:"E",weight:300},
    {a:"C",b:"E",weight:1000}
  ];
  const edgeKey=(a,b)=>[a,b].sort().join("-");
  function dijkstra(vertexList,edgeList,start,end){
    const ids=vertexList.map(n=>typeof n==="string"?n:n.id);
    if(new Set(ids).size!==ids.length||!ids.includes(start)||!ids.includes(end))throw Error("Неизвестная вершина");
    const links=Object.fromEntries(ids.map(id=>[id,[]]));
    for(const {a,b,weight} of edgeList){
      if(!links[a]||!links[b]||!Number.isFinite(weight)||weight<0)throw Error("Некорректное ребро");
      links[a].push({to:b,weight});links[b].push({to:a,weight});
    }
    const distance=Object.fromEntries(ids.map(id=>[id,Infinity]));
    const previous=Object.fromEntries(ids.map(id=>[id,null]));
    const visited=new Set();
    const trace=[];
    distance[start]=0;
    function snapshot(current,updates){
      trace.push({current,visited:[...visited],distance:{...distance},previous:{...previous},updates:[...updates]});
    }
    snapshot(null,[]);
    while(visited.size<ids.length){
      const candidates=ids.filter(id=>!visited.has(id)&&Number.isFinite(distance[id]));
      if(!candidates.length)break;
      candidates.sort((a,b)=>distance[a]-distance[b]||a.localeCompare(b));
      const current=candidates[0];
      visited.add(current);
      const updates=[];
      if(current!==end){
        for(const {to,weight} of links[current]){
          if(visited.has(to))continue;
          const attempt=distance[current]+weight;
          if(attempt<distance[to]){
            distance[to]=attempt;previous[to]=current;updates.push(to);
          }
        }
      }
      snapshot(current,updates);
      if(current===end)break;
    }
    const path=[];
    if(Number.isFinite(distance[end])){
      let at=end;
      while(at!==null){path.unshift(at);if(at===start)break;at=previous[at];}
      if(path[0]!==start)path.length=0;
    }
    return {start,end,path,length:path.length?distance[end]:Infinity,trace,distances:distance,previous};
  }
  function mount(doc){
    const page=doc.getElementById("laboratory");
    if(!page||page.dataset.labMounted==="1")return;
    page.dataset.labMounted="1";
    const svg=doc.getElementById("labGraph");
    const startSelect=doc.getElementById("labStart"),endSelect=doc.getElementById("labEnd");
    const prevButton=doc.getElementById("labPrevious"),nextButton=doc.getElementById("labNext");
    const runButton=doc.getElementById("labRun"),resetButton=doc.getElementById("labReset");
    const status=doc.getElementById("labStatus"),resultBox=doc.getElementById("labResult");
    const table=doc.getElementById("labDistanceTable");
    if(!svg||!startSelect||!endSelect||!prevButton||!nextButton||!runButton||!resetButton||!status||!resultBox||!table)return;
    let calculation=null,step=0;
    function draw(frame,showRoute){
      const selected=showRoute?new Set(calculation.path.slice(1).map((id,i)=>edgeKey(calculation.path[i],id))):new Set();
      const best=new Set(frame.visited);
      svg.innerHTML=edges.map(({a,b,weight})=>{
        const n1=nodes.find(n=>n.id===a),n2=nodes.find(n=>n.id===b);
        const hi=selected.has(edgeKey(a,b));
        const mx=(n1.x+n2.x)/2,my=(n1.y+n2.y)/2;
        return '<line x1="'+n1.x+'" y1="'+n1.y+'" x2="'+n2.x+'" y2="'+n2.y+'" class="lab-edge'+(hi?' lab-edge-route':'')+'"/>'+
          '<text x="'+mx+'" y="'+(my-7)+'" text-anchor="middle" class="lab-edge-label">'+weight+'</text>';
      }).join("")+nodes.map(n=>{
        const current=frame.current===n.id,done=best.has(n.id),onRoute=showRoute&&calculation.path.includes(n.id);
        const cls=current?' current':onRoute?' route':done?' visited':Number.isFinite(frame.distance[n.id])?' frontier':'';
        return '<g class="lab-vertex'+cls+'"><circle cx="'+n.x+'" cy="'+n.y+'" r="23"/>'+
          '<text x="'+n.x+'" y="'+(n.y+6)+'" text-anchor="middle">'+n.id+'</text></g>';
      }).join("");
    }
    function drawTable(frame){
      table.innerHTML=nodes.map(n=>{
        const value=frame.distance[n.id],pr=frame.previous[n.id];
        return '<div class="lab-distance-item"><strong>'+n.id+'</strong><span>'+(Number.isFinite(value)?value+' м':'∞')+'</span><small>'+(pr?'через '+pr:'—')+'</small></div>';
      }).join("");
    }
    function paint(){
      const frame=calculation.trace[step],finished=step===calculation.trace.length-1;
      draw(frame,finished);drawTable(frame);
      if(step===0){
        status.textContent='Шаг 0: начальная вершина '+calculation.start+' имеет расстояние 0, остальные — ∞.';
      }else{
        status.textContent='Шаг '+step+' из '+(calculation.trace.length-1)+': зафиксирована вершина '+frame.current+
          ' (расстояние '+frame.distance[frame.current]+' м).'+
          (frame.updates.length?' Обновлены оценки: '+frame.updates.join(', ')+'.':' Новых улучшений нет.');
      }
      resultBox.textContent=finished?
        (calculation.path.length?'Кратчайший путь: '+calculation.path.join(' → ')+' · '+calculation.length+' м.':'Путь не найден.') :
        'Нажмите «Следующий шаг» или «Рассчитать сразу».';
      prevButton.disabled=step===0;
      nextButton.disabled=finished;
      runButton.disabled=finished;
      page.dataset.labComplete=finished?"true":"false";
    }
    function reset(){
      calculation=dijkstra(nodes,edges,startSelect.value,endSelect.value);
      step=0;paint();
    }
    startSelect.addEventListener("change",reset);
    endSelect.addEventListener("change",reset);
    resetButton.addEventListener("click",reset);
    prevButton.addEventListener("click",function(){step=Math.max(0,step-1);paint();});
    nextButton.addEventListener("click",function(){step=Math.min(calculation.trace.length-1,step+1);paint();});
    runButton.addEventListener("click",function(){step=calculation.trace.length-1;paint();});
    reset();
  }
  return {nodes,edges,dijkstra,mount};
});
