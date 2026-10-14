// ADAPT of scripts/k400-selfhost-dataflow-transport.mjs at SHA256 7bfb952beaf65b068fed5c85a129745aa33bd2b5afaeab3efd5bd4879f481615; source-bound native RCL admission for compiler and VM jobs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {verifyControllerLedger} from './k400-selfhost-phase-ledger.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyPhaseTransport(report,contract){
  const b=report.binding,s=b.service;assert.ok(contract.environments.includes(report.environment));assert.equal(b.environment,report.environment);assert.deepEqual(b.runtime,contract.runtimeArtifacts.find(r=>r.environment===report.environment));assert.equal(b.compilerLocation,'COMPILER_STAGE_NATIVE_C_ABI');assert.equal(b.executionOwner,'RCL_CONTROLLED_NATIVE_COMPILER_AND_VM');
  for(const key of ['referenceCompilationUsed','referenceExecutionUsed','securitySandboxClaimed','externalStreamClaimed','multiHostClaimed'])assert.equal(b[key],false);
  assert.equal(s.owner,'RCL_COMPLETE_COMPILER_DATAFLOW');assert.equal(s.environment,'dataflow-runtime');assert.equal(s.session,b.session);assert.equal(s.maxInFlight,1);assert.ok(s.hostPid>0);assert.deepEqual(s.stages.map(p=>p.role),['compile','execute']);
  const compiler=s.stages[0],execution=s.stages[1];assert.notEqual(compiler.threadId,execution.threadId);for(const p of s.stages){assert.ok(p.threadId>0);assert.equal(p.session,b.session);assert.equal(p.hostPid,s.hostPid);}
  assert.deepEqual(compiler.compiler.binary,b.runtime.compiler);assert.deepEqual(execution.vm,b.runtime.vm);assert.equal(compiler.vm,null);assert.equal(execution.compiler,null);
  for(const key of ['referenceCompilationUsed','referenceExecutionUsed','securitySandboxClaimed','externalStreamClaimed','multiHostClaimed'])assert.equal(s[key],false);
  for(const f of [b.runtime.compiler,b.runtime.vm,s.worker,...compiler.compiler.sourceBindings])assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256);assert.equal(sha(fs.readFileSync(s.hostRuntime.path)),s.hostRuntime.sha256);
  const ready=JSON.parse(compiler.compiler.readyReply);assert.equal(ready.status,'ready');assert.equal(ready.protocol,'RCL_COMPILER_ABI_FILES_V1');assert.equal(ready.pid,compiler.compiler.pid);assert.equal(ready.token,compiler.compiler.token);
  const sequences={compile:0,execute:0};let nativeRequests=0;
  function stage(t,role,operation){const peer=role==='compile'?compiler:execution;assert.equal(t.role,role);assert.equal(t.operation,operation);assert.equal(t.session,b.session);assert.equal(t.threadId,peer.threadId);assert.equal(t.hostPid,s.hostPid);assert.equal(t.sequence,++sequences[role]);assert.equal(t.id,t.sequence);assert.match(t.flowId,/^[0-9a-f-]{36}$/u);}
  const c=report.runtimeControl;
  for(const t of report.ledger){
    if(!t.phaseTrace.nativeCalled){assert.equal(t.stageTrace,undefined);assert.equal(t.replyObserved,undefined);continue;}
    const st=t.stageTrace;stage(st,t.kind,t.kind);assert.equal(st.nativeCalled,true);assert.equal(st.inputHash,t.kind==='compile'?t.inputCompilerHash:t.artifactHash);assert.equal(st.sourceHash,t.sourceHash);assert.equal(st.sourceRoot,t.sourceRoot);assert.equal(t.index,report.ledger.indexOf(t));assert.equal(t.session,b.session);assert.equal(t.environment,report.environment);assert.equal(t.replyObserved,true);assert.equal(t.stdoutHash,sha(t.stdout));
    if(t.kind==='compile'){
      const n=t.nativeCompilerTrace,m=n.metrics;assert.deepEqual(n,st.nativeCompilerTrace);assert.equal(t.pid,compiler.compiler.pid);assert.equal(m.pid,t.pid);assert.equal(m.token,compiler.compiler.token);assert.equal(m.request,++nativeRequests);assert.deepEqual(m,JSON.parse(n.replyLine));assert.equal(t.stdout,n.replyLine);assert.equal(n.compilerHash,t.inputCompilerHash);assert.equal(n.sourceHash,t.sourceHash);assert.equal(t.sourceHash,sha(t.source));assert.equal(st.fromCompile,null);
      const frame=n.frame.split('\t');assert.equal(frame.length,4);assert.equal(frame[0],'COMPILE');assert.equal(frame[1],t.inputCompilerHash+'.rbc');assert.equal(frame[2],t.sourceHash+'.rcl');assert.match(frame[3],/^[0-9a-f-]{36}\.rbc$/u);
      if(t.error){assert.equal(t.status,1);assert.equal(m.status,'error');}else{assert.equal(t.status,0);assert.equal(m.status,'ok');assert.equal(m.outputState,'compiler.output');assert.equal(m.instructionBudget,300000000);assert.equal(m.bytes,t.outputBytes);assert.equal(n.artifactHash,t.outputHash);assert.equal(st.outputHash,t.outputHash);assert.equal(st.outputBytes,t.outputBytes);assert.equal(n.nativePid,t.pid);assert.equal(n.contextToken,compiler.compiler.token);}
    }else{
      const n=t.nativeExecutionTrace;assert.deepEqual(n,st.nativeExecutionTrace);assert.equal(n.pid,t.pid);assert.ok(t.pid>0);assert.equal(n.status,0);assert.equal(n.signal,null);assert.equal(n.stdout,t.stdout);assert.equal(n.stdoutHash,sha(n.stdout));assert.equal(n.stderrHash,sha(n.stderr));assert.equal(path.normalize(n.command),path.join(b.acquisitionRoot,b.runtime.vm.path));assert.equal(n.args.length,1);assert.equal(path.basename(n.args[0]),t.artifactHash+'.rbc');assert.equal(path.dirname(path.dirname(n.args[0])),path.resolve(os.tmpdir()));assert.ok(path.basename(path.dirname(n.args[0])).startsWith('rcl-compiler-flow-'));
      assert.deepEqual(t.result,verifyNativeSemanticStateRoot(JSON.parse(n.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'}));
      assert.equal(st.fromCompile,null);
    }
  }
  const gens=report.generations.map(g=>report.ledger[g.trace]);assert.equal(new Set(gens.map(t=>t.pid)).size,1);assert.equal(new Set(gens.map(t=>t.metrics.instance)).size,1);assert.equal(c.backpressure.rejected,true);assert.equal(c.backpressure.message,'RCLC_PHASE_BACKPRESSURE');
  const recovered=report.ledger[c.recovery],first=report.ledger[c.first],next=report.ledger[c.next];assert.equal(recovered.outputHash,contract.compilerHash);assert.ok(recovered.index>report.negativeControls.corruptCompiler);assert.deepEqual(first.result,next.result);
  assert.deepEqual(report.shutdown.graph.shutdown.map(t=>t.role),['compile','execute']);for(const t of report.shutdown.graph.shutdown)stage(t,t.role,'shutdown');const compilerExit=report.shutdown.graph.shutdown[0].compilerExit;assert.deepEqual(compilerExit,{code:0,signal:null,pid:compiler.compiler.pid});assert.equal(report.shutdown.graph.shutdown[1].compilerExit,null);
  assert.deepEqual(report.shutdown.graph.exits,[{role:'compile',threadId:compiler.threadId,code:0},{role:'execute',threadId:execution.threadId,code:0}]);
  const expected=report.ledger.filter(t=>t.kind==='execute'&&t.phaseTrace.nativeCalled).map(t=>({kind:'execute',pid:t.pid,code:0,signal:null,artifactHash:t.artifactHash}));expected.push({...compilerExit,kind:'compile'},...report.shutdown.graph.exits.map(e=>({...e,kind:'stage-worker'})));assert.deepEqual(report.nativeExits,expected);
  await verifyControllerLedger(report.environment,report);
  verifyPhaseOperations(report,contract);
}
function verifyPhaseOperations(report,contract){
  const b=report.binding,clock=report.environment==='simulation-runtime',ledger=report.controllerLedger,c=report.runtimeControl,pinned=contract.controllerArtifacts.find(p=>p.environment===report.environment),used=new Set();let operation=0;
  for(const key of ['sourcePath','sourceHash','bytecodeHash','programRoot','daemonRoot','daemonSourceRoot'])assert.equal(b.controller[key],pinned[key]);
  assert.equal(b.compileRootKind,'SHA256_SOURCE_BYTES');assert.equal(b.executeRootKind,'RCL_PROGRAM_ROOT');assert.equal(b.physicalTimeOrWorldClaimed,false);assert.equal(b.externalToolEffectsClaimed,false);
  for(const row of report.ledger){
    const trace=row.phaseTrace,range=trace.ledgerRange;assert.equal(trace.kind,row.kind);assert.equal(trace.root,row.kind==='compile'?row.sourceHash:row.sourceRoot);assert.ok(Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.start>=0&&range.end>range.start&&range.end<=ledger.length);
    const items=ledger.slice(range.start,range.end);for(let i=range.start;i<range.end;i++){assert.ok(!used.has(i));used.add(i);}assert.deepEqual(trace.before,items[0].before);assert.deepEqual(trace.snapshot,items.at(-1).after);
    const entry=items[0];assert.equal(entry.command.inputs['event.root'],trace.root);assert.equal(entry.command.rule,clock?'advance':'admit');
    if(clock){assert.equal(entry.command.mode,'foresee');assert.equal(entry.command.inputs['event.time'],trace.before.state['world.time']+1);}else assert.equal(entry.command.mode,undefined);
    if(!trace.nativeCalled){assert.equal(row.status,1);assert.equal(row.error.code,'RCL_AUTHORITY_DENIED');assert.equal(items.length,1);assert.equal(entry.error.code,'RCL_AUTHORITY_DENIED');assert.equal(trace.entry,null);assert.equal(trace.completion,null);assert.equal(trace.settlement,null);assert.equal(trace.snapshot.stateRoot,trace.before.stateRoot);continue;}
    assert.deepEqual(trace.entry,entry.result);assert.equal(entry.result.status,clock?'projected':'realized');
    if(row.error){assert.equal(row.status,1);assert.equal(trace.completion,null);if(clock){assert.equal(items.length,1);assert.equal(trace.settlement,null);assert.equal(trace.snapshot.stateRoot,trace.before.stateRoot);}else{assert.equal(items.length,2);assert.equal(items[1].command.rule,'finish');assert.equal(items[1].command.inputs['event.success'],false);assert.deepEqual(trace.settlement,items[1].result);assert.equal(trace.settlement.status,'realized');assert.equal(trace.snapshot.state['pipeline.failed'],trace.before.state['pipeline.failed']+1);assert.equal(trace.snapshot.state['pipeline.completed'],trace.before.state['pipeline.completed']);}}
    else{assert.equal(row.status,0);assert.equal(items.length,2);assert.equal(trace.operation,++operation);const done=items[1];assert.deepEqual(trace.completion,done.result);assert.equal(done.result.status,'realized');if(clock){assert.equal(done.command.rule,'advance');assert.equal(done.command.mode,undefined);assert.deepEqual(done.command.inputs,entry.command.inputs);assert.equal(entry.result.transition.afterRoot,done.result.transition.afterRoot);assert.equal(trace.snapshot.state['world.lastRoot'],trace.root);assert.equal(trace.snapshot.state['world.frames'],trace.before.state['world.frames']+1);}else{assert.equal(done.command.rule,'finish');assert.equal(done.command.inputs['event.success'],true);assert.equal(trace.snapshot.state['pipeline.completed'],trace.before.state['pipeline.completed']+1);assert.equal(trace.snapshot.state['pipeline.lastRoot'],trace.root);}}
    if(!clock){assert.equal(trace.snapshot.state['pipeline.active'],false);assert.equal(trace.snapshot.state['pipeline.admitted'],trace.snapshot.state['pipeline.completed']+trace.snapshot.state['pipeline.failed']);}
  }
  assert.equal(c.deniedOutputPublished,false);assert.equal(report.ledger[c.deniedCompile].kind,'compile');assert.equal(report.ledger[c.deniedExecute].kind,'execute');for(const index of [c.deniedCompile,c.deniedExecute])assert.equal(report.ledger[index].phaseTrace.snapshot.stateRoot,c.pausedStateRoot);
  const guard=ledger.slice(c.guardRange.start,c.guardRange.end);assert.equal(guard.length,4);assert.equal(guard[0].command.rule,'pause');assert.equal(guard[0].result.status,'realized');assert.equal(guard[0].after.stateRoot,c.pausedStateRoot);assert.equal(guard[3].command.rule,'resume');assert.equal(guard[3].result.status,'realized');for(const offset of [0,3]){const index=c.guardRange.start+offset;assert.ok(!used.has(index));used.add(index);}for(const offset of [1,2])assert.equal(guard[offset].error.code,'RCL_AUTHORITY_DENIED');
  if(clock){const r=c.reversal,item=ledger[r.index];assert.ok(!used.has(r.index));used.add(r.index);assert.deepEqual(r.before,item.before);assert.deepEqual(r.after,item.after);assert.deepEqual(r.result,item.result);assert.equal(item.command.rule,'advance');assert.equal(item.command.inputs['event.time'],item.before.state['world.time']-1);assert.equal(item.result.status,'not-triggered');assert.equal(item.before.stateRoot,item.after.stateRoot);}else assert.equal(c.reversal,null);
  assert.equal(used.size,ledger.length);assert.deepEqual(report.shutdown.controller,{pid:b.controller.processId,terminationObserved:true,exitCode:'UNAVAILABLE_FROM_REUSED_SESSION_API'});
}
