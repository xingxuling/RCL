import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPhaseContextTarget} from '../src/phase-context-targets.mjs';
import {compileReality} from '../src/compiler.mjs';
const source='reality PhaseControl {\n  facet value : Number = 49\n}\n';
for(const environment of ['simulation-runtime','automation-runtime'])test(environment+' owns permission, result binding and rejection state in native RCL',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-phase-test-'));let target;
  try{
    target=await createPhaseContextTarget(environment);const file=path.join(directory,'kernel.rcl'),artifact=file+'.rbc',root=compileReality(source).programRoot;
    fs.writeFileSync(file,source);target.compile(file,artifact);const first=await target.execute(artifact,root);assert.equal(first.result.state.value,49);
    assert.equal(first.controllerTrace.snapshot.native.sourceBound,true);assert.equal(first.controllerTrace.completion.status,'realized');
    if(environment==='simulation-runtime')assert.equal(first.controllerTrace.entry.transition.afterRoot,first.controllerTrace.completion.transition.afterRoot);
    const guard=await target.verifyContextGuard(artifact,root);assert.equal(guard.sourceAuthorityDenied,true);assert.equal(guard.stateRoot,first.result.stateRoot);
    if(environment==='simulation-runtime')assert.equal(guard.timeReversalRejected,true);
    const before=target.snapshotController().state;
    await assert.rejects(target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
    if(environment==='simulation-runtime')assert.deepEqual(target.snapshotController().state,before);
    else{assert.equal(target.snapshotController().state['pipeline.active'],false);assert.equal(target.snapshotController().state['pipeline.failed'],before['pipeline.failed']+1);}
  }finally{
    await target?.dispose();const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('rcl-phase-test-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
