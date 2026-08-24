import { nativeUiRoot } from './ui-ir.mjs';
import { createNativeUiRuntime, runNativeUiSemanticTrace } from './ui-event.mjs';
import { RCL_NATIVE_UI_WEB_FORMAT } from './ui-schema.mjs';

const ROLE_TO_TAG = Object.freeze({ container: 'section', text: 'span', action: 'button', input: 'input' });
const EVENT_TO_DOM = Object.freeze({
  activate: 'click', input: 'input', change: 'change', submit: 'submit',
  focus: 'focusin', blur: 'focusout', navigate: 'click',
});

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function cssValue(name, value) {
  if (name === 'foreground') return ['color', value];
  if (name === 'background') return ['background', value];
  if (name === 'font_family') return ['font-family', value === 'system' ? 'system-ui,sans-serif' : value];
  if (name === 'font_size') return ['font-size', typeof value === 'number' ? `${value}px` : value];
  if (name === 'text_align') return ['text-align', value];
  if (name === 'corner_radius') return ['border-radius', typeof value === 'number' ? `${value}px` : value];
  return null;
}

function layoutCss(layout) {
  const result = [];
  if (layout.mode === 'vertical' || layout.mode === 'horizontal') {
    result.push(['display', 'flex'], ['flex-direction', layout.mode === 'vertical' ? 'column' : 'row']);
  } else if (layout.mode === 'overlay') result.push(['display', 'grid']);
  else result.push(['display', 'grid'], ['grid-template-columns', `repeat(${layout.columns}, minmax(0,1fr))`]);
  if (layout.mode === 'overlay') result.push(['grid-template-areas', '"overlay"']);
  result.push(['gap', `${layout.gap}px`], ['padding', `${layout.padding}px`]);
  const align = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }[layout.alignment];
  const distribute = {
    start: 'flex-start', center: 'center', end: 'flex-end', space_between: 'space-between',
    space_around: 'space-around', space_evenly: 'space-evenly',
  }[layout.distribution];
  result.push(['align-items', align], ['justify-content', distribute], ['overflow', layout.overflow === 'scroll' ? 'auto' : layout.overflow]);
  if (layout.width.mode === 'fill') result.push(['width', '100%']);
  else if (layout.width.mode === 'fixed') result.push(['width', `${layout.width.value}px`]);
  if (layout.height.mode === 'fill') result.push(['height', '100%']);
  else if (layout.height.mode === 'fixed') result.push(['height', `${layout.height.value}px`]);
  return result;
}

function collectNodes(root, result = []) {
  result.push(root);
  for (const child of root.children) collectNodes(child, result);
  return result;
}

function staticProperty(node, name) {
  return node.localProperties.find((item) => item.property === name)?.value;
}

function emitNode(node, navigation = null) {
  const tag = ROLE_TO_TAG[node.role];
  const attrs = [`data-rcl-node="${escapeHtml(node.id)}"`, `data-rcl-role="${escapeHtml(node.role)}"`];
  const route = navigation?.routes.find((item) => item.target === node.id)?.id ?? null;
  if (route !== null) attrs.push(`data-rcl-route="${escapeHtml(route)}"`);
  if (node.events.length > 0) attrs.push(`data-rcl-events="${escapeHtml(node.events.map((item) => item.type).join(','))}"`);
  if (node.accessibility.label) attrs.push(`aria-label="${escapeHtml(node.accessibility.label)}"`);
  if (node.role === 'input') {
    const placeholder = staticProperty(node, 'placeholder');
    if (placeholder !== undefined) attrs.push(`placeholder="${escapeHtml(placeholder)}"`);
  }
  const value = staticProperty(node, node.role === 'action' ? 'label' : 'value');
  if (node.role === 'input') return `<input ${attrs.join(' ')}${value !== undefined ? ` value="${escapeHtml(value)}"` : ''}>`;
  const children = node.children.map((child) => emitNode(child, navigation)).join('');
  return `<${tag} ${attrs.join(' ')}>${value !== undefined ? escapeHtml(value) : ''}${children}</${tag}>`;
}

