import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPortableScientificTarget} from '../src/portable-scientific-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
test('actual native statistics, independent NumPy/SciPy, large-offset accuracy and source-owned mismatch rejection',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-scientific-test-'));let target;
  try{target=await createPortableScientificTarget();const file=path.join(dir,'p.rcl'),source='reality ScientificSample { facet value : Number = 49 }',artifact=file+'.rbc';fs.writeFileSync(file,source);
    assert.ok((await target.compile(file,artifact)).bytecode.equals(compileRealityToBytecode(source)));const sourceRoot=compileReality(source).programRoot;
    const result=await target.execute(artifact,sourceRoot);assert.equal(result.result.state.value,49);assert.equal(result.scientificTrace.analysis.independent.processPid,target.binding.observer.processPid);
    const large=await target.analyse(Array.from({length:8},(_,i)=>1e12+i*.125));assert.equal(large.result.state['result.variance'],.08203125);assert.equal(large.maxError,0);
    const arbitrary=await target.analyse([1,2,4,8]);assert.equal(arbitrary.result.state['result.mean'],3.75);assert.equal(arbitrary.result.state['result.variance'],7.1875);assert.equal(arbitrary.result.state['result.slope'],2.3);
    const maximum=await target.analyse(Array.from({length:256},(_,i)=>i%7));assert.ok(maximum.maxError<=1e-9);assert.equal(maximum.result.state['result.count'],256);
    const controls=await target.verifyRuntimeControl(artifact,sourceRoot);assert.equal(controls.status,'PASS');assert.equal(controls.mismatch.code,'RCL_AUTHORITY_DENIED');assert.equal(controls.mismatch.snapshot.state['experiment.active'],false);
    assert.notEqual(controls.reset.before.native.processId,controls.reset.after.native.processId);await assert.rejects(target.analyse([]),/MEASUREMENT_SIZE/u);await assert.rejects(target.analyse([NaN]),/MEASUREMENT_RANGE/u);
    const exit=await target.dispose();assert.equal(exit.exitObserved,true);assert.equal(exit.code,0);assert.equal(exit.processPid,target.binding.observer.processPid);target=null;
  }finally{await target?.dispose();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('rcl-scientific-test-'));fs.rmSync(dir,{recursive:true,force:true});}
});
