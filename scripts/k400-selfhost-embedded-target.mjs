import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {createResidentSequenceCompiler} from '../src/resident-sequence-compiler.mjs';
import {EmbeddedNativeVm} from '../src/embedded-vm.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

export async function createSelfhostTarget(environment,contract,directory){
  assert.equal(environment,'embedded-runtime');
  const runtime=contract.runtimeArtifacts.find(r=>r.environment===environment);assert.ok(runtime);
  for(const f of [runtime.compiler,runtime.vm])assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256);
  const compiler=await createResidentSequenceCompiler(),session=randomUUID(),ledger=[],exits=[],instances=new Map();let disposed=false;
  const binding={environment,session,runtime,acquisitionRoot:ROOT,referenceCompilationUsed:false,referenceExecutionUsed:false,
    compilerSemanticsOwner:'RCL_GENERAL_COMPILER_SOURCE',compilerLocation:'CALLER_OWNED_RESIDENT_NATIVE_C_ABI',
    compiler:compiler.binding,executionOwner:'CALLER_OWNED_NATIVE_VM_C_ABI',protocol:'RUN_RESET',microcontrollerOrHardwareClaimed:false,securitySandboxClaimed:false};
  async function instance(file){
    const hash=sha(fs.readFileSync(file));let item=instances.get(hash);
    if(!item){
      // EmbeddedNativeVm spawns synchronously and inherits the environment.
      // Scope the native root selection to this spawn, then restore the caller.
      const oldAlgorithm=process.env.RCL_SEMANTIC_STATE_ROOT_ALGORITHM;let vm;
      try{process.env.RCL_SEMANTIC_STATE_ROOT_ALGORITHM='rcl.semantic-state-root.v2';vm=new EmbeddedNativeVm(file,{daemonPath:path.join(ROOT,runtime.vm.path)});}
      finally{if(oldAlgorithm===undefined)delete process.env.RCL_SEMANTIC_STATE_ROOT_ALGORITHM;else process.env.RCL_SEMANTIC_STATE_ROOT_ALGORITHM=oldAlgorithm;}
      const wire=[];
      vm.lines.on('line',line=>wire.push(line));
      const exit=new Promise(resolve=>vm.process.once('exit',(code,signal)=>resolve({pid:vm.process.pid,code,signal,kind:'execute',artifactHash:hash})));
      item={vm,wire,exit,hash,ready:await vm.ready,runs:0};assert.equal(item.ready.status,'ready');instances.set(hash,item);
    }
    return item;
  }
  async function call(kind,{compilerFile,sourceFile,outputFile,artifactFile,sourceRoot}){
    if(disposed)throw new Error('RCL_SELFHOST_EMBEDDED_CLOSED');
    const started=performance.now(),trace={index:ledger.length,nonce:randomUUID(),session,environment,kind,
      inputCompilerHash:kind==='compile'?sha(fs.readFileSync(compilerFile)):null,source:sourceFile?fs.readFileSync(sourceFile,'utf8'):null,
      sourceHash:sourceFile?sha(fs.readFileSync(sourceFile)):null,artifactHash:artifactFile?sha(fs.readFileSync(artifactFile)):null,sourceRoot:sourceRoot??null};
    try{
      if(kind==='compile'){
        assert.ok(path.resolve(outputFile).startsWith(path.resolve(directory)+path.sep));
        const value=await compiler.compile(compilerFile,sourceFile,outputFile);
        trace.nativeCompilerTrace=value.compilerTrace;trace.pid=value.compilerTrace.nativePid;
        trace.metrics=value.compilerTrace.metrics;trace.stdout=value.compilerTrace.replyLine;
        trace.outputHash=sha(value.bytecode);trace.outputBytes=value.bytecode.length;
      }else{
        const item=await instance(artifactFile),reply=await item.vm.run({resetState:true});
        item.runs++;trace.pid=item.vm.process.pid;trace.nativeVmTrace={pid:trace.pid,artifactHash:item.hash,
          readyReply:item.wire[0],command:'RUN_RESET',replyLine:item.wire.at(-1),run:item.runs};
        assert.deepEqual(reply,JSON.parse(trace.nativeVmTrace.replyLine));assert.equal(reply.result?.status,'ok');
        trace.stdout=trace.nativeVmTrace.replyLine;trace.result=verifyNativeSemanticStateRoot(reply.result,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
        assert.equal(trace.result.sourceRoot,sourceRoot);
      }
      trace.replyObserved=true;trace.status=0;trace.stdoutHash=sha(trace.stdout);trace.ms=performance.now()-started;ledger.push(trace);return trace;
    }catch(error){
      if(error.compilerTrace){trace.nativeCompilerTrace=error.compilerTrace;trace.metrics=error.compilerTrace.metrics;trace.pid=trace.metrics.pid;trace.stdout=error.compilerTrace.replyLine;trace.replyObserved=true;trace.status=1;trace.stdoutHash=sha(trace.stdout);}
      trace.ms=performance.now()-started;trace.error={code:error.code??null,message:error.message};ledger.push(trace);throw Object.assign(error,{traceIndex:trace.index});
    }
  }
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>structuredClone(exits),
    compile:(compilerFile,sourceFile,outputFile)=>call('compile',{compilerFile,sourceFile,outputFile}),
    execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),
    async verifyLifecycle(compilerFile,sourceFile,outputFile,artifactFile,sourceRoot){
      const recovery=await target.compile(compilerFile,sourceFile,outputFile),first=await target.execute(artifactFile,sourceRoot),next=await target.execute(artifactFile,sourceRoot);
      assert.equal(first.pid,next.pid);assert.deepEqual(first.result,next.result);
      return{recovery:recovery.index,first:first.index,next:next.index};
    },
    async dispose(){
      if(disposed)return;disposed=true;
      try{for(const item of instances.values()){if(item.vm.process.exitCode===null)await item.vm.close();else item.vm.lines.close();const receipt=await item.exit;exits.push(receipt);assert.equal(receipt.code,0);assert.equal(receipt.signal,null);}}
      finally{const receipt=await compiler.dispose();exits.push({...receipt,kind:'compile'});}
    }};
  return target;
}
