import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPortableBrowserTarget} from '../src/portable-browser-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
test('actual browser compiles and runs RCL, resets its page and preserves native rejection diagnostics',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-browser-test-'));let target;
  try{
    target=await createPortableBrowserTarget();const source='reality BrowserControl {\n facet value : Number = 7 * 7\n}\n';
    const file=path.join(directory,'program.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,source);
    const compiled=await target.compile(file,artifact);assert.ok(compiled.bytecode.equals(compileRealityToBytecode(source)));
    assert.equal(compiled.browserCompileTrace.executionOwner,'RCL_COMPILER_RBC_BROWSER_WEBASSEMBLY');assert.equal(compiled.browserCompileTrace.wasiCalls.path_rename,1);
    const root=compileReality(source).programRoot,result=await target.execute(artifact,root);assert.equal(result.result.state.value,49);
    assert.equal(result.browserTrace.executionOwner,'RCL_C_VM_BROWSER_WEBASSEMBLY');assert.equal(target.binding.nodeWasiExecutionUsed,false);
    await assert.rejects(target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
    await assert.rejects(target.execute(path.join(directory,'missing.rbc'),root),/ENOENT/u);
    assert.equal((await target.execute(artifact,root)).result.stateRoot,result.result.stateRoot);
    const reset=await target.verifyReset(artifact,root);assert.equal(reset.pageResetObserved,true);assert.equal(reset.resetInstance,1);
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');await assert.rejects(target.execute(corrupt,root),/RCL_NATIVE_TRUNCATED/u);
    assert.equal((await target.execute(artifact,root)).result.stateRoot,result.result.stateRoot);
  }finally{
    await target?.dispose();const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('rcl-browser-test-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
