// ADAPT of scripts/k400-phase-ledger.mjs at SHA256 92c6ef406420501081356ef3ac6c5e7a47d19bbdfdf501721001875493b7bc2f; replay reused controller authority and every native transition.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRealitySession} from '../src/runtime.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealitySessionBytecode} from '../src/bytecode.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
import {CONTROL_SOURCES} from './k400-phase-definitions.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=state=>semanticStateRootForAlgorithm(state,'rcl.semantic-state-root.v2');

export async function verifyControllerLedger(environment,backend){
  const binding=backend.binding.controller,source=fs.readFileSync(path.join(ROOT,CONTROL_SOURCES[environment]),'utf8');
  assert.equal(binding.sourcePath,CONTROL_SOURCES[environment]);assert.equal(binding.sourceHash,sha(source));
  assert.equal(binding.programRoot,compileReality(source).programRoot);assert.equal(binding.bytecodeHash,sha(compileRealitySessionBytecode(source)));
  const compilerSource=['compiler-core.rcl','session-compiler-core.rcl','session-compiler-main.rcl'].map(file=>fs.readFileSync(path.join(ROOT,'selfhost',file),'utf8')).join('\n');
  assert.equal(binding.compilerEvidence.compilerOwner,'RCL');assert.equal(binding.compilerEvidence.compilerSourceHash,sha(compilerSource));
  assert.equal(binding.compilerEvidence.sourceHash,sha(source));assert.equal(binding.compilerEvidence.bytecodeRoot,binding.bytecodeHash);
  assert.equal(binding.compilerEvidence.targetByteParity,true);assert.equal(binding.compilerEvidence.referenceExecutionFallback,false);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'native/native-windows-manifest.json'),'utf8'));
  const hash=createHash('sha256');for(const file of manifest.sources){hash.update(file);hash.update('\0');hash.update(fs.readFileSync(path.join(ROOT,file)));hash.update('\0');}
  assert.equal(hash.digest('hex'),manifest.sourceSha256);assert.equal(binding.daemonSourceRoot,manifest.sourceSha256);
  assert.equal(binding.daemonRoot,sha(fs.readFileSync(path.join(ROOT,'native/rclvmd.exe'))));
  const reference=createRealitySession(source),ledger=backend.controllerLedger;assert.ok(ledger.length>0);
  function snapshot(observed){
    const expected=reference.snapshot();assert.equal(observed.programRoot,binding.programRoot);assert.deepEqual(observed.state,expected.state);
    assert.equal(observed.stateRoot,expected.stateRoot);assert.equal(observed.stateRootAlgorithm,'rcl.semantic-state-root.v2');
    assert.equal(observed.native.processId,binding.processId);assert.equal(observed.native.daemonRoot,binding.daemonRoot);
    assert.equal(observed.native.sourceRoot,binding.daemonSourceRoot);assert.equal(observed.native.sourceBound,true);
    assert.equal(observed.native.stateRootsIndependentlyVerified,true);
  }
  for(const[index,item]of ledger.entries()){
    assert.equal(item.index,index);snapshot(item.before);let expected,error;
    try{expected=await reference.invoke(item.command);}catch(caught){error=caught;}
    if(error){assert.equal(item.error?.code,error.code);assert.equal(item.result,undefined);}
    else{assert.equal(item.error,undefined);assert.deepEqual(item.result,expected);}
    snapshot(item.after);
  }
}
