import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {REALTIME_PROFILES} from '../scripts/k400-realtime-definitions.mjs';
import {verifyRealtimeProfile} from '../scripts/k400-realtime-engine.mjs';
const definition=id=>REALTIME_PROFILES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/realtime-native/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
async function rejects(mutate,id='learning'){const report=receipt(id);mutate(report);await assert.rejects(()=>verifyRealtimeProfile(definition(id),reseal(report)));}

test('actual soft realtime receipts admit every frozen program profile',async()=>{
  for(const profile of REALTIME_PROFILES)assert.equal((await verifyRealtimeProfile(profile)).admitted,true);
});
test('hard timing claims, missing actual exit and wrong native artifacts fail admission',async()=>{
  await rejects(r=>r.backends['realtime-runtime'].binding.hardRealtimeClaimed=true);
  await rejects(r=>r.backends['realtime-runtime'].rounds[0].runtimeTrace.nativeTrace.exitObserved=false);
  await rejects(r=>r.backends['realtime-runtime'].binding.binary.sha256='0'.repeat(64));
});
test('release/deadline observations and source-owned publication cannot be rehashed away',async()=>{
  await rejects(r=>r.backends['realtime-runtime'].rounds[0].runtimeTrace.admittedAt=0);
  await rejects(r=>r.backends['realtime-runtime'].rounds[0].runtimeTrace.publishedAt=r.backends['realtime-runtime'].rounds[0].runtimeTrace.deadline+1);
  await rejects(r=>r.backends['realtime-runtime'].rounds[0].runtimeTrace.completion.transition.actor='untrusted');
});
test('timer release, past-deadline rejection and backpressure controls remain mandatory',async()=>{
  await rejects(r=>r.backends['realtime-runtime'].runtimeControl.releaseTrace.timerCount=0);
  await rejects(r=>r.backends['realtime-runtime'].runtimeControl.expiredBeforeStart.code='PASS');
  await rejects(r=>r.backends['realtime-runtime'].runtimeControl.backpressureRejected=false);
});
test('native timeout/cancel require real terminal processes and cannot count as completed jobs',async()=>{
  await rejects(r=>r.backends['realtime-runtime'].runtimeControl.timeout.nativeTrace.exitObserved=false);
  await rejects(r=>r.backends['realtime-runtime'].runtimeControl.cancelled.nativeTrace.stopReason='PASS');
  await rejects(r=>r.backends['realtime-runtime'].runtimeControl.heartbeat=[]);
  await rejects(r=>r.backends['realtime-runtime'].runtimeControl.timeout.settlement.status='not-triggered');
});
test('complete controller replay and original proposals are mandatory',async()=>{
  await rejects(r=>r.backends['realtime-runtime'].controllerLedger[0].command.inputs['event.root']='0'.repeat(64));
  await rejects(r=>r.backends['realtime-runtime'].trials[0].proposal.new='ignored');
});
test('noncanonical membership repair retains every pre-sealed input',async()=>{
  const report=receipt('replicated-counter'),trial=report.backends['realtime-runtime'].trials.find(item=>item.id==='replica-membership');assert.equal(trial.exactCanonicalRestoration,false);assert.equal(trial.semanticRepairCases.length,10);
  trial.semanticRepairCases.pop();await assert.rejects(()=>verifyRealtimeProfile(definition('replicated-counter'),reseal(report)));
});
