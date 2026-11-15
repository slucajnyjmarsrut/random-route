/* Compact first-run Qwen chat. AI stays opt-in, on-device; GPS/routes/photos untouched. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s);
 const dialog=$('#rrAiDialog'),intro=$('#rrAiIntro'),launchBox=$('#rrAiLaunch'),
       start=$('#rrAiStart'),stop=$('#rrAiStop'),textarea=$('#rrAiQuestion'),
       send=$('#rrAiSend'),form=$('#rrAiForm'),log=$('#rrAiLog'),status=$('#rrAiStatus');
 if(!dialog||!intro||!launchBox||!start||!stop||!textarea||!send||!form||!log||!status)return;
 let worker=null,ready=false,busy=false,loading=false,lastFocus=null;
 let messages=[];
 const setStatus=message=>{
  status.textContent=message||'';
  status.hidden=!message;
 };
 function syncUi(){
  const idle=!ready&&!loading;
  intro.hidden=!idle;
  launchBox.hidden=!idle;
  log.hidden=!ready;
  form.hidden=!ready;
  stop.classList.toggle('hidden',idle);
  start.disabled=!idle;
  textarea.disabled=!ready||busy;
  send.disabled=!ready||busy;
 }
 function emptyChat(){
  log.replaceChildren();
  const item=document.createElement('p');
  item.className='rr-ai-empty';
  item.id='rrAiEmpty';
  item.textContent='🐾 С чего начнём?';
  log.append(item);
 }
 function bubble(role,message){
  $('#rrAiEmpty')?.remove();
  const item=document.createElement('p');
  item.className='rr-ai-bubble '+role;
  item.textContent=String(message||'').slice(0,1400);
  log.append(item);log.scrollTop=log.scrollHeight;
 }
 function open(){
  if(!dialog.classList.contains('hidden'))return;
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
  worker?.terminate();worker=null;
  ready=false;busy=false;loading=false;messages=[];
  emptyChat();
  syncUi();setStatus('');
 }
 function context(){
  const screen=$('.app')?.dataset.rrScreen||'home';
  const step=$('#rrMarshikGuide')?.dataset.rrGuideStep||'';
  const d=Number($('#distanceInput')?.value);
  const distance=Number.isFinite(d)&&d>=1&&d<=20?String(d):'не выбрана';
  const theme=$('#typeChoices .choice.active')?.textContent?.trim().slice(0,35)||'не выбраны';
  const route=window.__yakutskRR;
  const made=!!(route?.legs?.length);
  // Never include precise GPS, name, account details or photographs in prompt.
  return 'Экран: '+screen+'; шаг: '+step+'; расстояние: '+distance+
   ' км; интересы: '+theme+'; построенный маршрут: '+(made?'есть':'нет')+'.';
 }
 async function launch(){
  if(worker||loading||ready)return;
  loading=true;syncUi();setStatus('Проверяю возможность запуска…');
  try{
   if(!navigator.gpu||typeof navigator.gpu.requestAdapter!=='function'||
      !(await navigator.gpu.requestAdapter()))throw Error('WebGPU unavailable');
   worker=new Worker('marshik-ai-worker.js?v=1.0',{type:'module'});
   worker.onmessage=({data})=>{
    if(data?.type==='progress'){
     if(loading)setStatus('Загружаю Qwen: '+data.percent+'%');
    }else if(data?.type==='ready'){
     loading=false;ready=true;
     syncUi();setStatus('');textarea.focus();
    }else if(data?.type==='error'){
     halt();
     setStatus(data.message||'Не удалось включить ИИ. Попробуй ещё раз.');
    }else if(data?.type==='answer'||data?.type==='ask-error'){
     busy=false;
     const answer=data.type==='answer'?data.text:data.message;
     bubble('assistant',answer);
     if(data.type==='answer')messages.push({role:'assistant',content:answer});
     syncUi();textarea.focus();
     setStatus(data.type==='answer'?'':'Не удалось ответить. Попробуй ещё раз.');
    }
   };
   worker.onerror=()=>{
    halt();setStatus('Не удалось загрузить Qwen. Проверь интернет и поддержку WebGPU.');
   };
   setStatus('Загружаю Qwen…');
   worker.postMessage({type:'start'});
  }catch(_){
   loading=false;
   syncUi();
   setStatus('На этом устройстве WebGPU недоступен. Обычные подсказки Маршика работают.');
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
  busy=true;syncUi();setStatus('Маршик отвечает…');
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
  if(event.key==='Escape'&&!dialog.classList.contains('hidden')){
   event.preventDefault();close();
  }
 });
 syncUi();
 window.RRMarshikAI=Object.freeze({open,close,getStatus:()=>({ready,busy,loading})});
})();