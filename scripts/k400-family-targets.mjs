import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPortableNativeTarget} from '../src/portable-native-vm.mjs';
import {createExecutionContextTarget} from '../src/execution-context-targets.mjs';
import {createJobContextTarget} from '../src/job-context-targets.mjs';
import {createPhaseContextTarget} from '../src/phase-context-targets.mjs';
import {checkPhaseTrace,verifyPhaseLedger} from './k400-phase-ledger.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const NATIVE_ENVIRONMENTS=['windows','wasm-vm','linux','android'];
export const CONTEXT_ENVIRONMENTS=['server','embedded-runtime','distributed-runtime'];
export const JOB_ENVIRONMENTS=['serverless','database','dataflow-runtime'];
export const PHASE_ENVIRONMENTS=['simulation-runtime','automation-runtime'];
export async function createFamilyTarget(environment){
  if(NATIVE_ENVIRONMENTS.includes(environment))return createPortableNativeTarget(environment);
  if(CONTEXT_ENVIRONMENTS.includes(environment))return createExecutionContextTarget(environment);
  if(JOB_ENVIRONMENTS.includes(environment))return createJobContextTarget(environment);
  if(PHASE_ENVIRONMENTS.includes(environment))return createPhaseContextTarget(environment);
  throw new Error('RCL_FAMILY_ENVIRONMENT_UNKNOWN:'+environment);
}
export function compilationTrace(environment,compilation){
  return environment==='serverless'?{handlerPid:compilation.handlerPid,terminationObserved:compilation.terminationObserved,
    processExited:compilation.processExited,request:compilation.request}:null;
}
export function executionTrace(target,execution){
  const environment=target.environment;
  if(NATIVE_ENVIRONMENTS.includes(environment))return null;
  if(environment==='server')return{transport:target.binding.transport,workerPid:target.binding.workerPid};
  if(environment==='embedded-runtime')return{instancePid:execution.instancePid,instanceRun:execution.instanceRun};
  if(environment==='distributed-runtime')return{replicaPids:execution.replicaPids,replicaExecutions:execution.replicaExecutions};
  if(environment==='serverless')return{handlerPid:execution.handlerPid,terminationObserved:execution.terminationObserved,processExited:execution.processExited,request:execution.request};
  if(environment==='database')return{runId:execution.runId,committed:execution.committed,sqlFunction:execution.sqlFunction,sqlInvocations:execution.sqlInvocations,sqliteVersion:execution.sqliteVersion};
  if(environment==='dataflow-runtime')return{threadId:execution.threadId,delivery:execution.delivery,stages:execution.stages,inputHash:execution.inputHash};
  if(PHASE_ENVIRONMENTS.includes(environment))return execution.controllerTrace;
  throw new Error('RCL_FAMILY_TRACE_UNKNOWN:'+environment);
}
export function verifyFamilyTrace(environment,trace){
  if(NATIVE_ENVIRONMENTS.includes(environment)){assert.equal(trace,null);return;}
  assert.ok(trace);
  if(environment==='server'){assert.equal(trace.transport,'HTTP_LOOPBACK_127_0_0_1');assert.ok(Number.isInteger(trace.workerPid)&&trace.workerPid>0);}
  else if(environment==='embedded-runtime'){assert.ok(Number.isInteger(trace.instancePid)&&trace.instancePid>0);assert.ok(Number.isInteger(trace.instanceRun)&&trace.instanceRun>0);}
  else if(environment==='distributed-runtime'){assert.equal(trace.replicaExecutions,2);assert.equal(trace.replicaPids.length,2);assert.equal(new Set(trace.replicaPids).size,2);assert.ok(trace.replicaPids.every(pid=>Number.isInteger(pid)&&pid>0));}
  else if(environment==='serverless'){assert.ok(Number.isInteger(trace.handlerPid)&&trace.handlerPid>0);assert.equal(trace.terminationObserved,true);assert.equal(trace.processExited,true);assert.ok(Number.isInteger(trace.request)&&trace.request>0);}
  else if(environment==='database'){assert.match(trace.runId,/^[0-9a-f-]{36}$/u);assert.equal(trace.committed,true);assert.equal(trace.sqlFunction,'rcl_execute');assert.equal(trace.sqlInvocations,1);assert.match(trace.sqliteVersion,/^3\.[0-9.]+$/u);}
  else if(environment==='dataflow-runtime'){assert.ok(Number.isInteger(trace.threadId)&&trace.threadId>0);assert.ok(Number.isInteger(trace.delivery)&&trace.delivery>0);assert.deepEqual(trace.stages,['source-binding','native-execution','receipt-sink']);assert.match(trace.inputHash,/^[0-9a-f]{64}$/u);}
  else if(PHASE_ENVIRONMENTS.includes(environment))checkPhaseTrace(environment,trace);
  else throw new Error('RCL_FAMILY_TRACE_UNKNOWN:'+environment);
}
export function verifyFamilyRowTrace(environment,item,binding){
  verifyFamilyTrace(environment,item.runtimeTrace);
  if(environment==='serverless'){verifyFamilyTrace(environment,item.compileTrace);assert.notEqual(item.compileTrace.handlerPid,item.runtimeTrace.handlerPid);assert.ok(item.compileTrace.request<item.runtimeTrace.request);}
  else assert.equal(item.compileTrace,null);
  if(environment==='server')assert.equal(item.runtimeTrace.workerPid,binding.workerPid);
  if(environment==='embedded-runtime')assert.ok(item.runtimeTrace.instanceRun>0);
  if(environment==='distributed-runtime')assert.deepEqual(item.runtimeTrace.replicaPids,binding.workerPids);
  if(environment==='database')assert.equal(item.runtimeTrace.sqliteVersion,binding.sqliteVersion);
  if(environment==='dataflow-runtime'){assert.equal(item.runtimeTrace.threadId,binding.threadId);assert.equal(item.runtimeTrace.inputHash,item.artifactHash);}
}
export function verifyFamilyBinding(environment,binding,compilerHash){
  const binary=environment==='wasm-vm'?'native/wasi/rclvm.wasm':['linux','android'].includes(environment)?'native/linux/rclvm':environment==='embedded-runtime'?'native/rclvmd.exe':'native/rclvm.exe';
  const compiler=['linux','android'].includes(environment)?'native/linux/rclc':'native/rclc.exe';
  assert.equal(binding.binary.path,binary);assert.equal(binding.compilerBinary.path,compiler);assert.equal(binding.compilerArtifact.sha256,compilerHash);
  for(const item of [binding.binary,binding.compilerBinary,binding.compilerArtifact])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  if(environment==='android'){assert.equal(binding.emulator,true);assert.equal(binding.physicalDeviceClaimed,false);assert.equal(binding.mobileUiClaimed,false);assert.equal(binding.arch,'x86_64');}
  else if(environment==='linux')assert.ok(/^Linux .* x86_64$/u.test(binding.identity));
  else if(environment==='wasm-vm'){assert.equal(binding.os,'WASI');assert.equal(binding.arch,'wasm32');assert.equal(binding.securitySandboxClaimed,false);}
  else assert.equal(binding.os,'win32');
  if(!NATIVE_ENVIRONMENTS.includes(environment))assert.equal(binding.context,environment);
  if(environment==='server'){assert.equal(binding.hostedDeploymentClaimed,false);assert.equal(binding.transport,'HTTP_LOOPBACK_127_0_0_1');}
  if(environment==='embedded-runtime'){assert.equal(binding.microcontrollerOrHardwareClaimed,false);assert.equal(binding.protocol,'RCL_NATIVE_DAEMON_C_ABI');}
  if(environment==='distributed-runtime'){assert.equal(binding.multiHostClaimed,false);assert.equal(binding.transport,'TWO_HTTP_LOOPBACK_WORKERS');assert.equal(new Set(binding.workerPids).size,2);}
  if(JOB_ENVIRONMENTS.includes(environment)){
    const host=binding.hostRuntime;assert.equal(host.nodeVersion,process.version);assert.equal(host.binaryPath,process.execPath);assert.equal(sha(fs.readFileSync(host.binaryPath)),host.sha256);
  }
  if(environment==='serverless'){assert.equal(binding.cloudFaasClaimed,false);assert.equal(binding.warmProcessReused,false);}
  if(environment==='database'){assert.equal(binding.engine,'SQLite');assert.equal(binding.opaqueSqlSemanticDelegation,false);}
  if(environment==='dataflow-runtime'){assert.equal(binding.maxInFlight,1);assert.equal(binding.externalStreamClaimed,false);}
  if(PHASE_ENVIRONMENTS.includes(environment)){assert.equal(binding.physicalTimeOrWorldClaimed,false);assert.equal(binding.externalToolEffectsClaimed,false);}
}
export async function acquireFamilyControl(target,artifact){
  const environment=target.environment;
  if(NATIVE_ENVIRONMENTS.includes(environment)){
    let wrongRootRejected=false;try{await target.execute(artifact.path,'0'.repeat(64));}catch(error){wrongRootRejected=/RCL_PORTABLE_SOURCE_ROOT_MISMATCH/u.test(error.message);}
    assert.equal(wrongRootRejected,true);const execution=await target.execute(artifact.path,artifact.sourceRoot);
    return{status:'PASS',wrongRootRejected,stateRoot:execution.result.stateRoot,artifactHash:artifact.artifactHash,sourceRoot:artifact.sourceRoot};
  }
  if(environment==='server'){
    const authorizationRejected=target.assertUnauthorizedRejected(),health=target.inspectHealth(),execution=await target.execute(artifact.path,artifact.sourceRoot);
    return{status:'PASS',authorizationRejected,workerPid:health.pid,stateRoot:execution.result.stateRoot,artifactHash:artifact.artifactHash,sourceRoot:artifact.sourceRoot};
  }
  if(environment==='embedded-runtime')return{...await target.verifyReset(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
  if(environment==='distributed-runtime')return target.verifyPeerRecovery(artifact.path,artifact.sourceRoot);
  if(environment==='serverless')return{...target.verifyColdStart(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
  if(environment==='database')return{...target.verifyRecovery(artifact.path,artifact.sourceRoot),rollback:target.verifyRollback(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
  if(environment==='dataflow-runtime')return{...await target.verifyBackpressure(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
  return{...await target.verifyContextGuard(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
}
export function verifyFamilyControls(environment,backend){
  const control=backend.runtimeControl,canonical=backend.rounds[0];assert.equal(control.status,'PASS');
  assert.equal(control.stateRoot,canonical.stateRoot);assert.equal(control.artifactHash,canonical.artifactHash);assert.equal(control.sourceRoot,canonical.sourceRoot);
  if(NATIVE_ENVIRONMENTS.includes(environment))assert.equal(control.wrongRootRejected,true);
  else if(environment==='server'){assert.equal(control.authorizationRejected,true);assert.equal(control.workerPid,backend.binding.workerPid);}
  else if(environment==='embedded-runtime'){assert.equal(control.sameInstance,true);assert.ok(Number.isInteger(control.instancePid)&&control.instancePid>0);assert.ok(Number.isInteger(control.firstRun)&&control.firstRun>0);assert.equal(control.nextRun,control.firstRun+1);}
  else if(environment==='distributed-runtime'){
    assert.equal(control.terminalObserved,true);assert.ok(Number.isInteger(control.lostPid)&&control.lostPid>0);assert.ok(Number.isInteger(control.newPid)&&control.newPid>0);assert.notEqual(control.lostPid,control.newPid);
    assert.ok(backend.binding.workerPids.includes(control.lostPid));assert.ok(!backend.binding.workerPids.includes(control.newPid));assert.deepEqual(control.replicaPids,[backend.binding.workerPids[0],control.newPid]);
  }else if(environment==='serverless'){
    assert.equal(control.freshHandlers,true);assert.equal(control.terminationObserved,true);assert.equal(control.processExited,true);assert.equal(control.handlerPids.length,2);assert.equal(new Set(control.handlerPids).size,2);assert.ok(control.handlerPids.every(pid=>Number.isInteger(pid)&&pid>0));
  }else if(environment==='database'){
    assert.equal(control.reopened,true);assert.notEqual(control.persistedRunId,control.replayRunId);for(const id of [control.persistedRunId,control.replayRunId])assert.match(id,/^[0-9a-f-]{36}$/u);
    assert.equal(control.rollback.status,'PASS');assert.equal(control.rollback.wrongRootRejected,true);assert.ok(Number.isInteger(control.rollback.before)&&control.rollback.before>0);assert.equal(control.rollback.before,control.rollback.after);assert.equal(control.rollback.sourceRoot,canonical.sourceRoot);
  }else if(environment==='dataflow-runtime'){assert.equal(control.backpressureRejected,true);assert.equal(control.threadId,backend.binding.threadId);assert.ok(Number.isInteger(control.delivery)&&control.delivery>0);}
  else{assert.equal(control.sourceAuthorityDenied,true);checkPhaseTrace(environment,control.controllerTrace);}
}
export async function verifyFamilyBackendTrace(environment,backend){
  if(environment==='embedded-runtime'){
    const traces=backend.rounds.map(item=>item.runtimeTrace);
    assert.equal(new Set(traces.map(trace=>trace.instancePid)).size,1);
    for(let index=1;index<traces.length;index++)assert.ok(traces[index].instanceRun>traces[index-1].instanceRun);
  }
  if(environment==='serverless')assert.equal(new Set(backend.rounds.map(item=>item.runtimeTrace.handlerPid)).size,backend.rounds.length);
  if(environment==='database')assert.equal(new Set(backend.rounds.map(item=>item.runtimeTrace.runId)).size,backend.rounds.length);
  if(PHASE_ENVIRONMENTS.includes(environment)){
    const rows=[...backend.rounds,...backend.inputResults,...backend.trials,...backend.trials.flatMap(item=>item.semanticRepairCases),...backend.trials.filter(item=>item.broken.kind==='success').map(item=>item.broken)];
    await verifyPhaseLedger(environment,backend,rows);
  }else assert.equal(backend.controllerLedger,null);
  verifyFamilyControls(environment,backend);
}
