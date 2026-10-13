import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {compileReality} from './compiler.mjs';
import {compileRealityToBytecode} from './bytecode.mjs';
import {compileRealitySessionNative} from './session-compiler.mjs';
import {createNativeRealitySession} from './native-session.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {verifyNativeSemanticStateRoot,semanticStateRootForAlgorithm} from './semantic-state-root.mjs';
import {nativeDataLiteral} from './native-data-literals.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DONOR='examples/native-ai/general-mlp.rcl',GATE='examples/runtime-hosts/ai-gate.rcl';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),modelCache=new Map(),gateCache=new Map();
const fail=code=>Object.assign(new Error(JSON.stringify({code})),{code});
const modelRoot=model=>semanticStateRootForAlgorithm({model},'rcl.semantic-state-root.v2');
function validateSamples(samples){if(!Array.isArray(samples)||!samples.length||samples.length>256)throw fail('RCL_AI_MEASUREMENT_SIZE');for(const v of samples)if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e24||v!==0&&Math.abs(v)<1e-12)throw fail('RCL_AI_MEASUREMENT_RANGE');}
export function aiMeasurements(state){
  const values=[];function visit(v){if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>1e24||v!==0&&Math.abs(v)<1e-12)throw fail('RCL_AI_MEASUREMENT_RANGE');values.push(v);}else if(typeof v==='boolean')values.push(Number(v));else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.keys(v).sort().forEach(k=>visit(v[k]));else if(typeof v!=='string')throw fail('RCL_AI_MEASUREMENT_TYPE');}
  visit(state);if(!values.length||values.length>256)throw fail('RCL_AI_MEASUREMENT_SIZE');return values;
}
export function buildNativeInferenceSource(donor,model,samples){
  const end=donor.indexOf('  reckon sample_loss_units(');if(end<0)throw fail('RCL_AI_DONOR_BOUNDARY');
  return donor.slice(0,end).replace('reality GeneralMlpNativeLearning','reality NativeModelInference')+
    '  reckon binary_scale(value : Number, exponent : Number) -> Number = choose(exponent == 0, value, choose(exponent > 0, binary_scale(value * 2, exponent - 1), binary_scale(value / 2, exponent + 1)))\n'+
    '  reckon clamp_feature(value : Number) -> Number = choose(value < 0, 0, choose(value > 1, 1, value))\n'+
    '  reckon feature_channel(values : Sequence, index : Number, channel : Number, total : Number, count : Number) -> Number = choose(index >= length(values), choose(count == 0, 0, total / count), choose(index % 2 == channel, feature_channel(values, index + 1, channel, total + clamp_feature(sequence_get(values, index)), count + 1), feature_channel(values, index + 1, channel, total, count)))\n'+
    '  facet model.parameters : Sequence = '+nativeDataLiteral(model)+'\n'+
    '  facet input.samples : Sequence = '+nativeDataLiteral(samples)+'\n'+
    '  facet inference.features : Sequence = two(feature_channel(input.samples, 0, 0, 0, 0), feature_channel(input.samples, 0, 1, 0, 0))\n'+
    '  facet inference.model_valid : Truth = model_valid(model.parameters) and layer_input_size(model_first_layer(model.parameters)) == 2\n'+
    '  facet inference.hidden : Sequence = model_hidden(model.parameters, inference.features)\n'+
    '  facet inference.output : Sequence = model_forward(model.parameters, inference.features)\n'+
    '  facet inference.advisory_only : Truth = true\n'+
    '  facet inference.authority_granted : Truth = false\n}\n';
}
function runNative(file,sourceRoot,timeout=8000){
  const started=performance.now(),p=spawnSync(path.join(ROOT,'native/rclvm.exe'),[file],{encoding:'utf8',windowsHide:true,timeout,maxBuffer:16*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}}),ended=performance.now();
  if(p.error)throw p.error;let payload;try{payload=JSON.parse(p.stdout);}catch{throw new Error(p.stderr);}if(p.status!==0||payload.status!=='ok')throw new Error(JSON.stringify(payload));
  const result=verifyNativeSemanticStateRoot(payload,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});if(result.sourceRoot!==sourceRoot)throw fail('RCL_AI_SOURCE_ROOT_MISMATCH');
  return{result,trace:{processPid:p.pid,status:p.status,signal:p.signal,started,ended,stdoutHash:sha(p.stdout),stderrHash:sha(p.stderr)}};
}
export async function createPortableAiTarget(){
  const donor=fs.readFileSync(path.join(ROOT,DONOR),'utf8'),source=fs.readFileSync(path.join(ROOT,GATE),'utf8'),native=createPortableNativeTarget('windows'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-ai-runtime-'));
  const key=sha(donor)+':'+native.binding.compilerArtifact.sha256+':'+native.binding.binary.sha256;let training=modelCache.get(key);
  try{
    if(!training){const artifact=path.join(directory,'training.rbc'),compiled=native.compile(path.join(ROOT,DONOR),artifact);if(!compiled.bytecode.equals(compileRealityToBytecode(donor)))throw fail('RCL_AI_TRAINING_PARITY');
      const observed=runNative(artifact,compileReality(donor).programRoot,120000);if(observed.result.state['evaluation.xor_accuracy']!==1||observed.result.state['evaluation.majority_accuracy']!==1)throw fail('RCL_AI_TRAINING_NOT_CLOSED');
      training={sourcePath:DONOR,sourceHash:sha(donor),sourceRoot:observed.result.sourceRoot,artifactHash:sha(compiled.bytecode),compileMs:compiled.ms,processTrace:observed.trace,result:observed.result,
        model:observed.result.state['training.xor_final_model']};training.modelRoot=modelRoot(training.model);modelCache.set(key,training);
    }
    let compiled=gateCache.get(sha(source));if(!compiled){compiled=compileRealitySessionNative(source);gateCache.set(sha(source),compiled);}
    let controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode});const initial=controller.snapshot(),ledger=[];let busy=false,closed=false,disposePromise;
    async function invoke(command){const index=ledger.length,before=controller.snapshot();try{const result=await controller.invoke(command);ledger.push({index,command,before,result,after:controller.snapshot()});return result;}catch(error){ledger.push({index,command,before,error:{code:error.code,message:error.message},after:controller.snapshot()});throw error;}}
    await invoke({rule:'installModel',inputs:{'event.model_root':training.modelRoot}});
    function ready(){if(closed)throw fail('RCL_AI_CLOSED');if(busy)throw fail('RCL_AI_BACKPRESSURE');}
    async function infer(samples){
      validateSamples(samples);const text=buildNativeInferenceSource(donor,training.model,samples),file=path.join(directory,randomUUID()+'.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,text);
      const compiled=native.compile(file,artifact);if(!compiled.bytecode.equals(compileRealityToBytecode(text)))throw fail('RCL_AI_INFERENCE_PARITY');const observed=runNative(artifact,compileReality(text).programRoot);
      if(!observed.result.state['inference.model_valid'])throw fail('RCL_AI_MODEL_SHAPE');
      return{samples,modelRoot:training.modelRoot,sourceHash:sha(text),sourceRoot:observed.result.sourceRoot,artifactHash:sha(compiled.bytecode),compileMs:compiled.ms,processTrace:observed.trace,result:observed.result,advisoryOnly:true,authorityGranted:false};
    }
    const binding={...native.binding,context:'ai-runtime',execution:'Actual RCL-owned MLP training and native inference workflow with source-owned advisory-only result publication',
      modelOwner:'RCL_GENERAL_MLP',predictionAuthority:'ADVISORY_ONLY',externalEffectsClaimed:false,generalAiCompetenceClaimed:false,
      donor:{path:DONOR,sha256:sha(donor)},training:structuredClone(training),modelRoot:training.modelRoot,featurePolicy:'sorted recursive finite Number and Truth 0/1; Text omitted; alternating channels clamp to [0,1] and average; at most 256 values, magnitudes zero or 1e-12 through 1e24',
      controller:{sourcePath:GATE,sourceHash:sha(source),programRoot:compileReality(source).programRoot,bytecodeHash:sha(compiled.bytecode),compilerEvidence:compiled.evidence,
        daemonRoot:initial.native.daemonRoot,daemonSourceRoot:initial.native.sourceRoot,processId:initial.native.processId}};
    const target={environment:'ai-runtime',binding,
      async compile(file,out){ready();const c=native.compile(file,out);return{...c,aiCompileTrace:{owner:'RCL_COMPILER_RBC_WINDOWS_NATIVE',sourceHash:sha(fs.readFileSync(file)),artifactHash:sha(c.bytecode),compilerHash:native.binding.compilerBinary.sha256,compilerArtifactHash:native.binding.compilerArtifact.sha256}};},
      async execute(file,sourceRoot,options={}){ready();busy=true;const started=performance.now(),nonce=randomUUID(),ledgerStart=ledger.length,artifactHash=sha(fs.readFileSync(file));let program,entry,inference,admitted=false;
        try{program=runNative(file,sourceRoot);const samples=aiMeasurements(program.result.state),expectedModel=options.expectedModelRoot??training.modelRoot;entry=await invoke({rule:'prepare',inputs:{'event.source_root':sourceRoot,'event.model_root':expectedModel}});if(entry.status!=='realized')throw fail('RCL_AI_NOT_PREPARED');admitted=true;
          inference=await infer(samples);const completion=await invoke({rule:'publish',inputs:{'event.source_root':sourceRoot,'event.model_root':expectedModel,'event.inference_root':inference.result.stateRoot,'event.advisory':true,'event.requests_authority':options.requestsAuthority??false}});
          if(completion.status!=='realized')throw fail('RCL_AI_NOT_PUBLISHED');return{result:program.result,ms:performance.now()-started,aiTrace:{nonce,sourceRoot,artifactHash,programTrace:program.trace,entry,inference,completion,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}}};
        }catch(error){const settlement=admitted&&controller.snapshot().state['request.active']?await invoke({rule:'fail'}):undefined;error.aiFailure={nonce,sourceRoot,artifactHash,program:program?.result,programTrace:program?.trace,entry,inference,settlement,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}};throw error;}finally{busy=false;}},
      async infer(samples){ready();return infer(samples);},controllerLedger:()=>structuredClone(ledger),snapshotController:()=>controller.snapshot(),
      async controlCommand(command){ready();return invoke(command);},async pause(){ready();return invoke({rule:'pause'});},async resume(){ready();return invoke({rule:'resume'});},
      async reset(){ready();const before=controller.snapshot();await controller.close();controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode});const after=controller.snapshot();ledger.push({index:ledger.length,reset:true,before,after});await invoke({rule:'installModel',inputs:{'event.model_root':training.modelRoot}});return{before,after};},
      async verifyRuntimeControl(file,sourceRoot){
        const controlStart=ledger.length,first=await this.execute(file,sourceRoot);await this.pause();const paused=controller.snapshot();let pausedDenied;
        try{await this.execute(file,sourceRoot);}catch(error){if(error.code!=='RCL_AUTHORITY_DENIED')throw error;pausedDenied={code:error.code,...error.aiFailure};}const pausedRollback=controller.snapshot();await this.resume();
        const beforeWrong=controller.snapshot();let sourceRejected=false;try{await this.execute(file,'0'.repeat(64));}catch(error){if(error.code!=='RCL_AI_SOURCE_ROOT_MISMATCH')throw error;sourceRejected=true;}const sourceRollback=controller.snapshot();
        const beforeModel=controller.snapshot();let modelDenied;try{await this.execute(file,sourceRoot,{expectedModelRoot:'0'.repeat(64)});}catch(error){if(error.code!=='RCL_AUTHORITY_DENIED')throw error;modelDenied={code:error.code,...error.aiFailure};}const modelRollback=controller.snapshot();
        let replacementDenied=false;try{await invoke({rule:'installModel',inputs:{'event.model_root':'0'.repeat(64)}});}catch(error){if(error.code!=='RCL_AUTHORITY_DENIED')throw error;replacementDenied=true;}
        const beforeAuthority=controller.snapshot();let authorityDenied;try{await this.execute(file,sourceRoot,{requestsAuthority:true});}catch(error){if(error.code!=='RCL_AUTHORITY_DENIED')throw error;authorityDenied={code:error.code,...error.aiFailure};}
        if(!authorityDenied||authorityDenied.snapshot.state['result.authority_granted']||authorityDenied.snapshot.state['request.active']||authorityDenied.snapshot.state['request.completed']!==beforeAuthority.state['request.completed'])throw fail('RCL_AI_PREDICTOR_AUTHORITY_CONTROL');
        const directPositive=await infer([0,1]),directNegative=await infer([0,0]);let oversizedRejected=false,nonfiniteRejected=false;try{await infer(Array(257).fill(1));}catch(error){if(error.code!=='RCL_AI_MEASUREMENT_SIZE')throw error;oversizedRejected=true;}try{await infer([Infinity]);}catch(error){if(error.code!=='RCL_AI_MEASUREMENT_RANGE')throw error;nonfiniteRejected=true;}
        const reset=await this.reset(),second=await this.execute(file,sourceRoot);return{status:'PASS',sourceRejected,replacementDenied,oversizedRejected,nonfiniteRejected,firstTrace:first.aiTrace,secondTrace:second.aiTrace,
          paused,pausedDenied,pausedRollback,beforeWrong,sourceRollback,beforeModel,modelDenied,modelRollback,beforeAuthority,authorityDenied,directPositive,directNegative,reset,
          sourceRoot,artifactHash:sha(fs.readFileSync(file)),stateRoot:second.result.stateRoot,ledgerRange:{start:controlStart,end:ledger.length}};
      },
      async dispose(){disposePromise??=(async()=>{closed=true;while(busy)await new Promise(resolve=>setTimeout(resolve,1));await controller.close();native.dispose();if(path.dirname(directory)!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-ai-runtime-'))throw fail('RCL_AI_TEMP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});})();return disposePromise;},
    };return target;
  }catch(error){native.dispose();if(path.dirname(directory)===path.resolve(os.tmpdir())&&path.basename(directory).startsWith('rcl-ai-runtime-'))fs.rmSync(directory,{recursive:true,force:true});throw error;}
}
