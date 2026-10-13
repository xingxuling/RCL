import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {compileSourceFileSelfHosted} from './selfhost-compiler.mjs';
import {semanticStateRootForAlgorithm} from './semantic-state-root.mjs';

const ROOT=path.resolve(import.meta.dirname,'..'),ALGORITHM='rcl.semantic-state-root.v2';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const describe=file=>({path:path.relative(ROOT,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))});
const stateRoot=state=>semanticStateRootForAlgorithm(state,ALGORITHM);
const runtimeFiles=['native/gpu-runtime/provider.py','native/gpu-runtime/rcl-stack-vm.cl','native/tensor-engine/amd_opencl_bf16_provider.py'];

async function connect(python){
  const child=spawn(python,[path.join(ROOT,runtimeFiles[0])],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const lines=readline.createInterface({input:child.stdout});let pending,stderr='',closed=false;
  const fail=error=>{if(pending){const item=pending;pending=undefined;clearTimeout(item.timer);item.reject(error);}};
  child.stderr.on('data',bytes=>{stderr=(stderr+bytes.toString()).slice(-16384);});
  const exit=new Promise(resolve=>child.once('exit',(code,signal)=>{closed=true;fail(new Error('RCL_GPU_PROCESS_EXIT:'+code+':'+signal+':'+stderr));resolve({code,signal,pid:child.pid});}));
  child.on('error',error=>{closed=true;fail(error);});
  child.stdin.on('error',fail);
  lines.on('line',line=>{
    if(!pending){child.kill();return;}
    const item=pending;pending=undefined;clearTimeout(item.timer);
    try{item.resolve(JSON.parse(line));}catch(error){item.reject(error);child.kill();}
  });
  function response(){
    if(closed)return Promise.reject(new Error('RCL_GPU_PROCESS_CLOSED'));
    if(pending)return Promise.reject(new Error('RCL_GPU_BACKPRESSURE'));
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{fail(new Error('RCL_GPU_REQUEST_TIMEOUT'));child.kill();},60000);pending={resolve,reject,timer};});
  }
  async function close(){
    if(!closed){child.stdin.end();const timer=setTimeout(()=>child.kill(),3000);try{return await exit;}finally{clearTimeout(timer);lines.close();}}
    lines.close();return await exit;
  }
  try{
    const ready=await response();if(ready.ready!==true||ready.processPid!==child.pid)throw new Error('RCL_GPU_READY_BINDING');
    return{ready,async request(input){const result=response();child.stdin.write(JSON.stringify(input)+'\n');return await result;},close};
  }catch(error){child.kill();lines.close();throw error;}
}

export function reconstructGpuResult(observed){
  const history=[],projections=[];
  for(const record of observed.records){
    const projection=record.mode===0,beforeRoot=stateRoot(record.beforeState),afterRoot=stateRoot(record.afterState);
    const projected=structuredClone(record.beforeState);
    for(const change of record.changes){
      if(JSON.stringify(projected[change.target]??null)!==JSON.stringify(change.before))throw new Error('RCL_GPU_CHANGE_BEFORE_MISMATCH');
      projected[change.target]=change.after;
    }
    if(stateRoot(projected)!==afterRoot)throw new Error('RCL_GPU_CHANGE_AFTER_MISMATCH');
    const item={kind:projection?'Projection':'Transition',rule:record.rule,ruleKind:record.ruleKind?'Resonance':'Emergence',
      mode:projection?'foresee':'realize',status:projection?'projected':'realized',actor:record.actor,from:null,into:null,
      beforeRoot,afterRoot,stateRootAlgorithm:ALGORITHM,changes:record.changes,
      authority:{needs:record.needs,activeWarrants:observed.warrants.filter(item=>item.subject===record.actor)},
      witnesses:record.witnesses,hostCalls:[],...(projection?{projectedState:record.afterState}:{})};
    (projection?projections:history).push(item);
  }
  return{status:'ok',sourceRoot:observed.sourceRoot,state:observed.state,stateRoot:stateRoot(observed.state),
    stateRootAlgorithm:ALGORITHM,stateRootOwner:'HOST_HASHES_DEVICE_PRODUCED_VALUES',history,projections,
    gpuRecords:observed.records,gpuWarrants:observed.warrants};
}

