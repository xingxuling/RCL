import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createPortableRncsTarget,packRncsValue,unpackRncsValue} from '../src/portable-rncs-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import * as rncs from '../src/vendor/rncs-reality-branch/src/index.mjs';

test('actual RNCS branch runtime executes RCL, gates candidate merge, rolls back and restarts source-owned admission',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-rncs-test-'));let target;
  try{
    const source='reality RncsCandidate {\n  facet fraction : Number = 1 / 3\n  facet nested : Sequence = sequence_append(sequence_append(empty_sequence(), fraction), "中国")\n}\n';
    const input=path.join(directory,'program.rcl'),artifact=input+'.rbc';fs.writeFileSync(input,source);
    target=await createPortableRncsTarget();const compiled=await target.compile(input,artifact);assert.ok(compiled.bytecode.equals(compileRealityToBytecode(source)));
    const root=compileReality(source).programRoot,first=await target.execute(artifact,root),next=await target.execute(artifact,root);
    assert.equal(first.result.state.fraction,1/3);assert.deepEqual(first.result.state.nested,[1/3,'中国']);
    const restored=unpackRncsValue(first.rncsTrace.mergedState.body.result);assert.deepEqual(restored.state,first.result.state);
    assert.equal(first.rncsTrace.providerCalls,1);assert.equal(first.rncsTrace.executionReceipt.status,'completed');
    assert.equal(rncs.verifyExecutionReceipt(first.rncsTrace.executionReceipt),true);assert.equal(rncs.verifyAuthorityDecision(first.rncsTrace.authorityDecision,first.rncsTrace.proposal),true);
    assert.equal(next.rncsTrace.generation,first.rncsTrace.generation+1);assert.equal(next.rncsTrace.beforeGenerationRoot,first.rncsTrace.generationRoot);
    await assert.rejects(target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
    await assert.rejects(target.execute(path.join(directory,'missing.rbc'),root),/ENOENT/u);
    assert.equal((await target.execute(artifact,root)).result.stateRoot,first.result.stateRoot);
    const guard=await target.verifyContextGuard(artifact,root);assert.equal(guard.unapprovedRejected,true);assert.equal(guard.staleRejected,true);
    assert.equal(guard.rollbackObserved,true);assert.equal(guard.authorityDenied,true);assert.equal(guard.generationBefore,guard.generationAfter);
    const reset=await target.verifyReset(artifact,root);assert.equal(reset.contextResetObserved,true);assert.equal(reset.reset.generation,1);
    assert.notEqual(reset.processPidBefore,reset.processPidAfter);assert.equal(reset.reset.stateRoot,first.result.stateRoot);
    const sample={a:1/3,b:[true,false,null,'🌏',9007199254740992]};assert.deepEqual(unpackRncsValue(packRncsValue(sample)),sample);
    assert.match(rncs.rootHash(packRncsValue(sample)),/^[0-9a-f]{64}$/u);
  }finally{
    await target?.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-rncs-test-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
