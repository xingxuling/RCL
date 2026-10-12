import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortableHttpTarget} from '../src/index.mjs';
import {compileReality} from '../src/compiler.mjs';

test('HTTP execution uses the native RCL compiler, rejects unauthorized requests and binds the result to source',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-http-test-')),file=path.join(directory,'input.rcl'),artifact=path.join(directory,'input.rbc');
  const source='reality NativeHttpTest { reckon squared(n : Number) -> Number = n * n facet value : Number = squared(7) }';
  const target=createPortableHttpTarget();
  try{
    assert.equal(target.assertUnauthorizedRejected(),true);
    assert.equal(target.inspectHealth().pid,target.binding.workerPid);
    fs.writeFileSync(file,source);target.compile(file,artifact);
    const execution=target.execute(artifact,compileReality(source).programRoot);
    assert.equal(execution.result.state.value,49);assert.equal(execution.result.stateRootVerified,true);
    assert.throws(()=>target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);
  }finally{target.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});

test('HTTP compiler and VM errors remain errors without returning fabricated success results',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-http-negative-')),file=path.join(directory,'input.rcl'),artifact=path.join(directory,'input.rbc');
  const target=createPortableHttpTarget();
  try{
    fs.writeFileSync(file,'not a reality');assert.throws(()=>target.compile(file,artifact),/compil|COMPILE|reality/iu);
    fs.writeFileSync(artifact,Buffer.from('RCLB'));assert.throws(()=>target.execute(artifact),/BYTECODE|bytecode|header|truncat/iu);
  }finally{target.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
