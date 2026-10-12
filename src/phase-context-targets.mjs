import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {compileReality} from './compiler.mjs';
import {compileRealitySessionNative} from './session-compiler.mjs';
import {createNativeRealitySession} from './native-session.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),cache=new Map();
const sources={'simulation-runtime':'examples/runtime-hosts/simulation-clock.rcl','automation-runtime':'examples/runtime-hosts/automation-gate.rcl'};

/** Reuse RCL-owned persistent native sessions to own clock advancement and job admission. */
export async function createPhaseContextTarget(environment){
  const sourcePath=sources[environment];if(!sourcePath)throw new Error('RCL_PHASE_CONTEXT_UNKNOWN:'+environment);
  const source=fs.readFileSync(path.join(ROOT,sourcePath),'utf8'),sourceHash=sha(source),key=environment+':'+sourceHash;
  let compiled=cache.get(key);if(!compiled){compiled=compileRealitySessionNative(source);cache.set(key,compiled);}
  const controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode}),native=createPortableNativeTarget('windows');
  const initial=controller.snapshot(),programRoot=compileReality(source).programRoot;
  if(!initial.native.sourceBound||!initial.native.stateRootsIndependentlyVerified){await controller.close();throw new Error('RCL_PHASE_CONTROLLER_SOURCE_BINDING');}
  let executions=0,pending=Promise.resolve();
  async function advance(proposed,sourceRoot,mode='realize'){
    const result=await controller.invoke({rule:'advance',mode,inputs:{'event.time':proposed,'event.root':sourceRoot}});
    if(result.status!==(mode==='realize'?'realized':'projected'))throw new Error('RCL_SIMULATION_TIME_NOT_ADVANCED');return result;
  }
  async function executeOne(file,sourceRoot){
    if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw new Error('RCL_PHASE_EXPECTED_SOURCE_ROOT_REQUIRED');
    const started=performance.now();let entry,completion,proposedTime;
    if(environment==='simulation-runtime'){
      proposedTime=controller.snapshot().state['world.time']+1;entry=await advance(proposedTime,sourceRoot,'foresee');
    }
    else{
      entry=await controller.invoke({rule:'admit',inputs:{'event.root':sourceRoot}});
      if(entry.status!=='realized')throw new Error('RCL_AUTOMATION_BUSY_OR_NOT_ADMITTED');
    }
    let execution;
    try{
      execution=native.execute(file,sourceRoot);
      if(environment==='automation-runtime')completion=await controller.invoke({rule:'finish',inputs:{'event.success':true}});
      else{
        completion=await advance(proposedTime,sourceRoot);
        if(entry.transition.afterRoot!==completion.transition.afterRoot)throw new Error('RCL_SIMULATION_PROJECTED_FRAME_MISMATCH');
      }
    }catch(error){
      if(environment==='automation-runtime')await controller.invoke({rule:'finish',inputs:{'event.success':false}});
      throw error;
    }
    executions++;
    return{...execution,ms:performance.now()-started,controllerTrace:{processId:initial.native.processId,programRoot,
      entry,completion:completion??null,snapshot:controller.snapshot(),execution:executions}};
  }
  function execute(file,sourceRoot){
    const operation=pending.then(()=>executeOne(file,sourceRoot));pending=operation.catch(()=>{});return operation;
  }
  return{environment,binding:{...native.binding,context:environment,
    execution:environment==='simulation-runtime'?'Native RCL clock gates deterministic kernel frames':'Native RCL admission/completion sessions gate local kernel jobs',
    controller:{sourcePath,sourceHash,programRoot,bytecodeHash:sha(compiled.bytecode),compilerEvidence:compiled.evidence,
      daemonRoot:initial.native.daemonRoot,daemonSourceRoot:initial.native.sourceRoot,processId:initial.native.processId},
    physicalTimeOrWorldClaimed:false,externalToolEffectsClaimed:false},
    compile(sourceFile,output){return native.compile(sourceFile,output);},execute,
    snapshotController(){return controller.snapshot();},
    async verifyContextGuard(file,sourceRoot){
      let timeReversalRejected;
      if(environment==='simulation-runtime'){
        const before=controller.snapshot().stateRoot;
        try{await advance(controller.snapshot().state['world.time']-1,sourceRoot);timeReversalRejected=false;}catch(error){if(error.message!=='RCL_SIMULATION_TIME_NOT_ADVANCED')throw error;timeReversalRejected=true;}
        if(!timeReversalRejected||controller.snapshot().stateRoot!==before)throw new Error('RCL_SIMULATION_REVERSAL_CONTROL_FAILED');
      }
      await controller.invoke({rule:'pause'});const paused=controller.snapshot().stateRoot;let sourceAuthorityDenied=false;
      try{await execute(file,sourceRoot);}catch(error){if(error.code==='RCL_AUTHORITY_DENIED')sourceAuthorityDenied=true;else throw error;}
      if(!sourceAuthorityDenied||controller.snapshot().stateRoot!==paused)throw new Error('RCL_PHASE_DISABLED_DISPATCH_CONTROL_FAILED');
      await controller.invoke({rule:'resume'});const resumed=await execute(file,sourceRoot);
      return{status:'PASS',sourceAuthorityDenied,pausedStateRoot:paused,timeReversalRejected:timeReversalRejected??null,
        stateRoot:resumed.result.stateRoot,sourceRoot:resumed.result.sourceRoot,controllerTrace:resumed.controllerTrace};
    },async dispose(){await pending;await controller.close();native.dispose();},
  };
}
