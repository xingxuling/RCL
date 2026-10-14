import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createColdCompilerHttpTarget} from '../src/index.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';

test('cold HTTP compiler uses actual supplied generations and closes every worker on success and failure',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-cold-compiler-test-')),target=await createColdCompilerHttpTarget(),invocations=[];
  const ended=r=>{
    const c=r.coldInvocation;invocations.push(c);
    assert.equal(c.exit.pid,c.service.serverPid);assert.equal(c.exit.code,0);assert.equal(c.exit.signal,null);
    assert.equal(c.exit.compilerExit.pid,c.service.compiler.pid);assert.equal(c.exit.compilerExit.code,0);assert.equal(c.exit.compilerExit.signal,null);
    for(const pid of [c.exit.pid,c.exit.compilerExit.pid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
  };
  try{
    const seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
    const pending=target.compile(seed,source,path.join(directory,'c1.rbc'));
    await assert.rejects(()=>target.compile(seed,source),/RCLC_COLD_BACKPRESSURE/u);
    const first=await pending;ended(first);assert.deepEqual(first.bytecode,fs.readFileSync(seed));
    const next=await target.compile(path.join(directory,'c1.rbc'),source);ended(next);assert.deepEqual(next.bytecode,first.bytecode);
    assert.notEqual(first.coldInvocation.service.serverPid,next.coldInvocation.service.serverPid);
    assert.notEqual(first.nativeCompilerTrace.nativePid,next.nativeCompilerTrace.nativePid);
    const denied=await target.verifyUnauthorizedRejection();ended(denied);assert.equal(denied.unauthorized.status,403);
    const file=path.join(directory,'case.rcl'),text='reality ColdCompiler { facet value : Number = 9 + 2 }';fs.writeFileSync(file,text);
    const compiled=await target.compile(seed,file,file+'.rbc');ended(compiled);assert.deepEqual(compiled.bytecode,compileRealityToBytecode(text));
    const run=await target.execute(file+'.rbc',compileReality(text).programRoot);ended(run);assert.equal(run.result.state.value,11);
    fs.writeFileSync(file,'realty Invalid {}');await assert.rejects(()=>target.compile(seed,file),e=>{ended(e);return /RCL_SEMANTIC_ASSERT/u.test(e.message);});
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');fs.writeFileSync(file,text);
    await assert.rejects(()=>target.compile(corrupt,file),e=>{ended(e);return /RCL_NATIVE_TRUNCATED/u.test(e.message);});
    const recovered=await target.compile(seed,file);ended(recovered);assert.deepEqual(recovered.bytecode,compiled.bytecode);
    assert.equal(new Set(invocations.map(c=>c.id)).size,invocations.length);
    await target.dispose();await assert.rejects(()=>target.compile(seed,file),/RCLC_COLD_CLOSED/u);
  }finally{
    await target.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('rcl-cold-compiler-test-'));fs.rmSync(directory,{recursive:true,force:true});
  }
});
