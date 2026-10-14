import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {createPhaseCompilerTarget} from '../src/phase-compiler-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function createSelfhostTarget(environment,contract,directory){
  assert.ok(contract.environments.includes(environment));const runtime=contract.runtimeArtifacts.find(r=>r.environment===environment),service=await createPhaseCompilerTarget(environment),ledger=[],exits=[];let disposed=false;
  assert.deepEqual(service.binding.graph.stages[0].compiler.binary,runtime.compiler);assert.deepEqual(service.binding.graph.stages[1].vm,runtime.vm);
  const binding={environment,session:service.binding.graph.session,runtime,acquisitionRoot:ROOT,referenceCompilationUsed:false,referenceExecutionUsed:false,compilerLocation:'COMPILER_STAGE_NATIVE_C_ABI',executionOwner:'RCL_CONTROLLED_NATIVE_COMPILER_AND_VM',service:service.binding.graph,controller:service.binding.controller,compileRootKind:service.binding.compileRootKind,executeRootKind:service.binding.executeRootKind,securitySandboxClaimed:false,externalStreamClaimed:false,multiHostClaimed:false,physicalTimeOrWorldClaimed:false,externalToolEffectsClaimed:false};
  function trace(kind,{compilerFile,sourceFile,artifactFile,sourceRoot}){return{index:ledger.length,nonce:randomUUID(),session:binding.session,environment,kind,inputCompilerHash:kind==='compile'?sha(fs.readFileSync(compilerFile)):null,source:sourceFile?fs.readFileSync(sourceFile,'utf8'):null,sourceHash:sourceFile?sha(fs.readFileSync(sourceFile)):null,artifactHash:artifactFile?sha(fs.readFileSync(artifactFile)):null,sourceRoot:sourceRoot??null};}
  function capture(t,stage){t.stageTrace=stage;if(t.kind==='compile'){t.nativeCompilerTrace=stage.nativeCompilerTrace;t.metrics=stage.nativeCompilerTrace.metrics;t.pid=t.metrics.pid;t.stdout=stage.nativeCompilerTrace.replyLine;}else{t.nativeExecutionTrace=stage.nativeExecutionTrace;t.pid=stage.nativeExecutionTrace.pid;t.stdout=stage.nativeExecutionTrace.stdout;exits.push({kind:'execute',pid:t.pid,code:stage.nativeExecutionTrace.status,signal:stage.nativeExecutionTrace.signal,artifactHash:t.artifactHash});}t.stdoutHash=sha(t.stdout);t.replyObserved=true;}
  async function call(kind,args){const started=performance.now(),t=trace(kind,args);try{let r;if(kind==='compile'){assert.ok(path.resolve(args.outputFile).startsWith(path.resolve(directory)+path.sep));r=await service.compile(args.compilerFile,args.sourceFile,args.outputFile);t.outputHash=sha(r.bytecode);t.outputBytes=r.bytecode.length;}else{r=await service.execute(args.artifactFile,args.sourceRoot);t.result=r.result;}capture(t,r.stageTrace);t.phaseTrace=r.phaseTrace;t.status=0;t.ms=performance.now()-started;ledger.push(t);return t;}catch(error){if(error.stageTrace?.nativeCalled)capture(t,error.stageTrace);t.phaseTrace=error.phaseTrace??null;t.status=1;t.ms=performance.now()-started;t.error={code:error.code??null,message:error.message};ledger.push(t);throw Object.assign(error,{traceIndex:t.index});}}
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>structuredClone(exits),controllerLedger:()=>service.controllerLedger(),compile:(compilerFile,sourceFile,outputFile)=>call('compile',{compilerFile,sourceFile,outputFile}),execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),
    async compileExecute(compilerFile,sourceFile,outputFile,sourceRoot){const compiled=await target.compile(compilerFile,sourceFile,outputFile),executed=await target.execute(outputFile,sourceRoot);return{compiled,executed};},
    async verifyLifecycle(compilerFile,sourceFile,outputFile,artifactFile,sourceRoot){
      const reversal=await service.verifyTimeReversal(sourceRoot),guardStart=service.controllerLedger().length;await service.pause();const paused=service.snapshotController(),deniedFile=path.join(directory,'denied-output.rbc');let deniedCompile,deniedExecute;
      try{await target.compile(compilerFile,sourceFile,deniedFile);assert.fail('Paused compiler admitted');}catch(error){assert.equal(error.code,'RCL_AUTHORITY_DENIED');deniedCompile=error.traceIndex;}assert.equal(fs.existsSync(deniedFile),false);
      try{await target.execute(artifactFile,sourceRoot);assert.fail('Paused execution admitted');}catch(error){assert.equal(error.code,'RCL_AUTHORITY_DENIED');deniedExecute=error.traceIndex;}
      await service.resume();const guardEnd=service.controllerLedger().length,pending=target.compile(compilerFile,sourceFile,outputFile);let backpressure;
      try{await service.execute(artifactFile,sourceRoot);}catch(error){assert.equal(error.message,'RCLC_PHASE_BACKPRESSURE');backpressure={rejected:true,message:error.message};}assert.ok(backpressure?.rejected);
      const recovered=await pending,first=await target.execute(artifactFile,sourceRoot),next=await target.execute(artifactFile,sourceRoot);assert.deepEqual(first.result,next.result);
      return{reversal,guardRange:{start:guardStart,end:guardEnd},pausedStateRoot:paused.stateRoot,deniedCompile,deniedExecute,deniedOutputPublished:false,backpressure,recovery:recovered.index,first:first.index,next:next.index};
    },
    async dispose(){if(disposed)return;disposed=true;const ended=await service.dispose(),compilerExit=ended.graph.shutdown[0].compilerExit;exits.push({...compilerExit,kind:'compile'},...ended.graph.exits.map(e=>({...e,kind:'stage-worker'})));target.shutdown=ended;}};
  return target;
}
