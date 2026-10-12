import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {verifyFamilyProfile} from '../scripts/k400-new-family-engine.mjs';
import {NEW_FAMILIES,FAMILY_ENVIRONMENTS} from '../scripts/k400-new-family-definitions.mjs';
const definition=id=>NEW_FAMILIES.find(item=>item.id===id);
const receipt=id=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/new-families/'+id+'-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
async function rejects(mutate,id='media'){
  const report=receipt(id);mutate(report);await assert.rejects(()=>verifyFamilyProfile(definition(id),reseal(report)));
}
test('three substantive RCL families admit all twelve actual execution environments',async()=>{
  for(const profile of NEW_FAMILIES){const result=await verifyFamilyProfile(profile);assert.equal(result.admitted,true);assert.equal(result.claims.length,12);assert.deepEqual(Object.keys(receipt(profile.id).backends),FAMILY_ENVIRONMENTS);}
});
test('an omitted environment or substituted target artifact cannot be admitted',async()=>{
  await rejects(r=>delete r.backends.linux);
  await rejects(r=>r.backends['wasm-vm'].binding.binary.path='native/rclvm.exe');
  await rejects(r=>r.backends.android.binding.physicalDeviceClaimed=true);
});
test('cold termination, SQL execution and dataflow bindings cannot be reduced to labels',async()=>{
  for(const mutate of [r=>r.backends.serverless.rounds[0].runtimeTrace.processExited=false,
    r=>r.backends.serverless.rounds[1].runtimeTrace.handlerPid=r.backends.serverless.rounds[0].runtimeTrace.handlerPid,
    r=>r.backends.database.rounds[0].runtimeTrace.sqlInvocations=0,
    r=>r.backends.database.runtimeControl.rollback.after++,
    r=>r.backends['dataflow-runtime'].rounds[0].runtimeTrace.inputHash='0'.repeat(64),
    r=>r.backends['dataflow-runtime'].runtimeControl.backpressureRejected=false])await rejects(mutate);
});
test('embedded reuse, peer recovery and kernel-root controls remain mandatory',async()=>{
  await rejects(r=>r.backends['embedded-runtime'].rounds[1].runtimeTrace.instancePid++);
  await rejects(r=>r.backends['distributed-runtime'].runtimeControl.terminalObserved=false);
  await rejects(r=>r.backends.windows.runtimeControl.wrongRootRejected=false);
});
test('controller receipts must replay commands, source roots and denied dispatch',async()=>{
  await rejects(r=>r.backends['simulation-runtime'].controllerLedger[0].result.transition.actor='outsider');
  await rejects(r=>r.backends['automation-runtime'].runtimeControl.sourceAuthorityDenied=false);
});
test('a rehashed rooted compiler answer still has to match the independent oracle',async()=>{
  await rejects(r=>{
    const row=r.backends.windows.rounds[0],value=structuredClone(r.values[row.valueRef]);
    value.state['result.execution']=[1,999];value.stateRoot=semanticStateRootForAlgorithm(value.state,'rcl.semantic-state-root.v2');
    row.valueRef=evidenceRoot(value);r.values[row.valueRef]=value;row.stateRoot=value.stateRoot;
  },'compiler');
});
test('game transaction actors and foresee-realize continuity are checked',async()=>{
  await rejects(r=>{
    const row=r.backends.windows.rounds[0],value=structuredClone(r.values[row.valueRef]);value.history[0].actor='outsider';
    row.valueRef=evidenceRoot(value);r.values[row.valueRef]=value;
  },'game');
});
test('independent proposals, effective semantic failures and sealed inputs cannot be omitted',async()=>{
  await rejects(r=>r.backends.windows.trials[0].proposal.new='ignored');
  await rejects(r=>r.backends.windows.trials[0].broken={kind:'rejected',code:'NETWORK_TIMEOUT',diagnostic:'timeout'});
  await rejects(r=>r.backends.windows.inputResults.pop());
});
