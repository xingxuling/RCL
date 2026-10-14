// ADAPT of src/portable-realtime-target.mjs at SHA256 cee0ca3340412d4bc9c56e2f081d4c353777ed26220a312ef103491c2eb36df7; original native process/timer transport extended to actual supplied full compiler jobs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {compileReality} from './compiler.mjs';
import {compileRealitySessionNative} from './session-compiler.mjs';
import {createNativeRealitySession} from './native-session.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
import {createTimedSequenceCompiler} from './timed-sequence-compiler.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),SOURCE='examples/runtime-hosts/realtime-gate.rcl',sha=b=>createHash('sha256').update(b).digest('hex'),cache=new Map();
const error=(code,message=code)=>Object.assign(new Error(message),{code}),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function capture(bytes){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-realtime-compiler-'));if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-realtime-compiler-'))throw error('RCLC_REALTIME_TEMP_SCOPE');const paths=bytes.map((_v,i)=>path.join(directory,'input-'+i)),close=()=>fs.rmSync(directory,{recursive:true,force:true});try{bytes.forEach((v,i)=>fs.writeFileSync(paths[i],v));}catch(caught){close();throw caught;}return{paths,close};}

/** Actual supplied complete compiler and program jobs under the original native RCL soft scheduler. */
export async function createRealtimeCompilerTarget(){
  const source=fs.readFileSync(path.join(ROOT,SOURCE),'utf8'),sourceHash=sha(source),compiler=createTimedSequenceCompiler(),native=createPortableNativeTarget('windows'),binary=path.join(ROOT,'native/rclvm.exe');let compiled=cache.get(sourceHash);if(!compiled){compiled=compileRealitySessionNative(source);cache.set(sourceHash,compiled);}const controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode}),initial=controller.snapshot();
  if(!initial.native.sourceBound||!initial.native.stateRootsIndependentlyVerified){await controller.close();throw error('RCLC_REALTIME_CONTROLLER_UNBOUND');}
  const ledger=[];let busy=false,closed=false,sequence=0,active,disposed,currentStop=null,activeCancel=null;
  const clock={kind:'node.performance.now',timeOrigin:performance.timeOrigin,processPid:process.pid,nodeVersion:process.version,binaryPath:process.execPath,sha256:sha(fs.readFileSync(process.execPath))},controllerBinding={sourcePath:SOURCE,sourceHash,programRoot:compileReality(source).programRoot,bytecodeHash:sha(compiled.bytecode),compilerEvidence:compiled.evidence,daemonRoot:initial.native.daemonRoot,daemonSourceRoot:initial.native.sourceRoot,processId:initial.native.processId};
  const binding={owner:'RCL_COMPLETE_COMPILER_SOFT_REALTIME',environment:'realtime-runtime',compiler:compiler.binding,runtimeOwner:{...native.binding,context:'realtime-runtime',clock,controller:controllerBinding,maxInFlight:1,hardRealtimeClaimed:false,osInterruptGuaranteeClaimed:false,externalEffectsClaimed:false},compileRootKind:'SHA256_SOURCE_BYTES',executeRootKind:'RCL_PROGRAM_ROOT',referenceCompilationUsed:false,referenceExecutionUsed:false,securitySandboxClaimed:false,hardRealtimeClaimed:false,osInterruptGuaranteeClaimed:false,externalEffectsClaimed:false,maxInFlight:1};
  async function invoke(command){const index=ledger.length,before=controller.snapshot();try{const result=await controller.invoke(command);ledger.push({index,command,before,result,after:controller.snapshot()});return result;}catch(caught){ledger.push({index,command,before,error:{code:caught.code,message:caught.message},after:controller.snapshot()});throw caught;}}
  function ready(){if(closed)throw error('RCLC_REALTIME_CLOSED');if(busy)throw error('RCLC_REALTIME_BACKPRESSURE');}
  async function waitUntil(release,signal){let timerCount=0;while(performance.now()<release){if(signal.aborted)throw error('RCL_REALTIME_CANCELLED');await sleep(Math.min(10,Math.max(1,release-performance.now())));timerCount++;}if(signal.aborted)throw error('RCL_REALTIME_CANCELLED');return timerCount;}
  async function childExecution(file,sourceRoot,deadline,signal){
    const started=performance.now(),child=spawn(binary,[file],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}});
    let stdout='',stderr='',reason=null,stopRequestedAt=null,stopSignalSent=false,exitObserved=false;
    const stop=code=>{if(reason)return;reason=code;stopRequestedAt=performance.now();stopSignalSent=child.kill('SIGTERM');};currentStop=()=>stop('RCL_REALTIME_CANCELLED');
    const onAbort=()=>stop('RCL_REALTIME_CANCELLED');signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted)onAbort();
    let timer;
    const expire=()=>{const remaining=deadline-performance.now();if(remaining>0)timer=setTimeout(expire,Math.max(1,remaining));else stop('RCL_REALTIME_DEADLINE_EXPIRED');};
    timer=setTimeout(expire,Math.max(1,deadline-performance.now()));
    child.stdout.on('data',bytes=>{stdout+=bytes;if(Buffer.byteLength(stdout)>16*1024*1024)stop('RCL_REALTIME_OUTPUT_LIMIT');});
    child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-8192);});
    let exit;
    try{
      exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signalCode)=>{exitObserved=true;resolve({code,signal:signalCode});});});
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);currentStop=null;}
    const ended=performance.now(),trace={processPid:child.pid,started,ended,exitObserved,...exit,stopRequestedAt,stopSignalSent,stopReason:reason,
      stdout,stderr,command:binary,args:[file],stdoutHash:sha(stdout),stderrHash:sha(stderr)};
    if(reason){const caught=error(reason);caught.nativeTrace=trace;throw caught;}
    let payload;try{payload=JSON.parse(stdout);}catch{
      let rejected;try{rejected=JSON.parse(stderr);}catch{}
      const caught=error(rejected?.status==='error'&&/^RCL_[A-Z0-9_]+$/u.test(rejected.code??'')?rejected.code:'RCL_REALTIME_NATIVE_OUTPUT',rejected?.message??stderr);
      caught.nativeTrace=trace;throw caught;
    }
    if(exit.code!==0||payload.status!=='ok'){const caught=error(payload.code??/\b(RCL_[A-Z_]+)\b/u.exec(stderr)?.[1]??'RCL_REALTIME_NATIVE_REJECTED',payload.message??stderr);caught.nativeTrace=trace;throw caught;}
    const result=verifyNativeSemanticStateRoot(payload,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
    if(result.sourceRoot!==sourceRoot){const caught=error('RCL_REALTIME_SOURCE_ROOT_MISMATCH');caught.nativeTrace=trace;throw caught;}
    return{result,nativeTrace:trace};
  }
  function operation(kind,inputRoot,inputCompilerHash,artifactHash,run,outputFile,options){ready();busy=true;active=(async()=>{const started=performance.now(),release=started+(options.notBeforeMs??2),deadline=started+(options.deadlineMs??(kind==='compile'?50000:2000)),before=controller.snapshot(),start=ledger.length,index=++sequence,nonce=randomUUID();const cancellation=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,cancellation.signal]):cancellation.signal;activeCancel=()=>cancellation.abort();let entry,completion,settlement,nativeTrace,value,timerCount=0,nativeCalled=false,admittedAt,publishedAt;
    try{if(!Number.isFinite(release)||!Number.isFinite(deadline)||(options.notBeforeMs??2)<0)throw error('RCL_REALTIME_TIME_ARGUMENT');timerCount=await waitUntil(release,signal);admittedAt=performance.now();entry=await invoke({rule:'admit',inputs:{'event.root':inputRoot,'event.now':admittedAt,'event.release':release,'event.deadline':deadline,'event.cancelled':signal.aborted}});if(entry.status!=='realized')throw error('RCL_REALTIME_NOT_RELEASED_OR_EXPIRED');if(signal.aborted)throw error('RCL_REALTIME_CANCELLED');if(performance.now()>deadline)throw error('RCL_REALTIME_DEADLINE_EXPIRED');nativeCalled=true;value=await run(deadline,signal);nativeTrace=value.nativeTrace;
      publishedAt=performance.now();completion=await invoke({rule:'publish',inputs:{'event.now':publishedAt,'event.success':true,'event.cancelled':signal.aborted}});if(completion.status!=='realized')throw error('RCL_REALTIME_PUBLICATION_NOT_ADMITTED');if(kind==='compile'&&outputFile)fs.writeFileSync(outputFile,value.bytecode);return{...value,ms:performance.now()-started,realtimeTrace:{kind,index,nonce,inputRoot,inputCompilerHash,artifactHash:kind==='compile'?sha(value.bytecode):artifactHash,nativeCalled,before,started,release,deadline,admittedAt,publishedAt,timerCount,nativeTrace,entry,completion,snapshot:controller.snapshot(),ledgerRange:{start,end:ledger.length}}};
    }catch(caught){nativeTrace=caught.nativeTrace??nativeTrace;if(controller.snapshot().state['job.active'])settlement=await invoke({rule:'fail',inputs:{'event.now':performance.now(),'event.success':false,'event.cancelled':signal.aborted||caught.code==='RCL_REALTIME_CANCELLED'}});caught.compilerTrace??=value?.compilerTrace;caught.realtimeFailure={kind,index,nonce,inputRoot,inputCompilerHash,artifactHash:kind==='compile'&&value?sha(value.bytecode):artifactHash,nativeCalled,before,started,release,deadline,admittedAt:admittedAt??null,publishedAt:publishedAt??null,timerCount,nativeTrace:nativeTrace??null,entry:entry??null,completion:completion??null,settlement:settlement??null,snapshot:controller.snapshot(),ledgerRange:{start,end:ledger.length}};throw caught;}
    finally{busy=false;activeCancel=null;}
  })();return active;}
  const target={environment:'realtime-runtime',binding,
    async compile(compilerFile,sourceFile,outputFile,options={}){ready();const sourceBytes=fs.readFileSync(sourceFile),seed=fs.readFileSync(compilerFile);if(!Buffer.from(sourceBytes.toString('utf8')).equals(sourceBytes))throw error('RCLC_REALTIME_SOURCE_UTF8');const frozen=capture([seed,sourceBytes]);try{return await operation('compile',sha(sourceBytes),sha(seed),null,(deadline,signal)=>compiler.compile(...frozen.paths,{deadline,signal}),outputFile,options);}finally{frozen.close();}},
    async execute(file,sourceRoot,options={}){ready();if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw error('RCLC_REALTIME_SOURCE_ROOT_REQUIRED');const bytes=fs.readFileSync(file),frozen=capture([bytes]);try{return await operation('execute',sourceRoot,null,sha(bytes),(deadline,signal)=>childExecution(frozen.paths[0],sourceRoot,deadline,signal),null,options);}finally{frozen.close();}},
    controllerLedger:()=>structuredClone(ledger),snapshotController:()=>controller.snapshot(),
    async pause(){ready();return invoke({rule:'pause'});},async resume(){ready();return invoke({rule:'resume'});},
    async verifyTimeReversal(root){ready();const before=controller.snapshot(),result=await invoke({rule:'admit',inputs:{'event.root':root,'event.now':before.state['clock.last']-1,'event.release':0,'event.deadline':before.state['clock.last']+2000,'event.cancelled':false}});return{before,result,after:controller.snapshot(),index:ledger.length-1};},
    async dispose(){if(disposed)return disposed;closed=true;activeCancel?.();currentStop?.();disposed=(async()=>{if(active)await active.catch(()=>{});await controller.close();let absent=false;try{process.kill(controllerBinding.processId,0);}catch(caught){if(caught.code==='ESRCH')absent=true;else throw caught;}if(!absent)throw error('RCLC_REALTIME_CONTROLLER_TERMINATION');return{controller:{pid:controllerBinding.processId,terminationObserved:true,exitCode:'UNAVAILABLE_FROM_REUSED_SESSION_API'}};})();return disposed;},
  };return target;
}
