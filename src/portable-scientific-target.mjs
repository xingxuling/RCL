import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import readline from 'node:readline';
import {performance} from 'node:perf_hooks';
import {compileReality} from './compiler.mjs';
import {compileRealityToBytecode} from './bytecode.mjs';
import {compileRealitySessionNative} from './session-compiler.mjs';
import {createNativeRealitySession} from './native-session.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),GATE='examples/runtime-hosts/scientific-gate.rcl',KERNEL='examples/scientific/statistics.rcl',WORKER='native/scientific-runtime/oracle.py';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),cache=new Map();
const fail=code=>Object.assign(new Error(JSON.stringify({code})),{code});
export const SCIENTIFIC_TOLERANCE=1e-9;
function validateVector(values){if(!Array.isArray(values)||!values.length||values.length>256)throw fail('RCL_SCIENCE_MEASUREMENT_SIZE');for(const value of values)if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e24||value!==0&&Math.abs(value)<1e-12)throw fail('RCL_SCIENCE_MEASUREMENT_RANGE');}
export function numericMeasurements(state){
  const values=[];
  function visit(value){
    if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>1e24||value!==0&&Math.abs(value)<1e-12)throw fail('RCL_SCIENCE_MEASUREMENT_RANGE');values.push(value);}
    else if(typeof value==='boolean')values.push(Number(value));
    else if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object')Object.keys(value).sort().forEach(key=>visit(value[key]));
    else if(typeof value!=='string')throw fail('RCL_SCIENCE_MEASUREMENT_TYPE');
  }
  visit(state);if(!values.length||values.length>256)throw fail('RCL_SCIENCE_MEASUREMENT_SIZE');return values;
}
export function scientificVectorHash(values){const bytes=Buffer.alloc(values.length*8);values.forEach((v,i)=>bytes.writeDoubleBE(v,i*8));return sha(bytes);}
function numberExpression(value){
  if(value===0)return Object.is(value,-0)?'-0':'0';const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);const bits=bytes.readBigUInt64BE(),e=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n);
  const significand=(e?1n<<52n:0n)|fraction,exponent=e?e-1023-52:-1074;
  return'binary_scale('+(bits>>63n?'-':'')+significand.toString()+', '+exponent+')';
}
export function bindScientificSamples(source,values){
  function sequence(items){if(!items.length)return'empty_sequence()';if(items.length===1)return'sequence_append(empty_sequence(), '+numberExpression(items[0])+')';const middle=Math.floor(items.length/2);return'sequence_concat('+sequence(items.slice(0,middle))+', '+sequence(items.slice(middle))+')';}
  const expression=sequence(values);
  const pattern=/  facet samples\.values : Sequence = [^\n]+/u;if(!pattern.test(source))throw fail('RCL_SCIENCE_KERNEL_BINDING');
  return source.replace(pattern,'  facet samples.values : Sequence = '+expression);
}
async function createObserver(python){
  const child=spawn(python,['-u',path.join(ROOT,WORKER)],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1'}}),pending=new Map();
  let stderr='',binding,readyResolve,readyReject;const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({processPid:child.pid,code,signal,exitObserved:true})));
  child.stderr.on('data',data=>{stderr=(stderr+data).slice(-8192);});
  child.once('error',error=>{readyReject(error);for(const p of pending.values())p.reject(error);pending.clear();});
  child.once('close',()=>{const error=fail('RCL_SCIENCE_OBSERVER_EXIT:'+stderr);readyReject(error);for(const p of pending.values())p.reject(error);pending.clear();});
  readline.createInterface({input:child.stdout}).on('line',line=>{
    let payload;try{payload=JSON.parse(line);}catch{readyReject(fail('RCL_SCIENCE_OBSERVER_JSON'));return;}
    if(payload.status==='READY'){binding=payload.binding;if(binding.processPid!==child.pid){readyReject(fail('RCL_SCIENCE_OBSERVER_PID'));return;}readyResolve();return;}
    const request=pending.get(payload.id);if(request){pending.delete(payload.id);clearTimeout(request.timer);request.resolve(payload);}
  });
  const startTimer=setTimeout(()=>{readyReject(fail('RCL_SCIENCE_OBSERVER_START_TIMEOUT'));child.kill();},10000);
  try{await ready;}finally{clearTimeout(startTimer);}
  return{binding,
    async observe(values){const id=randomUUID(),started=performance.now();const payload=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(fail('RCL_SCIENCE_OBSERVER_TIMEOUT'));},5000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,operation:'observe',values})+'\n');});
      if(payload.status!=='OK')throw fail(payload.code??'RCL_SCIENCE_OBSERVER_FAILED');if(payload.processPid!==child.pid||payload.vectorHash!==scientificVectorHash(values))throw fail('RCL_SCIENCE_OBSERVER_BINDING');
      return{...payload,ms:performance.now()-started};},
    async close(){child.stdin.end(JSON.stringify({operation:'close'})+'\n');return closed;}};
}

