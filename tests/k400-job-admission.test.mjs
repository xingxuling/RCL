import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {verifyJobProfile} from '../scripts/k400-job-engine.mjs';
import {JOB_PROFILES} from '../scripts/k400-job-definitions.mjs';
const definition=id=>JOB_PROFILES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/job-contexts/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
test('all three real job contexts pass admission with the frozen independent proposals',()=>{
  const result=verifyJobProfile(definition('learning'));assert.equal(result.admitted,true);assert.equal(result.claims.length,3);
});
test('rehashed cold-handler or compile-process omissions fail admission',()=>{
  for(const mutate of [r=>r.backends.serverless.rounds[0].runtimeTrace.processExited=false,
    r=>delete r.backends.serverless.rounds[0].compileTrace,
    r=>r.backends.serverless.runtimeControl.processExited=false]){
    const report=receipt('learning');mutate(report);assert.throws(()=>verifyJobProfile(definition('learning'),reseal(report)));
  }
});
test('SQL invocation, reopen recovery and rollback cannot be substituted by flags',()=>{
  for(const mutate of [r=>r.backends.database.rounds[0].runtimeTrace.sqlInvocations=0,
    r=>r.backends.database.rounds[0].runtimeTrace.sqlFunction='javascript_fake',
    r=>r.backends.database.runtimeControl.reopened=false,
    r=>r.backends.database.runtimeControl.rollback.after++]){
    const report=receipt('learning');mutate(report);assert.throws(()=>verifyJobProfile(definition('learning'),reseal(report)));
  }
});
test('dataflow input, worker identity and backpressure are mandatory',()=>{
  for(const mutate of [r=>r.backends['dataflow-runtime'].rounds[0].runtimeTrace.inputHash='0'.repeat(64),
    r=>r.backends['dataflow-runtime'].rounds[0].runtimeTrace.threadId++,
    r=>r.backends['dataflow-runtime'].runtimeControl.backpressureRejected=false]){
    const report=receipt('learning');mutate(report);assert.throws(()=>verifyJobProfile(definition('learning'),reseal(report)));
  }
});
test('the original indexed proposal ID and every noncanonical repair case are retained',()=>{
  const report=receipt('algorithm-cli'),trial=report.backends.database.trials.find(item=>item.id==='gcd');
  assert.equal(trial.exactCanonicalRestoration,false);assert.equal(trial.semanticRepairCases.length,10);
  assert.equal(report.backends.database.trials.find(item=>item.id==='fibonacci').proposal.id,'algorithm-cli-1');
  trial.semanticRepairCases.pop();assert.throws(()=>verifyJobProfile(definition('algorithm-cli'),reseal(report)));
});
test('generic errors and a rehashed false host binary cannot receive growth credit',()=>{
  const generic=receipt('learning');generic.backends.serverless.trials[0].broken={kind:'rejected',code:'NETWORK_TIMEOUT',diagnostic:'timeout'};
  assert.throws(()=>verifyJobProfile(definition('learning'),reseal(generic)));
  const host=receipt('learning');host.backends.database.binding.hostRuntime.sha256='0'.repeat(64);
  assert.throws(()=>verifyJobProfile(definition('learning'),reseal(host)));
});
