import test from 'node:test';
import assert from 'node:assert/strict';
import {runReplicatedCounterNetwork} from '../src/replicated-counter-network.mjs';
import {verifyCounterNetwork} from '../scripts/k400-crdt-network-verifier.mjs';
import {CRDT_PROFILE} from '../scripts/k400-crdt-definitions.mjs';
import {verifyCrdtRowTrace} from '../scripts/k400-crdt-targets.mjs';

test('three actual HTTP nodes converge through RCL while stale, duplicate and denied packets preserve state',async()=>{
  const result=await runReplicatedCounterNetwork();
  await verifyCounterNetwork('windows',result,CRDT_PROFILE.source(),CRDT_PROFILE.oracle,
    (row,binding,value)=>verifyCrdtRowTrace('windows',row,binding,value));
  assert.deepEqual(result.partitionVectors,[[8,4,0],[8,4,0],[0,0,7]]);
  assert.deepEqual(result.finalVectors,[[8,4,7],[8,4,7],[8,4,7]]);
  assert.deepEqual(result.packets.slice(-3).map(packet=>packet.httpStatus),[400,400,403]);
  assert.equal(result.multiHostClaimed,false);
  const falsePacket=structuredClone(result);falsePacket.packets[6].after[0]=999;
  await assert.rejects(()=>verifyCounterNetwork('windows',falsePacket,CRDT_PROFILE.source(),CRDT_PROFILE.oracle,()=>{}));
  const hiddenExecution=structuredClone(result);delete hiddenExecution.packets[0].observed;
  await assert.rejects(()=>verifyCounterNetwork('windows',hiddenExecution,CRDT_PROFILE.source(),CRDT_PROFILE.oracle,()=>{}));
});