/** Actual native numerical workbench, independently observed by NumPy/SciPy. */
export async function createPortableScientificTarget(options={}){
  const source=fs.readFileSync(path.join(ROOT,GATE),'utf8'),sourceHash=sha(source),kernel=fs.readFileSync(path.join(ROOT,KERNEL),'utf8');
  let compiled=cache.get(sourceHash);if(!compiled){compiled=compileRealitySessionNative(source);cache.set(sourceHash,compiled);}
  const python=options.pythonPath??process.env.RCL_SCIENTIFIC_PYTHON??'C:/Users/User/AppData/Local/Programs/Python/Python311/python.exe';
  const native=createPortableNativeTarget('windows'),observer=await createObserver(python);let controller;
  try{controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode});}catch(error){await observer.close();native.dispose();throw error;}
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-scientific-')),initial=controller.snapshot(),ledger=[];
  let busy=false,closed=false,disposePromise;const observerRecords=[];
  async function invoke(command){const index=ledger.length,before=controller.snapshot();try{const result=await controller.invoke(command);ledger.push({index,command,before,result,after:controller.snapshot()});return result;}
    catch(error){ledger.push({index,command,before,error:{code:error.code,message:error.message},after:controller.snapshot()});throw error;}}
  function ready(){if(closed)throw fail('RCL_SCIENCE_CLOSED');if(busy)throw fail('RCL_SCIENCE_BACKPRESSURE');}
  function runNative(file,expectedSourceRoot){
    const started=performance.now(),p=spawnSync(path.join(ROOT,'native/rclvm.exe'),[file],{encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:16*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}}),ended=performance.now();
    if(p.error)throw p.error;let payload;try{payload=JSON.parse(p.stdout);}catch{throw new Error(p.stderr);}
    if(p.status!==0||payload.status!=='ok')throw new Error(JSON.stringify(payload));const result=verifyNativeSemanticStateRoot(payload,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
    if(result.sourceRoot!==expectedSourceRoot)throw fail('RCL_SCIENCE_SOURCE_ROOT_MISMATCH');
    return{result,trace:{processPid:p.pid,status:p.status,signal:p.signal,started,ended,stdoutHash:sha(p.stdout),stderrHash:sha(p.stderr)}};
  }
  async function analyse(values,template=kernel){
    validateVector(values);const text=bindScientificSamples(template,values),file=path.join(directory,randomUUID()+'.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,text);
    const compilation=native.compile(file,artifact);if(!compilation.bytecode.equals(compileRealityToBytecode(text)))throw fail('RCL_SCIENCE_ANALYSIS_PARITY');
    const execution=runNative(artifact,compileReality(text).programRoot),independent=await observer.observe(values);observerRecords.push(independent);
    const expected=independent.result,errors={};for(const[key,value]of Object.entries(expected)){const measured=execution.result.state['result.'+key];if(!Number.isFinite(measured))throw fail('RCL_SCIENCE_ANALYSIS_VALUE');errors[key]=Math.abs(measured-value)/(1+Math.abs(value));}
    return{samples:values,vectorHash:scientificVectorHash(values),templateHash:sha(template),sourceHash:sha(text),sourceRoot:execution.result.sourceRoot,artifactHash:sha(compilation.bytecode),compileMs:compilation.ms,
      result:execution.result,processTrace:execution.trace,independent,errors,maxError:Math.max(...Object.values(errors))};
  }
  const binding={...native.binding,context:'scientific-runtime',execution:'Actual native RCL program and numerical analysis, independent local NumPy/SciPy validation and RCL-owned publication',
    numericalOwner:'RCL',oracleOwner:'NUMPY_SCIPY_OBSERVER_ONLY',externalEffectsClaimed:false,arbitraryHpcClaimed:false,tolerance:SCIENTIFIC_TOLERANCE,
    measurements:'sorted recursive finite Number and Truth 0/1; Text omitted; at most 256 values, magnitudes zero or 1e-12 through 1e24',
    kernel:{path:KERNEL,sha256:sha(kernel)},observer:{...observer.binding,worker:{path:WORKER,sha256:sha(fs.readFileSync(path.join(ROOT,WORKER)))}},
    controller:{sourcePath:GATE,sourceHash,programRoot:compileReality(source).programRoot,bytecodeHash:sha(compiled.bytecode),compilerEvidence:compiled.evidence,
      daemonRoot:initial.native.daemonRoot,daemonSourceRoot:initial.native.sourceRoot,processId:initial.native.processId}};
  const target={environment:'scientific-runtime',binding,
    async compile(file,out){ready();const result=native.compile(file,out);return{...result,scientificCompileTrace:{owner:'RCL_COMPILER_RBC_WINDOWS_NATIVE',sourceHash:sha(fs.readFileSync(file)),artifactHash:sha(result.bytecode),compilerHash:native.binding.compilerBinary.sha256,compilerArtifactHash:native.binding.compilerArtifact.sha256}};},
    async execute(file,sourceRoot,options={}){ready();busy=true;const started=performance.now(),nonce=randomUUID(),ledgerStart=ledger.length,artifactHash=sha(fs.readFileSync(file));let admitted=false,execution,analysis,entry;
      try{execution=runNative(file,sourceRoot);const samples=numericMeasurements(execution.result.state);entry=await invoke({rule:'prepare',inputs:{'event.source_root':sourceRoot,'event.sample_count':samples.length}});
        if(entry.status!=='realized')throw fail('RCL_SCIENCE_NOT_PREPARED');admitted=true;analysis=await analyse(samples,options.analysisSource??kernel);
        const completion=await invoke({rule:'publish',inputs:{'event.source_root':sourceRoot,'event.analysis_root':analysis.result.stateRoot,'event.sample_count':samples.length,'event.error':analysis.maxError}});
        if(completion.status!=='realized')throw fail('RCL_SCIENCE_NOT_PUBLISHED');
        return{result:execution.result,ms:performance.now()-started,scientificTrace:{nonce,sourceRoot,artifactHash,programTrace:execution.trace,entry,analysis,completion,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}}};
      }catch(error){const settlement=admitted&&controller.snapshot().state['experiment.active']?await invoke({rule:'fail'}):undefined;error.scientificFailure={nonce,sourceRoot,artifactHash,program:execution?.result,programTrace:execution?.trace,entry,analysis,settlement,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}};throw error;}finally{busy=false;}},
    controllerLedger:()=>structuredClone(ledger),snapshotController:()=>controller.snapshot(),observerRecords:()=>structuredClone(observerRecords),
    async controlCommand(command){ready();return invoke(command);},async analyse(values,options={}){ready();return analyse(values,options.source??kernel);},
    async pause(){ready();return invoke({rule:'pause'});},async resume(){ready();return invoke({rule:'resume'});},
    async reset(){ready();const before=controller.snapshot();await controller.close();controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode});const after=controller.snapshot();ledger.push({index:ledger.length,reset:true,before,after});return{before,after};},
    async verifyRuntimeControl(file,sourceRoot){
      const controlStart=ledger.length,first=await this.execute(file,sourceRoot);await this.pause();const paused=controller.snapshot();let pausedDenied;
      try{await this.execute(file,sourceRoot);}catch(error){if(error.code!=='RCL_AUTHORITY_DENIED')throw error;pausedDenied={code:error.code,...error.scientificFailure};}
      const pausedRollback=controller.snapshot();await this.resume();const beforeWrong=controller.snapshot();let sourceRejected=false;
      try{await this.execute(file,'0'.repeat(64));}catch(error){if(error.code!=='RCL_SCIENCE_SOURCE_ROOT_MISMATCH')throw error;sourceRejected=true;}const sourceRollback=controller.snapshot();
      const beforeEmpty=controller.snapshot(),empty=await invoke({rule:'prepare',inputs:{'event.source_root':sourceRoot,'event.sample_count':0}}),afterEmpty=controller.snapshot();
      const sampleControl=await analyse([1,2,4,8]),badKernel=kernel.replace('sequence_get(internal.moments, 1) / result.count','sequence_get(internal.moments, 1) / result.count + 1');
      if(badKernel===kernel)throw fail('RCL_SCIENCE_BAD_KERNEL_CONTROL');const badAnalysis=await analyse([1,2,4,8],badKernel);if(badAnalysis.maxError<=SCIENTIFIC_TOLERANCE)throw fail('RCL_SCIENCE_NUMERIC_MUTANT_INEFFECTIVE');
      const beforeBad=controller.snapshot();let mismatch;
      try{await this.execute(file,sourceRoot,{analysisSource:badKernel});}catch(error){if(error.code!=='RCL_AUTHORITY_DENIED')throw error;mismatch={code:error.code,...error.scientificFailure};}
      if(!mismatch||mismatch.snapshot.state['experiment.active']||mismatch.snapshot.state['experiment.completed']!==beforeBad.state['experiment.completed'])throw fail('RCL_SCIENCE_MISMATCH_PUBLICATION');
      let oversizedRejected=false,nonfiniteRejected=false;try{await analyse(Array(257).fill(1));}catch(error){if(error.code!=='RCL_SCIENCE_MEASUREMENT_SIZE')throw error;oversizedRejected=true;}
      try{await analyse([Infinity]);}catch(error){if(error.code!=='RCL_SCIENCE_MEASUREMENT_RANGE')throw error;nonfiniteRejected=true;}
      const reset=await this.reset(),second=await this.execute(file,sourceRoot);
      return{status:'PASS',sourceRejected,oversizedRejected,nonfiniteRejected,firstTrace:first.scientificTrace,secondTrace:second.scientificTrace,paused,pausedDenied,pausedRollback,beforeWrong,sourceRollback,beforeEmpty,empty,afterEmpty,
        sampleControl,badAnalysis,beforeBad,mismatch,reset,sourceRoot,artifactHash:sha(fs.readFileSync(file)),stateRoot:second.result.stateRoot,ledgerRange:{start:controlStart,end:ledger.length}};
    },
    async dispose(){disposePromise??=(async()=>{closed=true;while(busy)await new Promise(resolve=>setTimeout(resolve,1));await controller.close();native.dispose();const exit=await observer.close();if(path.dirname(directory)!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-scientific-'))throw fail('RCL_SCIENCE_TEMP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});return exit;})();return disposePromise;},
  };return target;
}
