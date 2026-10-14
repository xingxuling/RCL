import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReplicatedCompilerTarget,compileReality,compileRealityToBytecode} from '../src/index.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('two actual HTTP/native peers self-compile, agree on execution and fail closed before peer recovery',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-replica-test-')),target=await createReplicatedCompilerTarget();
  try{
    const seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
    const pending=target.compile(seed,source,path.join(directory,'c1.rbc'));await assert.rejects(()=>target.compile(seed,source),/RCLC_REPLICA_BACKPRESSURE/u);
    const first=await pending;assert.deepEqual(first.bytecode,fs.readFileSync(seed));assert.deepEqual(first.replicaTrace.peers.map(p=>p.artifactHash),[sha(first.bytecode),sha(first.bytecode)]);
    const second=await target.compile(path.join(directory,'c1.rbc'),source);assert.deepEqual(second.bytecode,first.bytecode);
    const file=path.join(directory,'case.rcl'),text='reality ReplicaCompiler { facet value : Number = 9 + 2 }';fs.writeFileSync(file,text);
    const compiled=await target.compile(seed,file,file+'.rbc');assert.deepEqual(compiled.bytecode,compileRealityToBytecode(text));const run=await target.execute(file+'.rbc',compileReality(text).programRoot);assert.equal(run.result.state.value,11);assert.deepEqual(run.replicaTrace.peers[0].result,run.replicaTrace.peers[1].result);
    fs.writeFileSync(file,'realty Invalid {}');await assert.rejects(()=>target.compile(seed,file),/RCL_SEMANTIC_ASSERT/u);
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');await assert.rejects(()=>target.compile(corrupt,source),/RCL_NATIVE_TRUNCATED/u);
    const recovery=await target.verifyPeerRecovery(seed,source);assert.equal(recovery.artifactPublished,false);assert.deepEqual(recovery.partialFailure.replicaTrace.peers.map(p=>p.status),['OK','ERROR']);assert.equal(recovery.exit.code,0);assert.equal(recovery.exit.compilerExit.code,0);
    const recovered=await target.compile(seed,source);assert.deepEqual(recovered.bytecode,first.bytecode);const ended=await target.dispose();for(const exit of ended){assert.equal(exit.code,0);assert.equal(exit.compilerExit.code,0);assert.throws(()=>process.kill(exit.pid,0),e=>e.code==='ESRCH');assert.throws(()=>process.kill(exit.compilerExit.pid,0),e=>e.code==='ESRCH');}
    fs.mkdirSync('output/replica-selfhost-probe',{recursive:true});fs.writeFileSync('output/replica-selfhost-probe/report.json',JSON.stringify({status:'PASS_REPLICA_FULL_COMPILER_DIAGNOSTIC_NOT_K400',binding:target.binding,runtime:{environment:'distributed-runtime',compiler:target.binding.peers[0].compiler.binary,vm:target.binding.peers[0].vm},generation:{outputHash:sha(first.bytecode),replicaTrace:first.replicaTrace},recovery,ended},null,2)+'\n');
  }finally{await target.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-replica-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
