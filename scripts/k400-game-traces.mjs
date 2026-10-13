import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {FROZEN_GAME_INPUTS} from './k400-game-definitions.mjs';
import {createRealitySession} from '../src/runtime.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealitySessionBytecode} from '../src/bytecode.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {renderRcl2DGameFrame,normalizeRcl2DGameSpec} from '../src/game-2d-compiler.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),root=value=>semanticStateRootForAlgorithm(value,'rcl.semantic-state-root.v2');

// Separate transport and fixed-step oracles; these do not call the runtime target.
export function gameMetricOracle(state){
  function scalar(value){
    if(typeof value==='number'){assert.ok(Number.isFinite(value));const remainder=value%17;return remainder<0?remainder+17:remainder;}
    if(typeof value==='boolean')return Number(value);
    if(typeof value==='string')return value.length%17;
    const children=Array.isArray(value)?value:Object.keys(value).sort().map(key=>value[key]);
    let total=0;for(const child of children)total=(total+scalar(child))%17;return total;
  }
  return scalar(state);
}
export function gamePhysicsOracle(state,input,metric){
  const velocity=input.jump&&state['player.grounded']?-8:Math.min(12,state['player.vy']+2);
  const y=Math.min(136,state['player.y']+velocity),grounded=y>=136;
  return{'player.x':Math.max(0,Math.min(302,state['player.x']+input.horizontal*4+1+metric%3)),
    'player.y':y,'player.vx':input.horizontal*4+1+metric%3,'player.vy':grounded?0:velocity,'player.grounded':grounded,
    'game.frame':state['game.frame']+1,'game.score':state['game.score']+metric,'game.ground_collisions':state['game.ground_collisions']+Number(grounded)};
}
export function verifyGameBinding(binding,contract){
  assert.equal(binding.context,'game-runtime');assert.equal(binding.os,'win32');assert.equal(binding.stepMode,'deterministic-fixed-step');
  assert.deepEqual(binding.frameInputs,FROZEN_GAME_INPUTS);assert.deepEqual(contract.frameInputs,FROZEN_GAME_INPUTS);
  for(const field of ['physicalTimingClaimed','browserExecutionClaimed','externalEffectsClaimed'])assert.equal(binding[field],false);
  assert.equal(binding.binary.path,'native/rclvm.exe');assert.deepEqual(binding.compilerBinary,contract.compilerBinary);
  assert.equal(binding.compilerArtifact.path,contract.compilerPath);assert.equal(binding.compilerArtifact.sha256,contract.compilerHash);
  for(const item of [binding.binary,binding.compilerBinary,binding.compilerArtifact])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  const c=binding.controller,source=fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8');
  assert.equal(c.sourcePath,contract.controllerSource.path);assert.equal(c.sourceHash,contract.controllerSource.sha256);assert.equal(c.sourceHash,sha(source));
  assert.equal(c.programRoot,compileReality(source).programRoot);assert.equal(c.bytecodeHash,sha(compileRealitySessionBytecode(source)));
  const compilerSource=['compiler-core.rcl','session-compiler-core.rcl','session-compiler-main.rcl'].map(file=>fs.readFileSync(path.join(ROOT,'selfhost',file),'utf8')).join('\n');
  assert.equal(c.compilerEvidence.compilerOwner,'RCL');assert.equal(c.compilerEvidence.compilerSourceHash,sha(compilerSource));assert.equal(c.compilerEvidence.sourceHash,sha(source));
  assert.equal(c.compilerEvidence.bytecodeRoot,c.bytecodeHash);assert.equal(c.compilerEvidence.targetByteParity,true);assert.equal(c.compilerEvidence.referenceExecutionFallback,false);
  assert.equal(c.daemonRoot,sha(fs.readFileSync(path.join(ROOT,'native/rclvmd.exe'))));
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'native/native-windows-manifest.json'),'utf8')),hash=createHash('sha256');
  for(const file of manifest.sources){hash.update(file);hash.update('\0');hash.update(fs.readFileSync(path.join(ROOT,file)));hash.update('\0');}
  assert.equal(hash.digest('hex'),manifest.sourceSha256);assert.equal(c.daemonSourceRoot,manifest.sourceSha256);
  for(const field of ['source','spec'])assert.equal(binding.renderer[field+'Hash'],sha(fs.readFileSync(path.join(ROOT,binding.renderer[field+'Path']))));
  assert.equal(binding.renderer.sourcePath,'src/game-2d-compiler.mjs');assert.equal(binding.renderer.specPath,'examples/k04-2d-game.game.json');
}
function scene(state){
  const game=normalizeRcl2DGameSpec(JSON.parse(fs.readFileSync(path.join(ROOT,'examples/k04-2d-game.game.json'),'utf8')));game.entities=[];
  return renderRcl2DGameFrame({game},state);
}
function checkTrace(trace,value){
  assert.match(trace.nonce,/^[0-9a-f-]{36}$/u);assert.equal(trace.frames.length,3);assert.equal(trace.load.status,'realized');
  assert.equal(trace.load.transition.rule,'loadPlugin');assert.equal(trace.ledgerRange.end-trace.ledgerRange.start,4);
  for(const[index,frame]of trace.frames.entries()){
    assert.equal(frame.index,index);assert.equal(frame.hookStateRoot,value.stateRoot);assert.equal(frame.hookSourceRoot,trace.sourceRoot);
    const process=frame.hookTrace;assert.ok(Number.isInteger(process.processPid)&&process.processPid>0);assert.equal(process.status,0);assert.equal(process.signal,null);
    assert.ok(Number.isFinite(process.started)&&Number.isFinite(process.ended)&&process.ended>=process.started);assert.equal(frame.hookMs,process.ended-process.started);
    for(const field of ['stdoutHash','stderrHash'])assert.match(process[field],/^[0-9a-f]{64}$/u);
    assert.equal(frame.metric,gameMetricOracle(value.state));assert.equal(frame.commit.status,'realized');assert.equal(frame.commit.transition.rule,'advanceFrame');assert.equal(frame.commit.transition.actor,'engine');
    assert.deepEqual(frame.commit.transition.authority.needs,[{capability:'frame.advance',target:'game'}]);
    const state=frame.snapshot.state;assert.equal(frame.snapshot.stateRoot,root(state));assert.equal(state['plugin.source_root'],trace.sourceRoot);assert.equal(state['plugin.result_root'],value.stateRoot);
    for(const[key,expected]of Object.entries(gamePhysicsOracle(frame.before.state,FROZEN_GAME_INPUTS[index],frame.metric)))assert.deepEqual(state[key],expected);
    assert.deepEqual(frame.scene,scene(state));assert.equal(frame.sceneHash,sha(JSON.stringify(frame.scene)));
    if(index)assert.deepEqual(frame.before,trace.frames[index-1].snapshot);
  }
  assert.deepEqual(trace.snapshot,trace.frames.at(-1).snapshot);assert.equal(trace.snapshot.state['game.frame'],3);
}
export function verifyGameRow(row,binding,value){
  const c=row.compileTrace,t=row.runtimeTrace;assert.ok(c&&t);assert.equal(c.owner,'RCL_COMPILER_RBC_WINDOWS_NATIVE');
  assert.equal(c.sourceHash,row.sourceHash);assert.equal(c.artifactHash,row.artifactHash);assert.equal(c.compilerHash,binding.compilerBinary.sha256);assert.equal(c.compilerArtifactHash,binding.compilerArtifact.sha256);
  assert.equal(t.sourceRoot,row.sourceRoot);assert.equal(t.artifactHash,row.artifactHash);assert.equal(value.stateRoot,row.stateRoot??value.stateRoot);checkTrace(t,value);
}
export async function verifyGameControl(backend,contract,values){
  const b=backend.binding,source=fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8'),ledger=backend.controllerLedger;
  let reference=createRealitySession(source),pid=b.controller.processId;
  function snapshot(observed){assert.equal(observed.programRoot,b.controller.programRoot);assert.deepEqual(observed.state,reference.snapshot().state);assert.equal(observed.stateRoot,reference.snapshot().stateRoot);
    assert.equal(observed.native.processId,pid);assert.equal(observed.native.daemonRoot,b.controller.daemonRoot);assert.equal(observed.native.sourceRoot,b.controller.daemonSourceRoot);
    assert.equal(observed.native.sourceBound,true);assert.equal(observed.native.stateRootsIndependentlyVerified,true);}
  for(const[index,item]of ledger.entries()){
    assert.equal(item.index,index);snapshot(item.before);
    if(item.reset){assert.notEqual(item.after.native.processId,pid);assert.ok(Number.isInteger(item.after.native.processId)&&item.after.native.processId>0);pid=item.after.native.processId;reference=createRealitySession(source);snapshot(item.after);continue;}
    let expected,failure;try{expected=await reference.invoke(item.command);}catch(caught){failure=caught;}
    if(failure){assert.equal(item.error?.code,failure.code);assert.equal(item.result,undefined);}else{assert.equal(item.error,undefined);assert.deepEqual(item.result,expected);}snapshot(item.after);
  }
  function bound(trace,value){
    checkTrace(trace,value);const load=ledger[trace.ledgerRange.start];assert.equal(load.command.rule,'loadPlugin');assert.deepEqual(load.result,trace.load);assert.equal(load.command.inputs['event.source_root'],trace.sourceRoot);
    for(const[index,frame]of trace.frames.entries()){
      const item=ledger[trace.ledgerRange.start+index+1];assert.deepEqual(frame.before,item.before);assert.deepEqual(frame.commit,item.result);assert.deepEqual(frame.snapshot,item.after);
      assert.deepEqual(item.command,{rule:'advanceFrame',inputs:{'event.source_root':trace.sourceRoot,'event.result_root':value.stateRoot,'event.metric':frame.metric,'event.frame':index+1,'event.horizontal':FROZEN_GAME_INPUTS[index].horizontal,'event.jump':FROZEN_GAME_INPUTS[index].jump}});
    }
  }
  const rows=[...backend.rounds,...backend.inputResults,...backend.trials,...backend.trials.flatMap(t=>t.semanticRepairCases),...backend.trials.filter(t=>t.broken.kind==='success').map(t=>t.broken)];
  for(const row of rows)bound(row.runtimeTrace,values[row.valueRef]);
  const c=backend.runtimeControl;assert.equal(c.status,'PASS');for(const field of ['pausedRejected','authorityDenied','sourceRejected','foreignDenied'])assert.equal(c[field],true);
  const controls=ledger.slice(c.ledgerRange.start,c.ledgerRange.end);assert.equal(controls.length,24);
  assert.equal(c.firstTrace.ledgerRange.start,c.ledgerRange.start);assert.equal(c.secondTrace.ledgerRange.end,c.ledgerRange.end);
  assert.equal(controls[4].command.rule,'pause');assert.deepEqual(controls[4].before,c.beforePaused);assert.deepEqual(controls[4].after,c.paused);
  assert.equal(controls[5].error.code,'RCL_AUTHORITY_DENIED');assert.deepEqual(controls[5].after,c.pausedRollback);
  assert.equal(controls[6].command.rule,'resume');assert.deepEqual(controls[6].after,c.beforeWrong);
  assert.equal(controls[7].error.code,'RCL_AUTHORITY_DENIED');assert.equal(controls[7].command.inputs['event.source_root'],'0'.repeat(64));assert.deepEqual(controls[7].after,c.foreignRollback);
  for(const[offset,key,before,after]of [[8,'invalid','beforeInvalid','afterInvalid'],[9,'duplicate','beforeDuplicate','afterDuplicate']]){assert.deepEqual(controls[offset].result,c[key]);assert.deepEqual(controls[offset].before,c[before]);assert.deepEqual(controls[offset].after,c[after]);}
  const value=values[backend.rounds[0].valueRef];for(const t of [c.firstTrace,c.secondTrace])bound(t,value);
  for(const key of ['sourceRoot','artifactHash','stateRoot'])assert.equal(c[key],backend.rounds[0][key]);
  assert.equal(c.paused.stateRoot,c.pausedRollback.stateRoot);assert.equal(c.paused.state['game.enabled'],false);assert.equal(c.beforeWrong.stateRoot,c.sourceRollback.stateRoot);assert.equal(c.sourceRollback.stateRoot,c.foreignRollback.stateRoot);
  for(const[name,before,after]of [['invalid','beforeInvalid','afterInvalid'],['duplicate','beforeDuplicate','afterDuplicate']]){assert.equal(c[name].status,'not-triggered');assert.equal(c[before].stateRoot,c[after].stateRoot);}
  assert.equal(c.landing.length,9);for(const[index,row]of c.landing.entries()){assert.equal(row.index,index+4);assert.equal(row.result.status,'realized');assert.equal(row.snapshot.state['game.frame'],row.index);assert.deepEqual(row.result,controls[index+10].result);assert.deepEqual(row.snapshot,controls[index+10].after);}
  assert.deepEqual(c.landed,controls[18].after);assert.equal(controls[19].reset,true);
  assert.equal(c.landed.state['player.y'],136);assert.equal(c.landed.state['player.vy'],0);assert.equal(c.landed.state['player.grounded'],true);assert.ok(c.landed.state['game.ground_collisions']>0);
  assert.equal(ledger.filter(item=>item.reset).length,1);assert.deepEqual(c.reset,(({before,after})=>({before,after}))(ledger.find(item=>item.reset)));
  assert.deepEqual(c.firstTrace.snapshot.state,c.secondTrace.snapshot.state);assert.equal(c.firstTrace.snapshot.stateRoot,c.secondTrace.snapshot.stateRoot);
  assert.equal(new Set(backend.rounds.map(row=>row.runtimeTrace.nonce)).size,20);
}
