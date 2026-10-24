import { nativeUiRoot } from './ui-ir.mjs';
import { createNativeUiRuntime, runNativeUiSemanticTrace } from './ui-event.mjs';
import { RCL_NATIVE_UI_WEB_FORMAT } from './ui-schema.mjs';
import { inputKind, inputOptions } from './ui-controls.mjs';

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
  if (staticProperty(node, 'modal') === true) attrs.push('role="dialog"', 'aria-modal="true"', 'tabindex="-1"', 'data-rcl-modal="true"');
  if (['input', 'action'].includes(node.role) && staticProperty(node, 'disabled') === true) attrs.push('disabled');
  const kind = inputKind(node);
  if (node.role === 'input') {
    if (kind === 'switch') attrs.push('role="switch"');
    if (kind === 'slider') {
      for (const name of ['min', 'max', 'step']) attrs.push(`${name}="${escapeHtml(staticProperty(node, name))}"`);
    }
    if (!['select','radio','textarea'].includes(kind)) attrs.push(`type="${kind === 'slider' ? 'range' : ['checkbox','switch'].includes(kind) ? 'checkbox' : escapeHtml(kind)}"`);
    if (staticProperty(node, 'read_only') === true) {
      if (['text','email','password','textarea'].includes(kind)) attrs.push('readonly');
      else if (!attrs.includes('disabled')) attrs.push('disabled');
    }
    const placeholder = staticProperty(node, 'placeholder');
    if (placeholder !== undefined && ['text','email','password','textarea'].includes(kind)) attrs.push(`placeholder="${escapeHtml(placeholder)}"`);
  }
  const value = staticProperty(node, node.role === 'action' ? 'label' : 'value');
  if (node.role === 'input' && kind === 'radio') return `<fieldset ${attrs.join(' ')}><legend>${escapeHtml(node.accessibility.label ?? node.id)}</legend>${inputOptions(node).map((option) => `<label class="rcl-control-label"><input type="radio" name="rcl-${escapeHtml(node.id)}" value="${escapeHtml(option)}"${value === option ? ' checked' : ''}><span>${escapeHtml(option)}</span></label>`).join('')}</fieldset>`;
  if (node.role === 'input' && kind === 'textarea') return `<textarea ${attrs.join(' ')}>${value !== undefined ? escapeHtml(value) : ''}</textarea>`;
  if (node.role === 'input' && kind === 'select') return `<select ${attrs.join(' ')}>${inputOptions(node).map((option) => `<option value="${escapeHtml(option)}"${value === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`;
  if (node.role === 'input') {
    const html = `<input ${attrs.join(' ')}${value !== undefined && !['checkbox','switch'].includes(kind) ? ` value="${escapeHtml(value)}"` : value === true && ['checkbox','switch'].includes(kind) ? ' checked' : ''}>`;
    return ['checkbox','switch'].includes(kind) ? `<label class="rcl-control-label">${html}<span>${escapeHtml(staticProperty(node, 'accessibility_label') ?? node.id)}</span></label>` : html;
  }
  const children = node.children.map((child) => emitNode(child, navigation)).join('');
  return `<${tag} ${attrs.join(' ')}>${value !== undefined ? escapeHtml(value) : ''}${children}</${tag}>`;
}

function emitCss(ui) {
  const base = 'html,body{margin:0;min-height:100%;box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}body{display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif}[data-rcl-role="action"]{border:0;padding:10px 16px;cursor:pointer}[data-rcl-role="input"]{padding:10px 12px}[data-rcl-role="input"][type="checkbox"]{width:18px;height:18px;min-width:18px;display:inline-block;accent-color:#2563eb;padding:0;cursor:pointer}[data-rcl-role="input"][role="switch"]{appearance:none;width:46px;height:26px;min-width:46px;border-radius:30px;background:#9ca3af;position:relative;transition:background .15s}[data-rcl-role="input"][role="switch"]:checked{background:#2563eb}[data-rcl-role="input"][role="switch"]:before{content:"";width:20px;height:20px;position:absolute;top:3px;left:3px;background:#fff;border-radius:50%;transition:transform .15s}[data-rcl-role="input"][role="switch"]:checked:before{transform:translateX(20px)}[data-rcl-role="input"][type="range"]{display:block;width:100%;accent-color:#2563eb;padding:0}[data-rcl-role="input"]:disabled{opacity:.55;cursor:not-allowed}.rcl-control-label{display:flex;gap:10px;align-items:center}[data-rcl-role=\"input\"] fieldset{border:1px solid #9ca3af}[data-rcl-role=\"input\"][type=\"date\"]{min-width:170px}[data-rcl-route][hidden]{display:none!important}[aria-invalid=true]{outline:2px solid #dc2626;outline-offset:2px}[data-rcl-error-for]{font-size:12px;color:#b91c1c}[data-rcl-error-for][hidden]{display:none!important}[data-rcl-node][hidden]{display:none!important}[data-rcl-modal="true"]{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;justify-content:center;align-items:center;background:rgba(0,0,0,.82);color:white;box-shadow:0 20px 60px #0009;overflow:auto}[data-rcl-modal="true"]:focus-visible{outline:3px solid #60a5fa}';
  const nodes = collectNodes(ui.viewTree).map((node) => {
    const declarations = [
      ...layoutCss(node.layout),
      ...Object.entries(node.resolvedStyle.values).map(([name, value]) => cssValue(name, value)).filter(Boolean),
    ];
    if (node.layout.mode === 'overlay') declarations.push(['grid-area', 'overlay']);
    return `[data-rcl-node="${node.id}"]{${declarations.map(([key, value]) => `${key}:${value}`).join(';')}}`;
  });
  const adaptation = ui.extensionPoints.deviceAdaptation;
  const adaptive = adaptation ? adaptation.profiles.flatMap((profile) => {
    const conditions = [`(min-width:${profile.minWidth}px)`];
    if (profile.maxWidth !== null) conditions.push(`(max-width:${profile.maxWidth}px)`);
    const overrides = collectNodes(ui.viewTree).flatMap((node) => node.adaptiveLayouts
      .filter((item) => item.profile === profile.id)
      .map((item) => `[data-rcl-node="${node.id}"]{display:flex;flex-direction:${item.mode === 'vertical' ? 'column' : 'row'}}`));
    return overrides.length === 0 ? [] : [`@media ${conditions.join(' and ')}{${overrides.join('')}}`];
  }) : [];
  return [base, ...nodes, ...adaptive].join('\n');
}

function runtimeScript(manifest) {
  const payload = JSON.stringify(manifest).replaceAll('</script', '<\\/script');
  return `(()=>{const manifest=${payload};const ui=manifest.ui;const state=Object.fromEntries(ui.state.map(x=>[x.id,structuredClone(x.initial)]));const trace=[];const lifecycle=[];const navigation=ui.extensionPoints.navigation;const adaptation=ui.extensionPoints.deviceAdaptation;let currentRoute=navigation?.initialRoute??null;const nodes=new Map();const parents=new Map();(function walk(n,parent=null){nodes.set(n.id,n);parents.set(n.id,parent);for(const c of n.children)walk(c,n.id)})(ui.viewTree);let priorModal=null;
function truthy(v){return v!==null&&v!==undefined&&v!==false&&v!==0&&v!==''}
function rclIsoDate(value){if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;const y=Number(value.slice(0,4)),m=Number(value.slice(5,7)),d=Number(value.slice(8,10));if(y<1||m<1||m>12||d<1)return false;return d<=[31,((y%4===0&&y%100!==0)||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][m-1]}
function typeMatches(v,t){if(t==='Number')return typeof v==='number'&&Number.isFinite(v);if(t==='Text')return typeof v==='string';if(t==='Truth')return typeof v==='boolean';return false}
function binary(op,l,r){if(op==='and')return truthy(l)&&truthy(r);if(op==='or')return truthy(l)||truthy(r);if(op==='+')return typeof l==='string'||typeof r==='string'?String(l)+String(r):l+r;if(op==='-')return l-r;if(op==='*')return l*r;if(op==='/')return l/r;if(op==='%')return l%r;if(op==='==')return l===r;if(op==='!=')return l!==r;if(op==='<')return l<r;if(op==='<=')return l<=r;if(op==='>')return l>r;if(op==='>=')return l>=r;throw new Error('RCL_UI_WEB_OPERATOR:'+op)}
function context(event={}){const cache=new Map();const derived=id=>{if(cache.has(id))return cache.get(id);const d=ui.derivedState.find(x=>x.id===id);if(!d)throw new Error('RCL_UI_WEB_DERIVED:'+id);const v=evalExpr(d.expression,event,derived);cache.set(id,v);return v};return {event,derived}}
function evalExpr(e,event={},derived=context(event).derived){if(e.kind==='literal')return e.value;if(e.kind==='reference'){if(e.scope==='state')return state[e.id];if(e.scope==='derived')return derived(e.id);return event[e.id]}if(e.kind==='unary'){const v=evalExpr(e.expression,event,derived);return e.operator==='not'?!truthy(v):-v}if(e.kind==='choose')return truthy(evalExpr(e.args[0],event,derived))?evalExpr(e.args[1],event,derived):evalExpr(e.args[2],event,derived);return binary(e.operator,evalExpr(e.left,event,derived),evalExpr(e.right,event,derived))}
function rendered(event={}){const result={};const ctx=context(event);for(const [id,node] of nodes)result[id]=Object.fromEntries(node.bindings.map(b=>[b.property,evalExpr(b.expression,event,ctx.derived)]));return result}
function controlValue(node,property,values){return values?.[node.id]?.[property]??node.localProperties.find(x=>x.property===property)?.value}
function activeModalId(values){for(const [id,n] of nodes){if(controlValue(n,'modal',values)===true&&controlValue(n,'visible',values)===true)return id}return null}
function assertInteractable(id,type,values){const ancestors=new Set();for(let current=id;current!==null;current=parents.get(current)??null){ancestors.add(current);if(controlValue(nodes.get(current),'visible',values)===false)throw new Error('RCL_UI_EVENT_HIDDEN:'+id+':'+type)}const active=activeModalId(values);if(active&&!ancestors.has(active))throw new Error('RCL_UI_MODAL_BLOCKED:'+id+':'+type)}
let formAttempted=false;
function rclFormValidation(){const fields={};const values=rendered();for(const [id,node] of nodes){if(node.role!=='input')continue;const prop=k=>node.localProperties.find(x=>x.property===k)?.value;const value=values[id].value??prop('value');const kind=prop('input_kind')??'text';let reason=null;const empty=value===''||value===false||value===null||value===undefined;if(prop('required')===true&&empty)reason='required';if(!empty){if(['text','email','password','textarea'].includes(kind)){const n=Array.from(String(value)).length;if(prop('min_length')!==undefined&&n<prop('min_length'))reason='min_length';if(prop('max_length')!==undefined&&n>prop('max_length'))reason='max_length';}if(kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))reason='email';if(kind==='date'&&!rclIsoDate(value))reason='date';if(['select','radio'].includes(kind)&&!String(prop('options')).split('|').includes(value))reason='option';}if(reason)fields[id]=reason;}return {valid:Object.keys(fields).length===0,fields}}

function deviceProfile(width=window.innerWidth){if(!adaptation)return null;return adaptation.profiles.find(x=>width>=x.minWidth&&(x.maxWidth===null||width<=x.maxWidth))?.id??adaptation.defaultProfile}
function render(event={}){const values=rendered(event);for(const [id,props] of Object.entries(values)){const el=document.querySelector('[data-rcl-node="'+CSS.escape(id)+'"]');if(!el)continue;const node=nodes.get(id);if(controlValue(node,'visible',values)===false)el.hidden=true;else el.hidden=false;const kind=node.localProperties.find(x=>x.property==='input_kind')?.value??'text';const local=p=>node.localProperties.find(x=>x.property===p)?.value;const enabledByControl=!(Object.hasOwn(props,'disabled')?props.disabled:local('disabled')===true);const readonly=Object.hasOwn(props,'read_only')?props.read_only:local('read_only')===true;if(['input','action'].includes(node.role)){if(Object.hasOwn(props,'disabled'))el.disabled=props.disabled;el.disabled=!enabledByControl||(node.role==='input'&&['checkbox','switch','slider','select','radio','date'].includes(kind)&&readonly);if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&['text','email','password','textarea'].includes(kind)){if(Object.hasOwn(props,'read_only'))el.readOnly=props.read_only;else el.readOnly=readonly}}if(Object.hasOwn(props,'value')){if(el instanceof HTMLInputElement&&['checkbox','switch'].includes(kind))el.checked=props.value;else if(kind==='radio'){for(const radio of el.querySelectorAll('input[type=radio]'))radio.checked=radio.value===String(props.value)}else if(el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement){if(el.value!==String(props.value))el.value=String(props.value)}else el.textContent=String(props.value)}if(Object.hasOwn(props,'label'))el.textContent=String(props.label)}const validation=rclFormValidation();document.documentElement.dataset.rclFormValid=String(validation.valid);for(const [id,node] of nodes){if(node.role!=='input')continue;const el=document.querySelector('[data-rcl-node="'+CSS.escape(id)+'"]');if(!el)continue;const error=formAttempted?validation.fields[id]??null:null;el.setAttribute('aria-invalid',error?'true':'false');let note=document.querySelector('[data-rcl-error-for="'+CSS.escape(id)+'"]');if(!note){note=document.createElement('small');note.dataset.rclErrorFor=id;note.setAttribute('role','status');el.insertAdjacentElement('afterend',note)}note.hidden=!error;note.textContent=error?({'required':'Required field','email':'Enter a valid email address','min_length':'Value is too short','max_length':'Value is too long','date':'Invalid date','option':'Invalid selection'}[error]??'Invalid value'):'';}for(const el of document.querySelectorAll('[data-rcl-route]')){const hiddenByBinding=el.hidden;el.hidden=el.dataset.rclRoute!==currentRoute;el.hidden=el.hidden||hiddenByBinding;}const modalId=activeModalId(values);for(const child of ui.viewTree.children){const el=document.querySelector('[data-rcl-node="'+CSS.escape(child.id)+'"]');if(el&&child.id!==modalId){el.inert=!!modalId; if(modalId)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden')}}if(modalId!==priorModal){if(modalId){const dialog=document.querySelector('[data-rcl-node="'+CSS.escape(modalId)+'"]');(dialog?.querySelector('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')??dialog)?.focus?.()}priorModal=modalId}document.documentElement.dataset.rclState=JSON.stringify(state);document.documentElement.dataset.rclTrace=JSON.stringify(trace);if(navigation)document.documentElement.dataset.rclRoute=currentRoute;if(adaptation)document.documentElement.dataset.rclDeviceProfile=deviceProfile()}
function dispatch(nodeId,type,payload={}){const node=nodes.get(nodeId);if(!node)throw new Error('RCL_UI_WEB_NODE:'+nodeId);const handler=node.events.find(x=>x.type===type);if(!handler)throw new Error('RCL_UI_WEB_EVENT:'+nodeId+':'+type);assertInteractable(nodeId,type,rendered());const control=p=>{const binding=node.bindings.find(b=>b.property===p);return binding?evalExpr(binding.expression):node.localProperties.find(x=>x.property===p)?.value??false};if(control('disabled'))throw new Error('RCL_UI_EVENT_DISABLED:'+nodeId+':'+type);if(node.role==='action'&&control('require_valid_form')&&type==='activate'){formAttempted=true;const check=rclFormValidation();if(!check.valid){render();throw new Error('RCL_UI_FORM_INVALID:'+nodeId+':'+Object.keys(check.fields).join(','))}}if(node.role==='input'&&control('read_only')&&(type==='input'||type==='change'))throw new Error('RCL_UI_EVENT_READ_ONLY:'+nodeId+':'+type);if(node.role==='input'&&(type==='input'||type==='change')){const kind=node.localProperties.find(x=>x.property==='input_kind')?.value??'text';const prop=k=>node.localProperties.find(x=>x.property===k)?.value;if(kind==='slider'){const v=payload.value,min=prop('min'),max=prop('max'),step=prop('step');if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||Math.abs((v-min)/step-Math.round((v-min)/step))>1e-8)throw new Error('RCL_UI_SLIDER_VALUE:'+nodeId)}if(['select','radio'].includes(kind)&&!String(prop('options')).split('|').includes(payload.value))throw new Error('RCL_UI_SELECT_VALUE:'+nodeId);if(kind==='date'&&!rclIsoDate(payload.value))throw new Error('RCL_UI_DATE_VALUE:'+nodeId)}for(const p of handler.parameters){if(!Object.hasOwn(payload,p.id))throw new Error('RCL_UI_WEB_EVENT_PARAMETER_MISSING:'+nodeId+':'+type+':'+p.id);if(!typeMatches(payload[p.id],p.valueType))throw new Error('RCL_UI_WEB_EVENT_PARAMETER_TYPE:'+nodeId+':'+type+':'+p.id+':'+p.valueType)}if(handler.authority!=='ui-local')throw new Error('RCL_UI_WEB_REALITY_GATEWAY_REQUIRED:'+nodeId+':'+type);const before=structuredClone(state);const beforeRoute=currentRoute;const proposed=structuredClone(before);let proposedRoute=beforeRoute;const ctx=context(payload);for(const s of handler.statements){if(s.kind==='navigate'){if(!navigation?.routes.some(x=>x.id===s.route))throw new Error('RCL_UI_WEB_NAVIGATION_ROUTE:'+s.route);proposedRoute=s.route;continue}const next=evalExpr(s.expression,payload,ctx.derived);const declared=ui.state.find(x=>x.id===s.target);if(!typeMatches(next,declared.valueType))throw new Error('RCL_UI_WEB_MUTATION_TYPE:'+s.target+':'+declared.valueType);proposed[s.target]=next}Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,proposed);currentRoute=proposedRoute;render(payload);const record={sequence:trace.length+1,event:{nodeId,type,payload,authority:handler.authority},beforeState:before,afterState:structuredClone(state),renderedSemanticState:rendered(payload),...(navigation?{beforeRoute,afterRoute:currentRoute}:{})};trace.push(record);render(payload);return record}
function lifecycleStage(stage){if(!ui.lifecycle.stages.includes(stage))return;const last=lifecycle[lifecycle.length-1];if(last?.stage===stage)return;lifecycle.push({stage,state:structuredClone(state)})}
const domToCanonical={click:'activate',input:'input',change:'change',submit:'submit',focusin:'focus',focusout:'blur'};for(const domType of Object.keys(domToCanonical))document.addEventListener(domType,event=>{const host=event.target.closest?.('[data-rcl-node]');if(!host)return;const el=event.target;const type=domToCanonical[domType];const node=nodes.get(host.dataset.rclNode);if(!node?.events.some(x=>x.type===type))return;if(domType==='submit')event.preventDefault();const kind=node.localProperties.find(x=>x.property==='input_kind')?.value??'text';const payload=el instanceof HTMLInputElement?{value:['checkbox','switch'].includes(kind)?el.checked:kind==='slider'?Number(el.value):el.value}:el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement?{value:el.value}:{};try{dispatch(host.dataset.rclNode,type,payload)}catch(error){render();if(['RCL_UI_EVENT_DISABLED:','RCL_UI_EVENT_READ_ONLY:','RCL_UI_FORM_INVALID:','RCL_UI_EVENT_HIDDEN:','RCL_UI_MODAL_BLOCKED:'].some(code=>String(error).includes(code)))return;throw error}});
lifecycleStage('create');render();lifecycleStage('activate');lifecycleStage('resume');document.addEventListener('visibilitychange',()=>lifecycleStage(document.visibilityState==='hidden'?'suspend':'resume'));window.addEventListener('resize',()=>render());window.addEventListener('pageshow',()=>lifecycleStage('activate'));window.addEventListener('pagehide',()=>{lifecycleStage('suspend');lifecycleStage('destroy')});window.RCLNativeUI={manifest,state,trace,lifecycle,dispatch,render,rendered,formValidation:rclFormValidation,lifecycleStage,currentRoute:()=>currentRoute,currentDeviceProfile:()=>deviceProfile()};
if(new URL(location.href).searchParams.get('rclTest')==='1')queueMicrotask(()=>{let result;try{const runEvidenceEvent=event=>{const el=document.querySelector('[data-rcl-node="'+CSS.escape(event.nodeId)+'"]');if(event.type==='activate')el.click();else dispatch(event.nodeId,event.type,event.payload||{})};const benchmarkInitial=JSON.stringify(state);const iterations=50;const rclStarted=performance.now();for(let i=0;i<iterations;i++)for(const event of manifest.evidenceEvents)runEvidenceEvent(event);const rclDurationMs=performance.now()-rclStarted;if(JSON.stringify(state)!==benchmarkInitial)throw new Error('RCL_UI_WEB_PERFORMANCE_SEQUENCE_NOT_CLOSED');trace.length=0;render();for(const event of manifest.evidenceEvents)runEvidenceEvent(event);const deviceEvidence=adaptation?{profile:deviceProfile(),layouts:Object.fromEntries([...nodes].filter(([,node])=>node.adaptiveLayouts.length>0).map(([id])=>{const direction=getComputedStyle(document.querySelector('[data-rcl-node="'+CSS.escape(id)+'"]')).flexDirection;return [id,direction==='row'?'horizontal':'vertical']}))}:null;result={status:'PASS',finalState:structuredClone(state),trace:structuredClone(trace),uiProgramRoot:ui.semanticRoot,...(deviceEvidence?{deviceAdaptation:deviceEvidence}:{}),performance:{iterations,eventsPerIteration:manifest.evidenceEvents.length,rclDurationMs}}}catch(error){result={status:'FAIL',error:String(error)}}const out=document.getElementById('rcl-test-result');out.textContent=JSON.stringify(result);out.dataset.status=result.status;document.documentElement.dataset.rclTest=result.status});})();`;
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
    deviceAdaptationMapping: ui.extensionPoints.deviceAdaptation ? { axis: 'CSS reference pixel viewport width', strategy: 'media-query-plus-resize-profile', profiles: ui.extensionPoints.deviceAdaptation.profiles } : null,
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

export function traceNativeUiWebApplication(manifest, events = [], options = {}) {
  return runNativeUiSemanticTrace(manifest.ui, events, 'web', options);
}
