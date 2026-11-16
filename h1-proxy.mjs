/* Optional H1 model proxy for Node.js >=20.
 * Run behind an authenticated HTTPS reverse proxy before public deployment.
 * API keys NEVER belong in GitHub Pages / browser JavaScript.
 */
import http from 'node:http';

const MODEL=process.env.OPENROUTER_MODEL||'';
const KEY=process.env.OPENROUTER_API_KEY||'';
const HOST=process.env.H1_HOST||'127.0.0.1';
const PORT=Number(process.env.PORT||8787);
const ORIGIN=process.env.H1_ALLOWED_ORIGIN||'http://localhost:8080';
const MAX_BYTES=100000,MAX_PER_HOUR=60;
const limits=new Map();
const NAMES=new Set(['search_pois','get_graph_distances','build_candidate','evaluate_candidate','submit_waypoints']);

function reply(res,status,body,origin=''){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    ...(origin===ORIGIN?{'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin'}:{})});
  res.end(JSON.stringify(body));
}
function rateOk(ip){
  const now=Date.now(),old=limits.get(ip),item=old&&now-old.start<3600000?old:{start:now,count:0};
  item.count++;limits.set(ip,item);
  if(limits.size>3000)for(const [key,val] of limits)if(now-val.start>=3600000)limits.delete(key);
  return item.count<=MAX_PER_HOUR;
}
function safePayload(body){
  if(!body||!Array.isArray(body.messages)||body.messages.length<2||body.messages.length>33||
    !Array.isArray(body.tools)||body.tools.length!==NAMES.size) return false;
  if(body.tools.some(t=>t?.type!=='function'||!NAMES.has(t?.function?.name)))return false;
  if(new Set(body.tools.map(t=>t.function.name)).size!==NAMES.size)return false;
  for(const msg of body.messages){
    if(!['system','user','assistant','tool'].includes(msg?.role))return false;
    if(typeof msg.content==='string'&&msg.content.length>20000)return false;
    if(msg.tool_calls&&(!Array.isArray(msg.tool_calls)||msg.tool_calls.length>12))return false;
  }
  return true;
}
function handle(req,res){
  const origin=req.headers.origin||'';
  if(req.method==='OPTIONS'){
    if(origin!==ORIGIN){reply(res,403,{error:'OriginForbidden'});return;}
    res.writeHead(204,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return;
  }
  if(req.url!=='/v1/h1/chat'||req.method!=='POST'){reply(res,404,{error:'NotFound'});return;}
  if(origin!==ORIGIN){reply(res,403,{error:'OriginForbidden'});return;}
  if(!KEY||!MODEL){reply(res,503,{error:'H1ModelNotConfigured'},origin);return;}
  if(!rateOk(req.socket.remoteAddress||'')){reply(res,429,{error:'RateLimit'},origin);return;}
  let size=0,body='';
  req.on('data',chunk=>{
    size+=chunk.length;
    if(size>MAX_BYTES){req.destroy();return;}
    body+=chunk;
  });
  req.on('end',async()=>{
    if(size>MAX_BYTES){reply(res,413,{error:'PayloadTooLarge'},origin);return;}
    let data;try{data=JSON.parse(body)}catch(e){reply(res,400,{error:'InvalidJSON'},origin);return;}
    if(!safePayload(data)){reply(res,400,{error:'InvalidH1Conversation'},origin);return;}
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY,
          'HTTP-Referer':ORIGIN,'X-Title':'Random Route H1'},
        body:JSON.stringify({model:MODEL,messages:data.messages,tools:data.tools,tool_choice:'auto',
          temperature:.15,max_tokens:1100}),signal:controller.signal
      });
      if(!response.ok){reply(res,502,{error:'ModelProviderError',status:response.status},origin);return;}
      const parsed=await response.json(),message=parsed?.choices?.[0]?.message;
      if(!message||message.role!=='assistant'){reply(res,502,{error:'InvalidModelResponse'},origin);return;}
      reply(res,200,{message},origin);
    }catch(e){reply(res,504,{error:'ModelUnavailable'},origin);}
    finally{clearTimeout(timer);}
  });
}
http.createServer(handle).listen(PORT,HOST,()=>{
  process.stdout.write('H1 proxy listening on '+HOST+':'+PORT+'\n');
});