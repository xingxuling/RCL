import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { compileReality } from './compiler.mjs';
import {
  emitNativeUiWebHtml,
  emitNativeUiWebServer,
  lowerNativeUiToWeb,
  simulateNativeUiWebApplication,
  traceNativeUiWebApplication,
} from './ui/web-ui-backend.mjs';
import { RCL_NATIVE_UI_WEB_FORMAT } from './ui/ui-schema.mjs';

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function literalFacetValue(facet) {
  if (!facet.value || facet.value.kind !== 'LiteralExpr') {
    throw new Error(`RCL_WEB_NON_LITERAL_INITIAL_FACET:${facet.path}`);
  }
  return facet.value.value;
}

function lowerExpr(expr) {
  if (!expr) return null;
  if (expr.kind === 'LiteralExpr') return { kind: 'literal', value: expr.value };
  if (expr.kind === 'PathExpr') return { kind: 'path', path: expr.path };
  if (expr.kind === 'UnaryExpr') return { kind: 'unary', operator: expr.operator, expression: lowerExpr(expr.expression) };
  if (expr.kind === 'BinaryExpr') return { kind: 'binary', operator: expr.operator, left: lowerExpr(expr.left), right: lowerExpr(expr.right) };
  if (expr.kind === 'CallExpr' && expr.name === 'choose') {
    return { kind: 'choose', args: expr.args.map(lowerExpr) };
  }
  throw new Error(`RCL_WEB_UNSUPPORTED_EXPRESSION:${expr.kind}${expr.name ? `:${expr.name}` : ''}`);
}

function lowerRule(rule) {
  if ((rule.calls ?? []).length > 0) throw new Error(`RCL_WEB_HOST_CALL_NOT_YET_SUPPORTED:${rule.name}`);
  return {
    name: rule.name,
    kind: rule.kind,
    actor: rule.kind === 'Emergence' ? rule.cause : rule.from,
    when: lowerExpr(rule.when),
    needs: structuredClone(rule.needs ?? []),
    alters: (rule.alters ?? []).map((alter) => ({ target: alter.target, expression: lowerExpr(alter.expression) })),
    preserves: (rule.preserves ?? []).map(lowerExpr),
    witnesses: [...(rule.witnesses ?? [])],
  };
}

function normalizeWebSpec(spec) {
  if (!spec || spec.schema !== 'rcl.web-application.v0.1') throw new Error('RCL_WEB_SPEC_SCHEMA');
  if (!spec.document || spec.document.tag !== 'main') throw new Error('RCL_WEB_DOCUMENT_ROOT');
  return structuredClone(spec);
}

export function compileRclWebApplication(rclSource, webSpec) {
  const program = compileReality(rclSource);
  if ((program.nativeUis ?? []).length > 0) {
    if (program.nativeUis.length !== 1) throw new Error(`RCL_UI_PROGRAM_AMBIGUOUS:${program.nativeUis.length}`);
    const target = webSpec ?? {};
    if (target.schema && target.schema !== 'rcl.native-ui.web-target.v0.1') throw new Error(`RCL_UI_WEB_TARGET_SCHEMA:${target.schema}`);
    return lowerNativeUiToWeb(program.nativeUis[0], target);
  }
  const spec = normalizeWebSpec(webSpec);
  const state = Object.fromEntries(program.facets.filter((facet) => !facet.deferred).map((facet) => [facet.path, literalFacetValue(facet)]));
  const warrants = program.warrants.map((warrant) => ({ subject: warrant.subject, capability: warrant.capability, target: warrant.target }));
  const rules = program.rules.map(lowerRule);
  const manifest = {
    schema: 'rcl.web-runtime-manifest.v0.1',
    program: program.name,
    programRoot: program.programRoot,
    state,
    warrants,
    rules,
    document: spec.document,
    styles: spec.styles ?? [],
    routes: spec.routes ?? [{ path: '/', title: spec.title ?? program.name }],
    metadata: {
      title: spec.title ?? program.name,
      language: spec.language ?? 'en',
      generator: 'RCL Web Application Compiler v0.1',
      semantics: ['RCL state', 'RCL authority', 'RCL transaction rules', 'HTML tree', 'CSS lowering', 'DOM events', 'history routing'],
    },
  };
  return Object.freeze({ ...manifest, manifestRoot: sha256(JSON.stringify(manifest)) });
}

