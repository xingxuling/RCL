import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRealitySession} from '../src/runtime.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealitySessionBytecode} from '../src/bytecode.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
import {CONTROL_SOURCES} from './k400-phase-definitions.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=state=>semanticStateRootForAlgorithm(state,'rcl.semantic-state-root.v2');

export function checkPhaseTrace(environment,trace){
  assert.ok(Number.isInteger(trace?.processId)&&trace.processId>0);assert.match(trace.programRoot,/^[0-9a-f]{64}$/u);
  assert.ok(Number.isInteger(trace.execution)&&trace.execution>0);assert.equal(trace.ledgerRange.end,trace.ledgerRange.start+2);
  assert.equal(trace.entry.status,environment==='simulation-runtime'?'projected':'realized');assert.equal(trace.completion.status,'realized');
  assert.equal(trace.snapshot.stateRoot,root(trace.snapshot.state));assert.equal(trace.snapshot.native.sourceBound,true);
}
export async function verifyPhaseLedger(environment,backend,rows){
  const binding=backend.binding.controller,source=fs.readFileSync(path.join(ROOT,CONTROL_SOURCES[environment]),'utf8');
  assert.equal(binding.sourcePath,CONTROL_SOURCES[environment]);assert.equal(binding.sourceHash,sha(source));
  assert.equal(binding.programRoot,compileReality(source).programRoot);assert.equal(binding.bytecodeHash,sha(compileRealitySessionBytecode(source)));
  const compilerSource=['compiler-core.rcl','session-compiler-core.rcl','session-compiler-main.rcl'].map(file=>fs.readFileSync(path.join(ROOT,'selfhost',file),'utf8')).join('\n');
  assert.equal(binding.compilerEvidence.compilerOwner,'RCL');assert.equal(binding.compilerEvidence.compilerSourceHash,sha(compilerSource));
  assert.equal(binding.compilerEvidence.sourceHash,sha(source));assert.equal(binding.compilerEvidence.bytecodeRoot,binding.bytecodeHash);
  assert.equal(binding.compilerEvidence.targetByteParity,true);assert.equal(binding.compilerEvidence.referenceExecutionFallback,false);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'native/native-windows-manifest.json'),'utf8'));
  const hash=createHash('sha256');for(const file of manifest.sources){hash.update(file);hash.update('\0');hash.update(fs.readFileSync(path.join(ROOT,file)));hash.update('\0');}
  assert.equal(hash.digest('hex'),manifest.sourceSha256);assert.equal(binding.daemonSourceRoot,manifest.sourceSha256);
  assert.equal(binding.daemonRoot,sha(fs.readFileSync(path.join(ROOT,'native/rclvmd.exe'))));
  const reference=createRealitySession(source),ledger=backend.controllerLedger;assert.ok(ledger.length>0);
  function snapshot(observed){
    const expected=reference.snapshot();assert.equal(observed.programRoot,binding.programRoot);assert.deepEqual(observed.state,expected.state);
    assert.equal(observed.stateRoot,expected.stateRoot);assert.equal(observed.stateRootAlgorithm,'rcl.semantic-state-root.v2');
    assert.equal(observed.native.processId,binding.processId);assert.equal(observed.native.daemonRoot,binding.daemonRoot);
    assert.equal(observed.native.sourceRoot,binding.daemonSourceRoot);assert.equal(observed.native.sourceBound,true);
    assert.equal(observed.native.stateRootsIndependentlyVerified,true);
  }
  for(const[index,item]of ledger.entries()){
    assert.equal(item.index,index);snapshot(item.before);let expected,error;
    try{expected=await reference.invoke(item.command);}catch(caught){error=caught;}
    if(error){assert.equal(item.error?.code,error.code);assert.equal(item.result,undefined);}
    else{assert.equal(item.error,undefined);assert.deepEqual(item.result,expected);}
    snapshot(item.after);
  }
  function traceRow(row){
    const trace=row.runtimeTrace;checkPhaseTrace(environment,trace);assert.equal(trace.processId,binding.processId);assert.equal(trace.programRoot,binding.programRoot);
    const entry=ledger[trace.ledgerRange.start],completion=ledger[trace.ledgerRange.end-1];assert.ok(entry&&completion);
    assert.deepEqual(trace.entry,entry.result);assert.deepEqual(trace.completion,completion.result);assert.deepEqual(trace.snapshot,completion.after);
    assert.equal(entry.command.inputs['event.root'],row.sourceRoot);
    if(environment==='simulation-runtime'){
      assert.equal(entry.command.rule,'advance');assert.equal(entry.command.mode,'foresee');assert.equal(completion.command.rule,'advance');
      assert.equal(trace.entry.transition.afterRoot,trace.completion.transition.afterRoot);assert.deepEqual(entry.command.inputs,completion.command.inputs);
      assert.equal(trace.snapshot.state['world.lastRoot'],row.sourceRoot);
    }else{
      assert.equal(entry.command.rule,'admit');assert.equal(completion.command.rule,'finish');assert.equal(completion.command.inputs['event.success'],true);
      assert.equal(trace.snapshot.state['pipeline.lastRoot'],row.sourceRoot);assert.equal(trace.snapshot.state['pipeline.active'],false);
      assert.equal(trace.snapshot.state['pipeline.admitted'],trace.snapshot.state['pipeline.completed']+trace.snapshot.state['pipeline.failed']);
    }
  }
  for(const row of rows)traceRow(row);
  const control=backend.runtimeControl;assert.equal(control.status,'PASS');assert.equal(control.sourceAuthorityDenied,true);
  assert.equal(control.stateRoot,backend.rounds[0].stateRoot);assert.equal(control.sourceRoot,backend.rounds[0].sourceRoot);
  assert.equal(control.artifactHash,backend.rounds[0].artifactHash);traceRow({...control,runtimeTrace:control.controllerTrace});
  const guard=ledger.slice(control.guardRange.start,control.guardRange.end),clock=environment==='simulation-runtime';
  assert.equal(guard.length,clock?6:5);
  if(clock){assert.equal(control.timeReversalRejected,true);assert.equal(guard[0].result.status,'not-triggered');assert.equal(guard[0].before.stateRoot,guard[0].after.stateRoot);}
  else assert.equal(control.timeReversalRejected,null);
  const offset=clock?1:0;assert.equal(guard[offset].command.rule,'pause');assert.equal(guard[offset].after.stateRoot,control.pausedStateRoot);
  assert.equal(guard[offset+1].error.code,'RCL_AUTHORITY_DENIED');assert.equal(guard[offset+1].before.stateRoot,control.pausedStateRoot);
  assert.equal(guard[offset+1].after.stateRoot,control.pausedStateRoot);assert.equal(guard[offset+2].command.rule,'resume');
}
