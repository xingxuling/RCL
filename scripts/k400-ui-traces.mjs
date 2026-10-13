import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode,compileRealitySessionBytecode} from '../src/bytecode.mjs';
import {createRealitySession,runReality} from '../src/runtime.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {createNativeUiRuntime} from '../src/ui/ui-event.mjs';
import {collectUiNodes} from '../src/ui/ui-compiler.mjs';
import {compileNativeUiForExecution,lowerNativeUiEvent,projectNativeUiResult} from '../src/ui/native-event-lowering.mjs';
import {emitNativeUiBridgeHtml} from '../src/ui/native-web-bridge.mjs';
import {verifyCrdtBinding,verifyCrdtRowTrace,compilationTrace,executionTrace} from './k400-crdt-targets.mjs';
import {verifyFamilyBinding} from './k400-family-targets.mjs';
import {verifyRealtimeBinding,verifyRealtimeRow} from './k400-realtime-traces.mjs';
import {verifyGameBinding,verifyGameRow} from './k400-game-traces.mjs';
import {verifyScientificBinding,verifyScientificRow,bindScientificTrace} from './k400-scientific-traces.mjs';
import {verifyAiBinding,verifyAiRow,bindAiTrace} from './k400-ai-traces.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const root=s=>semanticStateRootForAlgorithm(s,'rcl.semantic-state-root.v2');
export const UI_TARGET_CONTRACTS={
  base:'examples/universal-stress/crdt/replicated-counter-contract.json',
  'realtime-runtime':'examples/universal-stress/realtime-native/algorithm-cli-contract.json',
  'game-runtime':'examples/universal-stress/game-native/algorithm-cli-contract.json',
  'scientific-runtime':'examples/universal-stress/scientific-native/statistics-contract.json',
  'ai-runtime':'examples/universal-stress/ai-native/model-forward-contract.json',
};
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
export function verifyUiTargetBinding(env,b,contract){
  if(env==='compiler-runtime'){verifyFamilyBinding('windows',b,contract.compilerHash);assert.equal(b.context,env);assert.equal(b.compilerWorkflowClaimed,true);return;}
  const validators={'realtime-runtime':verifyRealtimeBinding,'game-runtime':verifyGameBinding,'scientific-runtime':verifyScientificBinding,'ai-runtime':verifyAiBinding};
  const targetContract=read(UI_TARGET_CONTRACTS[env]??UI_TARGET_CONTRACTS.base);
  assert.equal(targetContract.compilerHash,contract.compilerHash);
  if(validators[env])validators[env](b,targetContract);else verifyCrdtBinding(env,b,targetContract);
}
export function uiRecordTrace(env,r){
  const key={'realtime-runtime':'realtime','game-runtime':'game','scientific-runtime':'scientific','ai-runtime':'ai'}[env];
  return{...r,stateRoot:r.nativeResult.stateRoot,compileTrace:key?r.compilation[key+'CompileTrace']:env==='compiler-runtime'?null:compilationTrace(env,r.compilation),
    runtimeTrace:key?r.runtime[key+'Trace']:env==='compiler-runtime'?null:executionTrace({environment:env,binding:{}},r.runtime)};
}
function recordTrace(env,r,b){
  const row=uiRecordTrace(env,r);if(env==='server')row.runtimeTrace={transport:b.transport,workerPid:b.workerPid};
  const verify={'realtime-runtime':verifyRealtimeRow,'game-runtime':verifyGameRow,'scientific-runtime':verifyScientificRow,'ai-runtime':verifyAiRow}[env];
  if(verify)verify(row,b,r.nativeResult);else if(env!=='compiler-runtime')verifyCrdtRowTrace(env,row,b,r.nativeResult);
  return row.runtimeTrace;
}
async function replayController(b,ledger){
  if(!b.controller){assert.equal(ledger,null);return;}
  // Invalid bytecode can be rejected before any controller command. Positive
  // UI records still require their complete nonempty, bound ledger ranges.
  assert.ok(Array.isArray(ledger));
  const c=b.controller,source=fs.readFileSync(path.join(ROOT,c.sourcePath),'utf8');
  assert.equal(c.sourceHash,sha(source));assert.equal(c.programRoot,compileReality(source).programRoot);assert.equal(c.bytecodeHash,sha(compileRealitySessionBytecode(source)));
  const donor=['compiler-core.rcl','session-compiler-core.rcl','session-compiler-main.rcl'].map(f=>fs.readFileSync(path.join(ROOT,'selfhost',f),'utf8')).join('\n');
  assert.equal(c.compilerEvidence.compilerOwner,'RCL');assert.equal(c.compilerEvidence.compilerSourceHash,sha(donor));assert.equal(c.compilerEvidence.sourceHash,c.sourceHash);assert.equal(c.compilerEvidence.bytecodeRoot,c.bytecodeHash);assert.equal(c.compilerEvidence.targetByteParity,true);assert.equal(c.compilerEvidence.referenceExecutionFallback,false);
  assert.equal(c.daemonRoot,sha(fs.readFileSync(path.join(ROOT,'native/rclvmd.exe'))));
  const manifest=read('native/native-windows-manifest.json'),h=createHash('sha256');for(const f of manifest.sources){h.update(f);h.update('\0');h.update(fs.readFileSync(path.join(ROOT,f)));h.update('\0');}assert.equal(h.digest('hex'),manifest.sourceSha256);assert.equal(c.daemonSourceRoot,manifest.sourceSha256);
  const reference=createRealitySession(source);
  function snapshot(s){assert.equal(s.programRoot,c.programRoot);assert.deepEqual(s.state,reference.snapshot().state);assert.equal(s.stateRoot,reference.snapshot().stateRoot);assert.equal(s.stateRootAlgorithm,'rcl.semantic-state-root.v2');assert.equal(s.native.processId,c.processId);assert.equal(s.native.daemonRoot,c.daemonRoot);assert.equal(s.native.sourceRoot,c.daemonSourceRoot);assert.equal(s.native.sourceBound,true);assert.equal(s.native.stateRootsIndependentlyVerified,true);}
  for(const[i,item]of ledger.entries()){assert.equal(item.index,i);assert.equal(item.reset,undefined);snapshot(item.before);let expected,failure;try{expected=await reference.invoke(item.command);}catch(e){failure=e;}
    if(failure){assert.equal(item.error?.code,failure.code);assert.equal(item.result,undefined);}else{assert.equal(item.error,undefined);assert.deepEqual(item.result,expected);}snapshot(item.after);}
}
function bindController(env,t,v,ledger,b){
  if(!b.controller)return;
  if(env==='scientific-runtime'){bindScientificTrace(t,v,ledger,b);return;}
  if(env==='ai-runtime'){bindAiTrace(t,v,ledger,b);return;}
  if(env==='rncs-runtime')t=t.controllerTrace;
  const first=ledger[t.ledgerRange.start],last=ledger[t.ledgerRange.end-1];assert.ok(first&&last);
  if(env==='game-runtime'){
    assert.equal(first.command.rule,'loadPlugin');assert.equal(first.command.inputs['event.source_root'],t.sourceRoot);assert.deepEqual(t.load,first.result);
    for(const[i,f]of t.frames.entries()){const item=ledger[t.ledgerRange.start+i+1];assert.deepEqual(f.before,item.before);assert.deepEqual(f.commit,item.result);assert.deepEqual(f.snapshot,item.after);assert.equal(item.command.inputs['event.result_root'],v.stateRoot);assert.equal(item.command.inputs['event.frame'],i+1);}return;
  }
  assert.deepEqual(t.entry,first.result);assert.deepEqual(t.completion,last.result);assert.deepEqual(t.snapshot,last.after);
  assert.equal(first.command.inputs['event.root'],env==='rncs-runtime'?v.sourceRoot:t.sourceRoot??v.sourceRoot);
  if(env==='simulation-runtime'){assert.equal(first.command.rule,'advance');assert.equal(first.command.mode,'foresee');assert.deepEqual(first.command.inputs,last.command.inputs);}
  else{assert.equal(first.command.rule,'admit');assert.equal(last.command.rule,env==='realtime-runtime'?'publish':'finish');}
  if(env==='realtime-runtime'){assert.equal(first.command.inputs['event.now'],t.admittedAt);assert.equal(first.command.inputs['event.release'],t.release);assert.equal(first.command.inputs['event.deadline'],t.deadline);assert.equal(last.command.inputs['event.now'],t.publishedAt);}
}
export async function verifyUiControllerLedger(env,b,ledger){await replayController(b,ledger);}
const nativeCache=new Map();
async function expectedNative(source){let value=nativeCache.get(source);if(!value){value=await runReality(source,{stateRootAlgorithm:'rcl.semantic-state-root.v2'});nativeCache.set(source,value);}return value;}
function png(screenshot,width){const b=Buffer.from(screenshot.base64,'base64');assert.equal(b.toString('base64'),screenshot.base64);assert.equal(sha(b),screenshot.sha256);assert.deepEqual([...b.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(b.readUInt32BE(16),width);assert.ok(b.readUInt32BE(20)>0);}
export function uiFlowSemanticKey(flow){return JSON.stringify([flow.initial,...flow.steps].map(o=>({state:o.snapshot.state,derived:o.snapshot.derived,rendered:o.snapshot.rendered})));}
export async function verifyUiFlow(flow,source,contract,{expectedSource=source,controls=false,driverBinding=null}={}){
  assert.equal(flow.format,'rcl.k400-ui-flow.v1');assert.equal(flow.status,'PASS_FLOW');assert.ok(contract.environments.includes(flow.environment));assert.equal(flow.transport,'ACTUAL_HTTP_LOOPBACK');assert.match(flow.url,/^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/u);assert.deepEqual(flow.logs,[]);
  const ui=compileNativeUiForExecution(source),oracle=createNativeUiRuntime(compileNativeUiForExecution(expectedSource));
  assert.equal(flow.uiRoot,ui.semanticRoot);assert.equal(flow.htmlHash,sha(flow.html));const token=/const token="([0-9a-f-]{36})";/u.exec(flow.html)?.[1];assert.ok(token);assert.equal(flow.html,emitNativeUiBridgeHtml(ui,token));
  if(driverBinding)assert.deepEqual(flow.driverBinding,driverBinding);else{const d=flow.driverBinding;assert.equal(d.browserPlugin,'ABSENT');assert.equal(d.fallbackReason,'Browser plugin not available');assert.equal(sha(fs.readFileSync(d.browser.binaryPath)),d.browser.sha256);assert.equal(sha(fs.readFileSync(d.driver.path)),d.driver.sha256);assert.ok(d.browser.pid>0);assert.match(d.browser.version,/^[0-9]+\./u);assert.match(d.browser.userAgent,/HeadlessChrome\//u);assert.match(d.driver.version,/^[0-9]+\./u);}
  verifyUiTargetBinding(flow.environment,flow.targetBinding,contract);await replayController(flow.targetBinding,flow.controllerLedger);
  assert.equal(flow.records.length,5);assert.equal(flow.steps.length,4);let before=null;
  const observations=[flow.initial,...flow.steps];
  for(const[i,r]of flow.records.entries()){
    const event=i?contract.events[i-1]:null,lowered=lowerNativeUiEvent(source,{state:before,event});
    assert.equal(r.index,i);assert.deepEqual(r.event,event);assert.equal(r.authorized,true);assert.equal(r.uiRoot,ui.semanticRoot);assert.equal(r.uiSourceHash,sha(source));assert.deepEqual(r.beforeState,lowered.beforeState);assert.equal(r.beforeStateRoot,lowered.beforeStateRoot);
    assert.equal(r.source,lowered.source);assert.equal(r.sourceHash,sha(r.source));assert.equal(r.sourceRoot,compileReality(r.source).programRoot);assert.equal(r.artifactHash,sha(compileRealityToBytecode(r.source)));
    const native=await expectedNative(r.source);assert.equal(r.nativeResult.sourceRoot,r.sourceRoot);assert.equal(r.nativeResult.stateRootAlgorithm,'rcl.semantic-state-root.v2');assert.equal(r.nativeResult.stateRoot,root(r.nativeResult.state));assert.deepEqual(r.nativeResult.state,native.state);
    assert.deepEqual(r.nativeResult.history,native.history);assert.deepEqual(r.nativeResult.projections,native.projections);
    assert.deepEqual(r.projection,projectNativeUiResult(lowered,r.nativeResult));assert.equal(r.projection.stateRoot,root(r.projection.state));
    if(event)oracle.dispatch(event.nodeId,event.type,event.payload);const expected=oracle.projection(event?.payload??{});
    assert.deepEqual({state:r.projection.state,derived:r.projection.derived,rendered:r.projection.rendered},expected,'UI reference/native semantics');
    const o=observations[i];assert.deepEqual(o.snapshot,{...r.projection,revision:i});assert.equal(o.ready,true);assert.equal(o.error,null);assert.equal(o.title,ui.id);
    assert.deepEqual(Object.keys(o.rendered),collectUiNodes(ui.viewTree).map(n=>n.id));
    for(const n of collectUiNodes(ui.viewTree)){const observed=o.rendered[n.id];assert.equal(observed.role,n.role);assert.ok(observed.rect.width>0&&observed.rect.height>0);for(const[k,v]of Object.entries(r.projection.rendered[n.id]))if(['value','label'].includes(k))assert.equal(observed.text,String(v));}
    for(const metric of ['compileMs','executeMs','totalMs'])assert.ok(Number.isFinite(r[metric])&&r[metric]>=0);assert.equal(r.compilation.ms,r.compileMs);assert.equal(r.runtime.ms,r.executeMs);
    bindController(flow.environment,recordTrace(flow.environment,r,flow.targetBinding),r.nativeResult,flow.controllerLedger,flow.targetBinding);before=r.projection.state;
  }
  assert.equal(flow.requests.filter(r=>r.method==='POST'&&r.status===200).length,4);assert.ok(flow.requests.some(r=>r.path==='/api/state'&&r.status===200));
  if(controls){const c=flow.control;assert.ok(c);assert.equal(c.unauthorized.status,403);assert.equal(c.unauthorized.payload.code,'UI_TRANSPORT_UNAUTHORIZED');assert.equal(c.stale.status,409);assert.equal(c.stale.payload.code,'RCL_UI_NATIVE_STALE_STATE');assert.equal(c.unknown.status,400);assert.equal(c.unknown.payload.code,'RCL_UI_NATIVE_EVENT_UNKNOWN');assert.equal(c.denied.status,400);assert.equal(c.denied.payload.code,'RCL_AUTHORITY_DENIED');
    assert.deepEqual(c.before,observations[4].snapshot);assert.deepEqual(c.afterRejected,c.before);assert.deepEqual(c.reloaded.snapshot,c.before);assert.deepEqual(c.mobile.snapshot,c.before);assert.equal(c.failureReceipts.length,1);
    const f=c.failureReceipts[0],denied=lowerNativeUiEvent(source,{state:before,event:contract.events[0],authorized:false});assert.equal(f.authorized,false);assert.deepEqual(f.event,contract.events[0]);assert.deepEqual(f.beforeState,before);assert.equal(f.beforeStateRoot,root(before));assert.equal(f.source,denied.source);assert.equal(f.sourceHash,sha(f.source));assert.equal(f.sourceRoot,compileReality(f.source).programRoot);assert.equal(f.artifactHash,sha(compileRealityToBytecode(f.source)));assert.equal(f.code,'RCL_AUTHORITY_DENIED');assert.match(f.diagnostic,/RCL_AUTHORITY_DENIED/u);
    await assert.rejects(()=>runReality(denied.source),e=>e.code==='RCL_AUTHORITY_DENIED');
    for(const[id,label]of [['IncrementButton','增加计数'],['ResetButton','重置计数']]){const r=c.mobile.rendered[id];assert.equal(r.role,'action');assert.equal(r.label,label);assert.ok(r.rect.height>=contract.browserPolicy.minimumActionHeight);assert.ok(r.rect.x>=0&&r.rect.x+r.rect.width<=414);}
    assert.equal(c.mobile.rendered.CounterText.text,before.count===undefined?'':'计数：'+before.count);png(c.screenshot,414);png(c.desktopScreenshot,1100);
    for(const[status,code]of [[403,'UI_TRANSPORT_UNAUTHORIZED'],[409,'RCL_UI_NATIVE_STALE_STATE'],[400,'RCL_UI_NATIVE_EVENT_UNKNOWN'],[400,'RCL_AUTHORITY_DENIED']])assert.equal(flow.requests.filter(r=>r.status===status&&r.code===code).length,1);
  }else assert.equal(flow.control,undefined);
  return true;
}
