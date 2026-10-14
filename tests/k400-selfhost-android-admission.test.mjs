import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-android-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-android-admission.mjs';
const directory='examples/universal-stress/selfhost-android/',inputs=validateSelfhostInputs();
const read=()=>JSON.parse(fs.readFileSync(directory+'general-compiler-android-android-runtime.json','utf8'));
test('Android actually self-compiles the complete compiler twenty generations with sealed programs and fresh repairs',async()=>{
  const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K099']);assert.equal(result.claims.length,1);
});
for(const [name,mutate] of [
 ['host compiler substitution',r=>{r.ledger[0].command='native/rclc.exe';}],
 ['primary mobile acquisition device substitution',r=>{r.binding.device.serial='emulator-5554';}],
 ['compiler transfer substitution',r=>{const t=r.ledger[0],c=r.adbCommands.slice(t.adbRange.start,t.adbRange.end).find(c=>c.args[2]==='push');c.args[4]=r.binding.remoteRoot+'/replacement.rbc';}],
 ['native PID substitution',r=>{r.ledger[0].pid++;}],
 ['output hash substitution',r=>{r.ledger[0].remoteOutputHash='0'.repeat(64);}],
 ['missing generation',r=>{r.generations.pop();}],
 ['duplicate compiler request',r=>{r.ledger[1].nonce=r.ledger[0].nonce;}],
 ['compiler instruction substitution',r=>{r.ledger[0].metrics.executedInstructions=1;}],
 ['state substitution',r=>{const t=r.ledger[r.inputResults[0].executeTrace];t.result.state.result=999;}],
 ['missing K400 gate',r=>{r.gates.EXECUTE='UNTESTED';}],
])test('forged Android self-hosting '+name+' cannot pass after rehashing',async()=>{
  const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));
});
test('a rooted empty Android self-hosting index cannot claim K099',async()=>{
  const index={format:'rcl.k400-selfhost-index.v1',contractRoot:inputs.contract.contractRoot,eligibleCells:['K099'],receipts:[],admissionBindings:[]};index.reportRoot=evidenceRoot(index);await assert.rejects(()=>verifySelfhostProfile(index));
});
