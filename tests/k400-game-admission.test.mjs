import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GAME_PROFILES,GAME_DIRECTORY} from '../scripts/k400-game-definitions.mjs';
import {verifyGameProfile} from '../scripts/k400-game-engine.mjs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
const definition=id=>GAME_PROFILES.find(p=>p.id===id),read=id=>JSON.parse(fs.readFileSync(GAME_DIRECTORY+'/'+id+'-runtime.json','utf8'));
const rehash=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});return report;};
async function reject(edit,id='learning'){const report=read(id);edit(report,report.backends['game-runtime']);await assert.rejects(verifyGameProfile(definition(id),rehash(report)));}
test('every frozen native game profile admits exact hooks, complete scene replay and controls',async()=>{
  for(const d of GAME_PROFILES){const r=await verifyGameProfile(d);assert.equal(r.admitted,true);assert.equal(r.eligibleCells.length,d.families.length);}
});
test('relabeling browser or physical timing claims and changing native binding rejects',async()=>{
  await reject((_r,b)=>{b.binding.browserExecutionClaimed=true;});await reject((_r,b)=>{b.binding.physicalTimingClaimed=true;});await reject((_r,b)=>{b.binding.binary.sha256='0'.repeat(64);});
});
test('every real native hook requires a process and unchanged program result binding',async()=>{
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames[0].hookTrace.processPid=0;});await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames[0].hookStateRoot='0'.repeat(64);});
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames.pop();});await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames[0].commit.transition.actor='coordinator';});
});
test('physics, independent metric and native-state scene projection cannot be rehashed away',async()=>{
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames[0].metric+=1;});await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames[0].snapshot.state['player.y']=136;});
  await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames[0].scene.primitives.at(-1).x=200;});await reject((_r,b)=>{b.rounds[0].runtimeTrace.frames[0].sceneHash='0'.repeat(64);});
});
test('paused/foreign/duplicate/invalid-frame rollback and landing are mandatory',async()=>{
  await reject((_r,b)=>{b.runtimeControl.authorityDenied=false;});await reject((_r,b)=>{b.runtimeControl.foreignRollback.stateRoot='0'.repeat(64);});
  await reject((_r,b)=>{b.runtimeControl.duplicate.status='realized';});await reject((_r,b)=>{b.runtimeControl.landing.pop();});await reject((_r,b)=>{b.runtimeControl.landed.state['player.grounded']=false;});
});
test('actual process reset and entire independent controller ledger remain mandatory',async()=>{
  await reject((_r,b)=>{b.runtimeControl.reset.after.native.processId=b.runtimeControl.reset.before.native.processId;});await reject((_r,b)=>{b.controllerLedger.pop();});
  await reject((_r,b)=>{b.controllerLedger[0].command.inputs['event.source_root']='0'.repeat(64);});await reject((_r,b)=>{b.rounds[1].runtimeTrace.nonce=b.rounds[0].runtimeTrace.nonce;});
});
test('noncanonical membership repair must retain every pre-sealed case and original proposal',async()=>{
  await reject((_r,b)=>{const t=b.trials.find(t=>!t.exactCanonicalRestoration);assert.ok(t);t.semanticRepairCases.pop();},'replicated-counter');
  await reject((_r,b)=>{b.trials[1].proposal.new='sender < 3';},'replicated-counter');
});
test('distributed game hooks require real partition/heal packets and three complete scene ledgers',async()=>{
  await reject((_r,b)=>{delete b.networkControl;},'replicated-counter');
  await reject((_r,b)=>{b.networkControl.packets[2].httpStatus=200;},'replicated-counter');
  await reject((_r,b)=>{b.networkControl.nodeControllerLedgers[0].pop();},'replicated-counter');
  await reject((_r,b)=>{b.networkControl.initial[0].runtimeTrace.frames[0].hookTrace.processPid=0;},'replicated-counter');
});
