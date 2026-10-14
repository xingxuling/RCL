import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {parentPort,threadId,workerData} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {createResidentSequenceCompiler} from './resident-sequence-compiler.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex'),{role,session}=workerData;
if(!['compile','execute'].includes(role)||!/^[0-9a-f-]{36}$/u.test(session))throw new Error('RCLC_FLOW_WORKER_SCOPE');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-compiler-flow-')),vm=path.join(ROOT,'native/rclvm.exe');let compiler,busy=false,sequence=0;
function cleanup(){if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-compiler-flow-'))throw new Error('RCLC_FLOW_CLEANUP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}
try{if(role==='compile')compiler=await createResidentSequenceCompiler();}catch(error){cleanup();throw error;}
const binding={role,session,threadId,hostPid:process.pid,compiler:compiler?.binding??null,
  vm:role==='execute'?{path:'native/rclvm.exe',sha256:sha(fs.readFileSync(vm)),bytes:fs.statSync(vm).size}:null};
parentPort.postMessage({ready:true,binding});
parentPort.on('message',async message=>{
  const trace={role,session,threadId,hostPid:process.pid,id:message.id,flowId:message.flowId,sequence:++sequence,operation:message.operation,
    inputHash:message.inputHash,sourceHash:message.sourceHash??null,sourceRoot:message.sourceRoot??null,fromCompile:message.fromCompile??null,nativeCalled:false};
  if(busy)return parentPort.postMessage({ok:false,id:message.id,code:'RCLC_FLOW_WORKER_BACKPRESSURE',message:'RCLC_FLOW_WORKER_BACKPRESSURE',trace});
  busy=true;
  try{
    if(message.operation==='shutdown'){
      trace.compilerExit=compiler?await compiler.dispose():null;cleanup();parentPort.postMessage({ok:true,id:message.id,trace});parentPort.close();return;
    }
    if(message.operation!==role||!/^[0-9a-f-]{36}$/u.test(message.flowId))throw new Error('RCLC_FLOW_ROLE_BINDING');
    const bytes=Buffer.from(message.bytes);if(sha(bytes)!==message.inputHash)throw new Error('RCLC_FLOW_INPUT_BINDING');
    if(role==='compile'){
      if(typeof message.source!=='string'||sha(message.source)!==message.sourceHash)throw new Error('RCLC_FLOW_SOURCE_BINDING');
      const seed=path.join(directory,message.inputHash+'.rbc'),source=path.join(directory,message.sourceHash+'.rcl');fs.writeFileSync(seed,bytes);fs.writeFileSync(source,message.source);trace.nativeCalled=true;
      const result=await compiler.compile(seed,source);trace.nativeCompilerTrace=result.compilerTrace;trace.outputHash=sha(result.bytecode);trace.outputBytes=result.bytecode.length;
      parentPort.postMessage({ok:true,id:message.id,trace,bytecode:result.bytecode});return;
    }
    if(message.fromCompile&&message.fromCompile.artifactHash!==message.inputHash)throw new Error('RCLC_FLOW_EDGE_BINDING');
    if(!/^[0-9a-f]{64}$/u.test(message.sourceRoot??''))throw new Error('RCLC_FLOW_SOURCE_ROOT');
    const file=path.join(directory,message.inputHash+'.rbc');fs.writeFileSync(file,bytes);trace.nativeCalled=true;
    const native=await new Promise(resolve=>{const child=execFile(vm,[file],{encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:32*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}},(error,stdout,stderr)=>resolve({pid:child.pid,command:vm,args:[file],status:error?(Number.isInteger(error.code)?error.code:null):0,signal:error?.signal??null,stdout,stderr}));});
    native.stdoutHash=sha(native.stdout);native.stderrHash=sha(native.stderr);trace.nativeExecutionTrace=native;
    if(native.status!==0||native.signal!==null)throw new Error(native.stdout+'\n'+native.stderr);
    const result=verifyNativeSemanticStateRoot(JSON.parse(native.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});if(result.sourceRoot!==message.sourceRoot)throw new Error('RCLC_FLOW_SOURCE_ROOT_MISMATCH');
    parentPort.postMessage({ok:true,id:message.id,trace,result});
  }catch(error){if(error.compilerTrace)trace.nativeCompilerTrace=error.compilerTrace;parentPort.postMessage({ok:false,id:message.id,code:error.code??null,message:error.message,trace});}
  finally{busy=false;}
});
