import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {createCompilerDataflowTarget} from '../src/compiler-dataflow-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function createSelfhostTarget(environment,contract,directory){
  assert.equal(environment,'dataflow-runtime');const runtime=contract.runtimeArtifacts.find(r=>r.environment===environment),service=await createCompilerDataflowTarget(),ledger=[],exits=[];let disposed=false;
  assert.deepEqual(service.binding.stages.find(s=>s.role==='compile').compiler.binary,runtime.compiler);assert.deepEqual(service.binding.stages.find(s=>s.role==='execute').vm,runtime.vm);
  const binding={environment,session:service.binding.session,runtime,acquisitionRoot:ROOT,referenceCompilationUsed:false,referenceExecutionUsed:false,
    compilerLocation:'COMPILER_STAGE_NATIVE_C_ABI',executionOwner:'COMPILER_TO_VM_WORKER_GRAPH',service:service.binding,securitySandboxClaimed:false,externalStreamClaimed:false,multiHostClaimed:false};
  function trace(kind,{compilerFile,sourceFile,artifactFile,sourceRoot}){return{index:ledger.length,nonce:randomUUID(),session:binding.session,environment,kind,inputCompilerHash:kind==='compile'?sha(fs.readFileSync(compilerFile)):null,
    source:sourceFile?fs.readFileSync(sourceFile,'utf8'):null,sourceHash:sourceFile?sha(fs.readFileSync(sourceFile)):null,artifactHash:artifactFile?sha(fs.readFileSync(artifactFile)):null,sourceRoot:sourceRoot??null};}
  function capture(t,stage){
    t.stageTrace=stage;
    if(t.kind==='compile'){t.nativeCompilerTrace=stage.nativeCompilerTrace;t.metrics=stage.nativeCompilerTrace.metrics;t.pid=t.metrics.pid;t.stdout=stage.nativeCompilerTrace.replyLine;}
    else{t.nativeExecutionTrace=stage.nativeExecutionTrace;t.pid=stage.nativeExecutionTrace.pid;t.stdout=stage.nativeExecutionTrace.stdout;exits.push({kind:'execute',pid:t.pid,code:stage.nativeExecutionTrace.status,signal:stage.nativeExecutionTrace.signal,artifactHash:t.artifactHash});}
    t.stdoutHash=sha(t.stdout);t.replyObserved=true;
  }
  async function call(kind,args){
    const started=performance.now(),t=trace(kind,args);
    try{
      let r;if(kind==='compile'){assert.ok(path.resolve(args.outputFile).startsWith(path.resolve(directory)+path.sep));r=await service.compile(args.compilerFile,args.sourceFile,args.outputFile);t.outputHash=sha(r.bytecode);t.outputBytes=r.bytecode.length;}
      else{r=await service.execute(args.artifactFile,args.sourceRoot);t.result=r.result;}
      capture(t,r.stageTrace);t.status=0;t.ms=performance.now()-started;ledger.push(t);return t;
    }catch(error){if(error.stageTrace?.nativeCalled)capture(t,error.stageTrace);t.status=1;t.ms=performance.now()-started;t.error={code:error.code??null,message:error.message};ledger.push(t);throw Object.assign(error,{traceIndex:t.index});}
  }
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>structuredClone(exits),compile:(compilerFile,sourceFile,outputFile)=>call('compile',{compilerFile,sourceFile,outputFile}),execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),
    async compileExecute(compilerFile,sourceFile,outputFile,sourceRoot){
      assert.ok(path.resolve(outputFile).startsWith(path.resolve(directory)+path.sep));const r=await service.compileAndExecute(compilerFile,sourceFile,sourceRoot,outputFile),compiled=trace('compile',{compilerFile,sourceFile});
      capture(compiled,r.compiled.stageTrace);Object.assign(compiled,{status:0,ms:r.compiled.ms,outputHash:sha(r.compiled.bytecode),outputBytes:r.compiled.bytecode.length});ledger.push(compiled);
      const executed=trace('execute',{artifactFile:outputFile,sourceRoot});capture(executed,r.executed.stageTrace);Object.assign(executed,{status:0,ms:r.executed.ms,result:r.executed.result});ledger.push(executed);return{compiled,executed};
    },
    async verifyLifecycle(compilerFile,sourceFile,outputFile,artifactFile,sourceRoot){
      const inputRejection=await service.verifyInputRejection(compilerFile,sourceFile),pending=target.compile(compilerFile,sourceFile,outputFile);let backpressure;
      try{await service.execute(artifactFile,sourceRoot);}catch(error){if(error.message==='RCLC_FLOW_BACKPRESSURE')backpressure={rejected:true,message:error.message};else throw error;}
      assert.ok(backpressure?.rejected);const recovered=await pending,first=await target.execute(artifactFile,sourceRoot),next=await target.execute(artifactFile,sourceRoot);assert.deepEqual(first.result,next.result);
      return{inputRejection,backpressure,recovery:recovered.index,first:first.index,next:next.index};
    },
    async dispose(){if(disposed)return;disposed=true;const ended=await service.dispose(),compilerExit=ended.shutdown.find(s=>s.role==='compile').compilerExit;exits.push({...compilerExit,kind:'compile'},...ended.exits.map(e=>({...e,kind:'stage-worker'})));target.shutdown=ended;}};
  return target;
}
