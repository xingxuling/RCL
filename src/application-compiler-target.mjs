import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createPortableAiTarget} from './portable-ai-target.mjs';
import {createPortableScientificTarget} from './portable-scientific-target.mjs';
import {createResidentSequenceCompiler} from './resident-sequence-compiler.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),failure=code=>Object.assign(new Error(code),{code});
function captureInputs(bytes){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-application-compiler-'));if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-application-compiler-'))throw failure('RCLC_APPLICATION_TEMP_SCOPE');const paths=bytes.map((_v,i)=>path.join(directory,'input-'+i)),close=()=>fs.rmSync(directory,{recursive:true,force:true});try{bytes.forEach((v,i)=>fs.writeFileSync(paths[i],v));}catch(error){close();throw error;}return{paths,close};}
export const COMPILER_METRIC_FEATURES='artifact bytes / (1 + artifact bytes); executed instructions / instruction budget';

/** Supplied complete compiler in the existing native science or advisory-model workflow. */
export async function createApplicationCompilerTarget(environment){
  if(!['ai-runtime','scientific-runtime'].includes(environment))throw failure('RCLC_APPLICATION_ENVIRONMENT');const ai=environment==='ai-runtime',workflow=await(ai?createPortableAiTarget():createPortableScientificTarget());let compiler;try{compiler=await createResidentSequenceCompiler();}catch(error){await workflow.dispose();throw error;}
  const binding={owner:'RCL_COMPLETE_COMPILER_APPLICATION',environment,compiler:compiler.binding,workflow:workflow.binding,compileRootKind:'SHA256_SOURCE_BYTES',executeRootKind:'RCL_PROGRAM_ROOT',compilerMetricFeatures:COMPILER_METRIC_FEATURES,referenceCompilationUsed:false,referenceExecutionUsed:false,securitySandboxClaimed:false,externalEffectsClaimed:false,generalAiOrHpcClaimed:false};
  let closed=false,busy=false,active,disposed;const activeKey=ai?'request.active':'experiment.active';
  function ready(){if(closed)throw failure('RCLC_APPLICATION_CLOSED');if(busy)throw failure('RCLC_APPLICATION_BACKPRESSURE');}
  function operate(run){ready();busy=true;active=(async()=>{try{return await run();}finally{busy=false;}})();return active;}
  const target={environment,binding,
    async compile(compilerFile,sourceFile,outputFile,options={}){ready();const sourceBytes=fs.readFileSync(sourceFile),compilerBytes=fs.readFileSync(compilerFile);if(!Buffer.from(sourceBytes.toString('utf8')).equals(sourceBytes))throw failure('RCLC_APPLICATION_SOURCE_UTF8');const inputRoot=sha(sourceBytes),inputCompilerHash=sha(compilerBytes),frozen=captureInputs([compilerBytes,sourceBytes]);
      try{return await operate(async()=>{const started=performance.now(),start=workflow.controllerLedger().length,before=workflow.snapshotController(),modelRoot=options.expectedModelRoot??workflow.binding.modelRoot;let entry,completion,observation,compiled,nativeCalled=false;
        try{entry=await workflow.controlCommand({rule:'prepare',inputs:ai?{'event.source_root':inputRoot,'event.model_root':modelRoot}:{'event.source_root':inputRoot,'event.sample_count':2}});if(entry.status!=='realized')throw failure('RCLC_APPLICATION_NOT_PREPARED');nativeCalled=true;
          compiled=await compiler.compile(...frozen.paths);if(compiled.compilerTrace.compilerHash!==inputCompilerHash||compiled.compilerTrace.sourceHash!==inputRoot)throw failure('RCLC_APPLICATION_COMPILER_BINDING');
          const features=[compiled.bytecode.length/(1+compiled.bytecode.length),compiled.compilerTrace.metrics.executedInstructions/compiled.compilerTrace.metrics.instructionBudget];observation=ai?await workflow.infer(features):await workflow.analyse(features,{source:options.analysisSource});
          completion=await workflow.controlCommand({rule:'publish',inputs:ai?{'event.source_root':inputRoot,'event.model_root':modelRoot,'event.inference_root':observation.result.stateRoot,'event.advisory':true,'event.requests_authority':options.requestsAuthority??false}:{'event.source_root':inputRoot,'event.analysis_root':observation.result.stateRoot,'event.sample_count':2,'event.error':observation.maxError}});if(completion.status!=='realized')throw failure('RCLC_APPLICATION_NOT_PUBLISHED');
          if(outputFile)fs.writeFileSync(outputFile,compiled.bytecode);return{...compiled,ms:performance.now()-started,workflowTrace:{kind:'compile',inputRoot,inputCompilerHash,sourceBytes:sourceBytes.length,nativeCalled,before,entry,features,observation,completion,snapshot:workflow.snapshotController(),ledgerRange:{start,end:workflow.controllerLedger().length}}};
        }catch(error){const settlement=workflow.snapshotController().state[activeKey]?await workflow.controlCommand({rule:'fail'}):null;error.compilerTrace??=compiled?.compilerTrace;error.workflowFailure={kind:'compile',inputRoot,inputCompilerHash,nativeCalled,before,entry:entry??null,observation:observation??null,completion:completion??null,settlement,snapshot:workflow.snapshotController(),ledgerRange:{start,end:workflow.controllerLedger().length}};throw error;}
      });}finally{frozen.close();}
    },
    async execute(file,sourceRoot,options={}){ready();if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw failure('RCLC_APPLICATION_SOURCE_ROOT_REQUIRED');const bytes=fs.readFileSync(file),frozen=captureInputs([bytes]);try{return await operate(async()=>{const started=performance.now(),start=workflow.controllerLedger().length,before=workflow.snapshotController();let preflight,nativeCalled=false;try{
      preflight=await workflow.controlCommand({rule:'prepare',mode:'foresee',inputs:ai?{'event.source_root':sourceRoot,'event.model_root':options.expectedModelRoot??workflow.binding.modelRoot}:{'event.source_root':sourceRoot,'event.sample_count':1}});if(preflight.status!=='projected')throw failure('RCLC_APPLICATION_EXECUTION_NOT_ADMITTED');nativeCalled=true;const result=await workflow.execute(frozen.paths[0],sourceRoot,options);return{...result,ms:performance.now()-started,applicationTrace:{kind:'execute',sourceRoot,artifactHash:sha(bytes),nativeCalled,before,preflight,snapshot:workflow.snapshotController(),ledgerRange:{start,end:workflow.controllerLedger().length}}};
    }catch(error){error.applicationFailure={kind:'execute',sourceRoot,artifactHash:sha(bytes),nativeCalled,before,preflight:preflight??null,snapshot:workflow.snapshotController(),ledgerRange:{start,end:workflow.controllerLedger().length}};throw error;}});}finally{frozen.close();}},
    controllerLedger:()=>workflow.controllerLedger(),snapshotController:()=>workflow.snapshotController(),observerRecords:()=>ai?[]:workflow.observerRecords(),
    async pause(){ready();return workflow.pause();},async resume(){ready();return workflow.resume();},
    async dispose(){if(disposed)return disposed;closed=true;disposed=(async()=>{if(active)await active.catch(()=>{});let compilerExit,observerExit;try{compilerExit=await compiler.dispose();}finally{observerExit=await workflow.dispose();}let absent=false;try{process.kill(binding.workflow.controller.processId,0);}catch(error){if(error.code==='ESRCH')absent=true;else throw error;}if(!absent)throw failure('RCLC_APPLICATION_CONTROLLER_TERMINATION');return{compiler:compilerExit,controller:{pid:binding.workflow.controller.processId,terminationObserved:true,exitCode:'UNAVAILABLE_FROM_REUSED_SESSION_API'},observer:observerExit??null};})();return disposed;},
  };return target;
}