function styleValue(value) {
  return String(value).replaceAll('</style', '<\\/style');
}

function emitCss(styles = []) {
  return styles.map((rule) => `${rule.selector}{${Object.entries(rule.declarations ?? {}).map(([key, value]) => `${key}:${styleValue(value)}`).join(';')}}`).join('\n');
}

function emitNode(node) {
  if (typeof node === 'string') return escapeHtml(node);
  const attrs = { ...(node.attrs ?? {}) };
  if (node.id) attrs.id = node.id;
  if (node.class) attrs.class = Array.isArray(node.class) ? node.class.join(' ') : node.class;
  if (node.textState) attrs['data-rcl-text'] = node.textState;
  if (node.valueState) attrs['data-rcl-value'] = node.valueState;
  if (node.observeState) attrs['data-rcl-observe'] = node.observeState;
  if (node.rule) attrs['data-rcl-rule'] = node.rule;
  if (node.navigate) attrs['data-rcl-navigate'] = node.navigate;
  const attrText = Object.entries(attrs).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('');
  const voidTags = new Set(['input', 'meta', 'link', 'img', 'br', 'hr']);
  if (voidTags.has(node.tag)) return `<${node.tag}${attrText}>`;
  const content = [node.text ? escapeHtml(node.text) : '', ...(node.children ?? []).map(emitNode)].join('');
  return `<${node.tag}${attrText}>${content}</${node.tag}>`;
}

