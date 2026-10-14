import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {compileReality} from './compiler.mjs';
import {compileRealitySessionNative} from './session-compiler.mjs';
import {createNativeRealitySession} from './native-session.mjs';
import {createCompilerDataflowTarget} from './compiler-dataflow-target.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex'),cache=new Map();
const SOURCES={'automation-runtime':'examples/runtime-hosts/automation-gate.rcl','simulation-runtime':'examples/runtime-hosts/simulation-clock.rcl'};
const failure=code=>Object.assign(new Error(code),{code});
function snapshotFiles(files){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-phase-inputs-')),paths=files.map((bytes,i)=>path.join(directory,'input-'+i));try{for(const [i,bytes]of files.entries())fs.writeFileSync(paths[i],bytes);}catch(error){fs.rmSync(directory,{recursive:true,force:true});throw error;}return{paths,cleanup(){if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-phase-inputs-'))throw failure('RCLC_PHASE_TEMP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}};}

/** RCL-owned admission/clock controls both supplied-artifact compilation and execution. */
export async function createPhaseCompilerTarget(environment){
  const sourcePath=SOURCES[environment];if(!sourcePath)throw failure('RCLC_PHASE_ENVIRONMENT');
  const source=fs.readFileSync(path.join(ROOT,sourcePath),'utf8'),sourceHash=sha(source);let compiled=cache.get(sourceHash);
  if(!compiled){compiled=compileRealitySessionNative(source);cache.set(sourceHash,compiled);}
  const controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode}),initial=controller.snapshot();let graph;
  try{if(!initial.native.sourceBound||!initial.native.stateRootsIndependentlyVerified)throw failure('RCLC_PHASE_CONTROLLER_UNBOUND');graph=await createCompilerDataflowTarget();}catch(error){await controller.close();throw error;}
  const ledger=[];let busy=false,closed=false,active,disposed,operations=0;
  const controllerBinding={sourcePath,sourceHash,programRoot:compileReality(source).programRoot,bytecodeHash:sha(compiled.bytecode),compilerEvidence:compiled.evidence,
    daemonRoot:initial.native.daemonRoot,daemonSourceRoot:initial.native.sourceRoot,processId:initial.native.processId};
  const binding={owner:'RCL_COMPLETE_COMPILER_PHASE',environment,controller:controllerBinding,graph:graph.binding,
    compileRootKind:'SHA256_SOURCE_BYTES',executeRootKind:'RCL_PROGRAM_ROOT',referenceCompilationUsed:false,referenceExecutionUsed:false,physicalTimeOrWorldClaimed:false,externalToolEffectsClaimed:false,securitySandboxClaimed:false};
  async function invoke(command){const index=ledger.length,before=controller.snapshot();try{const result=await controller.invoke(command);ledger.push({index,command,before,result,after:controller.snapshot()});return result;}catch(error){ledger.push({index,command,before,error:{code:error.code,message:error.message},after:controller.snapshot()});throw error;}}
  async function operation(kind,root,run){
    if(closed)throw failure('RCLC_PHASE_CLOSED');if(busy)throw failure('RCLC_PHASE_BACKPRESSURE');if(!/^[0-9a-f]{64}$/u.test(root??''))throw failure('RCLC_PHASE_ROOT_REQUIRED');busy=true;
    active=(async()=>{
      const started=performance.now(),ledgerStart=ledger.length,before=controller.snapshot();let entry,completion,nativeCalled=false;
      const proposedTime=environment==='simulation-runtime'?before.state['world.time']+1:null;
      try{
        entry=await invoke(environment==='simulation-runtime'?{rule:'advance',mode:'foresee',inputs:{'event.time':proposedTime,'event.root':root}}:{rule:'admit',inputs:{'event.root':root}});
        if(entry.status!==(environment==='simulation-runtime'?'projected':'realized'))throw failure('RCLC_PHASE_NOT_ADMITTED');
        nativeCalled=true;const result=await run();
        completion=await invoke(environment==='simulation-runtime'?{rule:'advance',inputs:{'event.time':proposedTime,'event.root':root}}:{rule:'finish',inputs:{'event.success':true}});
        if(completion.status!=='realized')throw failure('RCLC_PHASE_COMPLETION_NOT_ADMITTED');
        if(environment==='simulation-runtime'&&entry.transition.afterRoot!==completion.transition.afterRoot)throw failure('RCLC_PHASE_PROJECTION_MISMATCH');
        operations++;return{...result,ms:performance.now()-started,phaseTrace:{kind,root,nativeCalled,before,entry,completion,snapshot:controller.snapshot(),operation:operations,ledgerRange:{start:ledgerStart,end:ledger.length}}};
      }catch(error){
        let settlement=null;if(environment==='automation-runtime'&&controller.snapshot().state['pipeline.active'])settlement=await invoke({rule:'finish',inputs:{'event.success':false}});
        error.phaseTrace={kind,root,nativeCalled,before,entry:entry??null,completion:completion??null,settlement,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}};throw error;
      }finally{busy=false;}
    })();return active;
  }
  return{environment,binding,
    async compile(compilerFile,sourceFile,outputFile){const sourceBytes=fs.readFileSync(sourceFile),compilerBytes=fs.readFileSync(compilerFile);if(!Buffer.from(sourceBytes.toString('utf8')).equals(sourceBytes))throw failure('RCLC_PHASE_SOURCE_UTF8');const frozen=snapshotFiles([compilerBytes,sourceBytes]);try{const result=await operation('compile',sha(sourceBytes),()=>graph.compile(...frozen.paths));if(outputFile)fs.writeFileSync(outputFile,result.bytecode);return result;}finally{frozen.cleanup();}},
    async execute(file,sourceRoot){const frozen=snapshotFiles([fs.readFileSync(file)]);try{return await operation('execute',sourceRoot,()=>graph.execute(frozen.paths[0],sourceRoot));}finally{frozen.cleanup();}},
    controllerLedger:()=>structuredClone(ledger),snapshotController:()=>controller.snapshot(),
    async pause(){if(busy)throw failure('RCLC_PHASE_BACKPRESSURE');return invoke({rule:'pause'});},
    async resume(){if(busy)throw failure('RCLC_PHASE_BACKPRESSURE');return invoke({rule:'resume'});},
    async verifyTimeReversal(root){if(environment!=='simulation-runtime')return null;if(busy)throw failure('RCLC_PHASE_BACKPRESSURE');const before=controller.snapshot(),result=await invoke({rule:'advance',inputs:{'event.time':before.state['world.time']-1,'event.root':root}}),after=controller.snapshot();if(result.status!=='not-triggered'||before.stateRoot!==after.stateRoot)throw failure('RCLC_PHASE_TIME_REVERSAL');return{before,result,after,index:ledger.length-1};},
    async dispose(){if(disposed)return disposed;closed=true;disposed=(async()=>{if(active)await active.catch(()=>{});let ended;try{ended=await graph.dispose();}finally{await controller.close();}let absent=false;try{process.kill(controllerBinding.processId,0);}catch(error){if(error.code==='ESRCH')absent=true;else throw error;}if(!absent)throw failure('RCLC_PHASE_CONTROLLER_TERMINATION');return{graph:ended,controller:{pid:controllerBinding.processId,terminationObserved:true,exitCode:'UNAVAILABLE_FROM_REUSED_SESSION_API'}};})();return disposed;},
  };
}
