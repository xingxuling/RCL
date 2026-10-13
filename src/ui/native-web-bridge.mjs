import http from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {lowerNativeUiToWeb,emitNativeUiWebHtml} from './web-ui-backend.mjs';
import {createNativeUiEventRuntime,nativeUiExecutionErrorCode} from './native-event-runtime.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
/** Reuse current UI DOM/layout emission; browser only renders native projections. */
export function emitNativeUiBridgeHtml(ui,token){
  const manifest=lowerNativeUiToWeb(ui),html=emitNativeUiWebHtml(manifest);
  const script=`const token=${JSON.stringify(token)};const events=${JSON.stringify(manifest.eventMappings)};
let snapshot=null,pending=false;window.rclNativeBridge={ready:false,error:null};
function render(s){snapshot=s;for(const[id,properties]of Object.entries(s.rendered)){const el=document.querySelector('[data-rcl-node="'+CSS.escape(id)+'"]');if(!el)throw Error('render node missing');for(const[name,value]of Object.entries(properties)){if(name==='value'&&el instanceof HTMLInputElement)el.value=String(value);else if(name==='value'||name==='label')el.textContent=String(value);}}
document.documentElement.dataset.rclState=JSON.stringify(s.state);document.documentElement.dataset.rclStateRoot=s.stateRoot;window.rclNativeBridge.snapshot=s;}
async function request(url,body){const response=await fetch(url,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-rcl-ui-token':token},body:body?JSON.stringify(body):undefined});const result=await response.json();if(!response.ok)throw Error(result.code||'request failed');return result;}
for(const e of events){const el=document.querySelector('[data-rcl-node="'+CSS.escape(e.nodeId)+'"]');el.addEventListener(e.targetEvent,async()=>{if(pending)return;pending=true;window.rclNativeBridge.pending=true;try{const payload=e.canonicalEvent==='input'||e.canonicalEvent==='change'?{value:el.value}:{};const result=await request('/api/event',{event:{nodeId:e.nodeId,type:e.canonicalEvent,payload},expectedStateRoot:snapshot.stateRoot});render(result.snapshot);window.rclNativeBridge.lastReceipt=result.receipt;window.rclNativeBridge.error=null;}catch(error){window.rclNativeBridge.error=error.message;console.error(error);}finally{pending=false;window.rclNativeBridge.pending=false;}});}
request('/api/state').then(s=>{render(s);window.rclNativeBridge.ready=true;}).catch(error=>{window.rclNativeBridge.error=error.message;console.error(error);});`;
  const scripts=[...html.matchAll(/<script>[\s\S]*?<\/script>/gu)];if(scripts.length!==1)throw new Error('RCL_UI_NATIVE_RENDERER_SCRIPT_COUNT');
  return html.replace(scripts[0][0],'<script>'+script.replaceAll('</script','<\\/script')+'</script>');
}
export async function createNativeUiWebBridge(source,options={}){
  const runtime=await createNativeUiEventRuntime(source,options),token=randomUUID(),requests=[];
  const html=emitNativeUiBridgeHtml(runtime.ui,token),server=http.createServer(async(req,res)=>{
    function reply(status,payload){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(payload));requests.push({method:req.method,path:req.url,status,code:payload.code??null});}
    if(req.method==='GET'&&req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;}
    if(req.url!=='/api/state'&&req.url!=='/api/event'){reply(404,{code:'NOT_FOUND'});return;}
    if(req.headers['x-rcl-ui-token']!==token){reply(403,{code:'UI_TRANSPORT_UNAUTHORIZED'});return;}
    if(req.method==='GET'&&req.url==='/api/state'){reply(200,runtime.snapshot());return;}
    if(req.method!=='POST'||req.url!=='/api/event'){reply(405,{code:'METHOD_NOT_ALLOWED'});return;}
    let bytes='';for await(const chunk of req){bytes+=chunk;if(bytes.length>65536){reply(413,{code:'UI_REQUEST_LIMIT'});return;}}
    let body;try{body=JSON.parse(bytes);}catch{reply(400,{code:'UI_REQUEST_JSON'});return;}
    try{const receipt=await runtime.dispatch(body.event,{expectedStateRoot:body.expectedStateRoot,authorized:body.authorized??true});reply(200,{snapshot:runtime.snapshot(),receipt});}
    catch(error){const code=nativeUiExecutionErrorCode(error)??'UI_EXECUTION_FAILED';reply(code==='RCL_UI_NATIVE_STALE_STATE'||code==='RCL_UI_NATIVE_BACKPRESSURE'?409:400,{code});}
  });
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}
  catch(error){await runtime.dispose();throw error;}
  const url='http://127.0.0.1:'+server.address().port;
  return{url,token,runtime,html,htmlHash:sha(html),transport:'ACTUAL_HTTP_LOOPBACK',requests:()=>structuredClone(requests),
    async dispose(){await new Promise(resolve=>server.close(resolve));await runtime.dispose();}};
}
