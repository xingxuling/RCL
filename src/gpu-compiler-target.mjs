import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {createHash,randomUUID} from 'node:crypto';
import {decodeBytecode} from './bytecode.mjs';
import {reconstructGpuResult} from './portable-gpu-text-target.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const err=(code,message=code)=>Object.assign(new Error(message),{code});
function decode(bytes){try{return decodeBytecode(bytes);}catch(caught){throw err('RCL_GPU_BYTECODE_INVALID',caught.message);}}
const runtimeFiles=['native/gpu-compiler-runtime/provider.py','native/gpu-compiler-runtime/rcl-compiler-stack-vm.cl',
  'native/gpu-compiler-runtime/device-core.cl','native/gpu-compiler-runtime/device-builtins.cl','native/gpu-compiler-runtime/device-execution.cl',
  'native/gpu-compiler-runtime/decimal-parse.cl','native/gpu-compiler-runtime/build.json','scripts/build-gpu-compiler-runtime.mjs',
  'native/gpu-compiler-runtime/vendor/ryu/s2d.c','native/gpu-compiler-runtime/vendor/ryu/ryu_parse.h',
  'native/gpu-compiler-runtime/vendor/ryu/LICENSE-Apache2','native/gpu-compiler-runtime/vendor/ryu/PROVENANCE.json',
  'native/gpu-text-runtime/ryu-opencl.cl','native/tensor-engine/amd_opencl_bf16_provider.py'];
const describe=file=>{const bytes=fs.readFileSync(path.join(ROOT,file));return{path:file,sha256:sha(bytes),bytes:bytes.length};};

async function connect(python,timeoutMs){
  const child=spawn(python,[path.join(ROOT,runtimeFiles[0])],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const lines=readline.createInterface({input:child.stdout});let pending,closed=false,stderr='';
  const fail=caught=>{if(pending){const p=pending;pending=undefined;p.clean();p.reject(caught);}};
  child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-16384);});
  const exit=new Promise(resolve=>child.once('close',(code,signal)=>{closed=true;fail(err('RCL_GPU_PROCESS_EXIT',`${code}:${signal}:${stderr}`));lines.close();resolve({processPid:child.pid,code,signal,exitObserved:true});}));
  child.on('error',fail);child.stdin.on('error',fail);
  lines.on('line',line=>{if(!pending){child.kill();return;}const p=pending;pending=undefined;p.clean();try{p.resolve(JSON.parse(line));}catch(caught){p.reject(caught);child.kill();}});
  function response({signal,timeout=timeoutMs}={}){
    if(closed)return Promise.reject(err('RCL_GPU_PROCESS_CLOSED'));
    if(pending)return Promise.reject(err('RCL_GPU_BACKPRESSURE'));
    return new Promise((resolve,reject)=>{
      const stop=code=>{fail(err(code));child.kill();};
      const abort=()=>stop('RCL_GPU_CANCELLED');
      const timer=setTimeout(()=>stop('RCL_GPU_REQUEST_TIMEOUT'),timeout);
      pending={resolve,reject,clean(){clearTimeout(timer);signal?.removeEventListener('abort',abort);}};
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    });
  }
  async function close(){if(!closed){child.stdin.end();const timer=setTimeout(()=>child.kill(),3000);try{return await exit;}finally{clearTimeout(timer);}}return await exit;}
  try{const ready=await response();if(ready.ready!==true||ready.processPid!==child.pid)throw err('RCL_GPU_READY_BINDING');return{ready,
    async request(input,options){const wait=response(options);if(!options?.signal?.aborted)child.stdin.write(JSON.stringify(input)+'\n');try{return await wait;}catch(caught){if(caught.code==='RCL_GPU_CANCELLED'||caught.code==='RCL_GPU_REQUEST_TIMEOUT'){caught.gpuProcessExit=await exit;}throw caught;}},close};
  }catch(caught){child.kill();await exit;throw caught;}
}

