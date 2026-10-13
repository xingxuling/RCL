import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {verifyGpuProfile} from '../scripts/k400-gpu-engine.mjs';
import {GPU_PROFILES} from '../scripts/k400-gpu-definitions.mjs';
const definition=id=>GPU_PROFILES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/gpu-native/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
async function rejects(mutate,id='learning'){const report=receipt(id);mutate(report);await assert.rejects(()=>verifyGpuProfile(definition(id),reseal(report)));}

test('actual GPU receipts admit all frozen program profiles',async()=>{
  for(const profile of GPU_PROFILES)assert.equal((await verifyGpuProfile(profile)).admitted,true);
});
test('CPU fallback, unreported host hashing and wrong hardware bindings fail admission',async()=>{
  await rejects(r=>r.backends.gpu.binding.cpuExecutionFallback=true);
  await rejects(r=>r.backends.gpu.binding.stateRootOwner='GPU_NATIVE_SHA256');
  await rejects(r=>r.backends.gpu.binding.deviceType='CPU');
  await rejects(r=>r.backends.gpu.binding.kernel.sha256='0'.repeat(64));
});
test('compilation, actual device instructions and kernel calls cannot be omitted',async()=>{
  await rejects(r=>delete r.backends.gpu.rounds[0].compileTrace);
  await rejects(r=>r.backends.gpu.rounds[0].runtimeTrace.executedInstructions=0);
  await rejects(r=>r.backends.gpu.rounds[0].runtimeTrace.openclCalls.clEnqueueNDRangeKernel=0);
});
test('GPU nonce, process identity, source and bytecode are bound to each execution',async()=>{
  for(const mutate of [r=>r.backends.gpu.rounds[0].compileTrace.sourceHash='0'.repeat(64),
    r=>r.backends.gpu.rounds[0].runtimeTrace.artifactHash='0'.repeat(64),
    r=>r.backends.gpu.rounds[0].runtimeTrace.processPid++,
    r=>r.backends.gpu.rounds[1].runtimeTrace.nonce=r.backends.gpu.rounds[0].runtimeTrace.nonce])await rejects(mutate);
});
test('actual process reset and unchanged independent proposals are mandatory',async()=>{
  await rejects(r=>r.backends.gpu.runtimeControl.processResetObserved=false);
  await rejects(r=>r.backends.gpu.runtimeControl.contextTokenAfter=r.backends.gpu.runtimeControl.contextTokenBefore);
  await rejects(r=>r.backends.gpu.trials[0].proposal.new='ignored');
});
test('device-produced transaction snapshots remain mandatory after report rehashing',async()=>{
  await rejects(r=>r.backends.gpu.rounds[0].runtimeTrace.transactionSnapshotsRoot='0'.repeat(64),'governance-reactive');
  await rejects(r=>r.backends.gpu.rounds[0].runtimeTrace.transactionCount=0,'governance-reactive');
});
test('noncanonical repairs retain all ten pre-sealed input cases',async()=>{
  const report=receipt('relations'),trial=report.backends.gpu.trials.find(item=>!item.exactCanonicalRestoration);assert.ok(trial);assert.equal(trial.semanticRepairCases.length,10);
  trial.semanticRepairCases.pop();await assert.rejects(()=>verifyGpuProfile(definition('relations'),reseal(report)));
});
