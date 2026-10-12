import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {verifyContextProfile} from '../scripts/k400-context-engine.mjs';
import {CONTEXT_PROFILES} from '../scripts/k400-context-definitions.mjs';
const definition=id=>CONTEXT_PROFILES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/contexts/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
test('all three actual execution contexts are independently admitted',()=>{
  const result=verifyContextProfile(definition('learning'));assert.equal(result.admitted,true);assert.equal(result.claims.length,3);
  assert.equal(new Set(result.claims.map(item=>item.environment)).size,3);
});
test('rehashed false worker identities and recovery controls fail admission',()=>{
  for(const mutate of [report=>report.backends.server.rounds[0].runtimeTrace.workerPid++,
    report=>report.backends['distributed-runtime'].runtimeControl.terminalObserved=false,
    report=>report.backends['distributed-runtime'].runtimeControl.newPid=report.backends['distributed-runtime'].binding.workerPids[0],
    report=>report.backends['embedded-runtime'].runtimeControl.nextRun=report.backends['embedded-runtime'].runtimeControl.firstRun]){
    const report=receipt('learning');mutate(report);assert.throws(()=>verifyContextProfile(definition('learning'),reseal(report)));
  }
});
test('unchanged equivalent independent proposal must retain every pre-sealed repair case',()=>{
  const report=receipt('relations'),trial=report.backends.server.trials.find(item=>item.id==='foreign-key');
  assert.equal(trial.exactCanonicalRestoration,false);assert.equal(trial.semanticRepairCases.length,10);
  trial.semanticRepairCases.pop();assert.throws(()=>verifyContextProfile(definition('relations'),reseal(report)));
});
test('generic transport errors and unbound broken artifacts cannot count as effective mutations',()=>{
  const generic=receipt('learning');generic.backends.server.trials[0].broken={kind:'rejected',code:'NETWORK_TIMEOUT',diagnostic:'timeout'};
  assert.throws(()=>verifyContextProfile(definition('learning'),reseal(generic)));
  const artifact=receipt('learning');artifact.backends.server.trials[0].broken.artifactHash='0'.repeat(64);
  assert.throws(()=>verifyContextProfile(definition('learning'),reseal(artifact)));
  const corrupt=receipt('learning');corrupt.backends.server.negativeControls.corruptDiagnostic='BYTECODE_NETWORK_TIMEOUT';
  assert.throws(()=>verifyContextProfile(definition('learning'),reseal(corrupt)));
});
