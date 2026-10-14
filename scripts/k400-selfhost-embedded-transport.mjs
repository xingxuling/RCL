import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyEmbeddedTransport(report,contract){
  const b=report.binding;assert.equal(report.environment,'embedded-runtime');assert.equal(b.environment,report.environment);
  assert.equal(b.compilerLocation,'CALLER_OWNED_RESIDENT_NATIVE_C_ABI');assert.equal(b.executionOwner,'CALLER_OWNED_NATIVE_VM_C_ABI');
  assert.equal(b.referenceCompilationUsed,false);assert.equal(b.referenceExecutionUsed,false);assert.equal(b.securitySandboxClaimed,false);
  assert.equal(b.microcontrollerOrHardwareClaimed,false);assert.equal(b.protocol,'RUN_RESET');
  assert.equal(b.compiler.owner,'RCL_NATIVE_COMPILER_C_ABI');assert.equal(b.compiler.protocol,'RCL_COMPILER_ABI_FILES_V1');
  const ready=JSON.parse(b.compiler.readyReply);assert.equal(ready.status,'ready');assert.equal(ready.protocol,b.compiler.protocol);assert.equal(ready.pid,b.compiler.pid);assert.equal(ready.token,b.compiler.token);
  assert.deepEqual(b.runtime,contract.runtimeArtifacts[0]);assert.deepEqual(b.compiler.binary,b.runtime.compiler);
  for(const f of [b.runtime.compiler,b.runtime.vm,...b.compiler.sourceBindings])assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256);
  let previousRequest=0;
  for(const t of report.ledger){
    assert.equal(t.index,report.ledger.indexOf(t));assert.equal(t.session,b.session);assert.equal(t.environment,report.environment);
    assert.match(t.nonce,/^[0-9a-f-]{36}$/u);assert.ok(t.ms>=0);assert.equal(t.replyObserved,true);assert.equal(t.stdoutHash,sha(t.stdout));
    if(t.kind==='compile'){
      const c=t.nativeCompilerTrace,m=c.metrics;assert.ok(c);assert.equal(t.pid,b.compiler.pid);assert.equal(m.pid,t.pid);assert.equal(m.token,b.compiler.token);
      assert.equal(m.request,++previousRequest);assert.deepEqual(m,JSON.parse(c.replyLine));assert.equal(t.stdout,c.replyLine);
      assert.equal(c.compilerHash,t.inputCompilerHash);assert.equal(c.sourceHash,t.sourceHash);assert.equal(t.sourceHash,sha(t.source));
      const names=c.frame.split('\t');assert.equal(names.length,4);assert.equal(names[0],'COMPILE');assert.equal(names[1],t.inputCompilerHash+'.rbc');assert.equal(names[2],t.sourceHash+'.rcl');assert.match(names[3],/^[0-9a-f-]{36}\.rbc$/u);
      if(t.error){assert.equal(t.status,1);assert.equal(m.status,'error');}
      else{assert.equal(t.status,0);assert.equal(m.status,'ok');assert.equal(m.outputState,'compiler.output');assert.equal(m.instructionBudget,300000000);assert.equal(m.bytes,t.outputBytes);assert.equal(c.artifactHash,t.outputHash);assert.equal(c.nativePid,t.pid);assert.equal(c.contextToken,b.compiler.token);assert.equal(c.instance,m.instance);assert.equal(c.request,m.request);}
    }else{
      assert.equal(t.kind,'execute');const v=t.nativeVmTrace;assert.equal(t.status,0);assert.equal(v.pid,t.pid);assert.ok(Number.isInteger(t.pid)&&t.pid>0);assert.equal(JSON.parse(v.readyReply).status,'ready');
      assert.equal(v.command,'RUN_RESET');assert.equal(v.artifactHash,t.artifactHash);assert.equal(t.stdout,v.replyLine);assert.deepEqual(verifyNativeSemanticStateRoot(JSON.parse(v.replyLine).result,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'}),t.result);assert.ok(Number.isInteger(v.run)&&v.run>0);
    }
  }
  const generations=report.generations.map(g=>report.ledger[g.trace]);assert.equal(new Set(generations.map(t=>t.pid)).size,1);assert.equal(new Set(generations.map(t=>t.nativeCompilerTrace.metrics.instance)).size,1);
  const control=report.runtimeControl;assert.ok(control);
  const recovery=report.ledger[control.recovery],first=report.ledger[control.first],next=report.ledger[control.next];
  assert.equal(recovery.inputCompilerHash,contract.compilerHash);assert.equal(recovery.outputHash,contract.compilerHash);assert.ok(recovery.index>report.negativeControls.corruptCompiler);
  assert.equal(first.kind,'execute');assert.equal(next.kind,'execute');assert.equal(first.pid,next.pid);assert.deepEqual(first.result,next.result);assert.equal(next.nativeVmTrace.run,first.nativeVmTrace.run+1);
  assert.ok(report.nativeExits.length>1);assert.equal(new Set(report.nativeExits.map(e=>e.pid)).size,report.nativeExits.length);
  for(const e of report.nativeExits){assert.equal(e.code,0);assert.equal(e.signal,null);assert.ok(Number.isInteger(e.pid)&&e.pid>0);}
  assert.equal(report.nativeExits.filter(e=>e.kind==='compile').length,1);assert.equal(report.nativeExits.find(e=>e.kind==='compile').pid,b.compiler.pid);
  for(const t of report.ledger.filter(t=>t.kind==='execute'))assert.ok(report.nativeExits.some(e=>e.kind==='execute'&&e.pid===t.pid&&e.artifactHash===t.artifactHash));
}
