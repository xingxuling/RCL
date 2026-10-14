import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentSequenceCompiler} from '../src/index.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';

test('resident native compiler reuses its C ABI instance, self-compiles and recovers after rejected requests',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-resident-test-')),compiler=await createResidentSequenceCompiler();
  const seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
  try{
    const first=await compiler.compile(seed,source,path.join(directory,'c1.rbc'));assert.deepEqual(first.bytecode,fs.readFileSync(seed));
    assert.deepEqual(JSON.parse(first.compilerTrace.replyLine),first.compilerTrace.metrics);
    assert.equal(JSON.parse(compiler.binding.readyReply).pid,first.compilerTrace.nativePid);
    const second=await compiler.compile(path.join(directory,'c1.rbc'),source);assert.deepEqual(second.bytecode,first.bytecode);assert.equal(second.compilerTrace.instance,first.compilerTrace.instance);assert.equal(second.compilerTrace.nativePid,first.compilerTrace.nativePid);
    const file=path.join(directory,'input.rcl'),text='reality ResidentArithmetic { facet value : Number = 9 + 2 facet label : Text = "😀" }';fs.writeFileSync(file,text);
    const active=compiler.compile(seed,file);await assert.rejects(()=>compiler.compile(seed,file),/RCLC_RESIDENT_BACKPRESSURE/u);assert.deepEqual((await active).bytecode,compileRealityToBytecode(text));
    const broken=path.join(directory,'broken.rcl');fs.writeFileSync(broken,'realty Invalid { facet value : Number = 1 }');await assert.rejects(()=>compiler.compile(seed,broken),/RCL_SEMANTIC_ASSERT/u);
    const scope=await compiler.verifyScopeRejection();assert.equal(scope.code,'RCLC_PROTOCOL_SCOPE');assert.equal(scope.pid,first.compilerTrace.nativePid);
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');await assert.rejects(()=>compiler.compile(corrupt,file),/RCL_NATIVE_TRUNCATED/u);
    assert.deepEqual((await compiler.compile(seed,file)).bytecode,compileRealityToBytecode(text));
  }finally{const exit=await compiler.dispose();assert.equal(exit.code,0);assert.equal(exit.signal,null);assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-resident-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