/** Candidate actual supplied compiler/program execution on a generic AMD FP64 GPU VM. */
export async function createGpuCompilerTarget(options={}){
  const python=options.pythonPath??process.env.RCL_GPU_PYTHON??'python',timeoutMs=options.timeoutMs??240000;
  const quantum=options.quantum;
  if(quantum!==undefined&&(!Number.isSafeInteger(quantum)||quantum<1||quantum>1000000))throw err('RCL_GPU_QUANTUM_LIMIT');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw err('RCL_GPU_TIMEOUT_RANGE');
  const sourceBindings=runtimeFiles.map(describe),kernelHash=sourceBindings[1].sha256;
  let connection=await connect(python,timeoutMs),busy=false,closed=false,disposed,active;const exits=[];
  function validate(observed){if(observed.kernelHash!==kernelHash||observed.executionOwner!=='RCL_OPENCL_RESUMABLE_RBC_COMPILER_VM'
    ||observed.cpuExecutionFallback!==false||observed.processPid!==connection.ready.processPid||observed.contextToken!==connection.ready.contextToken
    ||JSON.stringify(observed.device)!==JSON.stringify(connection.ready.device))throw err('RCL_GPU_EXECUTION_BINDING');}
  validate(connection.ready);
  const loader=path.join(process.env.SystemRoot??'C:/Windows','System32/OpenCL.dll');
  const binding={owner:'RCL_SUPPLIED_COMPLETE_COMPILER_GPU',environment:'gpu',status:'CANDIDATE_RUNTIME_NOT_K400_ADMITTED',
    device:connection.ready.device,sourceBindings,kernelHash,initialProcessPid:connection.ready.processPid,initialContextToken:connection.ready.contextToken,
    python:{binaryPath:connection.ready.pythonExecutable,sha256:sha(fs.readFileSync(connection.ready.pythonExecutable)),version:connection.ready.pythonVersion},
    openclLoader:{binaryPath:loader,sha256:sha(fs.readFileSync(loader))},stateRootOwner:'HOST_HASHES_DEVICE_PRODUCED_VALUES',
    referenceCompilationUsed:false,referenceExecutionUsed:false,cpuExecutionFallback:false,parallelThroughputClaimed:false,securitySandboxClaimed:false,
    providerScope:'ONLY_IMMUTABLE_COMPILER_INPUT_SOURCE',maxInFlight:1,instructionBudget:300000000,
    decimalParserScope:'Pinned Ryu s2d parser; at most 17 significant decimal digits; unsupported formats fail visibly'};
  function ready(){if(closed)throw err('RCL_GPU_TARGET_CLOSED');if(busy)throw err('RCL_GPU_BACKPRESSURE');for(const item of sourceBindings)if(sha(fs.readFileSync(path.join(ROOT,item.path)))!==item.sha256)throw err('RCL_GPU_RUNTIME_SOURCE_DRIFT');}
  async function request(input,control){
    if(!connection)connection=await connect(python,timeoutMs);
    validate(connection.ready);
    try{const observed=await connection.request(input,control);validate(observed);if(observed.nonce!==input.nonce)throw err('RCL_GPU_NONCE_BINDING');
      if(observed.ok!==true){const caught=err(observed.error?.split(':')[0]??'RCL_GPU_REJECTED',observed.error);caught.gpuTrace=observed;throw caught;}
      if(observed.artifactHash!==input.artifactHash||observed.sourceRoot!==input.sourceRoot||observed.compilerSourceHash!==(input.compilerSourceHash??null)
        ||!Number.isInteger(observed.executedInstructions)||observed.executedInstructions<1||observed.executedInstructions>300000000
        ||observed.openclCalls?.clEnqueueNDRangeKernel<observed.batchCount||observed.openclCalls?.clFinish!==observed.openclCalls?.clEnqueueNDRangeKernel)throw err('RCL_GPU_TRACE_BINDING');
      if(!Array.isArray(observed.deviceOpcodeCounts)||observed.deviceOpcodeCounts.length!==48
        ||observed.deviceOpcodeCounts.some(n=>!Number.isSafeInteger(n)||n<0)
        ||observed.deviceOpcodeCounts.reduce((a,b)=>a+b,0)!==observed.executedInstructions)throw err('RCL_GPU_INSTRUCTION_COUNT_BINDING');
      return observed;
    }catch(caught){if(caught.gpuProcessExit){exits.push(caught.gpuProcessExit);connection=null;}throw caught;}
  }
  function operate(task){busy=true;active=(async()=>{try{return await task();}finally{busy=false;}})();return active;}
  const target={binding,exits:()=>structuredClone(exits),
    compile(compilerFile,sourceFile,outputFile,control={}){
      control={signal:control.signal,timeout:control.timeout};
      ready();if(control.signal?.aborted)return Promise.reject(err('RCL_GPU_CANCELLED'));
      const started=performance.now(),compiler=fs.readFileSync(compilerFile),sourceBytes=fs.readFileSync(sourceFile),program=decode(compiler);
      const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(sourceBytes),inputCompilerHash=sha(compiler),sourceHash=sha(sourceBytes),nonce=randomUUID(),destination=path.resolve(outputFile);
      return operate(async()=>{
        const observed=await request({mode:'compile',bytecode:compiler.toString('base64'),artifactHash:inputCompilerHash,sourceRoot:program.sourceRoot,
          compilerSource:source,compilerSourceHash:sourceHash,nonce,...(quantum?{quantum}:{})},control);
        const bytecode=Buffer.from(observed.outputBytes,'base64');if(sha(bytecode)!==observed.outputHash||bytecode.length!==observed.outputLength||observed.providerCalls!==1)throw err('RCL_GPU_COMPILER_OUTPUT_BINDING');
        const decoded=decode(bytecode);if(control.signal?.aborted)throw err('RCL_GPU_CANCELLED');
        const temporary=destination+'.gpu-'+nonce;try{fs.writeFileSync(temporary,bytecode,{flag:'wx'});fs.renameSync(temporary,destination);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
        return{bytecode,ms:performance.now()-started,compilerTrace:{...observed,outputBytes:undefined,inputCompilerHash,sourceHash,outputSourceRoot:decoded.sourceRoot,
          compilationOwner:'RCL_COMPILER_RBC_GPU',gpuCompilationClaimed:true}};
      });
    },
    execute(artifactFile,sourceRoot,control={}){
      control={signal:control.signal,timeout:control.timeout};
      ready();if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw err('RCL_GPU_SOURCE_ROOT_REQUIRED');if(control.signal?.aborted)return Promise.reject(err('RCL_GPU_CANCELLED'));
      const started=performance.now(),bytes=fs.readFileSync(artifactFile),artifactHash=sha(bytes),nonce=randomUUID();
      return operate(async()=>{const observed=await request({mode:'execute',bytecode:bytes.toString('base64'),artifactHash,sourceRoot,nonce},control),result=reconstructGpuResult(observed);
        return{result,ms:performance.now()-started,gpuTrace:{...observed,state:undefined,records:undefined,warrants:undefined,stateRoot:result.stateRoot,
          transactionCount:observed.records.length,transactionSnapshotsRoot:sha(JSON.stringify(observed.records))}};});
    },
    async reset(){ready();busy=true;try{const before=connection?.ready;if(connection){exits.push(await connection.close());connection=null;}connection=await connect(python,timeoutMs);validate(connection.ready);if(before?.contextToken===connection.ready.contextToken)throw err('RCL_GPU_RESET_FAILED');return{before,after:connection.ready,exit:exits.at(-1)};}finally{busy=false;}},
    dispose(){if(disposed)return disposed;closed=true;disposed=(async()=>{if(active)await active.catch(()=>{});if(connection){exits.push(await connection.close());connection=null;}return{closed:true,exits:target.exits()};})();return disposed;},
  };
  return target;
}
