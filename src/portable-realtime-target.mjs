import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {compileReality} from './compiler.mjs';
import {compileRealitySessionNative} from './session-compiler.mjs';
import {createNativeRealitySession} from './native-session.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),SOURCE='examples/runtime-hosts/realtime-gate.rcl';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),cache=new Map();
const error=(code,message=code)=>Object.assign(new Error(JSON.stringify({code,message})),{code});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Real monotonic timers and native child processes, with RCL-owned soft deadlines. */
export async function createPortableRealtimeTarget(){
  const source=fs.readFileSync(path.join(ROOT,SOURCE),'utf8'),sourceHash=sha(source);
  let compiled=cache.get(sourceHash);if(!compiled){compiled=compileRealitySessionNative(source);cache.set(sourceHash,compiled);}
  let controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode});
  const initial=controller.snapshot(),native=createPortableNativeTarget('windows'),binary=path.join(ROOT,'native/rclvm.exe');
  if(!initial.native.sourceBound){await controller.close();throw error('RCL_REALTIME_CONTROLLER_UNBOUND');}
  let busy=false,disposed=false,sequence=0,currentStop=null,activeCancel=null;const ledger=[];
  async function invoke(command){
    const index=ledger.length,before=controller.snapshot();
    try{const result=await controller.invoke(command);ledger.push({index,command,before,result,after:controller.snapshot()});return result;}
    catch(caught){ledger.push({index,command,before,error:{code:caught.code,message:caught.message},after:controller.snapshot()});throw caught;}
  }
  async function waitUntil(release,signal){
    let timerCount=0;
    while(performance.now()<release){if(signal?.aborted)throw error('RCL_REALTIME_CANCELLED');await sleep(Math.min(10,Math.max(1,release-performance.now())));timerCount++;}
    if(signal?.aborted)throw error('RCL_REALTIME_CANCELLED');return timerCount;
  }
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
      stdoutHash:sha(stdout),stderrHash:sha(stderr)};
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
  const target={environment:'realtime-runtime',binding:{...native.binding,context:'realtime-runtime',
      execution:'Actual monotonic timer release, asynchronous native C VM process, and source-owned soft deadline/publication',
      clock:{kind:'node.performance.now',timeOrigin:performance.timeOrigin,processPid:process.pid,nodeVersion:process.version,binaryPath:process.execPath,sha256:sha(fs.readFileSync(process.execPath))},
      controller:{sourcePath:SOURCE,sourceHash,programRoot:compileReality(source).programRoot,bytecodeHash:sha(compiled.bytecode),compilerEvidence:compiled.evidence,
        daemonRoot:initial.native.daemonRoot,daemonSourceRoot:initial.native.sourceRoot,processId:initial.native.processId},
      deadlineScope:'observed monotonic admission/completion samples; transport and OS scheduling are not hard realtime',
      hardRealtimeClaimed:false,osInterruptGuaranteeClaimed:false,externalEffectsClaimed:false,maxInFlight:1},
    async compile(file,out){
      if(disposed)throw error('RCL_REALTIME_CLOSED');if(busy)throw error('RCL_REALTIME_BACKPRESSURE');
      const compilation=native.compile(file,out);return{...compilation,realtimeCompileTrace:{owner:'RCL_COMPILER_RBC_WINDOWS_NATIVE',sourceHash:sha(fs.readFileSync(file)),artifactHash:sha(compilation.bytecode),
        compilerHash:native.binding.compilerBinary.sha256,compilerArtifactHash:native.binding.compilerArtifact.sha256}};
    },
    async execute(file,sourceRoot,options={}){
      if(disposed)throw error('RCL_REALTIME_CLOSED');if(busy)throw error('RCL_REALTIME_BACKPRESSURE');
      if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw error('RCL_REALTIME_SOURCE_ROOT_REQUIRED');
      const bytes=fs.readFileSync(file),artifactHash=sha(bytes),started=performance.now(),release=started+(options.notBeforeMs??2),deadline=started+(options.deadlineMs??2000);
      if(!Number.isFinite(release)||!Number.isFinite(deadline)||(options.notBeforeMs??2)<0)throw error('RCL_REALTIME_TIME_ARGUMENT');
      const cancellation=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,cancellation.signal]):cancellation.signal;
      activeCancel=()=>cancellation.abort();
      busy=true;const index=++sequence,ledgerStart=ledger.length,nonce=randomUUID();let admitted=false,entry,nativeTrace,timerCount=0;
      try{
        timerCount=await waitUntil(release,signal);const admittedAt=performance.now();
        entry=await invoke({rule:'admit',inputs:{'event.root':sourceRoot,'event.now':admittedAt,'event.release':release,'event.deadline':deadline,'event.cancelled':signal.aborted}});
        if(entry.status!=='realized')throw error('RCL_REALTIME_NOT_RELEASED_OR_EXPIRED');admitted=true;
        if(sha(fs.readFileSync(file))!==artifactHash)throw error('RCL_REALTIME_INPUT_BINDING');
        if(signal.aborted)throw error('RCL_REALTIME_CANCELLED');
        if(performance.now()>deadline)throw error('RCL_REALTIME_DEADLINE_EXPIRED');
        const executed=await childExecution(file,sourceRoot,deadline,signal);nativeTrace=executed.nativeTrace;
        const publishedAt=performance.now(),completion=await invoke({rule:'publish',inputs:{'event.now':publishedAt,'event.success':true,'event.cancelled':signal.aborted}});
        if(completion.status!=='realized')throw error('RCL_REALTIME_PUBLICATION_NOT_ADMITTED');
        return{result:executed.result,ms:performance.now()-started,realtimeTrace:{nonce,index,sourceRoot,artifactHash,stateRoot:executed.result.stateRoot,
          started,release,deadline,admittedAt,publishedAt,timerCount,nativeTrace,entry,completion,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}}};
      }catch(caught){
        nativeTrace=caught.nativeTrace??nativeTrace;
        let settlement;if(admitted&&controller.snapshot().state['job.active'])settlement=await invoke({rule:'fail',inputs:{'event.now':performance.now(),'event.success':false,'event.cancelled':signal.aborted||caught.code==='RCL_REALTIME_CANCELLED'}});
        caught.realtimeFailure={nonce,index,sourceRoot,artifactHash,started,release,deadline,timerCount,nativeTrace,entry,settlement,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}};
        throw caught;
      }finally{busy=false;activeCancel=null;}
    },
    controllerLedger(){return structuredClone(ledger);},snapshotController(){return controller.snapshot();},
    async verifyRuntimeControl(file,sourceRoot,spinArtifact,spinRoot){
      const controlStart=ledger.length,completedBefore=controller.snapshot().state['job.completed'];
      const releaseRun=await this.execute(file,sourceRoot,{notBeforeMs:20,deadlineMs:2000});
      if(releaseRun.realtimeTrace.timerCount<1||releaseRun.realtimeTrace.admittedAt<releaseRun.realtimeTrace.release)throw error('RCL_REALTIME_RELEASE_CONTROL');
      const inFlight=this.execute(file,sourceRoot,{notBeforeMs:20,deadlineMs:2000});let backpressureRejected=false;
      try{await this.execute(file,sourceRoot);}catch(caught){if(caught.code!=='RCL_REALTIME_BACKPRESSURE')throw caught;backpressureRejected=true;}
      const backpressureRun=await inFlight;
      let expiredBeforeStart;try{await this.execute(file,sourceRoot,{notBeforeMs:0,deadlineMs:-1});}catch(caught){expiredBeforeStart={code:caught.code,...caught.realtimeFailure};}
      if(expiredBeforeStart?.code!=='RCL_REALTIME_NOT_RELEASED_OR_EXPIRED'||expiredBeforeStart.nativeTrace)throw error('RCL_REALTIME_EXPIRED_DISPATCH_CONTROL');
      const beforeReverse=controller.snapshot();
      const reversal=await invoke({rule:'admit',inputs:{'event.root':sourceRoot,'event.now':beforeReverse.state['clock.last']-1,
        'event.release':0,'event.deadline':beforeReverse.state['clock.last']+2000,'event.cancelled':false}});
      if(reversal.status!=='not-triggered'||controller.snapshot().stateRoot!==beforeReverse.stateRoot)throw error('RCL_REALTIME_TIME_REVERSAL_CONTROL');
      await this.pause();let paused;try{await this.execute(file,sourceRoot);}catch(caught){paused={code:caught.code,...caught.realtimeFailure};}
      if(paused?.code!=='RCL_AUTHORITY_DENIED'||paused.nativeTrace)throw error('RCL_REALTIME_SOURCE_AUTHORITY_CONTROL');await this.resume();
      const beforeTimeout=controller.snapshot(),heartbeat=[];const pulse=setInterval(()=>heartbeat.push(performance.now()),5);let timeout;
      try{await this.execute(spinArtifact,spinRoot,{notBeforeMs:0,deadlineMs:150});}catch(caught){timeout={code:caught.code,...caught.realtimeFailure};}finally{clearInterval(pulse);}
      if(timeout?.code!=='RCL_REALTIME_DEADLINE_EXPIRED'||!timeout.nativeTrace?.exitObserved||!timeout.nativeTrace.stopSignalSent
          ||timeout.nativeTrace.stopReason!=='RCL_REALTIME_DEADLINE_EXPIRED'||heartbeat.length<1
          ||controller.snapshot().state['job.completed']!==beforeTimeout.state['job.completed']||controller.snapshot().state['job.active'])throw error('RCL_REALTIME_NATIVE_TIMEOUT_CONTROL');
      const beforeCancel=controller.snapshot(),cancellation=new AbortController();let cancellationRequestedAt,cancelled;
      const cancelTimer=setTimeout(()=>{cancellationRequestedAt=performance.now();cancellation.abort();},20);
      try{await this.execute(spinArtifact,spinRoot,{notBeforeMs:0,deadlineMs:2000,signal:cancellation.signal});}catch(caught){cancelled={code:caught.code,...caught.realtimeFailure};}finally{clearTimeout(cancelTimer);}
      if(cancelled?.code!=='RCL_REALTIME_CANCELLED'||!cancelled.nativeTrace?.exitObserved||!cancelled.nativeTrace.stopSignalSent
          ||cancelled.nativeTrace.stopReason!=='RCL_REALTIME_CANCELLED'||controller.snapshot().state['job.completed']!==beforeCancel.state['job.completed']||controller.snapshot().state['job.active'])throw error('RCL_REALTIME_NATIVE_CANCEL_CONTROL');
      const resumed=await this.execute(file,sourceRoot);
      return{status:'PASS',backpressureRejected,sourceAuthorityDenied:true,timeReversalRejected:true,expiredBeforeStart,paused,reversal,beforeReverse,
        releaseTrace:releaseRun.realtimeTrace,backpressureTrace:backpressureRun.realtimeTrace,timeout,cancelled,heartbeat,cancellationRequestedAt,
        spinArtifactHash:sha(fs.readFileSync(spinArtifact)),spinSourceRoot:spinRoot,completedBefore,
        resumedTrace:resumed.realtimeTrace,stateRoot:resumed.result.stateRoot,sourceRoot,artifactHash:sha(fs.readFileSync(file)),
        ledgerRange:{start:controlStart,end:ledger.length}};
    },
    async pause(){if(busy)throw error('RCL_REALTIME_BACKPRESSURE');return invoke({rule:'pause'});},
    async resume(){if(busy)throw error('RCL_REALTIME_BACKPRESSURE');return invoke({rule:'resume'});},
    async dispose(){disposed=true;activeCancel?.();currentStop?.();while(busy)await sleep(1);await controller.close();native.dispose();},
  };
  return target;
}
