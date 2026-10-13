import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createPortableGameTarget} from '../src/portable-game-target.mjs';
import {runReplicatedCounterNetwork} from '../src/replicated-counter-network.mjs';
import {createRealitySession} from '../src/runtime.mjs';
import {verifyCounterNetwork} from './k400-crdt-network-verifier.mjs';
import {verifyGameBinding,verifyGameRow} from './k400-game-traces.mjs';
import {ROOT} from './k400-genomes/shared.mjs';

// Reuse the existing actual HTTP packet runner without altering its frozen API.
// The adapter captures the game's new compile trace beside its controller trace.
export async function runGameCounterNetwork(source){
  const captures=[];
  const network=await runReplicatedCounterNetwork({source,factory:async()=>{
    const target=await createPortableGameTarget(),observed=[];captures.push(observed);let compilation;
    return{environment:target.environment,binding:target.binding,
      async compile(file,out){const result=await target.compile(file,out);compilation=result.gameCompileTrace;return result;},
      async execute(file,root){const result=await target.execute(file,root);observed.push({nonce:result.gameTrace.nonce,compileTrace:compilation});return{...result,controllerTrace:result.gameTrace};},
      controllerLedger:()=>target.controllerLedger(),dispose:()=>target.dispose()};
  }});
  for(let node=0;node<3;node++){
    const rows=[network.initial[node],...network.packets.filter(p=>p.receiver===node&&p.observed).map(p=>p.observed)];
    for(const row of rows){const captured=captures[node].find(item=>item.nonce===row.runtimeTrace.nonce);assert.ok(captured);row.compileTrace=captured.compileTrace;}
    assert.equal(rows.length,captures[node].length);
  }
  network.gameHookCapture='ACTUAL_NATIVE_PROGRAM_AND_SCENE_PER_PACKET';return network;
}

export async function verifyGameCounterNetwork(network,contract,source,oracle){
  assert.equal(network.gameHookCapture,'ACTUAL_NATIVE_PROGRAM_AND_SCENE_PER_PACKET');
  assert.equal(new Set(network.nodeBindings.map(b=>b.controller.processId)).size,3);
  for(const b of network.nodeBindings)verifyGameBinding(b,contract);
  // The legacy transport validator recognizes phase-controller ledgers only for
  // its original contexts. Validate its transport view, then enforce the actual
  // game ledgers separately below. The stored network receipt is never changed.
  await verifyCounterNetwork('game-runtime',{...network,nodeControllerLedgers:[null,null,null]},source,oracle,
    (row,binding,value)=>verifyGameRow(row,binding,value));
  for(let node=0;node<3;node++){
    const binding=network.nodeBindings[node],ledger=network.nodeControllerLedgers[node];assert.ok(ledger.length>0);
    const reference=createRealitySession(fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8'));
    function snapshot(value){assert.deepEqual(value.state,reference.snapshot().state);assert.equal(value.stateRoot,reference.snapshot().stateRoot);assert.equal(value.programRoot,binding.controller.programRoot);
      assert.equal(value.native.processId,binding.controller.processId);assert.equal(value.native.daemonRoot,binding.controller.daemonRoot);assert.equal(value.native.sourceRoot,binding.controller.daemonSourceRoot);
      assert.equal(value.native.sourceBound,true);assert.equal(value.native.stateRootsIndependentlyVerified,true);}
    for(const[index,item]of ledger.entries()){assert.equal(item.index,index);assert.equal(item.reset,undefined);assert.equal(item.error,undefined);snapshot(item.before);assert.deepEqual(item.result,await reference.invoke(item.command));snapshot(item.after);}
    const rows=[network.initial[node],...network.packets.filter(p=>p.receiver===node&&p.observed).map(p=>p.observed)];
    assert.equal(ledger.length,rows.length*4);
    for(const[offset,row]of rows.entries()){
      const trace=row.runtimeTrace,value=row.result;assert.equal(trace.ledgerRange.start,offset*4);assert.equal(trace.ledgerRange.end,offset*4+4);
      const load=ledger[offset*4];assert.equal(load.command.rule,'loadPlugin');assert.equal(load.command.inputs['event.source_root'],row.sourceRoot);assert.deepEqual(load.result,trace.load);
      for(const[index,frame]of trace.frames.entries()){
        const item=ledger[offset*4+index+1];assert.deepEqual(frame.before,item.before);assert.deepEqual(frame.commit,item.result);assert.deepEqual(frame.snapshot,item.after);
        assert.deepEqual(item.command,{rule:'advanceFrame',inputs:{'event.source_root':row.sourceRoot,'event.result_root':value.stateRoot,'event.metric':frame.metric,'event.frame':index+1,
          'event.horizontal':contract.frameInputs[index].horizontal,'event.jump':contract.frameInputs[index].jump}});
      }
    }
  }
}
