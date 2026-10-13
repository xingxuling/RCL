import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateUiInputs,verifyUiEnvironment,verifyUiProfile} from '../scripts/k400-gpu-mobile-engine.mjs';
import {verifyMobileFlow} from '../scripts/k400-gpu-mobile-traces.mjs';
const directory='examples/universal-stress/gpu-mobile/',inputs=validateUiInputs();
const receipt=()=>JSON.parse(fs.readFileSync(directory+'gpu-text-counter-gpu-runtime.json','utf8'));
test('actual GPU Android native counter admits frozen flows, lifecycle and unchanged fresh repairs',async()=>{
  const admission=await verifyUiProfile();assert.equal(admission.admitted,true);assert.deepEqual(admission.eligibleCells,['K165']);assert.equal(admission.claims.length,1);
});
for(const [name,mutate] of [
  ['CPU execution substitution',f=>{f.records[1].runtime.gpuTrace.cpuExecutionFallback=true;}],
  ['GPU kernel substitution',f=>{f.records[1].runtime.gpuTrace.kernelHash='0'.repeat(64);}],
  ['visible native label',f=>{f.steps[1].frame.views.CounterText.text='伪造显示';}],
  ['primary acquisition device substitution',f=>{f.appBinding.serial='emulator-5554';}],
  ['screenshot geometry substitution',f=>{f.control.screenshot.base64=Buffer.from('invalid png').toString('base64');}],
  ['state loss after rotation',f=>{f.control.rotated.frame.snapshot.stateRoot='0'.repeat(64);}],
  ['fake process restart',f=>{f.control.restarted.pid=f.control.rotated.frame.pid;}],
])test('forged GPU mobile '+name+' cannot be admitted',async()=>{
  const flow=receipt().rounds[0].flow;mutate(flow);await assert.rejects(()=>verifyMobileFlow(flow,inputs.source,inputs.contract,{controls:true}));
});
test('rehashing GPU mobile evidence cannot compensate for a missing gate',async()=>{
  const report=receipt();report.gates.EXECUTE='UNTESTED';report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifyUiEnvironment(report,inputs));
});
test('a rooted empty GPU mobile index cannot claim K165',async()=>{
  const index={format:'rcl.k400-mobile-index.v1',contractRoot:inputs.contract.contractRoot,eligibleCells:inputs.contract.eligibleCells,receipts:[],admissionBindings:[]};index.reportRoot=evidenceRoot(index);await assert.rejects(()=>verifyUiProfile(index));
});
