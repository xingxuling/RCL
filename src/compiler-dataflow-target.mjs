import fs from 'node:fs';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');

/** Actual compiler and VM stage workers, linked artifacts, one bounded flow in flight. */
export async function createCompilerDataflowTarget(){
  if(process.platform!=='win32')throw new Error('RCLC_FLOW_WINDOWS_REQUIRED');
  const session=randomUUID(),peers=[],workerFile='src/compiler-dataflow-worker.mjs';let busy=false,closed=false,active,disposed;
  function create(role){
    const worker=new Worker(new URL('./compiler-dataflow-worker.mjs',import.meta.url),{workerData:{role,session},execArgv:[]});let pending,sequence=0,readyResolve,readyReject,ended=false;
    const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
    const exit=new Promise(resolve=>worker.once('exit',code=>{ended=true;readyReject(new Error('RCLC_FLOW_STARTUP_EXIT:'+code));if(pending){clearTimeout(pending.timer);pending.reject(new Error('RCLC_FLOW_WORKER_EXIT:'+code));pending=undefined;}resolve({role,threadId:peer.threadId,code});}));
    const peer={role,threadId:worker.threadId,worker,ready,exit};peers.push(peer);
    worker.on('error',error=>{readyReject(error);if(pending){clearTimeout(pending.timer);pending.reject(error);pending=undefined;}});
    worker.on('message',message=>{
      if(message.ready){if(message.binding.role!==role||message.binding.session!==session||message.binding.threadId!==peer.threadId||message.binding.hostPid!==process.pid)return readyReject(new Error('RCLC_FLOW_READY_BINDING'));peer.binding=message.binding;readyResolve(message.binding);return;}
      const item=pending;if(!item||item.id!==message.id){worker.terminate();return;}
      pending=undefined;clearTimeout(item.timer);const t=message.trace;
      if(t.role!==role||t.session!==session||t.threadId!==peer.threadId||t.hostPid!==process.pid||t.id!==item.id||t.flowId!==item.flowId||t.operation!==item.operation){item.reject(new Error('RCLC_FLOW_REPLY_BINDING'));return;}
      if(!message.ok){const error=new Error(message.message);error.code=message.code;error.stageTrace=t;item.reject(error);}else item.resolve(message);
    });
    peer.request=(operation,body,flowId)=>{
      if(ended)return Promise.reject(new Error('RCLC_FLOW_WORKER_CLOSED'));if(pending)return Promise.reject(new Error('RCLC_FLOW_STAGE_BACKPRESSURE'));
      const id=++sequence,promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending=undefined;reject(new Error('RCLC_FLOW_STAGE_TIMEOUT'));worker.terminate();},300000);pending={id,flowId,operation,resolve,reject,timer};});worker.postMessage({id,flowId,operation,...body});return promise;
    };return peer;
  }
  const compiler=create('compile'),execution=create('execute');
  try{await Promise.all([compiler.ready,execution.ready]);}catch(error){await Promise.all(peers.map(p=>p.worker.terminate()));throw error;}
  if(compiler.threadId===execution.threadId)throw new Error('RCLC_FLOW_DISTINCT_WORKERS_REQUIRED');
  const binding={owner:'RCL_COMPLETE_COMPILER_DATAFLOW',environment:'dataflow-runtime',session,hostPid:process.pid,maxInFlight:1,
    stages:[compiler.binding,execution.binding],worker:{path:workerFile,sha256:sha(fs.readFileSync(path.join(ROOT,workerFile)))},
    hostRuntime:{path:process.execPath,sha256:sha(fs.readFileSync(process.execPath)),version:process.version},referenceCompilationUsed:false,referenceExecutionUsed:false,externalStreamClaimed:false,multiHostClaimed:false,securitySandboxClaimed:false};
  async function flow(operation){
    if(closed)throw new Error('RCLC_FLOW_CLOSED');if(busy)throw new Error('RCLC_FLOW_BACKPRESSURE');busy=true;
    active=(async()=>{try{return await operation(randomUUID());}finally{busy=false;}})();return active;
  }
  async function compileStage(compilerFile,sourceFile,flowId,sourceHashOverride){
    const started=performance.now(),bytes=fs.readFileSync(compilerFile),source=fs.readFileSync(sourceFile,'utf8');
    const reply=await compiler.request('compile',{bytes,inputHash:sha(bytes),source,sourceHash:sourceHashOverride??sha(source)},flowId),bytecode=Buffer.from(reply.bytecode),trace=reply.trace;
    if(trace.inputHash!==sha(bytes)||trace.sourceHash!==sha(source)||trace.outputHash!==sha(bytecode)||trace.nativeCompilerTrace.compilerHash!==sha(bytes)||trace.nativeCompilerTrace.sourceHash!==sha(source)||trace.nativeCompilerTrace.artifactHash!==sha(bytecode))throw new Error('RCLC_FLOW_COMPILE_BINDING');
    return{bytecode,stageTrace:trace,ms:performance.now()-started};
  }
  async function executeStage(bytes,sourceRoot,flowId,fromCompile){
    const started=performance.now(),reply=await execution.request('execute',{bytes,inputHash:sha(bytes),sourceRoot,fromCompile},flowId);
    if(reply.trace.inputHash!==sha(bytes)||reply.result.sourceRoot!==sourceRoot)throw new Error('RCLC_FLOW_EXECUTE_BINDING');return{result:reply.result,stageTrace:reply.trace,ms:performance.now()-started};
  }
  return{environment:'dataflow-runtime',binding,
    compile:(compilerFile,sourceFile,outputFile)=>flow(async id=>{const result=await compileStage(compilerFile,sourceFile,id);if(outputFile)fs.writeFileSync(outputFile,result.bytecode);return result;}),
    execute:(file,sourceRoot)=>flow(id=>executeStage(fs.readFileSync(file),sourceRoot,id,null)),
    compileAndExecute:(compilerFile,sourceFile,sourceRoot,outputFile)=>flow(async id=>{
      const compiled=await compileStage(compilerFile,sourceFile,id),edge={flowId:id,threadId:compiler.threadId,id:compiled.stageTrace.id,artifactHash:sha(compiled.bytecode)};
      const executed=await executeStage(compiled.bytecode,sourceRoot,id,edge);if(outputFile)fs.writeFileSync(outputFile,compiled.bytecode);return{compiled,executed,edge};
    }),
    verifyInputRejection:(compilerFile,sourceFile)=>flow(async id=>{try{await compileStage(compilerFile,sourceFile,id,'0'.repeat(64));}catch(error){if(error.message==='RCLC_FLOW_SOURCE_BINDING'&&error.stageTrace?.nativeCalled===false)return{status:'PASS',stageTrace:error.stageTrace};throw error;}throw new Error('RCLC_FLOW_INPUT_NOT_REJECTED');}),
    async dispose(){
      if(disposed)return disposed;closed=true;disposed=(async()=>{
        if(active)await active.catch(()=>{});const shutdown=[];
        try{for(const p of peers){const reply=await p.request('shutdown',{},randomUUID());shutdown.push(reply.trace);}const exits=await Promise.all(peers.map(p=>p.exit));if(exits.some(e=>e.code!==0))throw new Error('RCLC_FLOW_UNCLEAN_WORKER_EXIT');return{shutdown,exits};}
        catch(error){await Promise.all(peers.map(p=>p.worker.terminate()));throw error;}
      })();return disposed;
    },
  };
}
