import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode,compileRealitySessionBytecode} from '../src/bytecode.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {bindCounterInputs} from '../src/replicated-counter-network.mjs';
import {createRealitySession} from '../src/runtime.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
import {CRDT_BASELINE} from './k400-crdt-definitions.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),root=value=>semanticStateRootForAlgorithm(value,'rcl.semantic-state-root.v2');
const counterRoot=counter=>root({counter});

export async function verifyCounterNetwork(environment,network,source,oracle,verifyRow){
  assert.equal(network.status,'PASS');assert.equal(network.sourceOwnsMerge,true);assert.equal(network.multiHostClaimed,false);assert.equal(network.cryptographicMemberIdentityClaimed,false);
  assert.equal(network.transport,'THREE_REAL_HTTP_LOOPBACK_NODES');assert.equal(network.nodeBindings.length,3);assert.equal(network.nodeUrls.length,3);
  const ports=network.nodeUrls.map(value=>{const url=new URL(value);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/packet');return url.port;});assert.equal(new Set(ports).size,3);
  assert.equal(network.sourceHash,sha(source));assert.equal(network.sourceRoot,compileReality(source).programRoot);assert.equal(network.artifactHash,sha(compileRealityToBytecode(source)));
  if(environment==='browser')assert.equal(new Set(network.nodeBindings.map(binding=>binding.browser.pid)).size,3);
  if(environment==='gpu')assert.equal(new Set(network.nodeBindings.map(binding=>binding.initialProcessPid)).size,3);
  if(['simulation-runtime','automation-runtime','rncs-runtime'].includes(environment))assert.equal(new Set(network.nodeBindings.map(binding=>binding.controller.processId)).size,3);
  const observedRows=[[],[],[]];
  function observed(item,node,inputs){
    assert.deepEqual(item.inputs,inputs);const text=bindCounterInputs(source,inputs),expected=oracle({...CRDT_BASELINE,...inputs});
    assert.equal(item.sourceHash,sha(text));assert.equal(item.sourceRoot,compileReality(text).programRoot);assert.equal(item.artifactHash,sha(compileRealityToBytecode(text)));
    for(const[key,value]of Object.entries(expected.state))assert.deepEqual(item.result.state[key],value,'Network independent oracle: '+key);
    assert.equal(item.result.stateRoot,root(item.result.state));assert.deepEqual(item.result.history.map(record=>record.rule),expected.historyRules);assert.deepEqual(item.result.projections.map(record=>record.rule),expected.historyRules);
    const rules=compileReality(text).rules;let previous=structuredClone(item.result.state);
    for(let index=item.result.history.length-1;index>=0;index--){const record=item.result.history[index],projection=item.result.projections[index],rule=rules.find(rule=>rule.name===record.rule);
      assert.equal(record.actor,rule.cause);assert.deepEqual(record.authority.needs,rule.needs);assert.deepEqual(record.witnesses,rule.witnesses);assert.deepEqual(record.hostCalls,[]);
      assert.equal(record.afterRoot,root(previous));assert.deepEqual(record.changes.map(change=>change.target),rule.alters.map(alter=>alter.target));
      for(const change of record.changes){assert.deepEqual(previous[change.target],change.after);previous[change.target]=change.before;}
      assert.equal(record.beforeRoot,root(previous));assert.equal(record.stateRootAlgorithm,'rcl.semantic-state-root.v2');assert.equal(record.status,'realized');
      assert.equal(projection.beforeRoot,record.beforeRoot);assert.equal(projection.afterRoot,record.afterRoot);assert.equal(projection.mode,'foresee');
      assert.deepEqual(projection.authority,record.authority);assert.deepEqual(projection.witnesses,record.witnesses);
    }
    verifyRow({...item,stateRoot:item.result.stateRoot},network.nodeBindings[node],item.result);observedRows[node].push(item);
  }
  assert.equal(network.initial.length,3);for(let node=0;node<3;node++)observed(network.initial[node],node,{});
  const vectors=network.initial.map((item,node)=>[...item.result.state['local.'+['a','b','c'][node]]]);assert.deepEqual(network.initialVectors,vectors);
  const schedule=[[0,1],[1,0],[2,0],[1,2],[2,0],[2,1],[0,1],[2,0],[2,0],[99,0],[1,0],[1,0]],statuses=[200,200,503,200,200,200,200,200,200,400,400,403];
  assert.equal(network.packets.length,12);const ids=new Set();
  for(const[index,packet]of network.packets.entries()){
    assert.equal(packet.sequence,index);assert.match(packet.id,/^[0-9a-f-]{36}$/u);ids.add(packet.id);assert.deepEqual([packet.sender,packet.receiver],schedule[index]);assert.equal(packet.httpStatus,statuses[index]);
    const node=packet.receiver,before=[...vectors[node]];
    assert.deepEqual(packet.before,before);assert.equal(packet.beforeRoot,counterRoot(before));
    let expectedPayload;
    if(index===0||index===1||index===2)expectedPayload=network.initialVectors[packet.sender];
    else if(index===6)expectedPayload=network.initial[0].result.state['local.stale_a'];
    else if(index>=9)expectedPayload=[1000,1000,1000];
    else expectedPayload=vectors[packet.sender];
    assert.deepEqual(packet.vector,expectedPayload);
    if([503,403].includes(packet.httpStatus)){assert.equal(packet.executed,false);assert.equal(packet.observed,undefined);}
    else{
      assert.equal(packet.executed,true);const inputs={packet_mode:true,repeats:0,receiver:node,sender:packet.sender,
        current_a:before[0],current_b:before[1],current_c:before[2],incoming_a:packet.vector[0],incoming_b:packet.vector[1],incoming_c:packet.vector[2],allowed:index!==10};
      observed(packet.observed,node,inputs);
      assert.equal(packet.observed.result.state['packet.accepted'],packet.httpStatus===200);
      if(packet.httpStatus===200)vectors[node]=[...packet.observed.result.state['packet.result']];
    }
    assert.deepEqual(packet.after,vectors[node]);assert.equal(packet.afterRoot,counterRoot(vectors[node]));
    if(index===2)assert.deepEqual(network.partitionVectors,vectors);if(index===5)assert.deepEqual(network.convergedVectors,vectors);
    if(index>=6)assert.equal(packet.beforeRoot,packet.afterRoot,'Stale/duplicate/rejected packet preserves the target vector');
  }
  assert.equal(ids.size,12);assert.deepEqual(network.finalVectors,vectors);for(const value of vectors)assert.deepEqual(value,vectors[0]);
  assert.deepEqual(vectors[0],oracle(CRDT_BASELINE).state['replicas.snapshot'][0]);
  for(let node=0;node<3;node++){
    const binding=network.nodeBindings[node],ledger=network.nodeControllerLedgers[node];
    if(!['simulation-runtime','automation-runtime','rncs-runtime'].includes(environment)){assert.equal(ledger,null);continue;}
    assert.ok(ledger.length>0);const controller=binding.controller,controllerSource=fs.readFileSync(path.join(ROOT,controller.sourcePath),'utf8');
    assert.equal(controller.sourceHash,sha(controllerSource));assert.equal(controller.programRoot,compileReality(controllerSource).programRoot);
    assert.equal(controller.bytecodeHash,sha(compileRealitySessionBytecode(controllerSource)));assert.equal(controller.daemonRoot,sha(fs.readFileSync(path.join(ROOT,'native/rclvmd.exe'))));
    const reference=createRealitySession(controllerSource);
    for(const[index,item]of ledger.entries()){
      assert.equal(item.index,index);assert.equal(item.error,undefined);assert.deepEqual(item.before.state,reference.snapshot().state);assert.equal(item.before.stateRoot,reference.snapshot().stateRoot);
      assert.equal(item.before.native.processId,controller.processId);assert.equal(item.before.native.sourceBound,true);
      assert.deepEqual(item.result,await reference.invoke(item.command));assert.deepEqual(item.after.state,reference.snapshot().state);assert.equal(item.after.stateRoot,reference.snapshot().stateRoot);
      assert.equal(item.after.native.stateRootsIndependentlyVerified,true);
    }
    for(const row of observedRows[node]){
      const trace=environment==='rncs-runtime'?row.runtimeTrace.controllerTrace:row.runtimeTrace,
        first=ledger[trace.ledgerRange.start],last=ledger[trace.ledgerRange.end-1];
      assert.equal(trace.processId,controller.processId);assert.equal(trace.programRoot,controller.programRoot);assert.equal(trace.ledgerRange.end,trace.ledgerRange.start+2);
      assert.deepEqual(trace.entry,first.result);assert.deepEqual(trace.completion,last.result);assert.equal(first.command.inputs['event.root'],row.sourceRoot);
      assert.deepEqual(trace.snapshot,last.after);
    }
  }
}
