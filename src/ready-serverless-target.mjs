import fs from 'node:fs';
import {createHash} from 'node:crypto';
// ADAPT of src/portable-serverless-target.mjs at SHA256 b6aceaf143fe233357995ae992acd72c7e9881e57679495a79947ed45a9d3071; atomic readiness publication.
import {performance} from 'node:perf_hooks';
import {createReadyHttpTarget} from './ready-http-target.mjs';

function confirmProcessExit(pid){
  const deadline=Date.now()+1000;
  while(Date.now()<deadline){
    try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return true;throw error;}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
  }
  throw new Error('RCL_SERVERLESS_PROCESS_TERMINATION_NOT_OBSERVED');
}

/** A fresh local handler process for each request. No cloud FaaS or sandbox claim. */
export function createReadyServerlessTarget(){
  const probe=createReadyHttpTarget(),binding={...probe.binding,context:'serverless',
    execution:'Fresh local HTTP handler and native RCL compiler/VM for each request',warmProcessReused:false,cloudFaasClaimed:false};
  binding.hostRuntime={nodeVersion:process.version,binaryPath:process.execPath,sha256:createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex')};
  probe.dispose();confirmProcessExit(probe.binding.workerPid);delete binding.workerPid;let requests=0;
  function invoke(operation){
    const started=performance.now(),handler=createReadyHttpTarget();
    let result;
    try{result=operation(handler);}
    finally{handler.dispose();confirmProcessExit(handler.binding.workerPid);}
    let terminationObserved=false;
    try{handler.inspectHealth();}catch(error){if(/PROTOCOL|fetch|connect|ECONN/u.test(error.message))terminationObserved=true;else throw error;}
    if(!terminationObserved)throw new Error('RCL_SERVERLESS_HANDLER_TERMINATION_NOT_OBSERVED');
    return{...result,handlerPid:handler.binding.workerPid,terminationObserved,processExited:true,request:++requests,ms:performance.now()-started};
  }
  return{environment:'serverless',binding,
    compile(source,output){return invoke(handler=>handler.compile(source,output));},
    execute(file,sourceRoot){return invoke(handler=>handler.execute(file,sourceRoot));},
    verifyColdStart(file,sourceRoot){
      const first=this.execute(file,sourceRoot),second=this.execute(file,sourceRoot);
      if(first.handlerPid===second.handlerPid||first.result.stateRoot!==second.result.stateRoot)throw new Error('RCL_SERVERLESS_REQUEST_ISOLATION_FAILED');
      return{status:'PASS',freshHandlers:true,terminationObserved:first.terminationObserved&&second.terminationObserved,processExited:first.processExited&&second.processExited,
        handlerPids:[first.handlerPid,second.handlerPid],stateRoot:first.result.stateRoot,sourceRoot:first.result.sourceRoot};
    },dispose(){},
  };
}
