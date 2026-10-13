import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {createRealitySession} from '../src/runtime.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealitySessionBytecode,compileRealityToBytecode} from '../src/bytecode.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),root=value=>semanticStateRootForAlgorithm(value,'rcl.semantic-state-root.v2');
const near=(a,b)=>assert.ok(Math.abs(a-b)<.000001,`${a} != ${b}`);
export function verifyRealtimeBinding(binding,contract){
  assert.equal(binding.context,'realtime-runtime');assert.equal(binding.os,'win32');assert.equal(binding.maxInFlight,1);
  for(const field of ['hardRealtimeClaimed','osInterruptGuaranteeClaimed','externalEffectsClaimed'])assert.equal(binding[field],false);
  assert.equal(binding.binary.path,'native/rclvm.exe');assert.deepEqual(binding.compilerBinary,contract.compilerBinary);
  assert.equal(binding.compilerArtifact.path,contract.compilerPath);assert.equal(binding.compilerArtifact.sha256,contract.compilerHash);
  for(const item of [binding.binary,binding.compilerBinary,binding.compilerArtifact])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  assert.equal(binding.clock.kind,'node.performance.now');assert.equal(binding.clock.nodeVersion,process.version);assert.equal(binding.clock.binaryPath,process.execPath);
  assert.equal(binding.clock.sha256,sha(fs.readFileSync(binding.clock.binaryPath)));assert.ok(Number.isFinite(binding.clock.timeOrigin));assert.ok(Number.isInteger(binding.clock.processPid)&&binding.clock.processPid>0);
  const controller=binding.controller,source=fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8');
  assert.equal(controller.sourcePath,contract.controllerSource.path);assert.equal(controller.sourceHash,contract.controllerSource.sha256);assert.equal(controller.sourceHash,sha(source));
  assert.equal(controller.programRoot,compileReality(source).programRoot);assert.equal(controller.bytecodeHash,sha(compileRealitySessionBytecode(source)));
  const compilerSource=['compiler-core.rcl','session-compiler-core.rcl','session-compiler-main.rcl'].map(file=>fs.readFileSync(path.join(ROOT,'selfhost',file),'utf8')).join('\n');
  assert.equal(controller.compilerEvidence.compilerOwner,'RCL');assert.equal(controller.compilerEvidence.compilerSourceHash,sha(compilerSource));
  assert.equal(controller.compilerEvidence.sourceHash,sha(source));assert.equal(controller.compilerEvidence.bytecodeRoot,controller.bytecodeHash);
  assert.equal(controller.compilerEvidence.targetByteParity,true);assert.equal(controller.compilerEvidence.referenceExecutionFallback,false);
  assert.equal(controller.daemonRoot,sha(fs.readFileSync(path.join(ROOT,'native/rclvmd.exe'))));
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'native/native-windows-manifest.json'),'utf8')),hash=createHash('sha256');
  for(const file of manifest.sources){hash.update(file);hash.update('\0');hash.update(fs.readFileSync(path.join(ROOT,file)));hash.update('\0');}
  assert.equal(hash.digest('hex'),manifest.sourceSha256);assert.equal(controller.daemonSourceRoot,manifest.sourceSha256);
}
function checkProcess(trace,success=true){
  assert.ok(Number.isInteger(trace.processPid)&&trace.processPid>0);assert.equal(trace.exitObserved,true);
  assert.ok(Number.isFinite(trace.started)&&Number.isFinite(trace.ended)&&trace.ended>=trace.started);
  for(const field of ['stdoutHash','stderrHash'])assert.match(trace[field],/^[0-9a-f]{64}$/u);
  if(success){assert.equal(trace.code,0);assert.equal(trace.signal,null);assert.equal(trace.stopReason,null);assert.equal(trace.stopSignalSent,false);}
  else{assert.equal(trace.stopSignalSent,true);assert.ok(Number.isFinite(trace.stopRequestedAt));assert.ok(trace.stopRequestedAt>=trace.started&&trace.ended>=trace.stopRequestedAt);}
}
export function verifyRealtimeRow(row,binding,value){
  const compile=row.compileTrace,trace=row.runtimeTrace;assert.ok(compile&&trace);
  assert.equal(compile.owner,'RCL_COMPILER_RBC_WINDOWS_NATIVE');assert.equal(compile.sourceHash,row.sourceHash);assert.equal(compile.artifactHash,row.artifactHash);
  assert.equal(compile.compilerHash,binding.compilerBinary.sha256);assert.equal(compile.compilerArtifactHash,binding.compilerArtifact.sha256);
  for(const field of ['sourceRoot','artifactHash'])assert.equal(trace[field],row[field]);assert.equal(trace.stateRoot,row.stateRoot??value?.stateRoot);
  checkSuccess(trace,binding);
}
function checkSuccess(trace,binding){
  assert.match(trace.nonce,/^[0-9a-f-]{36}$/u);assert.ok(Number.isInteger(trace.index)&&trace.index>0);
  for(const field of ['started','release','deadline','admittedAt','publishedAt'])assert.ok(Number.isFinite(trace[field]));
  assert.ok(trace.release>=trace.started&&trace.admittedAt>=trace.release&&trace.admittedAt<=trace.deadline);
  assert.ok(trace.publishedAt>=trace.nativeTrace.ended&&trace.publishedAt<=trace.deadline);checkProcess(trace.nativeTrace);
  assert.ok(trace.nativeTrace.started>=trace.admittedAt);assert.equal(trace.entry.status,'realized');assert.equal(trace.completion.status,'realized');
  assert.equal(trace.entry.transition.rule,'admit');assert.equal(trace.completion.transition.rule,'publish');assert.equal(trace.entry.transition.actor,'dispatcher');assert.equal(trace.completion.transition.actor,'publisher');
  assert.deepEqual(trace.entry.transition.authority.needs,[{capability:'job.dispatch',target:'job'}]);assert.deepEqual(trace.completion.transition.authority.needs,[{capability:'job.publish',target:'job'}]);
  assert.equal(trace.snapshot.native.processId,binding.controller.processId);assert.equal(trace.snapshot.native.sourceBound,true);
  assert.equal(trace.snapshot.stateRoot,root(trace.snapshot.state));assert.equal(trace.snapshot.state['job.root'],trace.sourceRoot);assert.equal(trace.snapshot.state['job.active'],false);
  assert.equal(trace.snapshot.state['job.admitted'],trace.snapshot.state['job.completed']+trace.snapshot.state['job.failed']);
  assert.equal(trace.ledgerRange.end,trace.ledgerRange.start+2);
}
export async function verifyRealtimeControl(backend,contract){
  const binding=backend.binding,source=fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8'),reference=createRealitySession(source),ledger=backend.controllerLedger;
  assert.ok(ledger.length>0);
  function snapshot(observed){
    assert.equal(observed.programRoot,binding.controller.programRoot);assert.deepEqual(observed.state,reference.snapshot().state);assert.equal(observed.stateRoot,reference.snapshot().stateRoot);
    assert.equal(observed.native.processId,binding.controller.processId);assert.equal(observed.native.daemonRoot,binding.controller.daemonRoot);
    assert.equal(observed.native.sourceRoot,binding.controller.daemonSourceRoot);assert.equal(observed.native.sourceBound,true);assert.equal(observed.native.stateRootsIndependentlyVerified,true);
  }
  for(const[index,item]of ledger.entries()){
    assert.equal(item.index,index);snapshot(item.before);let expected,failure;
    try{expected=await reference.invoke(item.command);}catch(caught){failure=caught;}
    if(failure){assert.equal(item.error?.code,failure.code);assert.equal(item.result,undefined);}else{assert.equal(item.error,undefined);assert.deepEqual(item.result,expected);}
    snapshot(item.after);
  }
  function boundSuccess(trace){
    checkSuccess(trace,binding);const first=ledger[trace.ledgerRange.start],last=ledger[trace.ledgerRange.end-1];assert.ok(first&&last);
    assert.equal(first.command.rule,'admit');assert.equal(last.command.rule,'publish');assert.equal(first.command.inputs['event.root'],trace.sourceRoot);
    assert.equal(first.command.inputs['event.now'],trace.admittedAt);assert.equal(first.command.inputs['event.release'],trace.release);assert.equal(first.command.inputs['event.deadline'],trace.deadline);
    assert.equal(last.command.inputs['event.now'],trace.publishedAt);assert.equal(last.command.inputs['event.cancelled'],false);
    assert.deepEqual(trace.entry,first.result);assert.deepEqual(trace.completion,last.result);assert.deepEqual(trace.snapshot,last.after);
  }
  const rows=[...backend.rounds,...backend.inputResults,...backend.trials,...backend.trials.flatMap(trial=>trial.semanticRepairCases),...backend.trials.filter(trial=>trial.broken.kind==='success').map(trial=>trial.broken)];
  for(const row of rows){boundSuccess(row.runtimeTrace);near(row.runtimeTrace.release-row.runtimeTrace.started,contract.runtimeOptions.notBeforeMs);near(row.runtimeTrace.deadline-row.runtimeTrace.started,contract.runtimeOptions.deadlineMs);}
  const control=backend.runtimeControl;assert.equal(control.status,'PASS');for(const key of ['backpressureRejected','sourceAuthorityDenied','timeReversalRejected'])assert.equal(control[key],true);
  for(const key of ['artifactHash','sourceRoot','stateRoot'])assert.equal(control[key],backend.rounds[0][key]);
  for(const trace of [control.releaseTrace,control.backpressureTrace,control.resumedTrace]){boundSuccess(trace);assert.equal(trace.stateRoot,control.stateRoot);}
  assert.ok(control.releaseTrace.timerCount>0);near(control.releaseTrace.release-control.releaseTrace.started,contract.controlOptions.releaseMs);
  const expired=control.expiredBeforeStart;assert.equal(expired.code,'RCL_REALTIME_NOT_RELEASED_OR_EXPIRED');assert.equal(expired.nativeTrace,undefined);near(expired.deadline-expired.started,contract.controlOptions.expiredDeadlineMs);
  assert.equal(ledger[expired.ledgerRange.start].result.status,'not-triggered');assert.equal(control.paused.code,'RCL_AUTHORITY_DENIED');assert.equal(control.paused.nativeTrace,undefined);
  assert.equal(ledger[control.paused.ledgerRange.start].error.code,'RCL_AUTHORITY_DENIED');assert.equal(control.reversal.status,'not-triggered');
  const reversal=ledger.find(item=>item.command.rule==='admit'&&item.command.inputs?.['event.now']===control.beforeReverse.state['clock.last']-1);assert.ok(reversal);
  assert.equal(reversal.before.stateRoot,reversal.after.stateRoot);
  const spin=fs.readFileSync(path.join(ROOT,contract.spinSource.path),'utf8');assert.equal(sha(spin),contract.spinSource.sha256);
  assert.equal(control.spinArtifactHash,sha(compileRealityToBytecode(spin)));assert.equal(control.spinSourceRoot,compileReality(spin).programRoot);
  for(const[kind,expectedCode]of [['timeout','RCL_REALTIME_DEADLINE_EXPIRED'],['cancelled','RCL_REALTIME_CANCELLED']]){
    const failure=control[kind];assert.equal(failure.code,expectedCode);assert.equal(failure.sourceRoot,control.spinSourceRoot);assert.equal(failure.artifactHash,control.spinArtifactHash);
    checkProcess(failure.nativeTrace,false);assert.equal(failure.nativeTrace.stopReason,expectedCode);assert.equal(failure.settlement.status,'realized');assert.equal(failure.settlement.transition.rule,'fail');
    const first=ledger[failure.ledgerRange.start],last=ledger[failure.ledgerRange.end-1];assert.deepEqual(failure.entry,first.result);assert.deepEqual(failure.settlement,last.result);assert.deepEqual(failure.snapshot,last.after);
    assert.equal(first.before.state['job.completed'],last.after.state['job.completed']);assert.equal(last.after.state['job.failed'],first.before.state['job.failed']+1);assert.equal(last.after.state['job.active'],false);
    if(kind==='timeout'){assert.ok(failure.nativeTrace.stopRequestedAt>=failure.deadline);near(failure.deadline-failure.started,contract.controlOptions.spinDeadlineMs);}
    else{assert.ok(control.cancellationRequestedAt>=failure.started);assert.ok(failure.nativeTrace.stopRequestedAt>=control.cancellationRequestedAt);}
  }
  assert.ok(control.heartbeat.length>0);for(let index=0;index<control.heartbeat.length;index++){assert.ok(control.heartbeat[index]>=control.timeout.started);if(index)assert.ok(control.heartbeat[index]>=control.heartbeat[index-1]);}
  assert.equal(new Set(backend.rounds.map(row=>row.runtimeTrace.nonce)).size,20);
}
