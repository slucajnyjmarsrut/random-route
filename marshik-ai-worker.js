/* Local Qwen inference. No API token or user-message network request is used.
 * Model weights are loaded only after an explicit user action.
 */
const MODEL='onnx-community/Qwen2.5-0.5B-Instruct';
const LIBRARY='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let generator=null,loading=null;
const system='Ты Маршик, дружелюбный помощник сайта «Случайный маршрут» для прогулок по Якутску. Отвечай по-русски кратко, максимум 3-4 предложения. Помогай понять экраны приложения и выбирать интересные места. Не выдумывай реальные дороги, работающие фонари, погоду, GPS-координаты, готовность маршрута или успешную проверку фото. Маршрут рассчитывается отдельным алгоритмом Дейкстры; GPS и фото подтверждаются только сайтом. При проблемах с дорогами OSM предложи повторную попытку или явно демонстрационный маршрут, не утверждай, что улицы безопасны. Не обещай выполнить действие на сайте.';
function answerText(output) {
 const text=output?.[0]?.generated_text;
 const response=Array.isArray(text)?text.filter(x=>x?.role==='assistant').at(-1)?.content:
   (typeof text==='string'?text:'');
 return String(response||'').trim().slice(0,1200);
}
async function initialize(){
 if(generator)return;
 if(loading)return loading;
 loading=(async()=>{
  const {pipeline}=await import(LIBRARY);
  generator=await pipeline('text-generation',MODEL,{
    dtype:'q4',device:'webgpu',progress_callback:p=>{
     if(p?.status==='progress'&&Number.isFinite(p.progress)){
      self.postMessage({type:'progress',percent:Math.max(0,Math.min(100,Math.round(p.progress)))});
     }
    }
  });
 })();
 try{await loading;}finally{loading=null}
}
let asking=false;
self.onmessage=async({data})=>{
 if(data?.type==='start'){
  try{await initialize();self.postMessage({type:'ready'});}
  catch(err){self.postMessage({type:'error',message:'Не удалось загрузить Qwen или запустить WebGPU. Попробуй обновить браузер или другой компьютер.'});}
 }else if(data?.type==='ask'){
  if(!generator||asking)return;
  asking=true;
  try{
   const context=String(data.context||'').slice(0,220);
   const history=(Array.isArray(data.history)?data.history:[]).slice(-8)
     .filter(x=>['user','assistant'].includes(x?.role))
     .map(x=>({role:x.role,content:String(x.content||'').slice(0,500)}));
   const messages=[
    {role:'system',content:system+' Текущий экран и состояние (не факт безопасности): '+context},
    ...history
   ];
   const response=await generator(messages,{max_new_tokens:140,do_sample:false});
   self.postMessage({type:'answer',text:answerText(response)||'Не удалось сформировать ответ. Попробуй задать вопрос короче.'});
  }catch(err){self.postMessage({type:'ask-error',message:'Не удалось получить ответ от локального ИИ. Попробуй ещё раз.'});}
  finally{asking=false;}
 }
};