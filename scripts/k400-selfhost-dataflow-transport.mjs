import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyDataflowTransport(report,contract){
  const b=report.binding,s=b.service;assert.equal(report.environment,'dataflow-runtime');assert.equal(b.environment,'dataflow-runtime');assert.deepEqual(b.runtime,contract.runtimeArtifacts[0]);assert.equal(b.compilerLocation,'COMPILER_STAGE_NATIVE_C_ABI');assert.equal(b.executionOwner,'COMPILER_TO_VM_WORKER_GRAPH');
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
    if(t.index===c.recovery){const rejected=c.inputRejection;assert.equal(rejected.status,'PASS');stage(rejected.stageTrace,'compile','compile');assert.equal(rejected.stageTrace.nativeCalled,false);assert.equal(rejected.stageTrace.nativeCompilerTrace,undefined);assert.equal(rejected.stageTrace.inputHash,contract.compilerHash);assert.equal(rejected.stageTrace.sourceHash,'0'.repeat(64));}
    const st=t.stageTrace;stage(st,t.kind,t.kind);assert.equal(st.nativeCalled,true);assert.equal(st.inputHash,t.kind==='compile'?t.inputCompilerHash:t.artifactHash);assert.equal(st.sourceHash,t.sourceHash);assert.equal(st.sourceRoot,t.sourceRoot);assert.equal(t.index,report.ledger.indexOf(t));assert.equal(t.session,b.session);assert.equal(t.environment,'dataflow-runtime');assert.equal(t.replyObserved,true);assert.equal(t.stdoutHash,sha(t.stdout));
    if(t.kind==='compile'){
      const n=t.nativeCompilerTrace,m=n.metrics;assert.deepEqual(n,st.nativeCompilerTrace);assert.equal(t.pid,compiler.compiler.pid);assert.equal(m.pid,t.pid);assert.equal(m.token,compiler.compiler.token);assert.equal(m.request,++nativeRequests);assert.deepEqual(m,JSON.parse(n.replyLine));assert.equal(t.stdout,n.replyLine);assert.equal(n.compilerHash,t.inputCompilerHash);assert.equal(n.sourceHash,t.sourceHash);assert.equal(t.sourceHash,sha(t.source));assert.equal(st.fromCompile,null);
      const frame=n.frame.split('\t');assert.equal(frame.length,4);assert.equal(frame[0],'COMPILE');assert.equal(frame[1],t.inputCompilerHash+'.rbc');assert.equal(frame[2],t.sourceHash+'.rcl');assert.match(frame[3],/^[0-9a-f-]{36}\.rbc$/u);
      if(t.error){assert.equal(t.status,1);assert.equal(m.status,'error');}else{assert.equal(t.status,0);assert.equal(m.status,'ok');assert.equal(m.outputState,'compiler.output');assert.equal(m.instructionBudget,300000000);assert.equal(m.bytes,t.outputBytes);assert.equal(n.artifactHash,t.outputHash);assert.equal(st.outputHash,t.outputHash);assert.equal(st.outputBytes,t.outputBytes);assert.equal(n.nativePid,t.pid);assert.equal(n.contextToken,compiler.compiler.token);}
    }else{
      const n=t.nativeExecutionTrace;assert.deepEqual(n,st.nativeExecutionTrace);assert.equal(n.pid,t.pid);assert.ok(t.pid>0);assert.equal(n.status,0);assert.equal(n.signal,null);assert.equal(n.stdout,t.stdout);assert.equal(n.stdoutHash,sha(n.stdout));assert.equal(n.stderrHash,sha(n.stderr));assert.equal(path.normalize(n.command),path.join(b.acquisitionRoot,b.runtime.vm.path));assert.equal(n.args.length,1);assert.equal(path.basename(n.args[0]),t.artifactHash+'.rbc');assert.equal(path.dirname(path.dirname(n.args[0])),path.resolve(os.tmpdir()));assert.ok(path.basename(path.dirname(n.args[0])).startsWith('rcl-compiler-flow-'));
      assert.deepEqual(t.result,verifyNativeSemanticStateRoot(JSON.parse(n.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'}));
      if(st.fromCompile){const p=report.ledger.find(v=>v.kind==='compile'&&v.stageTrace.id===st.fromCompile.id);assert.ok(p&&p.index<t.index);assert.equal(p.stageTrace.flowId,st.flowId);assert.deepEqual(st.fromCompile,{flowId:st.flowId,threadId:compiler.threadId,id:p.stageTrace.id,artifactHash:p.outputHash});assert.equal(t.artifactHash,p.outputHash);}
    }
  }
  for(const pair of [...report.inputResults.map(r=>[r.compileTrace,r.executeTrace]),...report.trials.map(r=>[r.brokenCompile,r.brokenExecute])]){const compiled=report.ledger[pair[0]],executed=report.ledger[pair[1]];assert.equal(executed.stageTrace.flowId,compiled.stageTrace.flowId);assert.equal(executed.stageTrace.fromCompile.id,compiled.stageTrace.id);assert.equal(executed.stageTrace.fromCompile.artifactHash,compiled.outputHash);}
  const gens=report.generations.map(g=>report.ledger[g.trace]);assert.equal(new Set(gens.map(t=>t.pid)).size,1);assert.equal(new Set(gens.map(t=>t.metrics.instance)).size,1);assert.equal(c.backpressure.rejected,true);assert.equal(c.backpressure.message,'RCLC_FLOW_BACKPRESSURE');
  const recovered=report.ledger[c.recovery],first=report.ledger[c.first],next=report.ledger[c.next];assert.equal(recovered.outputHash,contract.compilerHash);assert.ok(recovered.index>report.negativeControls.corruptCompiler);assert.deepEqual(first.result,next.result);
  assert.deepEqual(report.shutdown.shutdown.map(t=>t.role),['compile','execute']);for(const t of report.shutdown.shutdown)stage(t,t.role,'shutdown');const compilerExit=report.shutdown.shutdown[0].compilerExit;assert.deepEqual(compilerExit,{code:0,signal:null,pid:compiler.compiler.pid});assert.equal(report.shutdown.shutdown[1].compilerExit,null);
  assert.deepEqual(report.shutdown.exits,[{role:'compile',threadId:compiler.threadId,code:0},{role:'execute',threadId:execution.threadId,code:0}]);
  const expected=report.ledger.filter(t=>t.kind==='execute').map(t=>({kind:'execute',pid:t.pid,code:0,signal:null,artifactHash:t.artifactHash}));expected.push({...compilerExit,kind:'compile'},...report.shutdown.exits.map(e=>({...e,kind:'stage-worker'})));assert.deepEqual(report.nativeExits,expected);
}