function emitCss(ui) {
  const base = 'html,body{margin:0;min-height:100%;box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}body{display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif}[data-rcl-role="action"]{border:0;padding:10px 16px;cursor:pointer}[data-rcl-role="input"]{padding:10px 12px}[data-rcl-route][hidden]{display:none!important}';
  const nodes = collectNodes(ui.viewTree).map((node) => {
    const declarations = [
      ...layoutCss(node.layout),
      ...Object.entries(node.resolvedStyle.values).map(([name, value]) => cssValue(name, value)).filter(Boolean),
    ];
    if (node.layout.mode === 'overlay') declarations.push(['grid-area', 'overlay']);
    return `[data-rcl-node="${node.id}"]{${declarations.map(([key, value]) => `${key}:${value}`).join(';')}}`;
  });
  return [base, ...nodes].join('\n');
}

function runtimeScript(manifest) {
  const payload = JSON.stringify(manifest).replaceAll('</script', '<\\/script');
  return `(()=>{const manifest=${payload};const ui=manifest.ui;const state=Object.fromEntries(ui.state.map(x=>[x.id,structuredClone(x.initial)]));const trace=[];const lifecycle=[];const navigation=ui.extensionPoints.navigation;let currentRoute=navigation?.initialRoute??null;const nodes=new Map();(function walk(n){nodes.set(n.id,n);for(const c of n.children)walk(c)})(ui.viewTree);
function truthy(v){return v!==null&&v!==undefined&&v!==false&&v!==0&&v!==''}
function typeMatches(v,t){if(t==='Number')return typeof v==='number'&&Number.isFinite(v);if(t==='Text')return typeof v==='string';if(t==='Truth')return typeof v==='boolean';return false}
function binary(op,l,r){if(op==='and')return truthy(l)&&truthy(r);if(op==='or')return truthy(l)||truthy(r);if(op==='+')return typeof l==='string'||typeof r==='string'?String(l)+String(r):l+r;if(op==='-')return l-r;if(op==='*')return l*r;if(op==='/')return l/r;if(op==='%')return l%r;if(op==='==')return l===r;if(op==='!=')return l!==r;if(op==='<')return l<r;if(op==='<=')return l<=r;if(op==='>')return l>r;if(op==='>=')return l>=r;throw new Error('RCL_UI_WEB_OPERATOR:'+op)}
function context(event={}){const cache=new Map();const derived=id=>{if(cache.has(id))return cache.get(id);const d=ui.derivedState.find(x=>x.id===id);if(!d)throw new Error('RCL_UI_WEB_DERIVED:'+id);const v=evalExpr(d.expression,event,derived);cache.set(id,v);return v};return {event,derived}}
function evalExpr(e,event={},derived=context(event).derived){if(e.kind==='literal')return e.value;if(e.kind==='reference'){if(e.scope==='state')return state[e.id];if(e.scope==='derived')return derived(e.id);return event[e.id]}if(e.kind==='unary'){const v=evalExpr(e.expression,event,derived);return e.operator==='not'?!truthy(v):-v}if(e.kind==='choose')return truthy(evalExpr(e.args[0],event,derived))?evalExpr(e.args[1],event,derived):evalExpr(e.args[2],event,derived);return binary(e.operator,evalExpr(e.left,event,derived),evalExpr(e.right,event,derived))}
function rendered(event={}){const result={};const ctx=context(event);for(const [id,node] of nodes)result[id]=Object.fromEntries(node.bindings.map(b=>[b.property,evalExpr(b.expression,event,ctx.derived)]));return result}
function render(event={}){const values=rendered(event);for(const [id,props] of Object.entries(values)){const el=document.querySelector('[data-rcl-node="'+CSS.escape(id)+'"]');if(!el)continue;if(Object.hasOwn(props,'value')){if(el instanceof HTMLInputElement){if(el.value!==String(props.value))el.value=String(props.value)}else el.textContent=String(props.value)}if(Object.hasOwn(props,'label'))el.textContent=String(props.label)}for(const el of document.querySelectorAll('[data-rcl-route]'))el.hidden=el.dataset.rclRoute!==currentRoute;document.documentElement.dataset.rclState=JSON.stringify(state);document.documentElement.dataset.rclTrace=JSON.stringify(trace);if(navigation)document.documentElement.dataset.rclRoute=currentRoute}
function dispatch(nodeId,type,payload={}){const node=nodes.get(nodeId);if(!node)throw new Error('RCL_UI_WEB_NODE:'+nodeId);const handler=node.events.find(x=>x.type===type);if(!handler)throw new Error('RCL_UI_WEB_EVENT:'+nodeId+':'+type);for(const p of handler.parameters){if(!Object.hasOwn(payload,p.id))throw new Error('RCL_UI_WEB_EVENT_PARAMETER_MISSING:'+nodeId+':'+type+':'+p.id);if(!typeMatches(payload[p.id],p.valueType))throw new Error('RCL_UI_WEB_EVENT_PARAMETER_TYPE:'+nodeId+':'+type+':'+p.id+':'+p.valueType)}if(handler.authority!=='ui-local')throw new Error('RCL_UI_WEB_REALITY_GATEWAY_REQUIRED:'+nodeId+':'+type);const before=structuredClone(state);const beforeRoute=currentRoute;const proposed=structuredClone(before);let proposedRoute=beforeRoute;const ctx=context(payload);for(const s of handler.statements){if(s.kind==='navigate'){if(!navigation?.routes.some(x=>x.id===s.route))throw new Error('RCL_UI_WEB_NAVIGATION_ROUTE:'+s.route);proposedRoute=s.route;continue}const next=evalExpr(s.expression,payload,ctx.derived);const declared=ui.state.find(x=>x.id===s.target);if(!typeMatches(next,declared.valueType))throw new Error('RCL_UI_WEB_MUTATION_TYPE:'+s.target+':'+declared.valueType);proposed[s.target]=next}Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,proposed);currentRoute=proposedRoute;render(payload);const record={sequence:trace.length+1,event:{nodeId,type,payload,authority:handler.authority},beforeState:before,afterState:structuredClone(state),renderedSemanticState:rendered(payload),...(navigation?{beforeRoute,afterRoute:currentRoute}:{})};trace.push(record);render(payload);return record}
function lifecycleStage(stage){if(!ui.lifecycle.stages.includes(stage))return;const last=lifecycle[lifecycle.length-1];if(last?.stage===stage)return;lifecycle.push({stage,state:structuredClone(state)})}
const domToCanonical={click:'activate',input:'input',change:'change',submit:'submit',focusin:'focus',focusout:'blur'};for(const domType of Object.keys(domToCanonical))document.addEventListener(domType,event=>{const el=event.target.closest?.('[data-rcl-node]');if(!el)return;const type=domToCanonical[domType];const node=nodes.get(el.dataset.rclNode);if(!node?.events.some(x=>x.type===type))return;if(domType==='submit')event.preventDefault();const payload=el instanceof HTMLInputElement?{value:el.value}:{};dispatch(el.dataset.rclNode,type,payload)});
lifecycleStage('create');render();lifecycleStage('activate');lifecycleStage('resume');document.addEventListener('visibilitychange',()=>lifecycleStage(document.visibilityState==='hidden'?'suspend':'resume'));window.addEventListener('pageshow',()=>lifecycleStage('activate'));window.addEventListener('pagehide',()=>{lifecycleStage('suspend');lifecycleStage('destroy')});window.RCLNativeUI={manifest,state,trace,lifecycle,dispatch,render,rendered,lifecycleStage,currentRoute:()=>currentRoute};
if(new URL(location.href).searchParams.get('rclTest')==='1')queueMicrotask(()=>{let result;try{const runEvidenceEvent=event=>{const el=document.querySelector('[data-rcl-node="'+CSS.escape(event.nodeId)+'"]');if(event.type==='activate')el.click();else dispatch(event.nodeId,event.type,event.payload||{})};const benchmarkInitial=JSON.stringify(state);const iterations=50;const rclStarted=performance.now();for(let i=0;i<iterations;i++)for(const event of manifest.evidenceEvents)runEvidenceEvent(event);const rclDurationMs=performance.now()-rclStarted;if(JSON.stringify(state)!==benchmarkInitial)throw new Error('RCL_UI_WEB_PERFORMANCE_SEQUENCE_NOT_CLOSED');trace.length=0;render();for(const event of manifest.evidenceEvents)runEvidenceEvent(event);result={status:'PASS',finalState:structuredClone(state),trace:structuredClone(trace),uiProgramRoot:ui.semanticRoot,performance:{iterations,eventsPerIteration:manifest.evidenceEvents.length,rclDurationMs}}}catch(error){result={status:'FAIL',error:String(error)}}const out=document.getElementById('rcl-test-result');out.textContent=JSON.stringify(result);out.dataset.status=result.status;document.documentElement.dataset.rclTest=result.status});})();`;
}

