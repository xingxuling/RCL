import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentCompilerHttpTarget} from '../src/index.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
test('authenticated HTTP worker self-compiles dynamic generations, owns native execution and recovers after rejection',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-http-compiler-test-')),target=await createResidentCompilerHttpTarget();
  try{
    const seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
    const active=target.compile(seed,source,path.join(directory,'c1.rbc'));await assert.rejects(()=>target.compile(seed,source),/RCLC_HTTP_BACKPRESSURE/u);
    const first=await active;assert.deepEqual(first.bytecode,fs.readFileSync(seed));
    const second=await target.compile(path.join(directory,'c1.rbc'),source);assert.deepEqual(second.bytecode,first.bytecode);assert.equal(second.nativeCompilerTrace.nativePid,first.nativeCompilerTrace.nativePid);assert.equal(second.nativeCompilerTrace.instance,first.nativeCompilerTrace.instance);
    const denied=await target.verifyUnauthorizedRejection();assert.equal(denied.status,403);
    const file=path.join(directory,'case.rcl'),text='reality HttpCompiler { facet value : Number = 9 + 2 }';fs.writeFileSync(file,text);
    const compiled=await target.compile(seed,file,file+'.rbc');assert.deepEqual(compiled.bytecode,compileRealityToBytecode(text));
    const executed=await target.execute(file+'.rbc',compileReality(text).programRoot);assert.equal(executed.result.state.value,11);assert.equal(executed.nativeExecutionTrace.status,0);
    fs.writeFileSync(file,'realty Invalid {}');await assert.rejects(()=>target.compile(seed,file),/RCL_SEMANTIC_ASSERT/u);
    fs.writeFileSync(file,text);assert.deepEqual((await target.compile(seed,file)).bytecode,compiled.bytecode);
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');await assert.rejects(()=>target.compile(corrupt,file),/RCL_NATIVE_TRUNCATED/u);
    assert.deepEqual((await target.compile(seed,file)).bytecode,compiled.bytecode);
  }finally{const exit=await target.dispose();assert.equal(exit.code,0);assert.equal(exit.compilerExit.code,0);assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-http-compiler-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
