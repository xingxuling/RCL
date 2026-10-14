import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {createColdCompilerHttpTarget} from '../src/cold-compiler-http-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function createSelfhostTarget(environment,contract,directory){
  assert.equal(environment,'serverless');const runtime=contract.runtimeArtifacts.find(r=>r.environment===environment);
  const service=await createColdCompilerHttpTarget(),ledger=[],exits=[],session=randomUUID();let disposed=false;
  assert.deepEqual(service.binding.compiler,runtime.compiler);assert.deepEqual(service.binding.vm,runtime.vm);
  const binding={environment,session,runtime,acquisitionRoot:ROOT,referenceCompilationUsed:false,referenceExecutionUsed:false,
    compilerLocation:'FRESH_HTTP_HANDLER_NATIVE_C_ABI',executionOwner:'FRESH_HTTP_HANDLER_NATIVE_VM_PROCESS',service:service.binding,securitySandboxClaimed:false,cloudDeploymentClaimed:false};
  function recordExits(cold){
    if(!cold?.exit)return;
    exits.push({...cold.exit.compilerExit,kind:'compile',invocationId:cold.id},{pid:cold.exit.pid,code:cold.exit.code,signal:cold.exit.signal,kind:'server',invocationId:cold.id});
  }
  async function call(kind,{compilerFile,sourceFile,outputFile,artifactFile,sourceRoot}){
    const started=performance.now(),trace={index:ledger.length,nonce:randomUUID(),session,environment,kind,inputCompilerHash:kind==='compile'?sha(fs.readFileSync(compilerFile)):null,
      source:sourceFile?fs.readFileSync(sourceFile,'utf8'):null,sourceHash:sourceFile?sha(fs.readFileSync(sourceFile)):null,artifactHash:artifactFile?sha(fs.readFileSync(artifactFile)):null,sourceRoot:sourceRoot??null};
    try{
      let result;
      if(kind==='compile'){
        assert.ok(path.resolve(outputFile).startsWith(path.resolve(directory)+path.sep));result=await service.compile(compilerFile,sourceFile,outputFile);
        trace.httpTrace=result.httpTrace;trace.nativeCompilerTrace=result.nativeCompilerTrace;trace.metrics=result.nativeCompilerTrace.metrics;trace.pid=trace.metrics.pid;
        trace.stdout=result.nativeCompilerTrace.replyLine;trace.outputHash=sha(result.bytecode);trace.outputBytes=result.bytecode.length;
      }else{
        result=await service.execute(artifactFile,sourceRoot);trace.httpTrace=result.httpTrace;trace.nativeExecutionTrace=result.nativeExecutionTrace;trace.pid=result.nativeExecutionTrace.pid;
        trace.stdout=result.nativeExecutionTrace.stdout;trace.result=result.result;
        exits.push({kind:'execute',pid:trace.pid,code:result.nativeExecutionTrace.status,signal:result.nativeExecutionTrace.signal,artifactHash:trace.artifactHash,invocationId:result.coldInvocation.id});
      }
      trace.coldInvocation=result.coldInvocation;recordExits(result.coldInvocation);
      trace.replyObserved=true;trace.status=0;trace.stdoutHash=sha(trace.stdout);trace.ms=performance.now()-started;ledger.push(trace);return trace;
    }catch(error){
      trace.coldInvocation=error.coldInvocation;recordExits(error.coldInvocation);trace.httpTrace=error.httpTrace;const native=error.httpTrace?.reply.nativeCompilerTrace;
      if(native){trace.nativeCompilerTrace=native;trace.metrics=native.metrics;trace.pid=native.metrics.pid;trace.stdout=native.replyLine;trace.stdoutHash=sha(trace.stdout);trace.replyObserved=true;trace.status=1;}
      trace.ms=performance.now()-started;trace.error={code:error.code??null,message:error.message};ledger.push(trace);throw Object.assign(error,{traceIndex:trace.index});
    }
  }
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>structuredClone(exits),compile:(compilerFile,sourceFile,outputFile)=>call('compile',{compilerFile,sourceFile,outputFile}),execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),
    async verifyLifecycle(compilerFile,sourceFile,outputFile,artifactFile,sourceRoot){
      const denied=await service.verifyUnauthorizedRejection();recordExits(denied.coldInvocation);
      const recovery=await target.compile(compilerFile,sourceFile,outputFile),first=await target.execute(artifactFile,sourceRoot),next=await target.execute(artifactFile,sourceRoot);
      assert.notEqual(first.coldInvocation.id,next.coldInvocation.id);assert.deepEqual(first.result,next.result);
      return{denied,recovery:recovery.index,first:first.index,next:next.index};
    },
    async dispose(){if(disposed)return;disposed=true;await service.dispose();}};
  return target;
}
