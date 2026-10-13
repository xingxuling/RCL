import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {verifyUiEnvironment,verifyUiProfile} from '../scripts/k400-ui-engine.mjs';
import {verifyUiFlow} from '../scripts/k400-ui-traces.mjs';
import {validateUiInputs} from '../scripts/k400-ui-engine.mjs';
import {verifyUiControllerRole} from '../scripts/k400-ui-admission.mjs';
import {verifyUiSourceBinding} from '../scripts/k400-ui-source-bindings.mjs';
const directory='examples/universal-stress/ui-native/',inputs=validateUiInputs();
const read=f=>JSON.parse(fs.readFileSync(directory+f,'utf8'));
test('twenty real Windows UI flows pass rooted independent admission',async()=>{
  await verifyUiEnvironment(read('governed-counter-windows-runtime.json'),inputs);
});
for(const[name,mutate]of [
  ['native state',f=>{f.records[1].nativeResult.state['ui.state.count']=999;}],
  ['DOM label',f=>{f.steps[1].rendered.CounterText.text='伪造显示';}],
  ['authority witness',f=>{f.records[1].nativeResult.history[0].authority.needs=[];}],
  ['stale-root rejection',f=>{f.control.stale.status=200;}],
  ['browser fallback',f=>{f.driverBinding.browserPlugin='SIMULATED';}],
  ['mobile layout',f=>{f.control.mobile.rendered.ResetButton.rect.height=12;}],
  ['screenshot binding',f=>{f.control.screenshot.sha256='0'.repeat(64);}],
])test('forged '+name+' cannot be admitted',async()=>{
  const flow=read('governed-counter-windows-runtime.json').rounds[0].flow;mutate(flow);
  await assert.rejects(()=>verifyUiFlow(flow,inputs.source,inputs.contract,{controls:true}));
});
test('all nine gates remain non-compensatory after rehashing',async()=>{
  const report=read('governed-counter-windows-runtime.json');report.gates.EXECUTE='UNTESTED';report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});
  await assert.rejects(()=>verifyUiEnvironment(report,inputs));
});
test('a rooted partial UI index cannot create nineteen target claims',async()=>{
  const index={format:'rcl.k400-ui-index.v1',contractRoot:inputs.contract.contractRoot,eligibleCells:inputs.contract.eligibleCells,receipts:[]};index.reportRoot=evidenceRoot(index);
  await assert.rejects(()=>verifyUiProfile(index));
});
test('a valid controller from another role cannot impersonate the selected target',()=>{
  assert.throws(()=>verifyUiControllerRole('simulation-runtime',{controller:{sourcePath:'examples/runtime-hosts/automation-gate.rcl'}}));
  assert.throws(()=>verifyUiControllerRole('windows',{controller:{sourcePath:'examples/runtime-hosts/automation-gate.rcl'}}));
  verifyUiControllerRole('rncs-runtime',{controller:{sourcePath:'examples/runtime-hosts/automation-gate.rcl'}});
});
test('historical verifier provenance cannot admit changed runtime sources or arbitrary verifier bytes',()=>{
  assert.throws(()=>verifyUiSourceBinding({path:'src/ui/native-event-runtime.mjs',sha256:'abe2df2b2d781639b69651c897da7b046b9716ca71b45d6bf4f98dec292b91df'}));
  assert.throws(()=>verifyUiSourceBinding({path:'scripts/k400-ui-traces.mjs',sha256:'0'.repeat(64)}));
});
test('successful RNCS UI execution cannot drop its controller ledger',async()=>{
  const flow=read('governed-counter-rncs-runtime-runtime.json').rounds[0].flow;flow.controllerLedger=[];
  await assert.rejects(()=>verifyUiFlow(flow,inputs.source,inputs.contract,{controls:true}));
});
