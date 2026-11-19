import http from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {lowerNativeUiToWeb,emitNativeUiWebHtml} from './web-ui-backend.mjs';
import {createNativeUiEventRuntime,nativeUiExecutionErrorCode} from './native-event-runtime.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

function startRoutedBridge({ root, navigation, eventMappings }, token) {
  const nodes = new Map();
  function collect(node) {
    nodes.set(node.id, node);
    for (const child of node.children) collect(child);
  }
  collect(root);
  const elements = new Map([...document.querySelectorAll('[data-rcl-node]')].map((element) => [element.dataset.rclNode, element]));
  const routes = new Map(navigation.routes.map(({ target, id }) => [target, id]));
  const prop = (node, name) => node.localProperties.find((item) => item.property === name)?.value;
  const kind = (node) => prop(node, 'input_kind') ?? 'text';
  const textControls = new Set(['text', 'email', 'password', 'textarea']);
  const checkControls = new Set(['checkbox', 'switch']);
  const observer = window.rclNativeBridge = { ready: false, error: null, pending: false };
  let snapshot, activeModal = null, queue = Promise.resolve(), queued = 0;

  function render() {
    const { rendered, navigation, state, stateRoot } = snapshot;
    function visible(node) {
      const binding = rendered[node.id]?.visible ?? prop(node, 'visible');
      return binding !== false && (!routes.has(node.id) || routes.get(node.id) === navigation.currentRoute);
    }
    for (const [id, node] of nodes) {
      const element = elements.get(id);
      const properties = rendered[id] ?? {};
      const input = node.role === 'input';
      const inputKind = kind(node);
      element.hidden = !visible(node);
      if (input || node.role === 'action') {
        const disabled = properties.disabled ?? prop(node, 'disabled') ?? false;
        const readOnly = properties.read_only ?? prop(node, 'read_only') ?? false;
        element.disabled = disabled || (input && !textControls.has(inputKind) && readOnly);
        if (input && textControls.has(inputKind)) element.readOnly = readOnly;
      }
      if (Object.hasOwn(properties, 'value')) {
        const value = properties.value;
        if (!input) element.textContent = String(value);
        else if (checkControls.has(inputKind)) element.checked = value;
        else if (inputKind === 'radio') {
          for (const option of element.querySelectorAll('input[type="radio"]')) option.checked = option.value === value;
        } else if (element.value !== String(value)) element.value = String(value);
      }
      if (Object.hasOwn(properties, 'label')) element.textContent = String(properties.label);
    }
    const modal = visible(root) && root.children.find((child) => prop(child, 'modal') === true && visible(child));
    for (const child of root.children) {
      const element = elements.get(child.id);
      element.inert = Boolean(modal && modal !== child);
      if (element.inert) element.setAttribute('aria-hidden', 'true');
      else element.removeAttribute('aria-hidden');
    }
    const priorModal = activeModal;
    activeModal = modal || null;
    if (activeModal && activeModal !== priorModal) {
      const dialog = elements.get(activeModal.id);
      const focusable = dialog.querySelector('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
      (focusable ?? dialog).focus();
    }
    document.documentElement.dataset.rclState = JSON.stringify(state);
    document.documentElement.dataset.rclStateRoot = stateRoot;
    document.documentElement.dataset.rclRoute = navigation.currentRoute;
  }

  async function request(url, body) {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-rcl-ui-token': token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.code ?? 'request failed'), { status: response.status });
    return result;
  }
  function accept(result) {
    snapshot = result;
    observer.snapshot = result;
  }
  const handlers = new Map();
  for (const mapping of eventMappings) {
    const byNode = handlers.get(mapping.targetEvent) ?? new Map();
    const events = byNode.get(mapping.nodeId) ?? [];
    events.push(mapping.canonicalEvent);
    byNode.set(mapping.nodeId, events);
    handlers.set(mapping.targetEvent, byNode);
  }
  for (const [domEvent, byNode] of handlers) {
    document.addEventListener(domEvent, (dom) => {
      if (!snapshot) return;
      const host = dom.target.closest?.('[data-rcl-node]');
      const nodeId = host?.dataset.rclNode;
      const events = byNode.get(nodeId);
      if (!events) return;
      if (domEvent === 'submit') dom.preventDefault();
      for (const type of events) {
        const payload = {};
        if (['input', 'change'].includes(type)) {
          const inputKind = kind(nodes.get(nodeId));
          if (checkControls.has(inputKind)) payload.value = dom.target.checked;
          else if (inputKind === 'slider') payload.value = dom.target.valueAsNumber;
          else payload.value = dom.target.value;
        }
        queued++;
        observer.pending = true;
        queue = queue.then(async () => {
          try {
            const result = await request('/api/event', {
              event: { nodeId, type, payload }, expectedStateRoot: snapshot.stateRoot, expectedRevision: snapshot.revision,
            });
            accept(result.snapshot);
            observer.lastReceipt = result.receipt;
            observer.error = null;
          } catch (error) {
            observer.error = error.message;
            if (error.status === 409) {
              try { accept(await request('/api/state')); }
              catch (refreshError) { observer.error = refreshError.message; }
            }
          } finally {
            queued--;
            if (!queued) { observer.pending = false; render(); }
          }
        });
      }
    });
  }
  request('/api/state').then((initial) => {
    accept(initial);
    render();
    observer.ready = true;
  }).catch((error) => { observer.error = error.message; });
}

function routedBrowserProjection(node) {
  const { id, role, localProperties, children } = node;
  return { id, role, localProperties, children: children.map(routedBrowserProjection) };
}

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
  const navigation = ui.extensionPoints.navigation;
  const client = navigation ? { root: routedBrowserProjection(ui.viewTree), navigation, eventMappings: manifest.eventMappings } : null;
  const bridgeScript = client
    ? '(' + startRoutedBridge.toString() + ')(JSON.parse('
      + JSON.stringify(JSON.stringify(client)).replaceAll('<', '\\u003c') + '), ' + JSON.stringify(token) + ');'
    : script.replaceAll('</script','<\\/script');
  return html.replace(scripts[0][0], () => '<script>' + bridgeScript + '</script>');
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
    const chunks = [];
    let bytes = 0;
    let body;
    try {
      for await (const chunk of req) {
        bytes += chunk.byteLength;
        if (bytes > 65536) { reply(413, { code: 'UI_REQUEST_LIMIT' }); return; }
        chunks.push(chunk);
      }
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks, bytes)));
    } catch {
      if (!res.destroyed) reply(400, { code: 'UI_REQUEST_JSON' });
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { reply(400, { code: 'UI_REQUEST_JSON' }); return; }
    try{const receipt=await runtime.dispatch(body.event,{expectedStateRoot:body.expectedStateRoot,expectedRevision:body.expectedRevision,authorized:body.authorized});reply(200,{snapshot:runtime.snapshot(),receipt});}
    catch(error){const code=nativeUiExecutionErrorCode(error)??'UI_EXECUTION_FAILED';reply(code==='RCL_UI_NATIVE_STALE_STATE'||code==='RCL_UI_NATIVE_BACKPRESSURE'?409:400,{code});}
  });
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}
  catch(error){await runtime.dispose();throw error;}
  const url='http://127.0.0.1:'+server.address().port;
  return{url,token,runtime,html,htmlHash:sha(html),transport:'ACTUAL_HTTP_LOOPBACK',requests:()=>structuredClone(requests),
    async dispose(){await new Promise(resolve=>server.close(resolve));await runtime.dispose();}};
}