function runtimeScript(manifest) {
  const payload = JSON.stringify(manifest).replaceAll('</script', '<\\/script');
  return `(() => {
const manifest=${payload};
const state=structuredClone(manifest.state);
const history=[];
const projections=[];
function get(path){if(!Object.prototype.hasOwnProperty.call(state,path))throw new Error('RCL_WEB_STATE_MISSING:'+path);return state[path]}
function evalExpr(expr, snapshot=state){
  if(!expr)return true;
  if(expr.kind==='literal')return expr.value;
  if(expr.kind==='path'){if(!Object.prototype.hasOwnProperty.call(snapshot,expr.path))throw new Error('RCL_WEB_STATE_MISSING:'+expr.path);return snapshot[expr.path]}
  if(expr.kind==='unary'){const v=evalExpr(expr.expression,snapshot);return expr.operator==='not'?!v:-v}
  if(expr.kind==='choose')return evalExpr(expr.args[0],snapshot)?evalExpr(expr.args[1],snapshot):evalExpr(expr.args[2],snapshot);
  const l=evalExpr(expr.left,snapshot);if(expr.operator==='and')return Boolean(l)&&Boolean(evalExpr(expr.right,snapshot));if(expr.operator==='or')return Boolean(l)||Boolean(evalExpr(expr.right,snapshot));const r=evalExpr(expr.right,snapshot);
  switch(expr.operator){case '+':return typeof l==='string'||typeof r==='string'?String(l)+String(r):l+r;case '-':return l-r;case '*':return l*r;case '/':return l/r;case '%':return l%r;case '==':return l===r;case '!=':return l!==r;case '<':return l<r;case '<=':return l<=r;case '>':return l>r;case '>=':return l>=r;default:throw new Error('RCL_WEB_OPERATOR:'+expr.operator)}
}
function scopeMatches(granted,required){return granted===required||required.startsWith(granted+'.')||granted==='*'}
function verifyAuthority(rule){for(const need of rule.needs){const ok=manifest.warrants.some(w=>w.subject===rule.actor&&w.capability===need.capability&&scopeMatches(w.target,need.target));if(!ok)throw new Error('RCL_WEB_AUTHORITY_DENIED:'+rule.name+':'+need.capability)}}
function realize(name){const rule=manifest.rules.find(r=>r.name===name);if(!rule)throw new Error('RCL_WEB_RULE_UNKNOWN:'+name);const before=structuredClone(state);if(!evalExpr(rule.when,before))return {status:'not-triggered',rule:name};verifyAuthority(rule);const proposed=structuredClone(before);for(const alter of rule.alters)proposed[alter.target]=evalExpr(alter.expression,before);for(const preserve of rule.preserves){if(!evalExpr(preserve,proposed))throw new Error('RCL_WEB_PRESERVE_FAILED:'+name)}Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,proposed);const receipt={status:'realized',rule:name,actor:rule.actor,witnesses:rule.witnesses,before,after:structuredClone(state)};history.push(receipt);render();return receipt}
function observe(path,value){if(!Object.prototype.hasOwnProperty.call(state,path))throw new Error('RCL_WEB_OBSERVE_UNKNOWN:'+path);const before=state[path];state[path]=value;history.push({status:'observed',path,before,after:value});render()}
function render(){document.querySelectorAll('[data-rcl-text]').forEach(el=>el.textContent=String(get(el.dataset.rclText)));document.querySelectorAll('[data-rcl-value]').forEach(el=>{const value=String(get(el.dataset.rclValue));if(el.value!==value)el.value=value});document.documentElement.dataset.rclState=JSON.stringify(state);document.documentElement.dataset.rclHistory=String(history.length)}
document.addEventListener('input',event=>{const path=event.target?.dataset?.rclObserve;if(path)observe(path,event.target.value)});
document.addEventListener('submit',event=>{const rule=event.target?.dataset?.rclRule;if(rule){event.preventDefault();realize(rule)}});
document.addEventListener('click',event=>{const target=event.target.closest('[data-rcl-rule],[data-rcl-navigate]');if(!target)return;if(target.dataset.rclRule){event.preventDefault();realize(target.dataset.rclRule)}if(target.dataset.rclNavigate){event.preventDefault();history.pushState({},'',target.dataset.rclNavigate);applyRoute()}});
function applyRoute(){const route=manifest.routes.find(r=>r.path===location.pathname)||manifest.routes[0];document.title=route?.title||manifest.metadata.title;document.body.dataset.route=route?.path||'/'}
addEventListener('popstate',applyRoute);
window.RCLWeb={manifest,state,history,projections,realize,observe,render};
render();applyRoute();
if(new URL(location.href).searchParams.get('rclTest')==='1'){
  queueMicrotask(()=>{let result={status:'PASS',checks:{}};try{const input=document.querySelector('[data-rcl-observe="app.todo_input"]');input.value='first';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form[data-rcl-rule="addTodo"]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));result.checks.add=state['app.todo_count']===1&&state['app.last_action']==='first'&&state['app.todo_input']==='';document.querySelector('[data-rcl-rule="resetTodos"]').click();result.checks.reset=state['app.todo_count']===0&&state['app.last_action']==='reset';result.checks.dom=document.querySelector('[data-rcl-text="app.todo_count"]').textContent==='0';result.checks.authority=history.some(x=>x.rule==='addTodo'&&x.actor==='user');if(!Object.values(result.checks).every(Boolean))result.status='FAIL'}catch(error){result={status:'FAIL',error:String(error),checks:result.checks}}const node=document.getElementById('rcl-test-result');node.textContent=JSON.stringify(result);node.dataset.status=result.status;document.documentElement.dataset.rclTest=result.status})}
})();`;
}

