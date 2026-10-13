import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {verifyBrowserProfile} from '../scripts/k400-browser-engine.mjs';
import {BROWSER_PROFILES} from '../scripts/k400-browser-definitions.mjs';
const definition=id=>BROWSER_PROFILES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/browser-native/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
async function rejects(mutate,id='learning'){const report=receipt(id);mutate(report);await assert.rejects(()=>verifyBrowserProfile(definition(id),reseal(report)));}
test('actual browser compiler and VM receipts admit every frozen profile',async()=>{
  for(const profile of BROWSER_PROFILES)assert.equal((await verifyBrowserProfile(profile)).admitted,true);
});
test('Node fallback, wrong browser artifact and omitted compilation traces fail admission',async()=>{
  await rejects(r=>r.backends.browser.binding.nodeWasiExecutionUsed=true);
  await rejects(r=>r.backends.browser.binding.compilerBinary.path='native/rclc.exe');
  await rejects(r=>delete r.backends.browser.rounds[0].compileTrace);
});
test('compiler instructions, real file rename and native execution syscalls are mandatory',async()=>{
  await rejects(r=>r.backends.browser.rounds[0].compileTrace.compilerMetrics.executedInstructions=0);
  await rejects(r=>r.backends.browser.rounds[0].compileTrace.wasiCalls.path_rename=0);
  await rejects(r=>r.backends.browser.rounds[0].runtimeTrace.wasiCalls.fd_read=0);
});
test('source, artifact, WASM and page sequence bindings cannot be replaced by rehashing',async()=>{
  for(const mutate of [r=>r.backends.browser.rounds[0].compileTrace.sourceHash='0'.repeat(64),
    r=>r.backends.browser.rounds[0].runtimeTrace.wasmHash='0'.repeat(64),
    r=>r.backends.browser.rounds[0].runtimeTrace.instance++,
    r=>r.backends.browser.rounds[1].compileTrace.pageToken='0'.repeat(36)])await rejects(mutate);
});
test('browser reload controls and exact frozen repairs remain mandatory',async()=>{
  await rejects(r=>r.backends.browser.runtimeControl.pageResetObserved=false);
  await rejects(r=>r.backends.browser.runtimeControl.pageTokenAfter=r.backends.browser.runtimeControl.pageTokenBefore);
  await rejects(r=>r.backends.browser.trials[0].proposal.new='ignored');
});
test('noncanonical repair spellings retain every pre-sealed input',async()=>{
  const report=receipt('relations'),trial=report.backends.browser.trials.find(item=>!item.exactCanonicalRestoration);assert.ok(trial);assert.equal(trial.semanticRepairCases.length,10);
  trial.semanticRepairCases.pop();await assert.rejects(()=>verifyBrowserProfile(definition('relations'),reseal(report)));
});
