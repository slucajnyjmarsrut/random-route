/* Visual navigation assistance based on existing walking route geometry.
 * Not voice navigation, turn restrictions, or a replacement for on-site judgement.
 * Pure functions are testable without location, browser or map access.
 */
(function(root,factory){
  "use strict";const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.RRRouteNavigation=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
function metres(a,b){
  const r=Math.PI/180,dy=(b[0]-a[0])*111195,dx=(b[1]-a[1])*111195*Math.cos(((a[0]+b[0])/2)*r);
  return Math.hypot(dx,dy);
}
function polylineLength(points){
  if(!Array.isArray(points))return 0;
  let sum=0;for(let i=1;i<points.length;i++)sum+=metres(points[i-1],points[i]);return sum;
}
function bearing(a,b){
  const r=Math.PI/180;
  const y=Math.sin((b[1]-a[1])*r)*Math.cos(b[0]*r),x=Math.cos(a[0]*r)*Math.sin(b[0]*r)-Math.sin(a[0]*r)*Math.cos(b[0]*r)*Math.cos((b[1]-a[1])*r);
  return (Math.atan2(y,x)/r+360)%360;
}
function angleChange(a,b){return ((b-a+540)%360)-180;}
// Smooth the line by examining a roughly 20-metre region on either side of a bend.
// This prevents tiny OSM geometry vertices from becoming spurious turn instructions.
function sampleBefore(points,i,need=22){
  let remaining=need;
  for(let j=i-1;j>=0;j--){const d=metres(points[j],points[j+1]);if(d>=remaining)return points[j];remaining-=d;}
  return points[0];
}
function sampleAfter(points,i,need=22){
  let remaining=need;
  for(let j=i;j<points.length-1;j++){const d=metres(points[j],points[j+1]);if(d>=remaining)return points[j+1];remaining-=d;}
  return points.at(-1);
}
function nextBend(points){
  if(!Array.isArray(points)||points.length<3)return null;
  let reached=0;
  for(let i=1;i<points.length-1;i++){
    reached+=metres(points[i-1],points[i]);
    const before=sampleBefore(points,i),after=sampleAfter(points,i);
    if(metres(before,points[i])<12||metres(points[i],after)<12)continue;
    const delta=angleChange(bearing(before,points[i]),bearing(points[i],after));
    if(Math.abs(delta)>=55&&Math.abs(delta)<=175){
      return {distance:reached,direction:delta>0?"right":"left",angle:Math.round(delta)};
    }
  }
  return null;
}
function formatDistance(m){
  if(!Number.isFinite(m)||m<0)return "—";
  return m>=1000?(m/1000).toLocaleString("ru-RU",{maximumFractionDigits:1})+" км":Math.max(0,Math.round(m/10)*10)+" м";
}
function minutes(m,speed=4.3){
  if(!Number.isFinite(m)||m<0||!Number.isFinite(speed)||speed<=0)return null;
  return Math.max(1,Math.ceil(m/(speed*1000/60)));
}
function guidance(remainingPts,laterLegMetres=0){
  const segment=polylineLength(remainingPts),total=segment+Math.max(0,laterLegMetres||0);
  const turn=nextBend(remainingPts);
  let symbol="↑",instruction="Идите по линии на карте";
  if(turn){
    symbol=turn.direction==="right"?"↱":"↰";
    instruction=turn.distance<25?(turn.direction==="right"?"Скоро поворот направо":"Скоро поворот налево")
      :"Через "+formatDistance(turn.distance)+(turn.direction==="right"?" — направо":" — налево");
  }else if(segment<=35){symbol="◎";instruction="Вы почти у следующей точки";}
  return {symbol,instruction,segmentMetres:segment,totalMetres:total,segmentLabel:formatDistance(segment),totalLabel:formatDistance(total),etaMinutes:minutes(total),turn};
}
return {metres,polylineLength,bearing,angleChange,nextBend,formatDistance,minutes,guidance};
});
