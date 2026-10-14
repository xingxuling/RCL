import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {createResidentCompilerHttpTarget} from './resident-compiler-http-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

/** Two actual HTTP/native compiler peers; publication requires both complete results. */
export async function createReplicatedCompilerTarget(){
  const peers=[],session=randomUUID(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-replica-compiler-'));let closed=false,busy=false,active,disposed;
  function cleanup(){if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-replica-compiler-'))throw new Error('RCLC_REPLICA_CLEANUP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}
  try{for(let i=0;i<2;i++)peers.push(await createResidentCompilerHttpTarget());}catch(error){for(const p of peers)await p.dispose();cleanup();throw error;}
  if(peers[0].binding.serverPid===peers[1].binding.serverPid||peers[0].binding.compiler.pid===peers[1].binding.compiler.pid)throw new Error('RCLC_REPLICA_DISTINCT_PEERS_REQUIRED');
  const binding={owner:'RCL_COMPLETE_COMPILER_REPLICA',environment:'distributed-runtime',session,peers:peers.map(p=>p.binding),quorum:2,
    referenceCompilationUsed:false,referenceExecutionUsed:false,multiHostClaimed:false,independentImplementationClaimed:false,securitySandboxClaimed:false};
  async function flow(operation){if(closed)throw new Error('RCLC_REPLICA_CLOSED');if(busy)throw new Error('RCLC_REPLICA_BACKPRESSURE');busy=true;active=(async()=>{try{return await operation();}finally{busy=false;}})();return active;}
  async function broadcast(kind,compilerFile,sourceFile,artifactFile,sourceRoot,outputFile){
    const started=performance.now(),id=randomUUID(),input=fs.readFileSync(kind==='compile'?compilerFile:artifactFile),inputHash=sha(input),ownedInput=path.join(directory,id+'.rbc');fs.writeFileSync(ownedInput,input);
    const source=kind==='compile'?fs.readFileSync(sourceFile,'utf8'):null,sourceHash=source===null?null:sha(source),ownedSource=path.join(directory,id+'.rcl');if(source!==null)fs.writeFileSync(ownedSource,source);
    const outcomes=await Promise.allSettled(peers.map(p=>kind==='compile'?p.compile(ownedInput,ownedSource):p.execute(ownedInput,sourceRoot)));
    const trace={id,session,kind,inputHash,sourceHash,sourceRoot:sourceRoot??null,quorum:2,peers:outcomes.map((o,index)=>{
      const value=o.status==='fulfilled'?o.value:o.reason;return{index,binding:peers[index].binding,status:o.status==='fulfilled'?'OK':'ERROR',httpTrace:value.httpTrace??null,
        nativeCompilerTrace:kind==='compile'?(value.nativeCompilerTrace??value.httpTrace?.reply.nativeCompilerTrace??null):null,
        nativeExecutionTrace:kind==='execute'?(value.nativeExecutionTrace??value.httpTrace?.reply.nativeExecutionTrace??null):null,
        artifactHash:o.status==='fulfilled'&&kind==='compile'?sha(value.bytecode):null,result:o.status==='fulfilled'&&kind==='execute'?value.result:null,
        error:o.status==='rejected'?{code:value.code??null,message:value.message}:null};})};
    if(outcomes.some(o=>o.status==='rejected')){
      const failures=outcomes.filter(o=>o.status==='rejected');const error=failures.length===2&&failures[0].reason.message===failures[1].reason.message?failures[0].reason:new Error('RCLC_REPLICA_INCOMPLETE_QUORUM');error.replicaTrace=trace;throw error;
    }
    const [left,right]=outcomes.map(o=>o.value);
    if(kind==='compile'){
      if(!left.bytecode.equals(right.bytecode))throw Object.assign(new Error('RCLC_REPLICA_COMPILER_DISAGREEMENT'),{replicaTrace:trace});
      if(outputFile)fs.writeFileSync(outputFile,left.bytecode);return{bytecode:left.bytecode,replicaTrace:trace,ms:performance.now()-started};
    }
    if(!isDeepStrictEqual(left.result,right.result))throw Object.assign(new Error('RCLC_REPLICA_EXECUTION_DISAGREEMENT'),{replicaTrace:trace});return{result:left.result,replicaTrace:trace,ms:performance.now()-started};
  }
  return{environment:'distributed-runtime',binding,
    compile:(compilerFile,sourceFile,outputFile)=>flow(()=>broadcast('compile',compilerFile,sourceFile,null,null,outputFile)),
    execute:(artifactFile,sourceRoot)=>flow(()=>broadcast('execute',null,null,artifactFile,sourceRoot)),
    verifyPeerRecovery:(compilerFile,sourceFile)=>flow(async()=>{
      const lost=peers[1].binding,exit=await peers[1].dispose(),unpublished=path.join(directory,'unpublished-'+randomUUID()+'.rbc');let failure;
      try{await broadcast('compile',compilerFile,sourceFile,null,null,unpublished);}catch(error){if(error.message==='RCLC_REPLICA_INCOMPLETE_QUORUM')failure={message:error.message,replicaTrace:error.replicaTrace};else throw error;}
      if(!failure||fs.existsSync(unpublished))throw new Error('RCLC_REPLICA_PARTIAL_RESULT_PUBLISHED');
      peers[1]=await createResidentCompilerHttpTarget();if(peers[1].binding.compiler.token===lost.compiler.token||peers[1].binding.serverPid===peers[0].binding.serverPid)throw new Error('RCLC_REPLICA_RECOVERY_IDENTITY');
      return{lost,exit,partialFailure:failure,artifactPublished:false,replacement:peers[1].binding};
    }),
    async dispose(){if(disposed)return disposed;closed=true;disposed=(async()=>{if(active)await active.catch(()=>{});try{return await Promise.all(peers.map(p=>p.dispose()));}finally{cleanup();}})();return disposed;},
  };
}
