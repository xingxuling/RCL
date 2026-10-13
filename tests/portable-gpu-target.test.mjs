import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createPortableGpuTarget} from '../src/portable-gpu-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode,decodeBytecode} from '../src/bytecode.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';

test('actual GPU executes recursive RBC, structural values and transactions; failures preserve healthy continuation',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-gpu-test-'));let target;
  async function run(source,name){
    const file=path.join(directory,name+'.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,source);
    const compiled=await target.compile(file,artifact);assert.ok(compiled.bytecode.equals(compileRealityToBytecode(source)));
    const root=compileReality(source).programRoot;return{artifact,root,execution:await target.execute(artifact,root)};
  }
  try{
    target=await createPortableGpuTarget();
    const source=`reality GpuControl {
      reckon fib(n : Number) -> Number = choose(n <= 1, n, fib(n - 1) + fib(n - 2))
      facet fib : Number = fib(10)
      facet same : Truth = sequence_append(empty_sequence(), sequence_append(empty_sequence(), 7)) == sequence_append(empty_sequence(), sequence_append(empty_sequence(), 7))
      facet different : Truth = sequence_append(empty_sequence(), 7) != sequence_append(empty_sequence(), 8)
      facet empty_truth : Truth = empty_sequence() == empty_sequence()
      facet unicode_length : Number = length("中🌏文")
      facet counter : Number = 0
      subject worker {
        warrant update on counter
      }
      emergence advance {
        cause worker
        when counter == 0
        needs update on counter
        alter counter <- counter + 1
        preserve counter == 1
        witness "gpu:transaction"
      }
      foresee advance
      realize advance
    }`;
    const {artifact,root,execution}=await run(source,'control');
    assert.deepEqual(execution.result.state,{fib:55,same:true,different:true,empty_truth:true,unicode_length:3,counter:1});
    assert.equal(execution.result.stateRoot,semanticStateRootForAlgorithm(execution.result.state,'rcl.semantic-state-root.v2'));
    const transition=execution.result.history[0],projection=execution.result.projections[0];
    assert.equal(projection.projectedState.counter,1);assert.equal(transition.changes[0].before,0);assert.equal(transition.changes[0].after,1);
    assert.equal(projection.beforeRoot,transition.beforeRoot);assert.equal(projection.afterRoot,transition.afterRoot);
    assert.deepEqual(transition.authority.activeWarrants,[{subject:'worker',capability:'update',target:'counter'}]);
    assert.equal(execution.gpuTrace.cpuExecutionFallback,false);assert.equal(execution.gpuTrace.openclCalls.clEnqueueNDRangeKernel,1);
    assert.ok(execution.gpuTrace.executedInstructions>1800);assert.match(target.binding.device.extensions,/cl_khr_fp64/u);
    await assert.rejects(target.execute(artifact,'0'.repeat(64)),/RCL_GPU_SOURCE_ROOT_MISMATCH/u);
    await assert.rejects(target.execute(path.join(directory,'missing.rbc'),root),/ENOENT/u);
    const invalid=path.join(directory,'invalid.rbc');fs.writeFileSync(invalid,'RCLB');
    await assert.rejects(target.execute(invalid,root),/RCL_GPU_BYTECODE_TRUNCATED/u);
    const bytes=fs.readFileSync(artifact),decoded=decodeBytecode(bytes),offset=bytes.length-decoded.instructions.length*16;
    const changed=Buffer.from(bytes);changed[offset]=35;fs.writeFileSync(invalid,changed);
    await assert.rejects(target.execute(invalid,root),/RCL_GPU_OPCODE_UNSUPPORTED/u);
    const missing=Buffer.from(bytes),load=decoded.instructions.find(x=>x.op===4);missing.writeInt32LE(decoded.strings.indexOf(root),offset+load.index*16+4);fs.writeFileSync(invalid,missing);
    await assert.rejects(target.execute(invalid,root),/RCL_STATE_MISSING/u);
    const denied=Buffer.from(bytes),grant=decoded.instructions.find(x=>x.op===22);denied[offset+grant.index*16]=0;fs.writeFileSync(invalid,denied);
    await assert.rejects(target.execute(invalid,root),/RCL_AUTHORITY_DENIED/u);
    const broken=source.replace('preserve counter == 1','preserve counter == 2');
    await assert.rejects(run(broken,'preserve-broken'),/RCL_REALITY_BOUND_BROKEN/u);
    assert.equal((await target.execute(artifact,root)).result.stateRoot,execution.result.stateRoot);
    const reset=await target.verifyReset(artifact,root);assert.equal(reset.processResetObserved,true);assert.equal(reset.processExit.code,0);assert.equal(reset.resetInstance,1);
    assert.notEqual(reset.contextTokenBefore,reset.contextTokenAfter);
  }finally{
    await target?.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-gpu-test-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
