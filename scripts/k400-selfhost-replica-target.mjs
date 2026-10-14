import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {createReplicatedCompilerTarget} from '../src/replicated-compiler-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function createSelfhostTarget(environment,contract,directory){
  assert.equal(environment,'distributed-runtime');const runtime=contract.runtimeArtifacts[0],service=await createReplicatedCompilerTarget(),ledger=[],exits=[];let disposed=false;
  for(const peer of service.binding.peers){assert.deepEqual(peer.compiler.binary,runtime.compiler);assert.deepEqual(peer.vm,runtime.vm);}
  const binding={environment,session:service.binding.session,runtime,acquisitionRoot:ROOT,referenceCompilationUsed:false,referenceExecutionUsed:false,
    compilerLocation:'TWO_HTTP_PEER_NATIVE_C_ABI',executionOwner:'TWO_HTTP_PEER_NATIVE_VM_QUORUM',service:service.binding,securitySandboxClaimed:false,multiHostClaimed:false,independentImplementationClaimed:false};
  function exitsForService(exit){exits.push({...exit.compilerExit,kind:'compile'},{pid:exit.pid,code:exit.code,signal:exit.signal,kind:'server'});}
  function capture(t,replica){
    t.replicaTrace=replica;const first=replica.peers[0];
    if(t.kind==='compile'){t.nativeCompilerTrace=first.nativeCompilerTrace;t.metrics=first.nativeCompilerTrace.metrics;t.pid=t.metrics.pid;t.stdout=first.nativeCompilerTrace.replyLine;}
    else{t.nativeExecutionTrace=first.nativeExecutionTrace;t.pid=first.nativeExecutionTrace.pid;t.stdout=first.nativeExecutionTrace.stdout;for(const p of replica.peers)exits.push({kind:'execute',pid:p.nativeExecutionTrace.pid,code:p.nativeExecutionTrace.status,signal:p.nativeExecutionTrace.signal,artifactHash:t.artifactHash});}
    t.stdoutHash=sha(t.stdout);t.replyObserved=true;
  }
  async function call(kind,{compilerFile,sourceFile,outputFile,artifactFile,sourceRoot}){
    const started=performance.now(),t={index:ledger.length,nonce:randomUUID(),session:binding.session,environment,kind,inputCompilerHash:kind==='compile'?sha(fs.readFileSync(compilerFile)):null,
      source:sourceFile?fs.readFileSync(sourceFile,'utf8'):null,sourceHash:sourceFile?sha(fs.readFileSync(sourceFile)):null,artifactHash:artifactFile?sha(fs.readFileSync(artifactFile)):null,sourceRoot:sourceRoot??null};
    try{
      let r;if(kind==='compile'){assert.ok(path.resolve(outputFile).startsWith(path.resolve(directory)+path.sep));r=await service.compile(compilerFile,sourceFile,outputFile);t.outputHash=sha(r.bytecode);t.outputBytes=r.bytecode.length;}
      else{r=await service.execute(artifactFile,sourceRoot);t.result=r.result;}
      capture(t,r.replicaTrace);t.status=0;t.ms=performance.now()-started;ledger.push(t);return t;
    }catch(error){if(error.replicaTrace)capture(t,error.replicaTrace);t.status=1;t.ms=performance.now()-started;t.error={code:error.code??null,message:error.message};ledger.push(t);throw Object.assign(error,{traceIndex:t.index});}
  }
  const target={binding,ledger:()=>structuredClone(ledger),exits:()=>structuredClone(exits),compile:(compilerFile,sourceFile,outputFile)=>call('compile',{compilerFile,sourceFile,outputFile}),execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),
    async verifyLifecycle(compilerFile,sourceFile,outputFile,artifactFile,sourceRoot){const peerRecovery=await service.verifyPeerRecovery(compilerFile,sourceFile);exitsForService(peerRecovery.exit);const recovered=await target.compile(compilerFile,sourceFile,outputFile),first=await target.execute(artifactFile,sourceRoot),next=await target.execute(artifactFile,sourceRoot);assert.deepEqual(first.result,next.result);return{peerRecovery,recovery:recovered.index,first:first.index,next:next.index};},
    async dispose(){if(disposed)return;disposed=true;const ended=await service.dispose();for(const exit of ended)exitsForService(exit);target.shutdown=ended;}};
  return target;
}
