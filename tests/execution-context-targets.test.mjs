import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createExecutionContextTarget} from '../src/execution-context-targets.mjs';
import {compileReality} from '../src/compiler.mjs';
const source='reality ContextControl {\n  facet value : Number = 7 * 7\n}\n';
const removeOwnedTemporary=directory=>{
  const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('rcl-context-test-'));
  fs.rmSync(resolved,{recursive:true,force:true});
};
test('embedded C ABI instance resets deterministically and rejects a mismatched program root',async()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-context-test-')),target=createExecutionContextTarget('embedded-runtime');
  try{
    const input=path.join(temporary,'program.rcl'),output=input+'.rbc';fs.writeFileSync(input,source);await target.compile(input,output);
    const control=await target.verifyReset(output,compileReality(source).programRoot);assert.equal(control.sameInstance,true);assert.equal(control.nextRun,control.firstRun+1);
    assert.equal((await target.execute(output,compileReality(source).programRoot)).result.state.value,49);
    await assert.rejects(target.execute(output,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
  }finally{await target.dispose();removeOwnedTemporary(temporary);}
});
test('two real HTTP workers recover a terminated peer with a fresh identity',async()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-context-test-')),target=createExecutionContextTarget('distributed-runtime');
  try{
    const input=path.join(temporary,'program.rcl'),output=input+'.rbc';fs.writeFileSync(input,source);target.compile(input,output);
    const first=target.execute(output,compileReality(source).programRoot);assert.equal(first.replicaExecutions,2);assert.equal(new Set(first.replicaPids).size,2);
    const control=target.verifyPeerRecovery(output,compileReality(source).programRoot);assert.equal(control.terminalObserved,true);assert.notEqual(control.newPid,control.lostPid);
    assert.equal(control.stateRoot,first.result.stateRoot);assert.deepEqual(target.inspectReplicas().pids,control.replicaPids);
    assert.throws(()=>target.execute(output,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
  }finally{target.dispose();removeOwnedTemporary(temporary);}
});
