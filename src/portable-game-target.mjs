import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {spawnSync} from 'node:child_process';
import {compileReality} from './compiler.mjs';
import {compileRealitySessionNative} from './session-compiler.mjs';
import {createNativeRealitySession} from './native-session.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {renderRcl2DGameFrame,normalizeRcl2DGameSpec} from './game-2d-compiler.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),SOURCE='examples/runtime-hosts/game-frame.rcl';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),cache=new Map();
const failure=code=>Object.assign(new Error(JSON.stringify({code})),{code});
export const GAME_FRAME_INPUTS=Object.freeze([{horizontal:1,jump:true},{horizontal:-1,jump:false},{horizontal:0,jump:false}]);

// Explicit host binding of verified output into a bounded procedural scene signal.
// This transport projection does not claim domain understanding or authority.
export function projectGameMetric(state){
  function project(value){
    if(typeof value==='number'){if(!Number.isFinite(value))throw failure('RCL_GAME_NONFINITE_OUTPUT');const remainder=value%17;return remainder<0?remainder+17:remainder;}
    if(typeof value==='boolean')return value?1:0;
    if(typeof value==='string')return value.length%17;
    if(Array.isArray(value))return value.reduce((sum,item)=>(sum+project(item))%17,0);
    if(value&&typeof value==='object')return Object.keys(value).sort().reduce((sum,key)=>(sum+project(value[key]))%17,0);
    throw failure('RCL_GAME_OUTPUT_TYPE');
  }
  return project(state);
}
export function projectGameFrame(state){
  const spec=normalizeRcl2DGameSpec(JSON.parse(fs.readFileSync(path.join(ROOT,'examples/k04-2d-game.game.json'),'utf8')));
  // The legacy renderer is reused strictly as a projection of native RCL state.
  spec.entities=[];return renderRcl2DGameFrame({game:spec},state);
}

