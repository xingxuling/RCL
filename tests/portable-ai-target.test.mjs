import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPortableAiTarget} from '../src/portable-ai-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
test('real trained native MLP, exact forward inputs, immutable model data and denied predictor authority',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-ai-test-'));let target;
  try{target=await createPortableAiTarget();const source='reality NativeAiSample { facet value : Number = 49 }',file=path.join(directory,'p.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,source);assert.ok((await target.compile(file,artifact)).bytecode.equals(compileRealityToBytecode(source)));
    const root=compileReality(source).programRoot,execution=await target.execute(artifact,root);assert.equal(execution.result.state.value,49);assert.equal(execution.aiTrace.snapshot.state['result.authority_granted'],false);
    assert.equal(target.binding.training.result.state['evaluation.xor_accuracy'],1);assert.equal(target.binding.training.result.state['evaluation.majority_accuracy'],1);
    const positive=await target.infer([0,1]),negative=await target.infer([0,0]);assert.ok(positive.result.state['inference.output'][0]>.5);assert.ok(negative.result.state['inference.output'][0]<.5);
    const maximum=await target.infer(Array.from({length:256},(_,i)=>i%2));assert.equal(maximum.samples.length,256);assert.equal(maximum.authorityGranted,false);
    // Public evidence copies cannot mutate the model actually used by inference.
    target.binding.training.model[1][4][1][0]=999;assert.deepEqual((await target.infer([0,1])).result.state['inference.output'],positive.result.state['inference.output']);
    const controls=await target.verifyRuntimeControl(artifact,root);assert.equal(controls.status,'PASS');assert.equal(controls.authorityDenied.snapshot.state['result.authority_granted'],false);assert.equal(controls.authorityDenied.snapshot.state['request.active'],false);assert.notEqual(controls.reset.before.native.processId,controls.reset.after.native.processId);
    await assert.rejects(target.infer([]),/MEASUREMENT_SIZE/u);await assert.rejects(target.infer([Infinity]),/MEASUREMENT_RANGE/u);
  }finally{await target?.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-ai-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
