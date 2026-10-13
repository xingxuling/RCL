import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateUiInputs,verifyUiEnvironment,verifyUiProfile} from '../scripts/k400-gpu-ui-engine.mjs';
import {verifyUiFlow} from '../scripts/k400-gpu-ui-traces.mjs';
const directory='examples/universal-stress/gpu-ui/',inputs=validateUiInputs();
const receipt=()=>JSON.parse(fs.readFileSync(directory+'gpu-text-counter-gpu-runtime.json','utf8'));
test('actual GPU counter GUI/Web admits all frozen flows and three fresh repairs',async()=>{
  const admission=await verifyUiProfile();assert.equal(admission.admitted,true);assert.deepEqual(admission.eligibleCells,['K163','K164']);assert.equal(admission.claims.length,2);
});
for(const [name,mutate] of [
  ['CPU execution substitution',f=>{f.records[1].runtime.gpuTrace.cpuExecutionFallback=true;}],
  ['GPU kernel substitution',f=>{f.records[1].runtime.gpuTrace.kernelHash='0'.repeat(64);}],
  ['host-only execution trace',f=>{f.records[1].runtime.gpuTrace.openclCalls.clEnqueueNDRangeKernel=0;}],
  ['device substitution',f=>{f.targetBinding.device.deviceName='replacement';}],
  ['unbound dynamic Text arena',f=>{f.records[1].runtime.gpuTrace.textArenaCapacity=1;}],
  ['native state',f=>{f.records[1].nativeResult.state['ui.state.count']=999;}],
  ['DOM label',f=>{f.steps[1].rendered.CounterText.text='伪造显示';}],
  ['authority witness',f=>{f.records[1].nativeResult.history[0].authority.needs=[];}],
  ['stale-root rejection',f=>{f.control.stale.status=200;}],
  ['browser simulation',f=>{f.driverBinding.browserPlugin='SIMULATED';}],
])test('forged GPU UI '+name+' cannot be admitted',async()=>{
  const flow=receipt().rounds[0].flow;mutate(flow);await assert.rejects(()=>verifyUiFlow(flow,inputs.source,inputs.contract,{controls:true}));
});
test('rehashing a GPU UI receipt cannot compensate for a missing gate',async()=>{
  const report=receipt();report.gates.EXECUTE='UNTESTED';report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifyUiEnvironment(report,inputs));
});
test('a rooted empty GPU UI index cannot claim GUI and Web',async()=>{
  const index={format:'rcl.k400-ui-index.v1',contractRoot:inputs.contract.contractRoot,eligibleCells:inputs.contract.eligibleCells,receipts:[],admissionBindings:[]};index.reportRoot=evidenceRoot(index);await assert.rejects(()=>verifyUiProfile(index));
});