export function lowerNativeUiToWeb(ui, target = {}) {
  if (target.document || target.styles || target.screen) throw new Error('RCL_UI_BACKEND_MORPHOLOGY_FORBIDDEN:web');
  const nodes = collectNodes(ui.viewTree);
  const report = {
    schema: RCL_NATIVE_UI_WEB_FORMAT,
    backend: 'web',
    backendVersion: '0.1.0',
    uiProgramRoot: ui.semanticRoot,
    ui,
    nodeMappings: nodes.map((node) => ({ nodeId: node.id, canonicalRole: node.role, target: ROLE_TO_TAG[node.role] })),
    eventMappings: ui.eventGraph.events.map((event) => ({ nodeId: event.nodeId, canonicalEvent: event.type, targetEvent: EVENT_TO_DOM[event.type] ?? 'custom-event' })),
    layoutMapping: { vertical: 'flex-column', horizontal: 'flex-row', overlay: 'css-grid-overlay', grid: 'css-grid' },
    lifecycleMapping: { create: 'document-bootstrap', activate: 'document-visible', suspend: 'visibility-hidden', resume: 'visibility-visible', destroy: 'pagehide' },
    evidenceEvents: structuredClone(target.evidenceEvents ?? []),
    target: { title: target.title ?? ui.id, language: target.language ?? 'zh-CN' },
    coverage: { semantic: 'native-ui-ir', visualFidelity: 'structural-v0.1', runtime: 'browser-dom' },
  };
  return Object.freeze({ ...report, loweringRoot: nativeUiRoot(report) });
}