export function emitStandaloneRclWebHtml(manifest) {
  if (manifest.schema === RCL_NATIVE_UI_WEB_FORMAT) return emitNativeUiWebHtml(manifest);
  const lang = escapeHtml(manifest.metadata.language || 'en');
  const title = escapeHtml(manifest.metadata.title || manifest.program);
  const css = emitCss(manifest.styles);
  const body = emitNode(manifest.document);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body>${body}<output id="rcl-test-result" hidden></output><script>${runtimeScript(manifest)}</script></body></html>`;
}

function nodeServerRuntime(manifest, html) {
  const payload = JSON.stringify(manifest).replaceAll('</script', '<\\/script');
  const htmlPayload = JSON.stringify(html);
  return `import http from 'node:http';\nconst manifest=${payload};\nconst html=${htmlPayload};\nconst state=structuredClone(manifest.state);\nconst history=[];\nfunction evalExpr(expr,snapshot=state){if(!expr)return true;if(expr.kind==='literal')return expr.value;if(expr.kind==='path')return snapshot[expr.path];if(expr.kind==='unary'){const v=evalExpr(expr.expression,snapshot);return expr.operator==='not'?!v:-v}if(expr.kind==='choose')return evalExpr(expr.args[0],snapshot)?evalExpr(expr.args[1],snapshot):evalExpr(expr.args[2],snapshot);const l=evalExpr(expr.left,snapshot);if(expr.operator==='and')return Boolean(l)&&Boolean(evalExpr(expr.right,snapshot));if(expr.operator==='or')return Boolean(l)||Boolean(evalExpr(expr.right,snapshot));const r=evalExpr(expr.right,snapshot);switch(expr.operator){case '+':return typeof l==='string'||typeof r==='string'?String(l)+String(r):l+r;case '-':return l-r;case '*':return l*r;case '/':return l/r;case '%':return l%r;case '==':return l===r;case '!=':return l!==r;case '<':return l<r;case '<=':return l<=r;case '>':return l>r;case '>=':return l>=r;default:throw new Error('RCL_WEB_OPERATOR:'+expr.operator)}}\nfunction scopeMatches(g,r){return g===r||r.startsWith(g+'.')||g==='*'}\nfunction realize(name){const rule=manifest.rules.find(r=>r.name===name);if(!rule)throw new Error('RCL_WEB_RULE_UNKNOWN:'+name);const before=structuredClone(state);if(!evalExpr(rule.when,before))return {status:'not-triggered',rule:name,state:structuredClone(state)};for(const need of rule.needs){const ok=manifest.warrants.some(w=>w.subject===rule.actor&&w.capability===need.capability&&scopeMatches(w.target,need.target));if(!ok)throw new Error('RCL_WEB_AUTHORITY_DENIED:'+name+':'+need.capability)}const proposed=structuredClone(before);for(const alter of rule.alters)proposed[alter.target]=evalExpr(alter.expression,before);for(const preserve of rule.preserves)if(!evalExpr(preserve,proposed))throw new Error('RCL_WEB_PRESERVE_FAILED:'+name);Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,proposed);const receipt={status:'realized',rule:name,actor:rule.actor,witnesses:rule.witnesses,before,after:structuredClone(state)};history.push(receipt);return {...receipt,state:structuredClone(state)}}\nasync function json(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);if(chunks.length===0)return {};return JSON.parse(Buffer.concat(chunks).toString('utf8'))}\nfunction send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(body):body)}\nexport const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://rcl.local');if(req.method==='GET'&&url.pathname==='/')return send(res,200,html,'text/html; charset=utf-8');if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,{state,history});if(req.method==='POST'&&url.pathname==='/api/observe'){const body=await json(req);if(!Object.prototype.hasOwnProperty.call(state,body.path))return send(res,404,{error:'RCL_WEB_OBSERVE_UNKNOWN'});const before=state[body.path];state[body.path]=body.value;history.push({status:'observed',path:body.path,before,after:body.value});return send(res,200,{state,historyLength:history.length})}if(req.method==='POST'&&url.pathname.startsWith('/api/rule/')){const name=decodeURIComponent(url.pathname.slice('/api/rule/'.length));return send(res,200,realize(name))}return send(res,404,{error:'RCL_WEB_ROUTE_NOT_FOUND',path:url.pathname})}catch(error){return send(res,400,{error:String(error)})}});\nif(import.meta.url===new URL(process.argv[1],'file:').href){const port=Number(process.env.PORT||8787);server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({status:'LISTENING',port,program:manifest.program,manifestRoot:manifest.manifestRoot})))}\n`;
}

export function emitStandaloneRclWebServer(manifest, html = emitStandaloneRclWebHtml(manifest)) {
  if (manifest.schema === RCL_NATIVE_UI_WEB_FORMAT) return emitNativeUiWebServer(manifest, html);
  return nodeServerRuntime(manifest, html);
}

export function buildRclWebApplication({ rclPath, specPath, outputPath }) {
  const source = fs.readFileSync(rclPath, 'utf8');
  const spec = specPath ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : null;
  const manifest = compileRclWebApplication(source, spec);
  const html = emitStandaloneRclWebHtml(manifest);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
  const manifestPath = outputPath.replace(/\.html$/u, '.manifest.json');
  const serverPath = outputPath.replace(/\.html$/u, '.server.mjs');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(serverPath, emitStandaloneRclWebServer(manifest, html), 'utf8');
  return { outputPath, manifestPath, serverPath, htmlBytes: Buffer.byteLength(html), htmlSha256: sha256(html), manifest };
}

export { simulateNativeUiWebApplication, traceNativeUiWebApplication };
