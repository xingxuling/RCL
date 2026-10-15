import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {createGpuCompilerTarget} from '../src/gpu-compiler-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function createSelfhostTarget(environment,contract,directory){
  assert.equal(environment,'gpu');const service=await createGpuCompilerTarget({pythonPath:contract.python.binaryPath,timeoutMs:240000});
  assert.equal(service.binding.kernelHash,contract.kernelHash);assert.deepEqual(service.binding.sourceBindings,contract.runtimeSourceBindings);
  const binding={...service.binding,session:randomUUID(),acquisitionRoot:ROOT},ledger=[];let shutdown;
  async function call(kind,args){const started=performance.now(),options=args.options??{},t={index:ledger.length,nonce:randomUUID(),session:binding.session,environment,kind,options:{timeout:options.timeout??null,signalProvided:!!options.signal,progress:options.progress===true}};ledger.push(t);
    try{if(kind==='compile'){t.inputCompilerHash=sha(fs.readFileSync(args.compilerFile));t.source=fs.readFileSync(args.sourceFile,'utf8');t.sourceHash=sha(t.source);assert.ok(path.resolve(args.outputFile).startsWith(path.resolve(directory)+path.sep));
        const result=await service.compile(args.compilerFile,args.sourceFile,args.outputFile,options);t.outputHash=sha(result.bytecode);t.outputBytes=result.bytecode.length;t.gpuTrace=result.compilerTrace;t.metrics={origin:'GPU_TRACE_DERIVED_NO_NATIVE_ABI_CLAIM',status:'ok',bytes:t.outputBytes,executedInstructions:t.gpuTrace.executedInstructions,instructionBudget:300000000};}
      else{t.artifactHash=sha(fs.readFileSync(args.artifactFile));t.sourceRoot=args.sourceRoot;const result=await service.execute(args.artifactFile,args.sourceRoot,options);t.result=result.result;t.gpuTrace=result.gpuTrace;}
      t.ms=performance.now()-started;return t;
    }catch(error){t.ms=performance.now()-started;t.error={code:error.code??null,message:error.message};t.gpuTrace=error.gpuTrace??null;t.gpuTransport=error.gpuTransport??null;t.gpuProcessExit=error.gpuProcessExit??null;error.traceIndex=t.index;throw error;}finally{fs.writeFileSync(path.join(directory,'job-'+t.index+'.json'),JSON.stringify(t)+'\n');}
  }
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>service.exits(),get shutdown(){return shutdown;},
    compile:(compilerFile,sourceFile,outputFile,options)=>call('compile',{compilerFile,sourceFile,outputFile,options}),
    execute:(artifactFile,sourceRoot,options)=>call('execute',{artifactFile,sourceRoot,options}),
    async compileExecute(compilerFile,sourceFile,outputFile,sourceRoot){const compiled=await target.compile(compilerFile,sourceFile,outputFile),executed=await target.execute(outputFile,sourceRoot);return{compiled,executed};},
    async verifyLifecycle(compilerFile,sourceFile,outputFile,programFile,sourceRoot){const denied=outputFile+'.denied';
      let wrongRoot,preAborted,timeout,cancelled;try{await target.execute(programFile,'0'.repeat(64));assert.fail('Source root admitted');}catch(e){wrongRoot=e.traceIndex;assert.equal(e.code,'RCL_GPU_SOURCE_ROOT_MISMATCH');}
      const aborted=new AbortController();aborted.abort();try{await target.compile(compilerFile,sourceFile,denied,{signal:aborted.signal});assert.fail('Pre-aborted compile');}catch(e){preAborted=e.traceIndex;assert.equal(e.code,'RCL_GPU_CANCELLED');}
      const first=await target.execute(programFile,sourceRoot),reset=await service.reset(),next=await target.execute(programFile,sourceRoot);assert.deepEqual(first.result,next.result);
      const sourceSnapshot=fs.readFileSync(sourceFile),compilerSnapshot=fs.readFileSync(compilerFile);const snapSource=outputFile+'.snapshot.rcl',snapCompiler=outputFile+'.snapshot.rbc';fs.writeFileSync(snapSource,sourceSnapshot);fs.writeFileSync(snapCompiler,compilerSnapshot);
      const pending=target.compile(snapCompiler,snapSource,outputFile+'.snapshot-output.rbc');fs.writeFileSync(snapSource,'realty Altered {}');fs.writeFileSync(snapCompiler,'RCLB');let backpressure;
      try{await service.compile(compilerFile,sourceFile,denied);assert.fail('Concurrent compile admitted');}catch(e){assert.equal(e.code,'RCL_GPU_BACKPRESSURE');backpressure={rejected:true,code:e.code};}
      const snapshot=await pending;assert.equal(snapshot.sourceHash,sha(sourceSnapshot));assert.equal(snapshot.inputCompilerHash,sha(compilerSnapshot));assert.equal(snapshot.outputHash,contract.compilerHash);
      try{await target.compile(compilerFile,sourceFile,denied,{timeout:contract.controlOptions.fullCompilerTimeoutMs,progress:true});assert.fail('Full compiler timeout unenforced');}catch(e){timeout=e.traceIndex;assert.equal(e.code,'RCL_GPU_REQUEST_TIMEOUT');}
      // Process readiness is a separate cold-start boundary. The cancellation
      // delay applies to the actual dispatched job, after a fresh context is ready.
      const cancelReady=(await service.reset()).after;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),contract.controlOptions.cancelAfterMs);try{await target.compile(compilerFile,sourceFile,denied,{signal:controller.signal,progress:true});assert.fail('Full compiler cancellation unenforced');}catch(e){cancelled=e.traceIndex;assert.equal(e.code,'RCL_GPU_CANCELLED');}finally{clearTimeout(timer);}
      assert.equal(fs.existsSync(denied),false);const recovery=await target.compile(compilerFile,sourceFile,outputFile);assert.equal(recovery.outputHash,contract.compilerHash);
      return{wrongRoot,preAborted,first:first.index,next:next.index,reset,snapshot:snapshot.index,backpressure,timeout,cancelReady,cancelled,deniedOutputPublished:false,recovery:recovery.index};
    },async dispose(){shutdown=await service.dispose();return shutdown;},
  };return target;
}
