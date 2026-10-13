// ADAPT of src/portable-http-target.mjs at SHA256 9bf98aa8302a71b400d9fec8776bec8e7335b814494a81fc77a0dd0d5907ac36; atomic readiness publication.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=value=>createHash('sha256').update(value).digest('hex');

/** Local HTTP execution organ. RCL compilation and state semantics stay in the native C/RCL path. */
export function createReadyHttpTarget(){
  if(process.platform!=='win32')throw new Error('RCL_HTTP_WINDOWS_HOST_REQUIRED');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-http-target-')),token=randomBytes(32).toString('hex');
  const log=fs.openSync(path.join(directory,'worker.log'),'w');
  const child=spawn(process.execPath,[path.join(ROOT,'src/ready-http-worker.mjs'),directory,token],{stdio:['ignore',log,log],windowsHide:true});
  fs.closeSync(log);const ready=path.join(directory,'ready.json'),deadline=Date.now()+10_000;
  while(!fs.existsSync(ready)&&Date.now()<deadline){if(fs.existsSync(path.join(directory,'startup-error.txt')))throw new Error(fs.readFileSync(path.join(directory,'startup-error.txt'),'utf8'));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);}
  if(!fs.existsSync(ready)){child.kill();throw new Error('RCL_HTTP_WORKER_STARTUP_TIMEOUT');}
  const started=JSON.parse(fs.readFileSync(ready,'utf8')),endpoint='http://127.0.0.1:'+started.port;
  let sequence=0;
  function request(route,value,overrideToken=token){
    let file;if(value!==undefined){file=path.join(directory,'request-'+sequence+++'.json');fs.writeFileSync(file,JSON.stringify(value));}
    const result=spawnSync(process.execPath,[path.join(ROOT,'src/portable-http-client.mjs'),endpoint,overrideToken,route,...(file?[file]:[])],{encoding:'utf8',timeout:70_000,windowsHide:true,maxBuffer:64*1024*1024});
    let body;try{body=JSON.parse(result.stdout);}catch{throw new Error('RCL_HTTP_CLIENT_PROTOCOL:'+result.stderr);}
    if(result.status!==0||!body.ok){const error=new Error(JSON.stringify(body));error.code=body.code;throw error;}
    if(body.pid!==undefined&&body.pid!==started.pid)throw new Error('RCL_HTTP_WORKER_IDENTITY_CHANGED');return body;
  }
  const health=request('/health');
  return{environment:'server',binding:{...health.binding,execution:'Native RCL compiler/VM behind authenticated loopback HTTP',context:'server',transport:'HTTP_LOOPBACK_127_0_0_1',workerPid:started.pid,hostedDeploymentClaimed:false},
    compile(source,output){const started=performance.now(),text=fs.readFileSync(source,'utf8'),body=request('/compile',{source:text,sourceHash:sha(text)}),bytecode=Buffer.from(body.bytecode,'base64');
      if(sha(bytecode)!==body.artifactHash||body.sourceHash!==sha(text))throw new Error('RCL_HTTP_COMPILE_REPLY_BINDING');fs.writeFileSync(output,bytecode);return{bytecode,ms:performance.now()-started};},
    execute(file,sourceRoot){const started=performance.now(),bytecode=fs.readFileSync(file),body=request('/execute',{bytecode:bytecode.toString('base64'),artifactHash:sha(bytecode),sourceRoot});
      if(body.artifactHash!==sha(bytecode))throw new Error('RCL_HTTP_EXECUTE_REPLY_BINDING');const result=verifyNativeSemanticStateRoot(body.result,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      if(sourceRoot&&result.sourceRoot!==sourceRoot)throw new Error('RCL_HTTP_SOURCE_ROOT_MISMATCH');return{result,ms:performance.now()-started};},
    inspectHealth(){return request('/health');},
    assertUnauthorizedRejected(){try{request('/health',undefined,'0'.repeat(64));}catch(error){if(error.code==='RCL_HTTP_AUTHORITY_DENIED')return true;throw error;}return false;},
    dispose(){try{request('/shutdown',{});}finally{child.kill();/* Keep the task-owned diagnostic directory for inspection. */}},
  };
}
