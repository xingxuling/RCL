import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateUiInputs,verifyUiEnvironment,verifyUiProfile} from '../scripts/k400-mobile-engine.mjs';
import {verifyMobileFlow} from '../scripts/k400-mobile-traces.mjs';
import {MOBILE_PROFILE,MOBILE_DIRECTORY} from '../scripts/k400-mobile-definitions.mjs';

const inputs=validateUiInputs();
const historicalPath=MOBILE_DIRECTORY+'/acquisition-before-async-driver/native-counter-server-runtime.json';
const receipt=()=>JSON.parse(fs.readFileSync(historicalPath,'utf8'));
const currentEnvironments=MOBILE_PROFILE.environments.filter(environment=>fs.existsSync(MOBILE_DIRECTORY+'/native-counter-'+environment+'-runtime.json'));

for(const environment of currentEnvironments)test('twenty real Android native-touch flows preserve '+environment+' RCL semantics and independent repairs',async()=>{
  const report=JSON.parse(fs.readFileSync('examples/universal-stress/mobile-native/native-counter-'+environment+'-runtime.json','utf8'));
  await verifyUiEnvironment(report,inputs);
});

test('historical native flow semantics remain verifiable while stale acquisition policies receive no current admission',async()=>{
  const report=receipt();await verifyMobileFlow(report.rounds[0].flow,inputs.source,inputs.contract,{controls:true});
  await assert.rejects(()=>verifyUiEnvironment(report,inputs));
});

for(const[name,mutate]of [
  ['native state',f=>{f.records[1].nativeResult.state['ui.state.count']=999;}],
  ['visible native label',f=>{f.steps[1].frame.views.CounterText.text='伪造显示';}],
  ['authority witness',f=>{f.records[1].nativeResult.history[0].authority.needs=[];}],
  ['touch outside the actual button',f=>{f.steps[0].tap.x=0;}],
  ['installed APK',f=>{f.appBinding.installedApk.sha256='0'.repeat(64);}],
  ['WebView substitution',f=>{f.appBinding.webViewUsed=true;}],
  ['stale-root admission',f=>{f.control.stale.status=200;}],
  ['rotation state loss',f=>{f.control.rotated.frame.snapshot.stateRoot='0'.repeat(64);}],
  ['fake process restart',f=>{f.control.restarted.pid=f.control.rotated.frame.pid;}],
  ['raw hierarchy replacement',f=>{f.initialHierarchy.xml='<hierarchy/>';}],
  ['screenshot substitution',f=>{f.control.screenshot.sha256='0'.repeat(64);}],
])test('forged '+name+' cannot receive mobile admission',async()=>{
  const flow=receipt().rounds[0].flow;mutate(flow);
  await assert.rejects(()=>verifyMobileFlow(flow,inputs.source,inputs.contract,{controls:true}));
});

test('rehashing does not compensate for a missing K400 gate',{skip:currentEnvironments.length===0?'Fresh acquisition is still running; a current receipt is required to isolate gate rejection':false},async()=>{
  const report=JSON.parse(fs.readFileSync(MOBILE_DIRECTORY+'/native-counter-'+currentEnvironments[0]+'-runtime.json','utf8'));report.gates.EXECUTE='UNTESTED';
  report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});
  await assert.rejects(()=>verifyUiEnvironment(report,inputs));
});

test('a rooted partial mobile index cannot claim nineteen environments',async()=>{
  const index={format:'rcl.k400-mobile-index.v1',contractRoot:inputs.contract.contractRoot,eligibleCells:inputs.contract.eligibleCells,receipts:[]};
  index.reportRoot=evidenceRoot(index);
  await assert.rejects(()=>verifyUiProfile(index));
});
