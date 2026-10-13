import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {verifyRncsProfile} from '../scripts/k400-rncs-engine.mjs';
import {RNCS_PROFILES} from '../scripts/k400-rncs-definitions.mjs';
const definition=id=>RNCS_PROFILES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/rncs-native/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
async function rejects(mutate,id='learning'){const report=receipt(id);mutate(report);await assert.rejects(()=>verifyRncsProfile(definition(id),reseal(report)));}

test('actual RNCS candidate runtime admits every frozen profile with deliberate host execution credit',async()=>{
  for(const profile of RNCS_PROFILES){const result=await verifyRncsProfile(profile);assert.equal(result.admitted,true);
    for(const claim of result.claims)assert.equal(claim.coverageMode,'lowered-execution');}
});
test('unproven production writes, wrong donor source and omitted compilation traces fail admission',async()=>{
  await rejects(r=>r.backends['rncs-runtime'].binding.productionRfeCommit=true);
  await rejects(r=>r.backends['rncs-runtime'].binding.vendor.commit='0'.repeat(40));
  await rejects(r=>delete r.backends['rncs-runtime'].rounds[0].compileTrace);
});
test('real RNCS provider dispatch and sealed execution receipts are mandatory',async()=>{
  await rejects(r=>r.backends['rncs-runtime'].rounds[0].runtimeTrace.providerCalls=0);
  await rejects(r=>r.backends['rncs-runtime'].rounds[0].runtimeTrace.executionReceipt.status='candidate');
  await rejects(r=>r.backends['rncs-runtime'].rounds[0].runtimeTrace.plan.mode='production');
});
test('RNCS authority, typed payload, source and generation continuity are bound',async()=>{
  for(const mutate of [r=>r.backends['rncs-runtime'].rounds[0].runtimeTrace.authorityDecision.decision='denied',
    r=>r.backends['rncs-runtime'].rounds[0].runtimeTrace.mergedState.body.stateRoot='0'.repeat(64),
    r=>r.backends['rncs-runtime'].rounds[0].compileTrace.sourceHash='0'.repeat(64),
    r=>r.backends['rncs-runtime'].rounds[1].runtimeTrace.beforeGenerationRoot='0'.repeat(64)])await rejects(mutate);
});
test('source-owned controller ledger, rollback, stale-base and restart controls remain mandatory',async()=>{
  await rejects(r=>r.backends['rncs-runtime'].runtimeControl.guard.rollbackObserved=false);
  await rejects(r=>r.backends['rncs-runtime'].runtimeControl.guard.staleRejected=false);
  await rejects(r=>r.backends['rncs-runtime'].runtimeControl.controllerLedgerBefore[0].command.inputs['event.root']='0'.repeat(64));
  await rejects(r=>r.backends['rncs-runtime'].runtimeControl.contextResetObserved=false);
});
test('unchanged independent repairs and all noncanonical sealed cases remain mandatory',async()=>{
  await rejects(r=>r.backends['rncs-runtime'].trials[0].proposal.new='ignored');
  const report=receipt('relations'),trial=report.backends['rncs-runtime'].trials.find(item=>!item.exactCanonicalRestoration);assert.ok(trial);assert.equal(trial.semanticRepairCases.length,10);
  trial.semanticRepairCases.pop();await assert.rejects(()=>verifyRncsProfile(definition('relations'),reseal(report)));
});
