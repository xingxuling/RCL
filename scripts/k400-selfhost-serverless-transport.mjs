import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyColdTransport(report,contract){
  const b=report.binding;assert.equal(report.environment,'serverless');assert.equal(b.environment,'serverless');assert.deepEqual(b.runtime,contract.runtimeArtifacts[0]);
  assert.equal(b.compilerLocation,'FRESH_HTTP_HANDLER_NATIVE_C_ABI');assert.equal(b.executionOwner,'FRESH_HTTP_HANDLER_NATIVE_VM_PROCESS');
  for(const key of ['referenceCompilationUsed','referenceExecutionUsed','cloudDeploymentClaimed','securitySandboxClaimed'])assert.equal(b[key],false);
  assert.equal(b.service.owner,'RCL_COLD_COMPILER_HTTP');assert.equal(b.service.environment,'serverless');assert.equal(b.service.transport,'FRESH_AUTHENTICATED_HTTP_LOOPBACK');
  assert.equal(b.service.warmReuse,false);assert.deepEqual(b.service.compiler,b.runtime.compiler);assert.deepEqual(b.service.vm,b.runtime.vm);
  for(const key of ['referenceCompilationUsed','referenceExecutionUsed','cloudDeploymentClaimed','securitySandboxClaimed'])assert.equal(b.service[key],false);
  let sequence=0;const invocations=[],ids=new Set(),tokens=new Set();
  function cold(c){
    assert.equal(c.format,'rcl.cold-compiler-invocation.v1');assert.match(c.id,/^[0-9a-f-]{36}$/u);assert.equal(c.sequence,++sequence);assert.equal(c.exitObservedBeforeResult,true);assert.ok(c.ms>0);
    assert.ok(!ids.has(c.id));ids.add(c.id);const s=c.service;assert.equal(s.owner,'RCL_RESIDENT_COMPILER_HTTP');assert.equal(s.transport,'AUTHENTICATED_HTTP_LOOPBACK');assert.match(s.endpoint,/^http:\/\/127\.0\.0\.1:[0-9]+$/u);assert.ok(s.serverPid>0);
    assert.deepEqual(s.compiler.binary,b.runtime.compiler);assert.deepEqual(s.vm,b.runtime.vm);assert.equal(s.compiler.owner,'RCL_NATIVE_COMPILER_C_ABI');
    for(const key of ['referenceCompilationUsed','referenceExecutionUsed','hostedDeploymentClaimed','securitySandboxClaimed'])assert.equal(s[key],false);
    const ready=JSON.parse(s.compiler.readyReply);assert.equal(ready.status,'ready');assert.equal(ready.pid,s.compiler.pid);assert.equal(ready.token,s.compiler.token);assert.equal(ready.protocol,'RCL_COMPILER_ABI_FILES_V1');
    assert.match(s.compiler.token,/^[0-9a-f-]{36}$/u);assert.ok(!tokens.has(s.compiler.token));tokens.add(s.compiler.token);
    for(const f of [b.runtime.compiler,b.runtime.vm,s.worker,...s.compiler.sourceBindings])assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256);
    assert.equal(sha(fs.readFileSync(s.hostRuntime.path)),s.hostRuntime.sha256);
    assert.equal(c.exit.pid,s.serverPid);assert.equal(c.exit.code,0);assert.equal(c.exit.signal,null);
    assert.equal(c.exit.compilerExit.pid,s.compiler.pid);assert.equal(c.exit.compilerExit.code,0);assert.equal(c.exit.compilerExit.signal,null);invocations.push(c);return s;
  }
  function http(h,s,route,status){assert.equal(h.route,route);assert.equal(h.status,status);assert.equal(h.reply.serverPid,s.serverPid);assert.equal(h.replyHash,sha(JSON.stringify(h.reply)));if(status===200&&route!=='/health'){assert.equal(h.reply.requestHash,h.requestHash);assert.match(h.reply.requestId,/^[0-9a-f-]{36}$/u);assert.equal(h.reply.requestSequence,1);}}
  const denied=report.runtimeControl.denied;
  for(const t of report.ledger){
    // The authority control runs between the two negative controls and recovery.
    if(t.index===report.runtimeControl.recovery){const s=cold(denied.coldInvocation);http(denied.unauthorized,s,'/health',403);assert.equal(denied.unauthorized.reply.code,'RCLC_HTTP_AUTHORITY_DENIED');assert.deepEqual(denied.before.reply,denied.after.reply);http(denied.before.trace,s,'/health',200);http(denied.after.trace,s,'/health',200);const {worker,endpoint,hostRuntime,...workerBinding}=s;assert.deepEqual(denied.before.reply.binding,workerBinding);}
    const s=cold(t.coldInvocation);assert.equal(t.index,report.ledger.indexOf(t));assert.equal(t.session,b.session);assert.equal(t.environment,'serverless');assert.equal(t.replyObserved,true);assert.match(t.nonce,/^[0-9a-f-]{36}$/u);assert.equal(t.stdoutHash,sha(t.stdout));http(t.httpTrace,s,t.kind==='compile'?'/compile':'/execute',t.error?400:200);
    if(t.kind==='compile'){
      const c=t.nativeCompilerTrace,m=c.metrics;assert.equal(t.pid,s.compiler.pid);assert.equal(m.pid,t.pid);assert.equal(m.token,s.compiler.token);assert.equal(m.request,1);
      assert.deepEqual(m,JSON.parse(c.replyLine));assert.deepEqual(c,t.httpTrace.reply.nativeCompilerTrace);assert.equal(t.stdout,c.replyLine);assert.equal(c.compilerHash,t.inputCompilerHash);assert.equal(c.sourceHash,t.sourceHash);assert.equal(t.sourceHash,sha(t.source));
      const names=c.frame.split('\t');assert.equal(names.length,4);assert.equal(names[0],'COMPILE');assert.equal(names[1],t.inputCompilerHash+'.rbc');assert.equal(names[2],t.sourceHash+'.rcl');assert.match(names[3],/^[0-9a-f-]{36}\.rbc$/u);
      if(t.error){assert.equal(t.status,1);assert.equal(m.status,'error');}else{assert.equal(t.status,0);assert.equal(m.status,'ok');assert.equal(m.outputState,'compiler.output');assert.equal(m.instructionBudget,300000000);assert.equal(m.bytes,t.outputBytes);assert.equal(c.artifactHash,t.outputHash);assert.equal(sha(Buffer.from(t.httpTrace.reply.bytecodeBase64,'base64')),t.outputHash);assert.equal(c.instance,m.instance);}
    }else{
      const n=t.nativeExecutionTrace;assert.equal(t.kind,'execute');assert.deepEqual(n,t.httpTrace.reply.nativeExecutionTrace);assert.equal(n.pid,t.pid);assert.ok(t.pid>0);assert.equal(n.status,0);assert.equal(n.signal,null);assert.equal(n.stdout,t.stdout);assert.equal(n.stdoutHash,sha(n.stdout));assert.equal(n.stderrHash,sha(n.stderr));assert.equal(path.normalize(n.command),path.join(b.acquisitionRoot,b.runtime.vm.path));assert.equal(n.args.length,1);assert.match(path.basename(n.args[0]),/^[0-9a-f]{64}\.rbc$/u);
      assert.deepEqual(t.result,verifyNativeSemanticStateRoot(JSON.parse(n.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'}));
    }
  }
  assert.ok(ids.has(denied.coldInvocation.id));const gens=report.generations.map(g=>report.ledger[g.trace]);assert.equal(new Set(gens.map(t=>t.coldInvocation.id)).size,20);assert.equal(new Set(gens.map(t=>t.coldInvocation.service.compiler.token)).size,20);
  const c=report.runtimeControl,recovered=report.ledger[c.recovery],first=report.ledger[c.first],next=report.ledger[c.next];assert.equal(recovered.outputHash,contract.compilerHash);assert.ok(recovered.index>report.negativeControls.corruptCompiler);assert.notEqual(first.coldInvocation.id,next.coldInvocation.id);assert.deepEqual(first.result,next.result);
  for(const e of report.nativeExits){assert.equal(e.code,0);assert.equal(e.signal,null);assert.ok(e.pid>0);assert.ok(ids.has(e.invocationId));}
  const expected=[];for(const invocation of invocations)expected.push({kind:'compile',invocationId:invocation.id,...invocation.exit.compilerExit},{kind:'server',invocationId:invocation.id,pid:invocation.exit.pid,code:0,signal:null});
  for(const t of report.ledger.filter(t=>t.kind==='execute'))expected.push({kind:'execute',invocationId:t.coldInvocation.id,pid:t.pid,code:0,signal:null,artifactHash:t.artifactHash});
  const sort=a=>a.sort((x,y)=>(x.invocationId+x.kind).localeCompare(y.invocationId+y.kind));assert.deepEqual(sort(structuredClone(report.nativeExits)),sort(expected));
}
