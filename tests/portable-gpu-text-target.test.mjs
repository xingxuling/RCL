import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createPortableGpuTextTarget} from '../src/portable-gpu-text-target.mjs';
import {compileReality} from '../src/scientific-compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';

test('actual GPU Text execution matches native C for Unicode, formatting, persistent values and bounded failures',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-gpu-text-test-'));let target;
  async function run(source,name,{oracle=true}={}){
    const input=path.join(directory,name+'.rcl'),artifact=input+'.rbc';fs.writeFileSync(input,source);
    const program=compileReality(source),compiled=await target.compile(input,artifact);assert.deepEqual(compiled.bytecode,compileRealityToBytecode(program));
    const execution=await target.execute(artifact,program.programRoot);
    assert.equal(execution.gpuTrace.executionOwner,'RCL_OPENCL_RBC_TEXT_STACK_VM');assert.equal(execution.gpuTrace.cpuExecutionFallback,false);assert.equal(execution.gpuTrace.openclCalls.clEnqueueNDRangeKernel,1);
    if(oracle){
      const native=spawnSync(path.resolve('native/rclvm.exe'),[artifact],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}});assert.equal(native.status,0,native.stderr);
      const expected=verifyNativeSemanticStateRoot(JSON.parse(native.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      assert.deepEqual(execution.result.state,expected.state);assert.equal(execution.result.stateRoot,expected.stateRoot);assert.deepEqual(execution.result.history,expected.history);assert.deepEqual(execution.result.projections,expected.projections);
    }
    return {artifact,root:program.programRoot,execution};
  }
  try{
    target=await createPortableGpuTextTarget();
    await run('reality Unicode { facet full : Text = "中😀文" + "𐐀" facet n : Number = length(full) facet one : Text = char_at(full, 1) facet clip : Text = slice_text(full, 1, 2) facet missing : Text = char_at(full, -1) facet end : Text = slice_text(full, 9999999999, 1) }','unicode');
    await run('reality Predicates { facet a : Truth = contains("中😀文", "😀") facet b : Truth = starts_with("中😀文", "中") facet c : Truth = ends_with("中😀文", "文") facet d : Truth = contains("", "") facet e : Text = split_before("left::right", "::") facet f : Text = split_after("left::right", "::") facet g : Text = split_after("left", "absent") facet h : Text = upper_text("Abc中") facet i : Text = lower_text("AbC中") facet j : Text = trim("  😀hello  ") }','predicates');
    await run('reality Scalar { facet a : Text = "计数：" + text(-17) facet b : Text = text(true) facet c : Text = text(false) facet d : Text = text("😀") facet e : Text = text(-0) }','scalar');
    await run('reality Subnormal { facet a : Text = text(1e-300 * 1e-20) facet b : Text = text(1e-300 * 1e-24) facet c : Text = text(-1e-300 * 1e-20) facet d : Text = text(1e-300 * 1e-8) }','subnormal');
    const numbers=[.1,1.25,1e20,1e21,1e-6,1e-7,1.2345678901234567];
    let seed=0x12345678;for(let i=0;i<64;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const magnitude=(seed%600)-300,value=(1+(seed/4294967296))*10**magnitude;numbers.push(i%2?-value:value);}
    await run('reality FiniteNumbers { '+numbers.map((n,i)=>'facet f'+i+' : Text = text('+String(n)+')').join(' ')+' }','finite-format-corpus');
    const healthy=await run('reality Persistent { facet a : Sequence = sequence_append(empty_sequence(), "😀") facet b : Sequence = sequence_concat(a, a) facet n : Number = length(b) facet v : Text = sequence_get(b, 1) facet left : Number = length(a) }','persistent');
    assert.deepEqual(healthy.execution.result.state,{a:['😀'],b:['😀','😀'],n:2,v:'😀',left:1});
    await assert.rejects(()=>run('reality TooMuchText { reckon double_text(value : Text, n : Number) -> Text = choose(n == 0, value, double_text(value + value, n - 1)) facet result : Text = double_text("x", 24) }','arena-overflow',{oracle:false}),/RCL_GPU_TEXT_LIMIT/u);
    await assert.rejects(()=>run('reality InvalidSlice { facet result : Text = slice_text("😀", -1, 1) }','negative-slice',{oracle:false}),/RCL_TEXT_SLICE/u);
    await assert.rejects(()=>run('reality UnsupportedSequenceText { facet result : Text = text(empty_sequence()) }','unsupported-sequence-text',{oracle:false}),/RCL_GPU_BUILTIN_TYPE/u);
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');await assert.rejects(()=>target.execute(corrupt,healthy.root),/RCL_GPU_BYTECODE_TRUNCATED/u);
    assert.equal((await target.execute(healthy.artifact,healthy.root)).result.stateRoot,healthy.execution.result.stateRoot);
    const reset=await target.verifyReset(healthy.artifact,healthy.root);assert.equal(reset.stateResetObserved,true);assert.equal(reset.processResetObserved,true);
  }finally{await target?.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-gpu-text-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
