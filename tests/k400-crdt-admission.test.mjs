import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {CRDT_PROFILE} from '../scripts/k400-crdt-definitions.mjs';
import {verifyCrdtProfile} from '../scripts/k400-crdt-engine.mjs';
const receipt=()=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/crdt/replicated-counter-runtime.json',import.meta.url),'utf8'));
async function rejects(mutate){const report=receipt();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifyCrdtProfile(CRDT_PROFILE,report));}

test('source-owned CRDT with actual HTTP packet controls admits all fifteen distinct contexts',async()=>{
  const result=await verifyCrdtProfile(CRDT_PROFILE);assert.equal(result.admitted,true);assert.equal(result.eligibleCells.length,15);assert.equal(new Set(result.eligibleCells).size,15);
});
test('semantic oracle and source/binary identities survive no amount of report rehashing',async()=>{
  await rejects(r=>r.backends.windows.rounds[0].sourceHash='0'.repeat(64));
  await rejects(r=>r.backends.windows.networkControl.sourceHash='0'.repeat(64));
});
test('actual HTTP execution, partition observations and three distinct endpoints are mandatory',async()=>{
  await rejects(r=>r.backends.windows.networkControl.transport='LOGICAL_MODEL_ONLY');
  await rejects(r=>r.backends.windows.networkControl.packets[2].httpStatus=200);
  await rejects(r=>r.backends.windows.networkControl.nodeUrls[1]=r.backends.windows.networkControl.nodeUrls[0]);
});
test('stale and duplicate packets cannot silently increment counters',async()=>{
  await rejects(r=>r.backends.windows.networkControl.packets[6].after[0]++);
  await rejects(r=>r.backends.windows.networkControl.finalVectors[0][1]++);
});
test('foreign members, source authority and transport denial remain real runtime controls',async()=>{
  await rejects(r=>r.backends.windows.networkControl.packets[9].observed.result.state['packet.accepted']=true);
  await rejects(r=>r.backends.windows.networkControl.packets[10].httpStatus=200);
  await rejects(r=>r.backends.windows.networkControl.packets[11].executed=true);
});
test('returned noncanonical independent membership repairs retain all sealed cases',async()=>{
  const report=receipt(),trial=report.backends.windows.trials.find(item=>item.id==='replica-membership');assert.equal(trial.exactCanonicalRestoration,false);assert.equal(trial.semanticRepairCases.length,10);
  trial.semanticRepairCases.pop();report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifyCrdtProfile(CRDT_PROFILE,report));
});
