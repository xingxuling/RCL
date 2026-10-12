import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createJobContextTarget} from '../src/job-context-targets.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
const source='reality JobControl {\n  facet value : Number = 7 * 7\n}\n';
async function using(environment,check){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-job-test-'));let target;
  try{
    target=await createJobContextTarget(environment);
    const file=path.join(directory,'program.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,source);
    assert.ok((await target.compile(file,artifact)).bytecode.equals(compileRealityToBytecode(source)));
    const root=compileReality(source).programRoot,execution=await target.execute(artifact,root);assert.equal(execution.result.state.value,49);
    await check(target,artifact,root,execution);
  }finally{
    await target?.dispose();const resolved=path.resolve(directory);
    assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('rcl-job-test-'));fs.rmSync(resolved,{recursive:true,force:true});
  }
}
test('cold handler execution has distinct exited process identities',async()=>using('serverless',async(target,artifact,root)=>{
  const control=target.verifyColdStart(artifact,root);assert.equal(control.freshHandlers,true);assert.equal(control.terminationObserved,true);
  assert.equal(new Set(control.handlerPids).size,2);assert.throws(()=>target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
}));
test('SQLite invokes native RCL inside real commits, reopen recovery and rollback',async()=>using('database',async(target,artifact,root,execution)=>{
  assert.equal(execution.committed,true);assert.equal(execution.sqlFunction,'rcl_execute');assert.equal(execution.sqlInvocations,1);
  const recovered=target.verifyRecovery(artifact,root);assert.equal(recovered.reopened,true);assert.equal(recovered.stateRoot,execution.result.stateRoot);
  const rollback=target.verifyRollback(artifact,root);assert.equal(rollback.wrongRootRejected,true);assert.equal(rollback.before,rollback.after);
  const corrupt=artifact+'.corrupt';fs.writeFileSync(corrupt,'RCLB');assert.throws(()=>target.execute(corrupt),/RCL_NATIVE_TRUNCATED/u);
}));
test('worker-thread dataflow rejects excess in-flight work and roots every result',async()=>using('dataflow-runtime',async(target,artifact,root,execution)=>{
  assert.equal(execution.threadId,target.binding.threadId);assert.deepEqual(execution.stages,['source-binding','native-execution','receipt-sink']);
  assert.equal(execution.inputHash,(await import('node:crypto')).createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'));
  const control=await target.verifyBackpressure(artifact,root);assert.equal(control.backpressureRejected,true);assert.equal(control.stateRoot,execution.result.stateRoot);
  await assert.rejects(target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
}));