/** GPU owns instruction execution and transaction decisions; host hashes returned snapshots. */
export async function createPortableGpuTarget(options={}){
  const python=options.pythonPath??process.env.RCL_GPU_PYTHON??'python';
  const compiler=path.join(ROOT,'native/rclc.exe'),artifact=path.join(ROOT,'selfhost/compiler.rbc');
  if(process.platform!=='win32')throw new Error('RCL_GPU_WINDOWS_COMPILER_HOST_REQUIRED');
  const sourceBindings=runtimeFiles.map(describe),kernelHash=sourceBindings[1].sha256;
  let connection=await connect(python),busy=false,disposed=false;
  function validateIdentity(observed){
    if(observed.kernelHash!==kernelHash||observed.executionOwner!=='RCL_OPENCL_RBC_STACK_VM'||observed.cpuExecutionFallback!==false
        ||observed.processPid!==connection.ready.processPid||observed.contextToken!==connection.ready.contextToken
        ||JSON.stringify(observed.device)!==JSON.stringify(connection.ready.device))throw new Error('RCL_GPU_EXECUTION_BINDING');
  }
  validateIdentity(connection.ready);
  const pythonFile=connection.ready.pythonExecutable,loader=path.join(process.env.SystemRoot??'C:/Windows','System32/OpenCL.dll');
  const target={environment:'gpu',binding:{context:'gpu',execution:'Generic RBC stack interpreter executing on one actual AMD FP64 OpenCL GPU work item',
    hostPlatform:process.platform,os:'OpenCL',arch:'gpu-fp64',deviceType:'GPU',device:connection.ready.device,
    runtimeOwner:'RCL_OPENCL_RBC_STACK_VM',cpuExecutionFallback:false,sourceBindings,
    compilerLocation:'Windows native host executing RCL-authored compiler RBC; program instructions execute on GPU',
    compilerBinary:describe(compiler),compilerArtifact:describe(artifact),kernel:sourceBindings[1],provider:sourceBindings[0],transport:sourceBindings[2],
    python:{binaryPath:pythonFile,sha256:sha(fs.readFileSync(pythonFile)),version:connection.ready.pythonVersion},
    openclLoader:{binaryPath:loader,sha256:sha(fs.readFileSync(loader))},initialProcessPid:connection.ready.processPid,
    initialContextToken:connection.ready.contextToken,stateRootOwner:'HOST_HASHES_DEVICE_PRODUCED_VALUES',
    parallelThroughputClaimed:false,securitySandboxClaimed:false,hostedDeploymentClaimed:false},
    async compile(source,output){
      if(disposed)throw new Error('RCL_GPU_TARGET_CLOSED');if(busy)throw new Error('RCL_GPU_BACKPRESSURE');
      const started=performance.now(),sourceHash=sha(fs.readFileSync(source));busy=true;
      try{
        const compiled=compileSourceFileSelfHosted(source,output,{compilerPath:compiler,compilerArtifactPath:artifact});
        return{bytecode:compiled.bytecode,ms:performance.now()-started,gpuCompileTrace:{sourceHash,artifactHash:sha(compiled.bytecode),
          compilerHash:target.binding.compilerBinary.sha256,compilerArtifactHash:target.binding.compilerArtifact.sha256,
          compilationOwner:'RCL_COMPILER_RBC_WINDOWS_NATIVE',gpuCompilationClaimed:false}};
      }finally{busy=false;}
    },
    async execute(file,sourceRoot){
      if(disposed)throw new Error('RCL_GPU_TARGET_CLOSED');if(busy)throw new Error('RCL_GPU_BACKPRESSURE');
      if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw new Error('RCL_GPU_SOURCE_ROOT_REQUIRED');
      const started=performance.now(),bytes=fs.readFileSync(file),artifactHash=sha(bytes),nonce=randomUUID();busy=true;
      try{
        for(const item of sourceBindings)if(sha(fs.readFileSync(path.join(ROOT,item.path)))!==item.sha256)throw new Error('RCL_GPU_RUNTIME_SOURCE_DRIFT');
        const observed=await connection.request({bytecode:bytes.toString('base64'),artifactHash,sourceRoot,nonce});validateIdentity(observed);
        if(observed.nonce!==nonce)throw new Error('RCL_GPU_NONCE_BINDING');
        if(observed.ok!==true){const error=new Error(JSON.stringify({status:'error',code:observed.error.split(':')[0],message:observed.error}));error.code=observed.error.split(':')[0];throw error;}
        if(observed.artifactHash!==artifactHash||observed.sourceRoot!==sourceRoot||!(observed.executedInstructions>0)
            ||observed.openclCalls?.clEnqueueNDRangeKernel!==1||observed.openclCalls?.clFinish!==1)throw new Error('RCL_GPU_EXECUTION_TRACE');
        const result=reconstructGpuResult(observed),gpuTrace={...observed,state:undefined,records:undefined,warrants:undefined,sourceRoot,
          stateRoot:result.stateRoot,transactionCount:observed.records.length,transactionSnapshotsRoot:sha(JSON.stringify(observed.records))};
        return{result,ms:performance.now()-started,gpuTrace};
      }finally{busy=false;}
    },
    async verifyReset(file,sourceRoot){
      const first=await this.execute(file,sourceRoot),next=await this.execute(file,sourceRoot);
      if(next.gpuTrace.instance!==first.gpuTrace.instance+1||next.result.stateRoot!==first.result.stateRoot)throw new Error('RCL_GPU_RESET_SEQUENCE');
      const before=connection.ready,exit=await connection.close();connection=await connect(python);validateIdentity(connection.ready);
      const reset=await this.execute(file,sourceRoot);
      if(before.contextToken===connection.ready.contextToken||reset.gpuTrace.instance!==1||reset.result.stateRoot!==first.result.stateRoot||exit.code!==0)throw new Error('RCL_GPU_PROCESS_RESET_FAILED');
      return{status:'PASS',processResetObserved:true,stateResetObserved:true,processExit:exit,
        processPidBefore:before.processPid,processPidAfter:connection.ready.processPid,contextTokenBefore:before.contextToken,contextTokenAfter:connection.ready.contextToken,
        firstInstance:first.gpuTrace.instance,nextInstance:next.gpuTrace.instance,resetInstance:1,artifactHash:sha(fs.readFileSync(file)),sourceRoot,stateRoot:reset.result.stateRoot};
    },
    async dispose(){disposed=true;await connection.close();},
  };
  return target;
}
