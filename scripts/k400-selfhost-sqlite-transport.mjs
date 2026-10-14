import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {ROOT} from './k400-genomes/shared.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),probe=new DatabaseSync(':memory:'),sqliteVersion=probe.prepare('SELECT sqlite_version() AS version').get().version;probe.close();
const compileSql='SELECT rcl_compile(a.bytecode,s.source) AS bytecode FROM artifacts a JOIN sources s ON s.hash=? WHERE a.hash=?',executeSql='SELECT rcl_execute(bytecode,?) AS result FROM artifacts WHERE hash=?';
export function verifySqliteTransport(report,contract){
  const b=report.binding,s=b.service;assert.equal(report.environment,'database');assert.equal(b.environment,'database');assert.deepEqual(b.runtime,contract.runtimeArtifacts[0]);
  assert.equal(b.compilerLocation,'SQLITE_SCALAR_FUNCTION_NATIVE_C_ABI');assert.equal(b.executionOwner,'SQLITE_SCALAR_FUNCTION_NATIVE_VM_PROCESS');
  for(const key of ['referenceCompilationUsed','referenceExecutionUsed','cloudDeploymentClaimed','securitySandboxClaimed'])assert.equal(b[key],false);
  assert.equal(s.owner,'RCL_SQLITE_DYNAMIC_COMPILER');assert.equal(s.environment,'database');assert.equal(s.engine,'SQLite');assert.equal(s.transport,'SQL_SCALAR_FUNCTION_NATIVE_COMPILER_AND_VM');assert.equal(s.session,b.session);
  assert.equal(s.sqliteVersion,sqliteVersion);assert.equal(s.sqliteVersion,contract.sqlite.version);assert.equal(s.schemaHash,contract.sqlite.schemaHash);assert.deepEqual(s.hostRuntime,contract.sqlite.hostRuntime);assert.equal(s.hostRuntime.version,process.version);assert.equal(sha(fs.readFileSync(s.hostRuntime.path)),s.hostRuntime.sha256);
  assert.equal(path.dirname(path.dirname(s.database)),path.resolve(os.tmpdir()));assert.ok(path.basename(path.dirname(s.database)).startsWith('rcl-sqlite-compiler-'));assert.equal(path.basename(s.database),'runtime.sqlite');
  assert.deepEqual(s.compiler,b.runtime.compiler);assert.deepEqual(s.vm,b.runtime.vm);for(const key of ['referenceCompilationUsed','referenceExecutionUsed','opaqueSqlSemanticDelegation','cloudDeploymentClaimed','securitySandboxClaimed'])assert.equal(s[key],false);
  for(const f of [s.compiler,s.vm,...s.compilerSourceBindings])assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256);
  const ids=new Set(),tokens=new Set(),artifacts=new Set(),sources=new Set(),expectedExits=[];let jobs=0;
  const counts=()=>({artifacts:artifacts.size,sources:sources.size,jobs,isTransaction:false});
  for(const t of report.ledger){
    const x=t.transaction,n=t.kind==='compile'?t.nativeCompilerTrace:t.nativeExecutionTrace;
    assert.equal(t.index,report.ledger.indexOf(t));assert.equal(t.session,b.session);assert.equal(t.environment,'database');assert.equal(t.replyObserved,true);assert.equal(t.stdoutHash,sha(t.stdout));assert.match(x.id,/^[0-9a-f-]{36}$/u);assert.ok(!ids.has(x.id));ids.add(x.id);
    assert.equal(x.kind,t.kind);assert.equal(x.session,b.session);assert.equal(x.begin,'BEGIN IMMEDIATE');assert.equal(x.sqlFunction,t.kind==='compile'?'rcl_compile':'rcl_execute');assert.equal(x.sql,t.kind==='compile'?compileSql:executeSql);assert.equal(x.sqlInvocations,1);assert.deepEqual(x.before,counts());assert.equal(x.inputHash,t.kind==='compile'?t.inputCompilerHash:t.artifactHash);assert.equal(x.sourceHash,t.sourceHash);assert.equal(x.sourceRoot,t.sourceRoot);
    assert.equal(n.kind,t.kind);assert.equal(n.pid,t.pid);assert.ok(n.pid>0);assert.equal(n.status,0);assert.equal(n.signal,null);assert.equal(n.exitObservedBeforeSqlReturn,true);assert.equal(n.stdoutHash,sha(n.stdout));assert.equal(n.stderrHash,sha(n.stderr));
    if(t.kind==='compile'){
      assert.equal(path.normalize(n.command),path.join(b.acquisitionRoot,s.compiler.path));assert.deepEqual(n.args,[path.dirname(s.database),n.token]);assert.match(n.token,/^[0-9a-f-]{36}$/u);assert.ok(!tokens.has(n.token));tokens.add(n.token);
      assert.equal(n.compilerHash,t.inputCompilerHash);assert.equal(n.sourceHash,t.sourceHash);assert.equal(t.sourceHash,sha(t.source));assert.equal(n.stdin,n.frame+'\nQUIT\n');assert.equal(n.stdinHash,sha(n.stdin));
      assert.deepEqual(n.stdout.trim().split(/\r?\n/u),[n.readyReply,n.replyLine]);assert.deepEqual(n.ready,JSON.parse(n.readyReply));assert.deepEqual(n.metrics,JSON.parse(n.replyLine));assert.equal(t.stdout,n.replyLine);assert.deepEqual(t.metrics,n.metrics);
      assert.equal(n.ready.status,'ready');assert.equal(n.ready.protocol,'RCL_COMPILER_ABI_FILES_V1');for(const item of [n.ready,n.metrics]){assert.equal(item.pid,n.pid);assert.equal(item.token,n.token);}assert.equal(n.metrics.request,1);
      const names=n.frame.split('\t');assert.equal(names.length,4);assert.equal(names[0],'COMPILE');assert.equal(names[1],t.inputCompilerHash+'.rbc');assert.equal(names[2],t.sourceHash+'.rcl');assert.match(names[3],/^[0-9a-f-]{36}\.rbc$/u);
      if(!t.error){assert.equal(n.metrics.status,'ok');assert.equal(n.metrics.outputState,'compiler.output');assert.equal(n.metrics.instructionBudget,300000000);assert.equal(n.metrics.bytes,t.outputBytes);assert.equal(n.artifactHash,t.outputHash);}
    }else{
      assert.equal(path.normalize(n.command),path.join(b.acquisitionRoot,s.vm.path));assert.deepEqual(n.args,[path.join(path.dirname(s.database),t.artifactHash+'.rbc')]);assert.equal(n.stdin,null);assert.equal(n.stdinHash,null);assert.equal(n.stdout,t.stdout);assert.equal(n.artifactHash,t.artifactHash);assert.equal(n.sourceRoot,t.sourceRoot);
      const result=verifyNativeSemanticStateRoot(JSON.parse(n.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});if(!t.error)assert.deepEqual(t.result,result);
    }
    if(t.error){assert.equal(t.status,1);assert.equal(x.completion,'ROLLBACK');assert.equal(x.persisted,null);assert.deepEqual(x.after,x.before);}
    else{
      assert.equal(t.status,0);assert.equal(x.completion,'COMMIT');assert.equal(x.nativeCapturedBeforeCommit,true);artifacts.add(x.inputHash);if(t.kind==='compile'){artifacts.add(t.outputHash);sources.add(t.sourceHash);}jobs++;
      assert.deepEqual(x.after,counts());const p=x.persisted,r=p.record;assert.deepEqual(r,x.stagedRecord);assert.deepEqual(r,{id:x.id,kind:t.kind,input_hash:x.inputHash,source_hash:t.sourceHash,output_hash:t.kind==='compile'?t.outputHash:null,source_root:t.kind==='execute'?t.result.sourceRoot:null,state_root:t.kind==='execute'?t.result.stateRoot:null,result:t.kind==='compile'?JSON.stringify({artifactHash:t.outputHash,bytes:t.outputBytes}):JSON.stringify(t.result)});
      assert.equal(p.inputHash,x.inputHash);assert.equal(p.sourceHash,t.sourceHash);assert.equal(p.outputHash,r.output_hash);assert.equal(p.resultHash,sha(r.result));
    }
    expectedExits.push({kind:t.kind,pid:t.pid,code:n.status,signal:n.signal,transactionId:x.id});
  }
  assert.deepEqual(report.nativeExits,expectedExits);const c=report.runtimeControl,g=report.ledger[c.persistedGeneration.trace];assert.equal(c.persistedGeneration.trace,0);assert.deepEqual(c.persistedGeneration.before,g.transaction.persisted);assert.deepEqual(c.persistedGeneration.after,c.persistedGeneration.before);assert.equal(c.reopen.reopened,true);assert.equal(c.reopen.sqliteVersion,s.sqliteVersion);assert.deepEqual(c.reopen.before,c.reopen.after);assert.deepEqual(c.reopen.after,report.ledger[c.compilationRollback].transaction.before);
  const rollback=report.ledger[c.compilationRollback];assert.equal(rollback.source,contract.rollbackSource);assert.equal(rollback.transaction.expectedArtifactHash,'0'.repeat(64));assert.match(rollback.error.message,/EXPECTED_ARTIFACT_MISMATCH/u);assert.equal(rollback.nativeCompilerTrace.metrics.status,'ok');assert.equal(rollback.nativeCompilerTrace.artifactHash,sha(compileRealityToBytecode(rollback.source)));assert.deepEqual(rollback.transaction.before,rollback.transaction.after);
  const denied=report.ledger[c.executionRollback];assert.equal(denied.sourceRoot,'0'.repeat(64));assert.match(denied.error.message,/SOURCE_ROOT_MISMATCH/u);assert.deepEqual(denied.transaction.before,denied.transaction.after);
  const recovered=report.ledger[c.recovery],first=report.ledger[c.first],next=report.ledger[c.next];assert.equal(recovered.outputHash,contract.compilerHash);assert.ok(recovered.index>c.executionRollback);assert.notEqual(first.transaction.id,next.transaction.id);assert.deepEqual(first.result,next.result);
}
