import assert from 'node:assert/strict';
import {createPortableAiTarget} from '../src/portable-ai-target.mjs';
import {runReplicatedCounterNetwork} from '../src/replicated-counter-network.mjs';
import {verifyCounterNetwork} from './k400-crdt-network-verifier.mjs';
import {verifyAiBinding,verifyAiRow,replayAiLedger,bindAiTrace} from './k400-ai-traces.mjs';
export async function runAiCounterNetwork(source){
  const captures=[];const network=await runReplicatedCounterNetwork({source,factory:async()=>{
    const target=await createPortableAiTarget(),capture=[];captures.push(capture);let compilation;
    return{environment:target.environment,binding:target.binding,async compile(file,out){const c=await target.compile(file,out);compilation=c.aiCompileTrace;return c;},
      async execute(file,root){const r=await target.execute(file,root);capture.push({nonce:r.aiTrace.nonce,compileTrace:compilation});return{...r,controllerTrace:r.aiTrace};},
      controllerLedger:()=>target.controllerLedger(),dispose:()=>target.dispose()};
  }});
  for(let node=0;node<3;node++){const rows=[network.initial[node],...network.packets.filter(p=>p.receiver===node&&p.observed).map(p=>p.observed)];for(const r of rows){const c=captures[node].find(c=>c.nonce===r.runtimeTrace.nonce);assert.ok(c);r.compileTrace=c.compileTrace;}assert.equal(rows.length,captures[node].length);}
  network.aiCapture='ACTUAL_NATIVE_PROGRAM_AND_ADVISORY_MODEL_PER_PACKET';return network;
}
export async function verifyAiCounterNetwork(network,contract,source,oracle){
  assert.equal(network.aiCapture,'ACTUAL_NATIVE_PROGRAM_AND_ADVISORY_MODEL_PER_PACKET');assert.equal(new Set(network.nodeBindings.map(b=>b.controller.processId)).size,3);for(const b of network.nodeBindings)verifyAiBinding(b,contract);
  await verifyCounterNetwork('ai-runtime',{...network,nodeControllerLedgers:[null,null,null]},source,oracle,(row,b,value)=>verifyAiRow(row,b,value));
  for(let node=0;node<3;node++){
    const b=network.nodeBindings[node],ledger=network.nodeControllerLedgers[node],rows=[network.initial[node],...network.packets.filter(p=>p.receiver===node&&p.observed).map(p=>p.observed)];assert.equal(ledger.length,1+rows.length*2);assert.equal(ledger.some(r=>r.reset||r.error),false);await replayAiLedger(b,ledger,contract);
    for(const[index,row]of rows.entries()){assert.equal(row.runtimeTrace.ledgerRange.start,1+index*2);assert.equal(row.runtimeTrace.ledgerRange.end,3+index*2);bindAiTrace(row.runtimeTrace,row.result,ledger,b);}
  }
}
