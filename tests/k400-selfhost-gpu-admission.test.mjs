import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-gpu-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-gpu-admission.mjs';
const inputs=validateSelfhostInputs(),read=()=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-gpu/general-compiler-gpu-gpu-runtime.json','utf8'));
test('actual full compiler GPU profile admits exactly K179 under original budgets',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K179']);});
for(const [name,mutate]of [
  ['CPU execution fallback',r=>{r.binding.cpuExecutionFallback=true;}],
  ['different device',r=>{r.binding.device.name='invented';}],
  ['compiler input substitution',r=>{r.ledger[0].inputCompilerHash='0'.repeat(64);}],
  ['kernel substitution',r=>{r.ledger[0].gpuTrace.kernelHash='0'.repeat(64);}],
  ['original instruction undercount',r=>{r.ledger[0].gpuTrace.executedInstructions--;}],
  ['fusion hardware count inflation',r=>{r.ledger[0].gpuTrace.instructionCountKind='HARDWARE_INSTRUCTIONS';}],
  ['host compilation claimed as GPU',r=>{r.ledger[0].gpuTrace.compilationOwner='HOST';}],
  ['source provider omitted',r=>{r.ledger[0].gpuTrace.providerCalls=0;}],
  ['output hash substitution',r=>{r.ledger[0].outputHash='0'.repeat(64);}],
  ['device cancellation progress omitted',r=>{r.ledger[r.runtimeControl.cancelled].gpuTransport.progress=[];}],
  ['unobserved timeout exit',r=>{r.ledger[r.runtimeControl.timeout].gpuProcessExit.exitObserved=false;}],
  ['cancel readiness process substitution',r=>{r.runtimeControl.cancelReady.processPid=r.runtimeControl.reset.before.processPid;}],
  ['fresh repair context substitution',r=>{r.trials[0].context=r.trials[1].context;}],
  ['missing generation',r=>{r.generations.pop();}],
])test('rehashing forged GPU '+name+' does not grant K179',async()=>{const r=read();mutate(r);r.reportRoot=evidenceRoot({...r,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(r,inputs));});
