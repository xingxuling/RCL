import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');

export async function createResidentSequenceCompiler(){
  if(process.platform!=='win32')throw new Error('RCLC_RESIDENT_WINDOWS_REQUIRED');
  const token=randomUUID(),binary=path.join(ROOT,'native/sequence-compiler/rclcd.exe');
  const build=JSON.parse(fs.readFileSync(path.join(ROOT,'native/sequence-compiler/build.json'),'utf8'));
  if(sha(fs.readFileSync(binary))!==build.artifact.sha256)throw new Error('RCLC_RESIDENT_BINARY_BINDING');
  for(const file of build.sourceBindings)if(sha(fs.readFileSync(path.join(ROOT,file.path)))!==file.sha256)throw new Error('RCLC_RESIDENT_SOURCE_BINDING:'+file.path);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-compiler-resident-'));
  function cleanup(){if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-compiler-resident-'))throw new Error('RCLC_RESIDENT_CLEANUP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}
  const child=spawn(binary,[directory,token],{stdio:['pipe','pipe','pipe'],windowsHide:true}),lines=readline.createInterface({input:child.stdout});let pending,stderr='',closed=false,busy=false,request=0;
  function fail(error){if(pending){clearTimeout(pending.timer);pending.reject(error);pending=null;}}
  function next(){if(closed)return Promise.reject(new Error('RCLC_RESIDENT_CLOSED'));if(pending)return Promise.reject(new Error('RCLC_RESIDENT_BACKPRESSURE'));return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{fail(new Error('RCLC_RESIDENT_TIMEOUT'));child.kill();},300000);pending={resolve,reject,timer};});}
  const exit=new Promise(resolve=>child.once('close',(code,signal)=>{closed=true;fail(new Error('RCLC_RESIDENT_EXIT:'+code+':'+stderr));resolve({code,signal,pid:child.pid});}));
  child.on('error',error=>{closed=true;fail(error);});child.stdin.on('error',fail);child.stderr.on('data',bytes=>{stderr=(stderr+bytes.toString()).slice(-16384);});
  lines.on('line',line=>{if(!pending){child.kill();return;}const item=pending;pending=null;clearTimeout(item.timer);try{const value=JSON.parse(line);Object.defineProperty(value,'wireLine',{value:line});item.resolve(value);}catch(error){item.reject(error);child.kill();}});
  let ready;
  try{ready=await next();if(ready.status!=='ready'||ready.pid!==child.pid||ready.token!==token||ready.protocol!=='RCL_COMPILER_ABI_FILES_V1')throw new Error('RCLC_RESIDENT_READY_BINDING');}
  catch(error){child.kill();await exit;lines.close();cleanup();throw error;}
  const binding={owner:'RCL_NATIVE_COMPILER_C_ABI',protocol:ready.protocol,pid:child.pid,token,readyReply:ready.wireLine,binary:build.artifact,sourceBindings:build.sourceBindings,referenceCompilationUsed:false,securitySandboxClaimed:false,compilerOutputOwner:'RCL_COMPILER_RBC',hostEffects:'Flat files in one owned temporary directory'};
  async function command(line){const id=++request,promise=next();child.stdin.write(line+'\n');const value=await promise;if(value.pid!==child.pid||value.token!==token||value.request!==id)throw new Error('RCLC_RESIDENT_REPLY_BINDING');return value;}
  async function compile(compilerFile,sourceFile,outputFile){
    if(closed)throw new Error('RCLC_RESIDENT_CLOSED');if(busy)throw new Error('RCLC_RESIDENT_BACKPRESSURE');busy=true;const started=performance.now();
    try{
      const compiler=fs.readFileSync(compilerFile),source=fs.readFileSync(sourceFile),compilerHash=sha(compiler),sourceHash=sha(source),compilerName=compilerHash+'.rbc',sourceName=sourceHash+'.rcl',outputName=randomUUID()+'.rbc';
      fs.writeFileSync(path.join(directory,compilerName),compiler);fs.writeFileSync(path.join(directory,sourceName),source);
      const frame='COMPILE\t'+compilerName+'\t'+sourceName+'\t'+outputName,metrics=await command(frame);
      if(metrics.status!=='ok'){const error=new Error(metrics.code+':'+metrics.message);error.code=metrics.code;error.compilerTrace={frame,replyLine:metrics.wireLine,metrics,compilerHash,sourceHash};throw error;}
      if(metrics.output!==directory+'/'+outputName||metrics.instructionBudget!==300000000||!(metrics.executedInstructions>0)||!(metrics.instance>0))throw new Error('RCLC_RESIDENT_METRICS_BINDING');
      const bytecode=fs.readFileSync(path.join(directory,outputName));if(bytecode.length!==metrics.bytes)throw new Error('RCLC_RESIDENT_OUTPUT_LENGTH');if(outputFile)fs.writeFileSync(outputFile,bytecode);
      return{bytecode,ms:performance.now()-started,compilerTrace:{frame,replyLine:metrics.wireLine,metrics,compilerHash,sourceHash,artifactHash:sha(bytecode),nativePid:child.pid,contextToken:token,instance:metrics.instance,request:metrics.request}};
    }finally{busy=false;}
  }
  return{binding,compile,async verifyScopeRejection(){if(busy)throw new Error('RCLC_RESIDENT_BACKPRESSURE');busy=true;try{const result=await command('COMPILE\t../escape.rbc\tsource.rcl\toutput.rbc');if(result.status!=='error'||result.code!=='RCLC_PROTOCOL_SCOPE')throw new Error('RCLC_RESIDENT_SCOPE_NOT_REJECTED');return result;}finally{busy=false;}},async dispose(){
    let result;
    try{
      if(!closed){child.stdin.write('QUIT\n');child.stdin.end();const timeout=setTimeout(()=>child.kill(),3000);try{await exit;}finally{clearTimeout(timeout);}}
      result=await exit;
    }finally{lines.close();cleanup();}
    if(result.code!==0||result.signal!==null)throw new Error('RCLC_RESIDENT_UNCLEAN_EXIT');return result;
  }};
}
