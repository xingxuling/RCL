import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {createApplicationCompilerTarget} from '../src/application-compiler-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function createSelfhostTarget(environment,contract,directory){
  const service=await createApplicationCompilerTarget(environment),ai=environment==='ai-runtime',runtime=contract.runtimeArtifacts.find(r=>r.environment===environment),ledger=[],exits=[];let disposed=false;assert.deepEqual(service.binding.compiler.binary,runtime.compiler);assert.deepEqual(service.binding.workflow.binary,runtime.vm);
  const binding={...service.binding,session:randomUUID(),runtime,acquisitionRoot:ROOT};
  function capture(t,n){t.nativeCompilerTrace=n;t.metrics=n.metrics;t.pid=n.metrics.pid;t.stdout=n.replyLine;t.stdoutHash=sha(t.stdout);t.replyObserved=true;if(n.metrics.status==='ok'){t.outputHash=n.artifactHash;t.outputBytes=n.metrics.bytes;}}
  async function call(kind,args){const started=performance.now(),t={index:ledger.length,nonce:randomUUID(),session:binding.session,environment,kind,inputCompilerHash:kind==='compile'?sha(fs.readFileSync(args.compilerFile)):null,source:args.sourceFile?fs.readFileSync(args.sourceFile,'utf8'):null,sourceHash:args.sourceFile?sha(fs.readFileSync(args.sourceFile)):null,artifactHash:args.artifactFile?sha(fs.readFileSync(args.artifactFile)):null,sourceRoot:args.sourceRoot??null,options:args.options??{}};
    try{let result;if(kind==='compile'){assert.ok(path.resolve(args.outputFile).startsWith(path.resolve(directory)+path.sep));result=await service.compile(args.compilerFile,args.sourceFile,args.outputFile,args.options);capture(t,result.compilerTrace);t.workflowTrace=result.workflowTrace;t.outputHash=sha(result.bytecode);t.outputBytes=result.bytecode.length;}
      else{result=await service.execute(args.artifactFile,args.sourceRoot);t.applicationTrace=result.applicationTrace;t.runtimeTrace=ai?result.aiTrace:result.scientificTrace;t.nativeExecutionTrace=t.runtimeTrace.programTrace;t.pid=t.nativeExecutionTrace.processPid;t.result=result.result;exits.push({kind:'execute',pid:t.pid,code:t.nativeExecutionTrace.status,signal:t.nativeExecutionTrace.signal,artifactHash:t.artifactHash});}
      t.status=0;t.ms=performance.now()-started;ledger.push(t);return t;
    }catch(error){if(error.compilerTrace)capture(t,error.compilerTrace);t.workflowTrace=error.workflowFailure??null;t.applicationTrace=error.applicationFailure??null;t.status=1;t.ms=performance.now()-started;t.error={code:error.code??null,message:error.message};ledger.push(t);throw Object.assign(error,{traceIndex:t.index});}
  }
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>structuredClone(exits),controllerLedger:()=>service.controllerLedger(),observerRecords:()=>service.observerRecords(),compile:(compilerFile,sourceFile,outputFile,options)=>call('compile',{compilerFile,sourceFile,outputFile,options}),execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),
    async compileExecute(compilerFile,sourceFile,outputFile,sourceRoot){const compiled=await target.compile(compilerFile,sourceFile,outputFile),executed=await target.execute(outputFile,sourceRoot);return{compiled,executed};},
    async verifyLifecycle(compilerFile,sourceFile,outputFile,artifactFile,sourceRoot){const guardStart=service.controllerLedger().length;await service.pause();const paused=service.snapshotController(),deniedFile=path.join(directory,'denied-output.rbc');let deniedCompile,deniedExecute,wrongModel,publicationDenied;
      try{await target.compile(compilerFile,sourceFile,deniedFile);assert.fail('Paused compile admitted');}catch(error){assert.equal(error.code,'RCL_AUTHORITY_DENIED');deniedCompile=error.traceIndex;}
      try{await target.execute(artifactFile,sourceRoot);assert.fail('Paused execute admitted');}catch(error){assert.equal(error.code,'RCL_AUTHORITY_DENIED');deniedExecute=error.traceIndex;}await service.resume();const guardEnd=service.controllerLedger().length;
      if(ai){try{await target.compile(compilerFile,sourceFile,deniedFile,{expectedModelRoot:'0'.repeat(64)});assert.fail('Foreign model admitted');}catch(error){assert.equal(error.code,'RCL_AUTHORITY_DENIED');wrongModel=error.traceIndex;}}
      const kernel=ai?null:fs.readFileSync(path.join(ROOT,binding.workflow.kernel.path),'utf8'),options=ai?{requestsAuthority:true}:{analysisSource:kernel.replace('sequence_get(internal.moments, 1) / result.count','sequence_get(internal.moments, 1) / result.count + 1')};if(!ai)assert.notEqual(options.analysisSource,kernel);
      try{await target.compile(compilerFile,sourceFile,deniedFile,options);assert.fail('Invalid publication admitted');}catch(error){assert.equal(error.code,'RCL_AUTHORITY_DENIED');publicationDenied=error.traceIndex;}assert.equal(fs.existsSync(deniedFile),false);
      const pending=target.compile(compilerFile,sourceFile,outputFile);let backpressure;try{await service.execute(artifactFile,sourceRoot);}catch(error){assert.equal(error.message,'RCLC_APPLICATION_BACKPRESSURE');backpressure={rejected:true,message:error.message};}assert.ok(backpressure?.rejected);const recovered=await pending,first=await target.execute(artifactFile,sourceRoot),next=await target.execute(artifactFile,sourceRoot);assert.deepEqual(first.result,next.result);
      return{guardRange:{start:guardStart,end:guardEnd},pausedStateRoot:paused.stateRoot,deniedCompile,deniedExecute,wrongModel:wrongModel??null,publicationDenied,deniedOutputPublished:false,backpressure,recovery:recovered.index,first:first.index,next:next.index};
    },
    async dispose(){if(disposed)return;disposed=true;const ended=await service.dispose();exits.push({...ended.compiler,kind:'compile'});target.shutdown=ended;},
  };return target;
}