export function emitNativeUiWebHtml(manifest) {
  if (manifest.schema !== RCL_NATIVE_UI_WEB_FORMAT) throw new Error('RCL_UI_WEB_MANIFEST_FORMAT');
  return `<!doctype html><html lang="${escapeHtml(manifest.target.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.target.title)}</title><style>${emitCss(manifest.ui)}</style></head><body>${emitNode(manifest.ui.viewTree, manifest.ui.extensionPoints.navigation)}<output id="rcl-test-result" hidden></output><script>${runtimeScript(manifest)}</script></body></html>`;
}

export function emitNativeUiWebServer(manifest, html = emitNativeUiWebHtml(manifest)) {
  return `import http from 'node:http';\nconst html=${JSON.stringify(html)};\nexport const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});\nif(import.meta.url===new URL(process.argv[1],'file:').href){const port=Number(process.env.PORT||8787);server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({status:'LISTENING',port,uiProgramRoot:${JSON.stringify(manifest.uiProgramRoot)}})))}\n`;
}

export function simulateNativeUiWebApplication(manifest, events = []) {
  if (manifest.schema !== RCL_NATIVE_UI_WEB_FORMAT) throw new Error('RCL_UI_WEB_MANIFEST_FORMAT');
  const runtime = createNativeUiRuntime(manifest.ui);
  runtime.lifecycle('create');
  runtime.lifecycle('resume');
  for (const event of events) runtime.dispatch(event.nodeId, event.type, event.payload ?? {});
  return { state: runtime.snapshot(), rendered: runtime.projection().rendered, history: structuredClone(runtime.trace), ...(manifest.ui.extensionPoints.navigation ? { currentRoute: runtime.currentRoute() } : {}) };
}

export function traceNativeUiWebApplication(manifest, events = []) {
  return runNativeUiSemanticTrace(manifest.ui, events, 'web');
}