/** Native RCL program hooks in an RCL-owned fixed-step game scene. */
export async function createPortableGameTarget(){
  const source=fs.readFileSync(path.join(ROOT,SOURCE),'utf8'),sourceHash=sha(source);
  let compiled=cache.get(sourceHash);if(!compiled){compiled=compileRealitySessionNative(source);cache.set(sourceHash,compiled);}
  let controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode});
  const native=createPortableNativeTarget('windows'),initial=controller.snapshot(),ledger=[];
  let busy=false,closed=false;
  if(!initial.native.sourceBound){await controller.close();native.dispose();throw failure('RCL_GAME_CONTROLLER_UNBOUND');}
  async function invoke(command){
    const index=ledger.length,before=controller.snapshot();
    try{const result=await controller.invoke(command);ledger.push({index,command,before,result,after:controller.snapshot()});return result;}
    catch(caught){ledger.push({index,command,before,error:{code:caught.code,message:caught.message},after:controller.snapshot()});throw caught;}
  }
  function ready(){if(closed)throw failure('RCL_GAME_CLOSED');if(busy)throw failure('RCL_GAME_BACKPRESSURE');}
  function executeHook(file,sourceRoot){
    const started=performance.now(),processResult=spawnSync(path.join(ROOT,'native/rclvm.exe'),[file],{encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:16*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}}),ended=performance.now();
    if(processResult.error)throw processResult.error;
    let payload;try{payload=JSON.parse(processResult.stdout);}catch{throw new Error(processResult.stderr);}
    if(processResult.status!==0||payload.status!=='ok')throw new Error(JSON.stringify(payload));
    const result=verifyNativeSemanticStateRoot(payload,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
    if(result.sourceRoot!==sourceRoot)throw failure('RCL_GAME_SOURCE_ROOT_MISMATCH');
    return{result,ms:ended-started,trace:{processPid:processResult.pid,status:processResult.status,signal:processResult.signal,started,ended,stdoutHash:sha(processResult.stdout),stderrHash:sha(processResult.stderr)}};
  }
  const binding={...native.binding,context:'game-runtime',execution:'Actual native RCL hook per fixed step, native RCL input/physics/collision commits and state-bound scene projection',
    stepMode:'deterministic-fixed-step',frameInputs:GAME_FRAME_INPUTS,physicalTimingClaimed:false,browserExecutionClaimed:false,externalEffectsClaimed:false,
    metricBinding:'recursive finite Number modulo 17, Truth 0/1 and Text length modulo 17, summed modulo 17 in sorted state order; host transport only',
    renderer:{sourcePath:'src/game-2d-compiler.mjs',sourceHash:sha(fs.readFileSync(path.join(ROOT,'src/game-2d-compiler.mjs'))),specPath:'examples/k04-2d-game.game.json',specHash:sha(fs.readFileSync(path.join(ROOT,'examples/k04-2d-game.game.json')))},
    controller:{sourcePath:SOURCE,sourceHash,programRoot:compileReality(source).programRoot,bytecodeHash:sha(compiled.bytecode),compilerEvidence:compiled.evidence,
      daemonRoot:initial.native.daemonRoot,daemonSourceRoot:initial.native.sourceRoot,processId:initial.native.processId}};
  const target={environment:'game-runtime',binding,
    async compile(file,out){ready();const compilation=native.compile(file,out);return{...compilation,gameCompileTrace:{owner:'RCL_COMPILER_RBC_WINDOWS_NATIVE',sourceHash:sha(fs.readFileSync(file)),artifactHash:sha(compilation.bytecode),compilerHash:native.binding.compilerBinary.sha256,compilerArtifactHash:native.binding.compilerArtifact.sha256}};},
    async execute(file,sourceRoot){
      ready();if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw failure('RCL_GAME_SOURCE_ROOT_REQUIRED');
      const started=performance.now(),artifactHash=sha(fs.readFileSync(file)),ledgerStart=ledger.length,nonce=randomUUID(),frames=[];
      busy=true;
      try{
        if(!controller.snapshot().state['game.enabled'])throw failure('RCL_GAME_PAUSED');
        let result;
        // A failed hook cannot load or mutate a scene. Its native root is checked first.
        const first=executeHook(file,sourceRoot);
        if(first.result.sourceRoot!==sourceRoot)throw failure('RCL_GAME_SOURCE_ROOT_MISMATCH');
        const load=await invoke({rule:'loadPlugin',inputs:{'event.source_root':sourceRoot}});if(load.status!=='realized')throw failure('RCL_GAME_PLUGIN_NOT_LOADED');
        for(const[index,input]of GAME_FRAME_INPUTS.entries()){
          if(sha(fs.readFileSync(file))!==artifactHash)throw failure('RCL_GAME_ARTIFACT_DRIFT');
          const hook=index===0?first:executeHook(file,sourceRoot);result=hook.result;
          if(result.sourceRoot!==sourceRoot)throw failure('RCL_GAME_SOURCE_ROOT_MISMATCH');
          const metric=projectGameMetric(result.state),before=controller.snapshot();
          const command={rule:'advanceFrame',inputs:{'event.source_root':sourceRoot,'event.result_root':result.stateRoot,'event.metric':metric,'event.frame':index+1,'event.horizontal':input.horizontal,'event.jump':input.jump}};
          const commit=await invoke(command);if(commit.status!=='realized')throw failure('RCL_GAME_FRAME_NOT_ADMITTED');
          const snapshot=controller.snapshot(),scene=projectGameFrame(snapshot.state);
          frames.push({index,hookMs:hook.ms,hookTrace:hook.trace,hookSourceRoot:result.sourceRoot,hookStateRoot:result.stateRoot,metric,before,commit,snapshot,scene,sceneHash:sha(JSON.stringify(scene))});
        }
        return{result,ms:performance.now()-started,gameTrace:{nonce,sourceRoot,artifactHash,load,frames,snapshot:controller.snapshot(),ledgerRange:{start:ledgerStart,end:ledger.length}}};
      }finally{busy=false;}
    },
    async pause(){ready();return invoke({rule:'pause'});},async resume(){ready();return invoke({rule:'resume'});},
    controllerLedger(){return structuredClone(ledger);},snapshotController(){return controller.snapshot();},
    async controlCommand(command){ready();return invoke(command);},
    async verifyRuntimeControl(file,sourceRoot){
      const controlStart=ledger.length,first=await this.execute(file,sourceRoot),beforePaused=controller.snapshot();await this.pause();
      let pausedRejected=false;try{await this.execute(file,sourceRoot);}catch(caught){if(caught.code!=='RCL_GAME_PAUSED')throw caught;pausedRejected=true;}
      const paused=controller.snapshot(),last=first.gameTrace.frames.at(-1),inputs={'event.source_root':sourceRoot,'event.result_root':first.result.stateRoot,'event.metric':last.metric,'event.frame':4,'event.horizontal':0,'event.jump':false};
      let authorityDenied=false;try{await invoke({rule:'advanceFrame',inputs});}catch(caught){if(caught.code!=='RCL_AUTHORITY_DENIED')throw caught;authorityDenied=true;}
      const pausedRollback=controller.snapshot();await this.resume();
      const beforeWrong=controller.snapshot();let sourceRejected=false;try{await this.execute(file,'0'.repeat(64));}catch(caught){if(caught.code!=='RCL_GAME_SOURCE_ROOT_MISMATCH')throw caught;sourceRejected=true;}
      const sourceRollback=controller.snapshot();let foreignDenied=false;try{await invoke({rule:'advanceFrame',inputs:{...inputs,'event.source_root':'0'.repeat(64)}});}catch(caught){if(caught.code!=='RCL_AUTHORITY_DENIED')throw caught;foreignDenied=true;}
      const foreignRollback=controller.snapshot(),beforeInvalid=controller.snapshot(),invalid=await invoke({rule:'advanceFrame',inputs:{...inputs,'event.metric':17}}),afterInvalid=controller.snapshot();
      const beforeDuplicate=controller.snapshot(),duplicate=await invoke({rule:'advanceFrame',inputs:{...inputs,'event.frame':3}}),afterDuplicate=controller.snapshot();
      const landing=[];for(let index=4;index<=12;index++)landing.push({index,result:await invoke({rule:'advanceFrame',inputs:{...inputs,'event.frame':index}}),snapshot:controller.snapshot()});
      const landed=controller.snapshot();if(!landed.state['player.grounded']||landed.state['player.y']!==136||landed.state['player.vy']!==0||landed.state['game.ground_collisions']<1)throw failure('RCL_GAME_LANDING_CONTROL');
      const reset=await this.reset(),second=await this.execute(file,sourceRoot);
      return{status:'PASS',pausedRejected,authorityDenied,sourceRejected,foreignDenied,beforePaused,paused,pausedRollback,beforeWrong,sourceRollback,foreignRollback,beforeInvalid,invalid,afterInvalid,beforeDuplicate,duplicate,afterDuplicate,
        firstTrace:first.gameTrace,landing,landed,reset,secondTrace:second.gameTrace,sourceRoot,artifactHash:sha(fs.readFileSync(file)),stateRoot:second.result.stateRoot,ledgerRange:{start:controlStart,end:ledger.length}};
    },
    async reset(){ready();const before=controller.snapshot();await controller.close();controller=await createNativeRealitySession(source,{bytecode:compiled.bytecode});const after=controller.snapshot();ledger.push({index:ledger.length,reset:true,before,after});return{before,after};},
    async dispose(){closed=true;while(busy)await new Promise(resolve=>setTimeout(resolve,1));await controller.close();native.dispose();},
  };
  return target;
}
