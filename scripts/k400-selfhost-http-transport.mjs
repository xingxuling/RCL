import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyHttpTransport(report,contract){
  const b=report.binding,s=b.service;assert.equal(report.environment,'server');assert.equal(b.environment,'server');assert.deepEqual(b.runtime,contract.runtimeArtifacts[0]);
  assert.equal(b.compilerLocation,'AUTHENTICATED_HTTP_RESIDENT_NATIVE_C_ABI');assert.equal(b.executionOwner,'HTTP_WORKER_NATIVE_VM_PROCESSES');
  assert.equal(b.referenceCompilationUsed,false);assert.equal(b.referenceExecutionUsed,false);assert.equal(b.hostedDeploymentClaimed,false);assert.equal(b.securitySandboxClaimed,false);
  assert.equal(s.owner,'RCL_RESIDENT_COMPILER_HTTP');assert.equal(s.transport,'AUTHENTICATED_HTTP_LOOPBACK');assert.match(s.endpoint,/^http:\/\/127\.0\.0\.1:[0-9]+$/u);assert.ok(s.serverPid>0);
  assert.deepEqual(s.compiler.binary,b.runtime.compiler);assert.deepEqual(s.vm,b.runtime.vm);assert.equal(s.compiler.owner,'RCL_NATIVE_COMPILER_C_ABI');
  const ready=JSON.parse(s.compiler.readyReply);assert.equal(ready.status,'ready');assert.equal(ready.pid,s.compiler.pid);assert.equal(ready.token,s.compiler.token);assert.equal(ready.protocol,'RCL_COMPILER_ABI_FILES_V1');
  for(const f of [b.runtime.compiler,b.runtime.vm,s.worker,...s.compiler.sourceBindings])assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256);
  assert.equal(sha(fs.readFileSync(s.hostRuntime.path)),s.hostRuntime.sha256);let request=0;
  function http(h,route,status){assert.equal(h.route,route);assert.equal(h.status,status);assert.equal(h.reply.serverPid,s.serverPid);assert.equal(h.replyHash,sha(JSON.stringify(h.reply)));if(status===200&&route!=='/health'){assert.equal(h.reply.requestHash,h.requestHash);assert.match(h.reply.requestId,/^[0-9a-f-]{36}$/u);}}
  for(const t of report.ledger){
    assert.equal(t.index,report.ledger.indexOf(t));assert.equal(t.session,b.session);assert.equal(t.environment,'server');assert.equal(t.replyObserved,true);assert.match(t.nonce,/^[0-9a-f-]{36}$/u);assert.equal(t.stdoutHash,sha(t.stdout));http(t.httpTrace,t.kind==='compile'?'/compile':'/execute',t.error?400:200);
    if(t.kind==='compile'){
      const c=t.nativeCompilerTrace,m=c.metrics;assert.equal(t.pid,s.compiler.pid);assert.equal(m.pid,t.pid);assert.equal(m.token,s.compiler.token);assert.equal(m.request,++request);
      assert.deepEqual(m,JSON.parse(c.replyLine));assert.deepEqual(c,t.httpTrace.reply.nativeCompilerTrace);assert.equal(t.stdout,c.replyLine);assert.equal(c.compilerHash,t.inputCompilerHash);assert.equal(c.sourceHash,t.sourceHash);assert.equal(t.sourceHash,sha(t.source));
      const names=c.frame.split('\t');assert.equal(names.length,4);assert.equal(names[0],'COMPILE');assert.equal(names[1],t.inputCompilerHash+'.rbc');assert.equal(names[2],t.sourceHash+'.rcl');assert.match(names[3],/^[0-9a-f-]{36}\.rbc$/u);
      if(t.error){assert.equal(t.status,1);assert.equal(m.status,'error');}else{assert.equal(t.status,0);assert.equal(m.status,'ok');assert.equal(m.outputState,'compiler.output');assert.equal(m.instructionBudget,300000000);assert.equal(m.bytes,t.outputBytes);assert.equal(c.artifactHash,t.outputHash);assert.equal(sha(Buffer.from(t.httpTrace.reply.bytecodeBase64,'base64')),t.outputHash);assert.equal(c.instance,m.instance);}
    }else{
      const n=t.nativeExecutionTrace;assert.equal(t.kind,'execute');assert.deepEqual(n,t.httpTrace.reply.nativeExecutionTrace);assert.equal(n.pid,t.pid);assert.ok(t.pid>0);assert.equal(n.status,0);assert.equal(n.signal,null);assert.equal(n.stdout,t.stdout);assert.equal(n.stdoutHash,sha(n.stdout));assert.equal(n.stderrHash,sha(n.stderr));assert.equal(path.normalize(n.command),path.join(b.acquisitionRoot,b.runtime.vm.path));assert.equal(n.args.length,1);assert.match(path.basename(n.args[0]),/^[0-9a-f]{64}\.rbc$/u);
      assert.deepEqual(t.result,verifyNativeSemanticStateRoot(JSON.parse(n.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'}));
    }
  }
  const gens=report.generations.map(g=>report.ledger[g.trace]);assert.equal(new Set(gens.map(t=>t.pid)).size,1);assert.equal(new Set(gens.map(t=>t.metrics.instance)).size,1);
  const c=report.runtimeControl;http(c.unauthorized,'/health',403);assert.equal(c.unauthorized.reply.code,'RCLC_HTTP_AUTHORITY_DENIED');assert.deepEqual(c.before.reply,c.after.reply);assert.equal(c.before.reply.binding.serverPid,s.serverPid);
  const recovered=report.ledger[c.recovery],first=report.ledger[c.first],next=report.ledger[c.next];assert.equal(recovered.outputHash,contract.compilerHash);assert.ok(recovered.index>report.negativeControls.corruptCompiler);assert.notEqual(first.pid,next.pid);assert.deepEqual(first.result,next.result);
  for(const e of report.nativeExits){assert.equal(e.code,0);assert.equal(e.signal,null);assert.ok(e.pid>0);}
  assert.equal(report.nativeExits.filter(e=>e.kind==='compile').length,1);assert.equal(report.nativeExits.find(e=>e.kind==='compile').pid,s.compiler.pid);assert.equal(report.nativeExits.filter(e=>e.kind==='server').length,1);assert.equal(report.nativeExits.find(e=>e.kind==='server').pid,s.serverPid);
  for(const t of report.ledger.filter(t=>t.kind==='execute'))assert.ok(report.nativeExits.some(e=>e.kind==='execute'&&e.pid===t.pid&&e.artifactHash===t.artifactHash));
}
