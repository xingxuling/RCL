import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {SQLITE_ROLLBACK_SOURCE} from './k400-selfhost-sqlite-definitions.mjs';
import {createSqliteCompilerTarget} from '../src/sqlite-compiler-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function createSelfhostTarget(environment,contract,directory){
  assert.equal(environment,'database');const runtime=contract.runtimeArtifacts.find(r=>r.environment===environment),service=await createSqliteCompilerTarget(),ledger=[],exits=[];let disposed=false;
  assert.deepEqual(service.binding.compiler,runtime.compiler);assert.deepEqual(service.binding.vm,runtime.vm);
  const binding={environment,session:service.binding.session,runtime,acquisitionRoot:ROOT,referenceCompilationUsed:false,referenceExecutionUsed:false,
    compilerLocation:'SQLITE_SCALAR_FUNCTION_NATIVE_C_ABI',executionOwner:'SQLITE_SCALAR_FUNCTION_NATIVE_VM_PROCESS',service:service.binding,cloudDeploymentClaimed:false,securitySandboxClaimed:false};
  function capture(trace,native,transaction){
    trace.transaction=transaction;trace.pid=native.pid;
    if(trace.kind==='compile'){trace.nativeCompilerTrace=native;trace.metrics=native.metrics;trace.stdout=native.replyLine;}
    else{trace.nativeExecutionTrace=native;trace.stdout=native.stdout;}
    trace.stdoutHash=sha(trace.stdout);trace.replyObserved=true;exits.push({kind:trace.kind,pid:native.pid,code:native.status,signal:native.signal,transactionId:transaction.id});
  }
  async function call(kind,{compilerFile,sourceFile,outputFile,artifactFile,sourceRoot,options}){
    const started=performance.now(),trace={index:ledger.length,nonce:randomUUID(),session:binding.session,environment,kind,inputCompilerHash:kind==='compile'?sha(fs.readFileSync(compilerFile)):null,
      source:sourceFile?fs.readFileSync(sourceFile,'utf8'):null,sourceHash:sourceFile?sha(fs.readFileSync(sourceFile)):null,artifactHash:artifactFile?sha(fs.readFileSync(artifactFile)):null,sourceRoot:sourceRoot??null};
    try{
      let result;
      if(kind==='compile'){assert.ok(path.resolve(outputFile).startsWith(path.resolve(directory)+path.sep));result=service.compile(compilerFile,sourceFile,outputFile,options);trace.outputHash=sha(result.bytecode);trace.outputBytes=result.bytecode.length;}
      else{result=service.execute(artifactFile,sourceRoot);trace.result=result.result;}
      capture(trace,result.nativeTrace,result.transaction);trace.status=0;trace.ms=performance.now()-started;ledger.push(trace);return trace;
    }catch(error){
      if(error.nativeTrace&&error.transaction)capture(trace,error.nativeTrace,error.transaction);
      trace.status=1;trace.ms=performance.now()-started;trace.error={code:error.code??null,message:error.message};ledger.push(trace);throw Object.assign(error,{traceIndex:trace.index});
    }
  }
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>structuredClone(exits),compile:(compilerFile,sourceFile,outputFile)=>call('compile',{compilerFile,sourceFile,outputFile}),execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),
    async verifyLifecycle(compilerFile,sourceFile,outputFile,artifactFile,sourceRoot){
      const generation=ledger[0],before=service.inspectJob(generation.transaction.id),reopen=service.reopen(),after=service.inspectJob(generation.transaction.id);assert.deepEqual(before,after);
      const rollbackSource=path.join(directory,'rollback.rcl');fs.writeFileSync(rollbackSource,SQLITE_ROLLBACK_SOURCE);let compilationRollback,executionRollback;
      try{await call('compile',{compilerFile,sourceFile:rollbackSource,outputFile:path.join(directory,'rollback.rbc'),options:{expectedArtifactHash:'0'.repeat(64)}});assert.fail('Expected artifact mismatch admitted');}catch(error){compilationRollback=error.traceIndex;}
      try{await target.execute(artifactFile,'0'.repeat(64));assert.fail('Wrong source root admitted');}catch(error){executionRollback=error.traceIndex;}
      assert.ok(Number.isInteger(compilationRollback)&&Number.isInteger(executionRollback));
      const recovery=await target.compile(compilerFile,sourceFile,outputFile),first=await target.execute(artifactFile,sourceRoot),next=await target.execute(artifactFile,sourceRoot);assert.deepEqual(first.result,next.result);
      return{persistedGeneration:{trace:0,before,after},reopen,compilationRollback,executionRollback,recovery:recovery.index,first:first.index,next:next.index};
    },
    async dispose(){if(disposed)return;disposed=true;service.dispose();}};
  return target;
}
