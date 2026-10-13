import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCIENTIFIC_PROFILES,SCIENTIFIC_DIRECTORY} from '../scripts/k400-scientific-definitions.mjs';
import {verifyScientificProfile} from '../scripts/k400-scientific-engine.mjs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
const definition=id=>SCIENTIFIC_PROFILES.find(p=>p.id===id),read=id=>JSON.parse(fs.readFileSync(SCIENTIFIC_DIRECTORY+'/'+id+'-runtime.json','utf8'));
const rehash=r=>{r.reportRoot=evidenceRoot({...r,generatedAt:undefined,reportRoot:undefined});return r;};
async function reject(edit,id='learning'){const r=read(id);edit(r,r.backends['scientific-runtime']);await assert.rejects(verifyScientificProfile(definition(id),rehash(r)));}
test('all fourteen frozen scientific profiles admit actual numerical execution and independent worker evidence',async()=>{for(const d of SCIENTIFIC_PROFILES)assert.equal((await verifyScientificProfile(d)).admitted,true);});
test('changing numeric ownership, tolerance, actual modules or kernel identity rejects',async()=>{
  await reject((_r,b)=>{b.binding.numericalOwner='NUMPY';});await reject((_r,b)=>{b.binding.tolerance=1;});await reject((_r,b)=>{b.binding.observer.modules[0].sha256='0'.repeat(64);});await reject((_r,b)=>{b.binding.kernel.sha256='0'.repeat(64);});
});
test('native program and numerical analysis require actual process traces and exact input identity',async()=>{
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.programTrace.processPid=0;});await reject((_r,b)=>{b.rounds[0].runtimeTrace.analysis.processTrace.status=1;});
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.analysis.samples[0]+=1;});await reject((_r,b)=>{b.rounds[0].runtimeTrace.analysis.vectorHash='0'.repeat(64);});
});
test('fabricated independent results or omitted observations fail their separate numerical oracle',async()=>{
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.analysis.independent.result.variance+=1;});await reject((_r,b)=>{b.rounds[0].runtimeTrace.analysis.independent.processPid=0;});
  await reject((_r,b)=>{b.observerRecords.pop();});await reject((_r,b)=>{b.rounds[0].runtimeTrace.analysis.maxError=1;});
});
test('source-owned publication and failed numeric-mutant settlement remain mandatory',async()=>{
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.completion.transition.actor='coordinator';});await reject((_r,b)=>{b.runtimeControl.mismatch.analysis.maxError=0;});
  await reject((_r,b)=>{b.runtimeControl.mismatch.snapshot.state['experiment.completed']+=1;});await reject((_r,b)=>{b.runtimeControl.mismatch.settlement.status='not-triggered';});
});
test('pause/empty-input rollback, actual controller reset and observed worker exit cannot be omitted',async()=>{
  await reject((_r,b)=>{b.runtimeControl.empty.status='realized';});await reject((_r,b)=>{b.runtimeControl.pausedRollback.stateRoot='0'.repeat(64);});
  await reject((_r,b)=>{b.runtimeControl.reset.after.native.processId=b.runtimeControl.reset.before.native.processId;});await reject((_r,b)=>{b.observerExit.exitObserved=false;});await reject((_r,b)=>{b.controllerLedger.pop();});
});
test('noncanonical Boolean and membership repairs retain every sealed case and original proposal',async()=>{
  for(const id of ['relations','replicated-counter'])await reject((_r,b)=>{const t=b.trials.find(t=>!t.exactCanonicalRestoration);assert.ok(t);t.semanticRepairCases.pop();},id);
  await reject((_r,b)=>{b.trials[1].proposal.new='sender < 3';},'replicated-counter');
});
test('distributed scientific execution retains real HTTP controls and all three observer exits',async()=>{
  await reject((_r,b)=>{delete b.networkControl;},'replicated-counter');await reject((_r,b)=>{b.networkControl.packets[2].httpStatus=200;},'replicated-counter');
  await reject((_r,b)=>{b.networkControl.nodeObserverExits[1].exitObserved=false;},'replicated-counter');await reject((_r,b)=>{b.networkControl.nodeControllerLedgers[0].pop();},'replicated-counter');
});
