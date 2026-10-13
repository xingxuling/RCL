import assert from 'node:assert/strict';
import {createPortableScientificTarget} from '../src/portable-scientific-target.mjs';
import {runReplicatedCounterNetwork} from '../src/replicated-counter-network.mjs';
import {verifyCounterNetwork} from './k400-crdt-network-verifier.mjs';
import {verifyScientificBinding,verifyScientificRow,replayScientificLedger,bindScientificTrace} from './k400-scientific-traces.mjs';
export async function runScientificCounterNetwork(source){
  const captures=[];
  const network=await runReplicatedCounterNetwork({source,factory:async()=>{
    const target=await createPortableScientificTarget(),capture={rows:[]};captures.push(capture);let compilation;
    return{environment:target.environment,binding:target.binding,
      async compile(file,out){const result=await target.compile(file,out);compilation=result.scientificCompileTrace;return result;},
      async execute(file,root){const result=await target.execute(file,root);capture.rows.push({nonce:result.scientificTrace.nonce,compileTrace:compilation});return{...result,controllerTrace:result.scientificTrace};},
      controllerLedger:()=>target.controllerLedger(),async dispose(){capture.records=target.observerRecords();capture.exit=await target.dispose();}};
  }});
  for(let node=0;node<3;node++){
    const rows=[network.initial[node],...network.packets.filter(p=>p.receiver===node&&p.observed).map(p=>p.observed)];
    for(const row of rows){const capture=captures[node].rows.find(item=>item.nonce===row.runtimeTrace.nonce);assert.ok(capture);row.compileTrace=capture.compileTrace;}assert.equal(rows.length,captures[node].rows.length);
  }
  network.scientificCapture='ACTUAL_NATIVE_NUMERICS_AND_INDEPENDENT_OBSERVER_PER_PACKET';network.nodeObserverRecords=captures.map(c=>c.records);network.nodeObserverExits=captures.map(c=>c.exit);return network;
}
export async function verifyScientificCounterNetwork(network,contract,source,oracle){
  assert.equal(network.scientificCapture,'ACTUAL_NATIVE_NUMERICS_AND_INDEPENDENT_OBSERVER_PER_PACKET');assert.equal(new Set(network.nodeBindings.map(b=>b.controller.processId)).size,3);assert.equal(new Set(network.nodeBindings.map(b=>b.observer.processPid)).size,3);
  for(const b of network.nodeBindings)verifyScientificBinding(b,contract);
  await verifyCounterNetwork('scientific-runtime',{...network,nodeControllerLedgers:[null,null,null]},source,oracle,(row,b,value)=>verifyScientificRow(row,b,value));
  for(let node=0;node<3;node++){
    const binding=network.nodeBindings[node],ledger=network.nodeControllerLedgers[node],rows=[network.initial[node],...network.packets.filter(p=>p.receiver===node&&p.observed).map(p=>p.observed)];
    assert.equal(ledger.length,rows.length*2);assert.equal(ledger.some(row=>row.reset||row.error),false);await replayScientificLedger(binding,ledger,contract);
    for(const[index,row]of rows.entries()){assert.equal(row.runtimeTrace.ledgerRange.start,index*2);assert.equal(row.runtimeTrace.ledgerRange.end,index*2+2);bindScientificTrace(row.runtimeTrace,row.result,ledger,binding);}
    assert.deepEqual(network.nodeObserverRecords[node],rows.map(r=>r.runtimeTrace.analysis.independent));assert.equal(new Set(network.nodeObserverRecords[node].map(r=>r.id)).size,rows.length);
    const exit=network.nodeObserverExits[node];assert.equal(exit.processPid,binding.observer.processPid);assert.equal(exit.exitObserved,true);assert.equal(exit.code,0);assert.equal(exit.signal,null);
  }
}
