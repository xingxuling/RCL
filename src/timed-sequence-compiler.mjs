import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex'),failure=(code,message=code)=>Object.assign(new Error(message),{code});

/** Same pinned native compiler ABI, one observed process lifetime per soft-deadline job. */
export function createTimedSequenceCompiler(){
  if(process.platform!=='win32')throw failure('RCLC_TIMED_WINDOWS_REQUIRED');const binary=path.join(ROOT,'native/sequence-compiler/rclcd.exe'),build=JSON.parse(fs.readFileSync(path.join(ROOT,'native/sequence-compiler/build.json'),'utf8'));
  if(sha(fs.readFileSync(binary))!==build.artifact.sha256)throw failure('RCLC_TIMED_BINARY_BINDING');for(const f of build.sourceBindings)if(sha(fs.readFileSync(path.join(ROOT,f.path)))!==f.sha256)throw failure('RCLC_TIMED_SOURCE_BINDING');
  const binding={owner:'RCL_TIMED_NATIVE_COMPILER_C_ABI',protocol:'RCL_COMPILER_ABI_FILES_V1',binary:build.artifact,sourceBindings:build.sourceBindings,processMode:'FRESH_NATIVE_COMPILER_PER_JOB',referenceCompilationUsed:false,securitySandboxClaimed:false};
  async function compile(compilerFile,sourceFile,{deadline,signal}={}){
    if(!Number.isFinite(deadline))throw failure('RCLC_TIMED_DEADLINE_REQUIRED');const seed=fs.readFileSync(compilerFile),source=fs.readFileSync(sourceFile),compilerHash=sha(seed),sourceHash=sha(source),token=randomUUID(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-compiler-timed-'));
    if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-compiler-timed-'))throw failure('RCLC_TIMED_TEMP_SCOPE');const outputName=randomUUID()+'.rbc',outputFile=path.join(directory,outputName),frame='COMPILE\t'+compilerHash+'.rbc\t'+sourceHash+'.rcl\t'+outputName;
    let child,lines,timer,pending,abort,closed=false,stdout='',stderr='',reason=null,stopRequestedAt=null,stopSignalSent=false,readyReply=null,replyLine=null,frameSentAt=null,nativeTrace,compiled;
    function cleanup(){fs.rmSync(directory,{recursive:true,force:true});}
    try{
      fs.writeFileSync(path.join(directory,compilerHash+'.rbc'),seed);fs.writeFileSync(path.join(directory,sourceHash+'.rcl'),source);const started=performance.now();child=spawn(binary,[directory,token],{windowsHide:true,stdio:['pipe','pipe','pipe']});
      const stop=code=>{if(reason||closed)return;reason=code;stopRequestedAt=performance.now();stopSignalSent=child.kill('SIGTERM');};abort=()=>stop('RCL_REALTIME_CANCELLED');signal?.addEventListener('abort',abort,{once:true});
      const exit=new Promise(resolve=>{child.once('close',(code,signalCode)=>{closed=true;if(pending){pending.reject(failure(reason??'RCLC_TIMED_EXIT',reason??stderr));pending=null;}resolve({code,signal:signalCode,pid:child.pid});});});
      child.on('error',error=>{if(pending){pending.reject(error);pending=null;}});child.stdin.on('error',error=>{if(pending){pending.reject(error);pending=null;}});child.stdout.on('data',bytes=>{stdout+=bytes.toString();if(Buffer.byteLength(stdout)>1024*1024)stop('RCLC_TIMED_OUTPUT_LIMIT');});child.stderr.on('data',bytes=>{stderr=(stderr+bytes.toString()).slice(-16384);});
      lines=readline.createInterface({input:child.stdout});lines.on('line',line=>{if(!pending){stop('RCLC_TIMED_UNEXPECTED_REPLY');return;}const item=pending;pending=null;item.resolve(line);});
      const next=()=>closed?Promise.reject(failure(reason??'RCLC_TIMED_EXIT')):new Promise((resolve,reject)=>{if(pending)return reject(failure('RCLC_TIMED_OVERLAP'));pending={resolve,reject};});
      const expire=()=>{const remaining=deadline-performance.now();if(remaining>0)timer=setTimeout(expire,Math.max(1,remaining));else stop('RCL_REALTIME_DEADLINE_EXPIRED');};timer=setTimeout(expire,Math.max(1,deadline-performance.now()));if(signal?.aborted)abort();
      let caught;
      try{readyReply=await next();const ready=JSON.parse(readyReply);if(ready.status!=='ready'||ready.protocol!==binding.protocol||ready.pid!==child.pid||ready.token!==token)throw failure('RCLC_TIMED_READY_BINDING');if(reason)throw failure(reason);const reply=next();frameSentAt=performance.now();child.stdin.write(frame+'\n');replyLine=await reply;const metrics=JSON.parse(replyLine);if(metrics.pid!==child.pid||metrics.token!==token||metrics.request!==1)throw failure('RCLC_TIMED_REPLY_BINDING');
        const compilerTrace={frame,replyLine,metrics,compilerHash,sourceHash,nativePid:child.pid,contextToken:token,readyReply};if(metrics.status!=='ok'){caught=failure(metrics.code,metrics.code+':'+metrics.message);caught.compilerTrace=compilerTrace;}else{if(metrics.output!==directory+'/'+outputName||metrics.outputState!=='compiler.output'||metrics.instructionBudget!==300000000||!(metrics.executedInstructions>0)||!(metrics.instance>0))throw failure('RCLC_TIMED_METRICS_BINDING');const bytecode=fs.readFileSync(outputFile);if(bytecode.length!==metrics.bytes)throw failure('RCLC_TIMED_OUTPUT_LENGTH');compiled={bytecode,compilerTrace:{...compilerTrace,artifactHash:sha(bytecode),instance:metrics.instance,request:metrics.request}};}
      }catch(error){caught=error;}
      if(!closed){if(caught&&!replyLine)stop(caught.code??'RCLC_TIMED_PROTOCOL_FAILURE');else{child.stdin.write('QUIT\n');child.stdin.end();}}const ended=await exit;clearTimeout(timer);signal?.removeEventListener('abort',abort);lines.close();nativeTrace={processPid:child.pid,command:binary,args:[directory,token],started,ended:performance.now(),exitObserved:true,...ended,stopRequestedAt,stopSignalSent,stopReason:reason,readyReply,frame,frameSentAt,replyLine,stdout,stderr,stdoutHash:sha(stdout),stderrHash:sha(stderr)};
      if(reason)throw Object.assign(failure(reason),{compilerTrace:compiled?.compilerTrace??caught?.compilerTrace,nativeTrace});if(ended.code!==0||ended.signal!==null)throw Object.assign(failure('RCLC_TIMED_UNCLEAN_EXIT'),{nativeTrace});if(caught)throw Object.assign(caught,{nativeTrace});return{...compiled,nativeTrace,ms:nativeTrace.ended-started};
    }finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);lines?.close();if(child&&!closed){child.kill('SIGTERM');await new Promise(resolve=>child.once('close',resolve));}cleanup();}
  }
  return{binding,compile};
}
