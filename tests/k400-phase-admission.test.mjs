import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {verifyPhaseProfile} from '../scripts/k400-phase-engine.mjs';
import {PHASE_PROFILES} from '../scripts/k400-phase-definitions.mjs';
const definition=id=>PHASE_PROFILES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/phase-contexts/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
async function rejects(mutate,id='learning'){
  const report=receipt(id);mutate(report);await assert.rejects(()=>verifyPhaseProfile(definition(id),reseal(report)));
}
test('both native RCL phase controllers admit complete source-bound receipts',async()=>{
  const result=await verifyPhaseProfile(definition('learning'));assert.equal(result.admitted,true);assert.equal(result.claims.length,2);
});
test('controller commands, actors, results and snapshots are independently replayed',async()=>{
  for(const mutate of [r=>r.backends['simulation-runtime'].controllerLedger[0].result.transition.actor='outsider',
    r=>r.backends['simulation-runtime'].controllerLedger[0].command.inputs['event.root']='0'.repeat(64),
    r=>r.backends['simulation-runtime'].controllerLedger[0].result.transition.afterRoot='0'.repeat(64),
    r=>r.backends['automation-runtime'].controllerLedger[1].after.state['pipeline.completed']++])await rejects(mutate);
});
test('a correct unrelated controller trace cannot replace the kernel source binding',async()=>{
  await rejects(r=>r.backends['simulation-runtime'].rounds[0].runtimeTrace=r.backends['simulation-runtime'].inputResults[0].runtimeTrace);
});
test('rehashed pause, denial and backward-clock controls remain mandatory',async()=>{
  for(const mutate of [r=>r.backends['simulation-runtime'].runtimeControl.timeReversalRejected=false,
    r=>r.backends['automation-runtime'].runtimeControl.sourceAuthorityDenied=false,
    r=>r.backends['simulation-runtime'].runtimeControl.guardRange.end--,
    r=>{const b=r.backends['automation-runtime'],i=b.runtimeControl.guardRange.start+1;b.controllerLedger[i].error.code='NETWORK_TIMEOUT';}])await rejects(mutate);
});
test('controller binary/source receipts and every environment are mandatory',async()=>{
  await rejects(r=>r.backends['simulation-runtime'].binding.controller.daemonRoot='0'.repeat(64));
  await rejects(r=>delete r.backends['automation-runtime']);
});
test('a noncanonical proposal retains every pre-sealed oracle case',async()=>{
  const report=receipt('relations'),trial=report.backends['simulation-runtime'].trials.find(item=>!item.exactCanonicalRestoration);
  assert.ok(trial);assert.equal(trial.semanticRepairCases.length,10);trial.semanticRepairCases.pop();
  await assert.rejects(()=>verifyPhaseProfile(definition('relations'),reseal(report)));
});
test('generic transport errors cannot close the semantic mutation gate',async()=>{
  await rejects(r=>r.backends['simulation-runtime'].trials[0].broken={kind:'rejected',code:'NETWORK_TIMEOUT',diagnostic:'timeout'});
});
