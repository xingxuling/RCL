import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCompilerDataflowTarget,compileReality,compileRealityToBytecode} from '../src/index.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('actual compiler and VM workers transfer complete generations and linked programs with bounded recovery and graceful exits',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-flow-compiler-test-')),target=await createCompilerDataflowTarget();let exited;
  try{
    const seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
    const pending=target.compile(seed,source,path.join(directory,'c1.rbc'));await assert.rejects(()=>target.execute('unused.rbc','0'.repeat(64)),/RCLC_FLOW_BACKPRESSURE/u);
    const first=await pending;assert.deepEqual(first.bytecode,fs.readFileSync(seed));
    const next=await target.compile(path.join(directory,'c1.rbc'),source);assert.deepEqual(next.bytecode,first.bytecode);assert.equal(next.stageTrace.nativeCompilerTrace.nativePid,first.stageTrace.nativeCompilerTrace.nativePid);
    const file=path.join(directory,'case.rcl'),text='reality DataflowCompiler { facet value : Number = 9 + 2 }';fs.writeFileSync(file,text);
    const linked=await target.compileAndExecute(path.join(directory,'c1.rbc'),file,compileReality(text).programRoot);assert.deepEqual(linked.compiled.bytecode,compileRealityToBytecode(text));assert.equal(linked.executed.result.state.value,11);
    assert.notEqual(linked.compiled.stageTrace.threadId,linked.executed.stageTrace.threadId);assert.equal(linked.compiled.stageTrace.flowId,linked.executed.stageTrace.flowId);assert.deepEqual(linked.executed.stageTrace.fromCompile,linked.edge);assert.equal(linked.edge.artifactHash,sha(linked.compiled.bytecode));
    const rejection=await target.verifyInputRejection(seed,file);assert.equal(rejection.stageTrace.nativeCalled,false);
    fs.writeFileSync(file,'realty Invalid {}');await assert.rejects(()=>target.compile(seed,file),/RCL_SEMANTIC_ASSERT/u);
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');await assert.rejects(()=>target.compile(corrupt,source),/RCL_NATIVE_TRUNCATED/u);
    const recovered=await target.compile(seed,source);assert.deepEqual(recovered.bytecode,first.bytecode);
    exited=await target.dispose();assert.deepEqual(exited.exits.map(e=>e.code),[0,0]);const compilerExit=exited.shutdown.find(t=>t.role==='compile').compilerExit;assert.equal(compilerExit.code,0);assert.equal(compilerExit.signal,null);assert.throws(()=>process.kill(compilerExit.pid,0),e=>e.code==='ESRCH');
    await assert.rejects(()=>target.compile(seed,source),/RCLC_FLOW_CLOSED/u);
    fs.mkdirSync('output/dataflow-selfhost-probe',{recursive:true});fs.writeFileSync('output/dataflow-selfhost-probe/report.json',JSON.stringify({status:'PASS_DATAFLOW_FULL_COMPILER_DIAGNOSTIC_NOT_K400',binding:target.binding,
      runtime:{environment:'dataflow-runtime',compiler:target.binding.stages.find(s=>s.role==='compile').compiler.binary,vm:target.binding.stages.find(s=>s.role==='execute').vm},generation:{outputHash:sha(first.bytecode),bytes:first.bytecode.length,stageTrace:first.stageTrace},linked:{compiled:linked.compiled.stageTrace,executed:linked.executed.stageTrace,edge:linked.edge,result:linked.executed.result},rejection,exited},null,2)+'\n');
  }finally{await target.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-flow-compiler-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
