import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPortableRealtimeTarget} from '../src/portable-realtime-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
test('real monotonic release, child deadlines/cancellation, source-owned publication and recovery',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-realtime-test-'));let target;
  try{
    target=await createPortableRealtimeTarget();const source='reality TimedResult {\n facet value : Number = 7 * 7\n}\n',file=path.join(directory,'source.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,source);
    const compilation=await target.compile(file,artifact);assert.ok(compilation.bytecode.equals(compileRealityToBytecode(source)));const root=compileReality(source).programRoot;
    const first=await target.execute(artifact,root);assert.equal(first.result.state.value,49);assert.equal(first.realtimeTrace.nativeTrace.exitObserved,true);
    const spinFile=new URL('../examples/runtime-hosts/realtime-spin-control.rcl',import.meta.url),spin=path.join(directory,'spin.rbc'),spinText=fs.readFileSync(spinFile,'utf8');
    await target.compile(fileURLToPath(spinFile),spin);const controls=await target.verifyRuntimeControl(artifact,root,spin,compileReality(spinText).programRoot);
    assert.equal(controls.status,'PASS');assert.equal(controls.stateRoot,first.result.stateRoot);assert.equal(controls.timeout.nativeTrace.stopReason,'RCL_REALTIME_DEADLINE_EXPIRED');
    assert.equal(controls.cancelled.nativeTrace.stopReason,'RCL_REALTIME_CANCELLED');assert.ok(controls.heartbeat.length>0);
    await assert.rejects(target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);assert.equal(target.snapshotController().state['job.active'],false);
    assert.equal((await target.execute(artifact,root)).result.stateRoot,first.result.stateRoot);
    const waiting=target.execute(artifact,root,{notBeforeMs:1000});const rejected=assert.rejects(waiting,/RCL_REALTIME_CANCELLED/u);await target.dispose();target=null;await rejected;
  }finally{
    await target?.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-realtime-test-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
