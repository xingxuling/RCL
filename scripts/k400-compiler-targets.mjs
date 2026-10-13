import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {createPortableCompilerTarget} from '../src/portable-compiler-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
import {runReplicatedCounterNetwork} from '../src/replicated-counter-network.mjs';
import {verifyCounterNetwork} from './k400-crdt-network-verifier.mjs';
import {runReality} from '../src/runtime.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),valueOf=r=>({state:r.state,stateRoot:r.stateRoot,history:r.history??[],projections:r.projections??[]});
export const PHASE_ENVIRONMENTS=[];
export function createFamilyTarget(environment){assert.equal(environment,'compiler-runtime');return createPortableCompilerTarget();}
export const compilationTrace=(_env,c)=>c.compilerCompileTrace;
export const executionTrace=(_target,e)=>e.compilerTrace;
export function verifyFamilyTrace(environment,t){
  assert.equal(environment,'compiler-runtime');assert.ok(['compile','execute'].includes(t.kind));assert.match(t.nonce,/^[0-9a-f-]{36}$/u);assert.match(t.session,/^[0-9a-f-]{36}$/u);
  const p=t.process;assert.ok(Number.isInteger(p.pid)&&p.pid>0);assert.equal(p.exitObserved,true);assert.equal(p.signal,null);assert.ok(Number.isFinite(p.started)&&Number.isFinite(p.ended)&&p.ended>=p.started);assert.equal(p.stdoutHash,sha(t.stdout));assert.equal(p.stderrHash,sha(t.stderr));assert.ok(Number.isInteger(t.index)&&t.index>=0);
}
export function verifyFamilyBinding(environment,b,compilerHash){
  assert.equal(environment,'compiler-runtime');assert.equal(b.context,environment);assert.equal(b.runtimeOwner,'RCL_COMPILER_PIPELINE');assert.equal(b.os,'win32');assert.equal(b.arch,'x64');for(const field of ['referenceCompilationUsed','referenceExecutionUsed','externalEffectsClaimed','securitySandboxClaimed'])assert.equal(b[field],false);assert.match(b.session,/^[0-9a-f-]{36}$/u);
  assert.equal(b.binary.path,'native/rclvm.exe');assert.equal(b.compilerBinary.path,'native/rclc.exe');assert.equal(b.compilerArtifact.path,'selfhost/compiler.rbc');assert.equal(b.compilerArtifact.sha256,compilerHash);for(const item of [b.binary,b.compilerBinary,b.compilerArtifact])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
}
function compileRecord(t,b){
  verifyFamilyTrace('compiler-runtime',t);assert.equal(t.session,b.session);assert.equal(t.kind,'compile');assert.equal(t.process.status,0);assert.equal(t.compilerHash,b.compilerBinary.sha256);assert.equal(t.compilerArtifactHash,b.compilerArtifact.sha256);assert.equal(t.sourceHash,sha(t.source));assert.equal(t.artifactHash,sha(compileRealityToBytecode(t.source)));
  assert.deepEqual(t.metrics,JSON.parse(t.stdout));assert.equal(t.metrics.status,'ok');assert.equal(t.metrics.outputState,'compiler.output');assert.equal(t.metrics.bytes,t.byteLength);assert.equal(t.byteLength,compileRealityToBytecode(t.source).length);for(const metric of ['executedInstructions','instructionBudget','peakStackDepth','peakCallFrames'])assert.ok(Number.isInteger(t.metrics[metric])&&t.metrics[metric]>0);assert.ok(t.metrics.executedInstructions<=t.metrics.instructionBudget);
}
function executeRecord(t,b){
  verifyFamilyTrace('compiler-runtime',t);assert.equal(t.session,b.session);assert.equal(t.kind,'execute');assert.equal(t.process.status,0);const r=verifyNativeSemanticStateRoot(JSON.parse(t.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});assert.equal(t.sourceRoot,r.sourceRoot);assert.equal(t.stateRoot,r.stateRoot);assert.deepEqual(t.value,valueOf(r));return r;
}
export function verifyFamilyRowTrace(environment,row,b){
  assert.equal(environment,'compiler-runtime');const c=row.compileTrace,t=row.runtimeTrace;compileRecord(c,b);const result=executeRecord(t,b);assert.equal(t.rejection,undefined);assert.equal(t.expectedSourceRoot,row.sourceRoot);assert.equal(c.sourceHash,row.sourceHash);assert.equal(c.artifactHash,row.artifactHash);assert.equal(t.artifactHash,row.artifactHash);assert.equal(result.sourceRoot,row.sourceRoot);assert.equal(result.stateRoot,row.stateRoot);assert.ok(c.index<t.index);assert.notEqual(c.process.pid,t.process.pid);
}
export async function acquireFamilyControl(target,a){
  let rejected=false;try{await target.execute(a.path,'0'.repeat(64));}catch(e){rejected=e.message==='RCL_PORTABLE_SOURCE_ROOT_MISMATCH';}assert.equal(rejected,true);const e=await target.execute(a.path,a.sourceRoot);
  return{status:'PASS',wrongRootRejected:rejected,sourceRoot:a.sourceRoot,artifactHash:a.artifactHash,stateRoot:e.result.stateRoot,trace:e.compilerTrace};
}
export function verifyFamilyControls(environment,backend){const c=backend.runtimeControl;assert.equal(environment,'compiler-runtime');assert.equal(c.status,'PASS');assert.equal(c.wrongRootRejected,true);for(const key of ['sourceRoot','artifactHash','stateRoot'])assert.equal(c[key],backend.rounds[0][key]);executeRecord(c.trace,backend.binding);assert.equal(c.trace.sourceRoot,c.sourceRoot);assert.equal(c.trace.stateRoot,c.stateRoot);}
export async function verifyCompilerLedger(binding,ledger){
  assert.ok(Array.isArray(ledger)&&ledger.length>0);const nonces=new Set();for(const[i,t]of ledger.entries()){assert.equal(t.index,i);assert.equal(t.session,binding.session);verifyFamilyTrace('compiler-runtime',t);assert.ok(!nonces.has(t.nonce));nonces.add(t.nonce);
    if(t.process.status!==0){
      if(t.kind==='compile'){assert.equal(t.sourceHash,sha(t.source));assert.match(t.stderr,/RCL_SEMANTIC_ASSERT: reality at/u);}
      else if(t.artifactHash===sha(Buffer.from('RCLB')))assert.match(t.stderr,/RCL_NATIVE_TRUNCATED/u);
      else{const compiled=ledger.slice(0,i).reverse().find(c=>c.kind==='compile'&&c.process.status===0&&c.artifactHash===t.artifactHash);assert.ok(compiled);assert.equal(t.expectedSourceRoot,compileReality(compiled.source).programRoot);const code=/"code"\s*:\s*"([A-Z0-9_]+)"/u.exec(t.stderr)?.[1];assert.ok(['RCL_AUTHORITY_DENIED','RCL_REALITY_BOUND_BROKEN'].includes(code));await assert.rejects(()=>runReality(compiled.source),e=>e.code===code);}
      continue;
    }
    if(t.kind==='compile')compileRecord(t,binding);else{const r=executeRecord(t,binding);if(t.rejection){assert.equal(t.rejection,'RCL_PORTABLE_SOURCE_ROOT_MISMATCH');assert.equal(t.expectedSourceRoot,'0'.repeat(64));assert.notEqual(r.sourceRoot,t.expectedSourceRoot);}else assert.equal(r.sourceRoot,t.expectedSourceRoot);}
  }
}
function bindRowToLedger(row,ledger){for(const trace of [row.compileTrace,row.runtimeTrace])assert.deepEqual(trace,ledger[trace.index]);}
export async function verifyFamilyBackendTrace(environment,backend){
  assert.equal(backend.controllerLedger,null);await verifyCompilerLedger(backend.binding,backend.compilerLedger);
  const rows=[...backend.rounds,...backend.inputResults,...backend.trials,...backend.trials.flatMap(t=>t.semanticRepairCases),...backend.trials.filter(t=>t.broken.kind==='success').map(t=>t.broken)];for(const row of rows)bindRowToLedger(row,backend.compilerLedger);
  assert.deepEqual(backend.runtimeControl.trace,backend.compilerLedger[backend.runtimeControl.trace.index]);assert.ok(backend.compilerLedger.some(t=>t.rejection==='RCL_PORTABLE_SOURCE_ROOT_MISMATCH'));verifyFamilyControls(environment,backend);
}
export async function acquireCompilerNetwork(source){
  const targets=[];const network=await runReplicatedCounterNetwork({source,factory:()=>{const t=createPortableCompilerTarget();targets.push(t);return t;}});return{...network,pipelineLedgers:targets.map(t=>t.pipelineLedger())};
}
export async function verifyCompilerNetwork(network,contract,source,oracle){
  assert.equal(new Set(network.nodeBindings.map(b=>b.session)).size,3);assert.equal(network.pipelineLedgers.length,3);for(let i=0;i<3;i++){verifyFamilyBinding('compiler-runtime',network.nodeBindings[i],contract.compilerHash);await verifyCompilerLedger(network.nodeBindings[i],network.pipelineLedgers[i]);}
  await verifyCounterNetwork('compiler-runtime',network,source,oracle,(row,b,value)=>{
    assert.equal(row.compileTrace,null);assert.equal(row.runtimeTrace,null);const index=network.nodeBindings.indexOf(b),ledger=network.pipelineLedgers[index];const compiled=ledger.find(t=>t.kind==='compile'&&t.sourceHash===row.sourceHash&&t.artifactHash===row.artifactHash);assert.ok(compiled);compileRecord(compiled,b);
    const executed=ledger.find(t=>t.kind==='execute'&&t.artifactHash===row.artifactHash&&t.sourceRoot===row.sourceRoot&&t.stateRoot===value.stateRoot);assert.ok(executed);executeRecord(executed,b);assert.deepEqual(executed.value,valueOf(value));
  });
}
