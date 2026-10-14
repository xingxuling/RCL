import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');

/** Dynamic compiler generations through a separate authenticated HTTP worker. */
export async function createResidentCompilerHttpTarget(){
  if(process.platform!=='win32')throw new Error('RCLC_HTTP_WINDOWS_REQUIRED');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-resident-http-')),token=randomBytes(32).toString('hex');
  const worker=path.join(ROOT,'src/resident-compiler-http-worker.mjs'),child=spawn(process.execPath,[worker,directory,token],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  const lines=readline.createInterface({input:child.stdout});let stderr='',closed=false,busy=false;
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-16384);});
  const exit=new Promise(resolve=>child.once('close',(code,signal)=>{closed=true;resolve({pid:child.pid,code,signal});}));
  function cleanup(){if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-resident-http-'))throw new Error('RCLC_HTTP_CLEANUP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}
  let ready;
  try{ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('RCLC_HTTP_READY_TIMEOUT')),15000);lines.once('line',line=>{clearTimeout(timer);try{resolve(JSON.parse(line));}catch(e){reject(e);}});child.once('error',e=>{clearTimeout(timer);reject(e);});exit.then(e=>{clearTimeout(timer);reject(new Error('RCLC_HTTP_STARTUP_EXIT:'+e.code+':'+stderr));});});
    if(ready.status!=='ready'||ready.pid!==child.pid||ready.binding.serverPid!==child.pid||!Number.isInteger(ready.port))throw new Error('RCLC_HTTP_READY_BINDING');
  }catch(error){child.kill();await exit;lines.close();cleanup();throw error;}
  const endpoint='http://127.0.0.1:'+ready.port;
  const binding={...ready.binding,worker:{path:'src/resident-compiler-http-worker.mjs',sha256:sha(fs.readFileSync(worker))},endpoint,
    hostRuntime:{path:process.execPath,sha256:sha(fs.readFileSync(process.execPath)),version:process.version}};
  async function request(route,body,overrideToken=token){
    if(closed)throw new Error('RCLC_HTTP_CLOSED');
    const data=body===undefined?undefined:JSON.stringify({...body,requestId:randomUUID()});
    const response=await fetch(endpoint+route,{method:data===undefined?'GET':'POST',headers:{authorization:'Bearer '+overrideToken,...(data===undefined?{}:{'content-type':'application/json'})},body:data,signal:AbortSignal.timeout(300000)});
    const replyText=await response.text(),reply=JSON.parse(replyText);
    const trace={route,requestHash:data===undefined?null:sha(data),replyHash:sha(replyText),status:response.status,reply};
    if(reply.serverPid!==child.pid)throw new Error('RCLC_HTTP_WORKER_BINDING');
    if(!response.ok||!reply.ok){const error=new Error(reply.code+':'+(reply.message??''));error.code=reply.code;error.httpTrace=trace;throw error;}
    if(data!==undefined&&(reply.requestHash!==sha(data)||reply.requestId!==JSON.parse(data).requestId))throw new Error('RCLC_HTTP_REPLY_BINDING');
    return{reply,trace};
  }
  async function exclusive(fn){if(busy)throw new Error('RCLC_HTTP_BACKPRESSURE');busy=true;try{return await fn();}finally{busy=false;}}
  return{environment:'server',binding,
    compile(compilerFile,sourceFile,outputFile){return exclusive(async()=>{
      const started=performance.now(),seed=fs.readFileSync(compilerFile),source=fs.readFileSync(sourceFile,'utf8');
      const {reply,trace}=await request('/compile',{compilerHash:sha(seed),compilerBase64:seed.toString('base64'),sourceHash:sha(source),source});
      const bytecode=Buffer.from(reply.bytecodeBase64,'base64'),native=reply.nativeCompilerTrace;
      if(reply.compilerHash!==sha(seed)||reply.sourceHash!==sha(source)||reply.artifactHash!==sha(bytecode)||native.nativePid!==binding.compiler.pid||native.compilerHash!==sha(seed)||native.sourceHash!==sha(source)||native.artifactHash!==sha(bytecode))throw new Error('RCLC_HTTP_COMPILE_BINDING');
      if(outputFile)fs.writeFileSync(outputFile,bytecode);return{bytecode,ms:performance.now()-started,nativeCompilerTrace:native,httpTrace:trace};
    });},
    execute(file,sourceRoot){return exclusive(async()=>{
      const started=performance.now(),bytecode=fs.readFileSync(file),{reply,trace}=await request('/execute',{artifactHash:sha(bytecode),bytecodeBase64:bytecode.toString('base64'),sourceRoot});
      if(reply.artifactHash!==sha(bytecode)||reply.result.sourceRoot!==sourceRoot||reply.nativeExecutionTrace.status!==0)throw new Error('RCLC_HTTP_EXECUTE_BINDING');
      return{result:reply.result,ms:performance.now()-started,nativeExecutionTrace:reply.nativeExecutionTrace,httpTrace:trace};
    });},
    inspectHealth:()=>request('/health'),
    async verifyUnauthorizedRejection(){try{await request('/health',undefined,'0'.repeat(64));}catch(error){if(error.code==='RCLC_HTTP_AUTHORITY_DENIED')return error.httpTrace;throw error;}throw new Error('RCLC_HTTP_AUTHORITY_NOT_REJECTED');},
    async dispose(){
      let shutdown,result;
      try{if(!closed)shutdown=(await request('/shutdown',{})).reply;const timer=setTimeout(()=>child.kill(),3000);try{result=await exit;}finally{clearTimeout(timer);}}
      finally{if(!closed){child.kill();await exit;}lines.close();cleanup();}
      if(result.code!==0||result.signal!==null)throw new Error('RCLC_HTTP_UNCLEAN_EXIT');return{...result,compilerExit:shutdown?.compilerExit};
    }};
}
