import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

/** One bounded native execution stage in an actual worker-thread dataflow pipeline. */
export async function createPortableDataflowTarget(){
  const worker=new Worker(new URL('./portable-dataflow-worker.mjs',import.meta.url),{execArgv:[]});let pending,sequence=0,closed=false;
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  worker.on('message',message=>{
    if(message.ready){resolveReady(message);return;}
    const active=pending;
    if(!active||message.id!==active.id){closed=true;pending?.reject(new Error('RCL_DATAFLOW_UNSOLICITED_REPLY'));pending=undefined;return;}
    pending=undefined;
    if(!message.ok){const error=new Error(message.message);error.code=message.code;active.reject(error);return;}
    if(message.threadId!==worker.threadId||message.inputHash!==active.inputHash){active.reject(new Error('RCL_DATAFLOW_REPLY_BINDING'));return;}
    active.resolve(message);
  });
  const fail=error=>{closed=true;rejectReady(error);pending?.reject(error);pending=undefined;};
  worker.on('error',fail);worker.on('exit',code=>fail(new Error('RCL_DATAFLOW_WORKER_EXIT:'+code)));
  const identity=await ready;
  async function request(operation,file,extra={}){
    if(closed)throw new Error('RCL_DATAFLOW_CLOSED');if(pending)throw new Error('RCL_DATAFLOW_BACKPRESSURE');
    const id=++sequence,inputHash=sha(fs.readFileSync(file)),started=performance.now();
    const promise=new Promise((resolve,reject)=>{pending={id,inputHash,resolve,reject};});
    worker.postMessage({id,operation,file,inputHash,...extra});
    const reply=await promise;return{...reply.result,ms:performance.now()-started,threadId:reply.threadId,stages:reply.stages,inputHash:reply.inputHash,delivery:id};
  }
  return{environment:'dataflow-runtime',binding:{...identity.binding,context:'dataflow-runtime',
    execution:'Bounded source-binding/native-execution/receipt-sink worker-thread pipeline',threadId:identity.threadId,maxInFlight:1,externalStreamClaimed:false},
    async compile(source,output){const reply=await request('compile',source,{output});return{...reply,bytecode:Buffer.from(reply.bytecode)};},
    async execute(file,sourceRoot){
      const reply=await request('execute',file,{sourceRoot});
      reply.result=verifyNativeSemanticStateRoot(reply.result,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      if(sourceRoot&&reply.result.sourceRoot!==sourceRoot)throw new Error('RCL_DATAFLOW_SOURCE_ROOT_MISMATCH');return reply;
    },
    async verifyBackpressure(file,sourceRoot){
      const first=this.execute(file,sourceRoot);let backpressureRejected=false;
      try{await this.execute(file,sourceRoot);}catch(error){if(error.message==='RCL_DATAFLOW_BACKPRESSURE')backpressureRejected=true;else throw error;}
      const completed=await first;if(!backpressureRejected)throw new Error('RCL_DATAFLOW_UNBOUNDED_ACCEPTANCE');
      return{status:'PASS',backpressureRejected,threadId:completed.threadId,delivery:completed.delivery,stateRoot:completed.result.stateRoot,sourceRoot:completed.result.sourceRoot};
    },async dispose(){closed=true;await worker.terminate();},
  };
}
