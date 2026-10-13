import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPortableGameTarget} from '../src/portable-game-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {gamePhysicsOracle} from '../scripts/k400-game-traces.mjs';
test('actual native hook drives native RCL jump, motion, landing, authority rollback and process reset',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-game-test-'));let target;
  try{
    target=await createPortableGameTarget();const source='reality GameSignal { facet value : Number = 49 }',file=path.join(directory,'source.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,source);
    const compilation=await target.compile(file,artifact);assert.ok(compilation.bytecode.equals(compileRealityToBytecode(source)));const root=compileReality(source).programRoot;
    const first=await target.execute(artifact,root);assert.equal(first.result.state.value,49);
    assert.deepEqual(first.gameTrace.frames.map(f=>f.snapshot.state['player.y']),[128,122,118]);
    for(const f of first.gameTrace.frames){assert.ok(f.hookTrace.processPid>0);assert.equal(f.hookTrace.status,0);assert.equal(f.commit.transition.actor,'engine');assert.ok(f.scene.svg.includes('<svg'));}
    const changed=source.replace('49','50'),other=path.join(directory,'changed.rcl');fs.writeFileSync(other,changed);await target.compile(other,other+'.rbc');
    const second=await target.execute(other+'.rbc',compileReality(changed).programRoot);assert.notEqual(first.gameTrace.snapshot.state['player.x'],second.gameTrace.snapshot.state['player.x']);
    const controls=await target.verifyRuntimeControl(artifact,root);assert.equal(controls.status,'PASS');assert.equal(controls.landed.state['player.y'],136);assert.notEqual(controls.reset.before.native.processId,controls.reset.after.native.processId);
    // Drive both real native collision boundaries using the last verified hook.
    for(let frame=4;frame<=159;frame++){
      const input={'event.source_root':root,'event.result_root':first.result.stateRoot,'event.metric':15,'event.frame':frame,'event.horizontal':frame<=56?1:-1,'event.jump':false};
      assert.equal((await target.controlCommand({rule:'advanceFrame',inputs:input})).status,'realized');
      if(frame===56)assert.equal(target.snapshotController().state['player.x'],302);
    }
    assert.equal(target.snapshotController().state['player.x'],0);
    const before=target.snapshotController();await assert.rejects(target.execute(artifact,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);assert.equal(target.snapshotController().stateRoot,before.stateRoot);
    assert.equal((await target.execute(artifact,root)).gameTrace.snapshot.stateRoot,first.gameTrace.snapshot.stateRoot);
  }finally{
    await target?.dispose();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-game-test-'));fs.rmSync(directory,{recursive:true,force:true});
  }
});
test('independent physics oracle keeps ground and both horizontal collision boundaries',()=>{
  const base={'player.x':301,'player.y':135,'player.vy':10,'player.grounded':false,'game.frame':9,'game.score':0,'game.ground_collisions':0};
  const right=gamePhysicsOracle(base,{horizontal:1,jump:false},16);assert.equal(right['player.x'],302);assert.equal(right['player.y'],136);assert.equal(right['player.vy'],0);assert.equal(right['game.ground_collisions'],1);
  assert.equal(gamePhysicsOracle({...base,'player.x':0},{horizontal:-1,jump:false},0)['player.x'],0);
});
