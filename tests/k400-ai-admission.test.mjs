import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AI_PROFILES,AI_DIRECTORY} from '../scripts/k400-ai-definitions.mjs';
import {verifyAiProfile} from '../scripts/k400-ai-engine.mjs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
const definition=id=>AI_PROFILES.find(p=>p.id===id),read=id=>JSON.parse(fs.readFileSync(AI_DIRECTORY+'/'+id+'-runtime.json','utf8'));
const rehash=r=>{r.reportRoot=evidenceRoot({...r,generatedAt:undefined,reportRoot:undefined});return r;};
async function reject(edit,id='learning'){const r=read(id);edit(r,r.backends['ai-runtime']);await assert.rejects(verifyAiProfile(definition(id),rehash(r)));}
test('all fourteen frozen native AI profiles admit actual program, training and forward receipts',async()=>{for(const d of AI_PROFILES)assert.equal((await verifyAiProfile(d)).admitted,true);});
test('general competence, action authority and changed native/model identities fail admission',async()=>{
  await reject((_r,b)=>{b.binding.generalAiCompetenceClaimed=true;});await reject((_r,b)=>{b.binding.predictionAuthority='CAN_AUTHORIZE';});await reject((_r,b)=>{b.binding.modelRoot='0'.repeat(64);});await reject((_r,b)=>{b.binding.binary.sha256='0'.repeat(64);});
});
test('training must retain actual native traces, independently matching learned parameters and both toy-task results',async()=>{
  await reject((_r,b)=>{b.binding.training.processTrace.processPid=0;});await reject((_r,b)=>{b.binding.training.model[1][4][1][0]+=1;});await reject((_r,b)=>{b.binding.training.result.state['evaluation.xor_accuracy']=0;});
});
test('forward inference retains exact samples, model roots and independent dense-layer results',async()=>{
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.inference.samples[0]+=1;});await reject((_r,b)=>{b.rounds[0].runtimeTrace.inference.modelRoot='0'.repeat(64);});await reject((_r,b)=>{b.rounds[0].runtimeTrace.inference.result.state['inference.output'][0]=1;});
});
test('prediction output never grants action authority or bypasses source-owned failure settlement',async()=>{
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.inference.authorityGranted=true;});await reject((_r,b)=>{b.runtimeControl.authorityDenied.snapshot.state['result.authority_granted']=true;});
  await reject((_r,b)=>{b.runtimeControl.authorityDenied.settlement.status='not-triggered';});await reject((_r,b)=>{b.runtimeControl.authorityDenied.snapshot.state['request.completed']+=1;});
});
test('source/model/pause rejection, initial model pin and actual controller reset remain mandatory',async()=>{
  await reject((_r,b)=>{b.runtimeControl.replacementDenied=false;});await reject((_r,b)=>{b.runtimeControl.modelRollback.stateRoot='0'.repeat(64);});await reject((_r,b)=>{b.controllerLedger[0].command.inputs['event.model_root']='0'.repeat(64);});
  await reject((_r,b)=>{b.runtimeControl.reset.after.native.processId=b.runtimeControl.reset.before.native.processId;});await reject((_r,b)=>{b.controllerLedger.pop();});
});
test('noncanonical repairs retain every sealed input and the original independent proposal',async()=>{
  await reject((_r,b)=>{const t=b.trials.find(t=>!t.exactCanonicalRestoration);assert.ok(t);t.semanticRepairCases.pop();},'replicated-counter');await reject((_r,b)=>{b.trials[1].proposal.new='sender < 3';},'replicated-counter');
});
test('distributed AI execution must retain real HTTP controls and three advisory-only controller ledgers',async()=>{
  await reject((_r,b)=>{delete b.networkControl;},'replicated-counter');await reject((_r,b)=>{b.networkControl.packets[2].httpStatus=200;},'replicated-counter');await reject((_r,b)=>{b.networkControl.nodeControllerLedgers[0].pop();},'replicated-counter');
});
