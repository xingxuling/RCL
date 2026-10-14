import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPhaseCompilerTarget,compileReality,compileRealityToBytecode} from '../src/index.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const environment of ['automation-runtime','simulation-runtime'])test('native RCL '+environment+' owns full compilation, denied dispatch and failure settlement',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-phase-compiler-test-')),target=await createPhaseCompilerTarget(environment);
  try{
    const seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
    const pending=target.compile(seed,source,path.join(directory,'c1.rbc'));await assert.rejects(()=>target.compile(seed,source),/RCLC_PHASE_BACKPRESSURE/u);const first=await pending;assert.deepEqual(first.bytecode,fs.readFileSync(seed));
    const file=path.join(directory,'case.rcl'),text='reality PhaseCompiler { facet value : Number = 9 + 2 }';fs.writeFileSync(file,text);const compilePending=target.compile(path.join(directory,'c1.rbc'),file,file+'.rbc');fs.writeFileSync(file,'realty ChangedAfterCall {}');fs.writeFileSync(path.join(directory,'c1.rbc'),Buffer.from('RCLB'));const compiled=await compilePending;assert.deepEqual(compiled.bytecode,compileRealityToBytecode(text));fs.writeFileSync(path.join(directory,'c1.rbc'),first.bytecode);fs.writeFileSync(file,text);const runPending=target.execute(file+'.rbc',compileReality(text).programRoot);fs.writeFileSync(file+'.rbc',Buffer.from('RCLB'));const run=await runPending;assert.equal(run.result.state.value,11);fs.writeFileSync(file+'.rbc',compiled.bytecode);
    fs.writeFileSync(file,'realty Invalid {}');const beforeFailure=target.snapshotController();await assert.rejects(()=>target.compile(seed,file),e=>{assert.equal(e.phaseTrace.nativeCalled,true);if(environment==='simulation-runtime')assert.equal(e.phaseTrace.snapshot.stateRoot,beforeFailure.stateRoot);else{assert.equal(e.phaseTrace.snapshot.state['pipeline.active'],false);assert.equal(e.phaseTrace.snapshot.state['pipeline.failed'],beforeFailure.state['pipeline.failed']+1);}return /RCL_SEMANTIC_ASSERT/u.test(e.message);});
    await target.pause();const paused=target.snapshotController(),deniedOutput=path.join(directory,'denied.rbc');const denied=e=>{assert.equal(e.code,'RCL_AUTHORITY_DENIED');assert.equal(e.phaseTrace.nativeCalled,false);assert.equal(e.phaseTrace.snapshot.stateRoot,paused.stateRoot);return true;};await assert.rejects(()=>target.compile(seed,source,deniedOutput),denied);assert.equal(fs.existsSync(deniedOutput),false);await assert.rejects(()=>target.execute(file+'.rbc',compileReality(text).programRoot),denied);await target.resume();
    const reversal=await target.verifyTimeReversal(sha(fs.readFileSync(source))),recovered=await target.compile(seed,source);assert.deepEqual(recovered.bytecode,first.bytecode);const ended=await target.dispose();assert.equal(ended.controller.terminationObserved,true);assert.deepEqual(ended.graph.exits.map(e=>e.code),[0,0]);
    fs.mkdirSync('output/phase-selfhost-probe',{recursive:true});fs.writeFileSync('output/phase-selfhost-probe/'+environment+'.json',JSON.stringify({status:'PASS_PHASE_FULL_COMPILER_DIAGNOSTIC_NOT_K400',binding:target.binding,runtime:{environment,compiler:target.binding.graph.stages[0].compiler.binary,vm:target.binding.graph.stages[1].vm},generation:{outputHash:sha(first.bytecode),stageTrace:first.stageTrace,phaseTrace:first.phaseTrace},reversal,ended},null,2)+'\n');
  }finally{await target.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-phase-compiler-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
