/* Local-only Qwen chat for Marshik. The route/photo/GPS workflow remains unchanged. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s);
 const dialog=$('#rrAiDialog'),start=$('#rrAiStart'),stop=$('#rrAiStop'),
       textarea=$('#rrAiQuestion'),send=$('#rrAiSend'),form=$('#rrAiForm'),
       log=$('#rrAiLog'),status=$('#rrAiStatus');
 if(!dialog||!start||!stop||!textarea||!send||!form||!log||!status)return;
 let worker=null,ready=false,busy=false,loading=false,lastFocus=null;
 let messages=[];
 const setStatus=s=>{status.textContent=s};
 const toggleInput=()=>{textarea.disabled=!ready||busy;send.disabled=!ready||busy;start.disabled=loading||ready;};
 function bubble(role,text){
  const item=document.createElement('p');
  item.className='rr-ai-bubble '+role;
  item.textContent=String(text||'').slice(0,1400);
  log.append(item);
  log.scrollTop=log.scrollHeight;
  return item;
 }
 function open(){
  lastFocus=document.activeElement;
  dialog.classList.remove('hidden');
  document.querySelectorAll('.rr-ai-home-open,.rr-ai-guide-open')
    .forEach(x=>x.setAttribute('aria-expanded','true'));
  $('#rrAiClose')?.focus();
 }
 function close(){
  dialog.classList.add('hidden');
  document.querySelectorAll('.rr-ai-home-open,.rr-ai-guide-open')
    .forEach(x=>x.setAttribute('aria-expanded','false'));
  if(lastFocus?.isConnected)lastFocus.focus();
 }
 function halt(){
  worker?.terminate();worker=null;ready=false;busy=false;loading=false;messages=[];
  start.classList.remove('hidden');stop.classList.add('hidden');
  start.textContent='Запустить Qwen · ≈800 МБ';
  setStatus('ИИ выключен. Нажми «Запустить Qwen», чтобы попробовать снова.');
  toggleInput();
 }
 function context(){
  const screen=$('.app')?.dataset.rrScreen||'home';
  const step=$('#rrMarshikGuide')?.dataset.rrGuideStep||'';
  const d=Number($('#distanceInput')?.value);
  const distance=Number.isFinite(d)&&d>=1&&d<=20?String(d):'не выбрана';
  const theme=$('#typeChoices .choice.active')?.textContent?.trim().slice(0,35)||'не выбраны';
  const route=window.__yakutskRR;
  const made=!!(route?.legs?.length);
  // Do not include the person's name, precise location, GPS log, photos, or account data.
  return 'Экран: '+screen+'; шаг: '+step+'; расстояние: '+distance+
    ' км; интересы: '+theme+'; построенный маршрут: '+(made?'есть':'нет')+'.';
 }
 async function launch(){
  if(worker||loading||ready)return;
  loading=true;start.textContent='Проверяю WebGPU…';toggleInput();
  try{
   if(!navigator.gpu||typeof navigator.gpu.requestAdapter!=='function'||
      !(await navigator.gpu.requestAdapter()))
    throw Error('WebGPU unavailable');
   worker=new Worker('marshik-ai-worker.js?v=1.0',{type:'module'});
   worker.onmessage=({data})=>{
    if(data?.type==='progress'){
     if(loading)setStatus('Загружаю модель Qwen: '+data.percent+'% файла. Объём около 800 МБ.');
    }else if(data?.type==='ready'){
     loading=false;ready=true;
     start.classList.add('hidden');stop.classList.remove('hidden');
     setStatus('Qwen готов. Ответы формируются локально на этом устройстве.');
     toggleInput();textarea.focus();
    }else if(data?.type==='error'){
     halt();setStatus(data.message||'Модель не запустилась.');
    }else if(data?.type==='answer'||data?.type==='ask-error'){
     busy=false;
     const answer=data.type==='answer'?data.text:data.message;
     bubble('assistant',answer);
     if(data.type==='answer')messages.push({role:'assistant',content:answer});
     toggleInput();textarea.focus();
     setStatus(data.type==='answer'?'Qwen отвечает локально.':'Ошибка ответа; можно попробовать снова.');
    }
   };
   worker.onerror=()=>{halt();setStatus('Ошибка загрузки Qwen. Проверь интернет или поддержку WebGPU.');};
   setStatus('Загружаю библиотеку и модель Qwen с Hugging Face. Это может потребовать около 800 МБ интернет-трафика.');
   start.textContent='Загружаю Qwen…';
   stop.classList.remove('hidden');
   worker.postMessage({type:'start'});
  }catch(_){
   loading=false;
   start.textContent='Запустить Qwen · ≈800 МБ';
   toggleInput();
   setStatus('WebGPU недоступен в этом браузере или на устройстве. Обычный Маршик с пошаговыми подсказками продолжает работать.');
  }
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if(!ready||busy)return;
  const question=textarea.value.trim().slice(0,500);
  if(!question)return;
  textarea.value='';
  bubble('user',question);messages.push({role:'user',content:question});
  messages=messages.slice(-8);
  busy=true;toggleInput();setStatus('Qwen формирует ответ на твоём устройстве…');
  worker.postMessage({type:'ask',history:messages,context:context()});
 });
 start.addEventListener('click',launch);
 stop.addEventListener('click',halt);
 $('#rrAiClose')?.addEventListener('click',close);
 dialog.querySelector('[data-ai-close]')?.addEventListener('click',close);
 document.addEventListener('click',event=>{
  if(event.target.closest('.rr-ai-home-open,.rr-ai-guide-open'))open();
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!dialog.classList.contains('hidden')){event.preventDefault();close();}
 });
 toggleInput();
 window.RRMarshikAI=Object.freeze({open,close,getStatus:()=>({ready,busy,loading})});
})();