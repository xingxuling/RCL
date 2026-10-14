import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSqliteCompilerTarget} from '../src/index.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
test('SQLite functions self-compile supplied generations, persist jobs, rollback failures and recover after reopen',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-sqlite-compiler-test-')),target=await createSqliteCompilerTarget();
  const committed=r=>{
    assert.equal(r.transaction.completion,'COMMIT');assert.equal(r.transaction.sqlInvocations,1);assert.equal(r.transaction.after.jobs,r.transaction.before.jobs+1);
    assert.deepEqual(target.inspectJob(r.transaction.id),r.transaction.persisted);assert.equal(r.nativeTrace.status,0);assert.equal(r.nativeTrace.signal,null);
    assert.equal(r.nativeTrace.exitObservedBeforeSqlReturn,true);assert.throws(()=>process.kill(r.nativeTrace.pid,0),e=>e.code==='ESRCH');
  };
  const rolled=e=>{assert.equal(e.transaction.completion,'ROLLBACK');assert.equal(e.transaction.sqlInvocations,1);assert.deepEqual(e.transaction.before,e.transaction.after);assert.equal(e.transaction.persisted,null);assert.equal(target.inspectJob(e.transaction.id),null);assert.equal(e.nativeTrace.status,0);assert.equal(e.nativeTrace.signal,null);assert.equal(e.nativeTrace.exitObservedBeforeSqlReturn,true);assert.throws(()=>process.kill(e.nativeTrace.pid,0),error=>error.code==='ESRCH');return true;};
  try{
    const seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
    const first=target.compile(seed,source,path.join(directory,'c1.rbc'));committed(first);assert.deepEqual(first.bytecode,fs.readFileSync(seed));
    const next=target.compile(path.join(directory,'c1.rbc'),source);committed(next);assert.deepEqual(next.bytecode,first.bytecode);
    const file=path.join(directory,'case.rcl'),text='reality SqliteCompiler { facet value : Number = 9 + 2 }';fs.writeFileSync(file,text);
    const compiled=target.compile(seed,file,file+'.rbc');committed(compiled);assert.deepEqual(compiled.bytecode,compileRealityToBytecode(text));
    const run=target.execute(file+'.rbc',compileReality(text).programRoot);committed(run);assert.equal(run.result.state.value,11);
    const persisted=target.inspectJob(first.transaction.id);const reopened=target.reopen();assert.deepEqual(reopened.before,reopened.after);assert.deepEqual(target.inspectJob(first.transaction.id),persisted);
    fs.writeFileSync(file,'reality RollbackNewArtifact { facet value : Number = 47 }');assert.throws(()=>target.compile(seed,file,undefined,{expectedArtifactHash:'0'.repeat(64)}),e=>rolled(e)&&/EXPECTED_ARTIFACT_MISMATCH/u.test(e.message));
    fs.writeFileSync(file,'realty Invalid {}');assert.throws(()=>target.compile(seed,file),e=>rolled(e)&&/RCL_SEMANTIC_ASSERT/u.test(e.message));
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');fs.writeFileSync(file,text);assert.throws(()=>target.compile(corrupt,file),e=>rolled(e)&&/RCL_NATIVE_TRUNCATED/u.test(e.message));
    assert.throws(()=>target.execute(file+'.rbc','0'.repeat(64)),e=>rolled(e)&&/SOURCE_ROOT_MISMATCH/u.test(e.message));
    const recovered=target.compile(seed,source);committed(recovered);assert.deepEqual(recovered.bytecode,first.bytecode);
    target.dispose();assert.throws(()=>target.inspectCounts(),/RCLC_SQLITE_CLOSED/u);
  }finally{target.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-sqlite-compiler-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
