import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-embedded-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-embedded-admission.mjs';
const directory='examples/universal-stress/selfhost-embedded/',inputs=validateSelfhostInputs();
const read=()=>JSON.parse(fs.readFileSync(directory+'general-compiler-embedded-embedded-runtime-runtime.json','utf8'));
test('complete embedded compiler has twenty real generations, sealed native programs, fresh repairs and clean C ABI lifecycle',async()=>{
  const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K299']);assert.equal(result.claims.length,1);
});
for(const [name,mutate] of [
  ['one-shot compiler substitution',r=>{r.binding.compilerLocation='WINDOWS_ONE_SHOT';}],
  ['compiler native PID substitution',r=>{r.ledger[0].pid++;}],
  ['compiler wire reply substitution',r=>{r.ledger[0].nativeCompilerTrace.replyLine='{}';}],
  ['compiler request substitution',r=>{r.ledger[1].nativeCompilerTrace.metrics.request=1;}],
  ['different compiler instances across generations',r=>{r.ledger[1].nativeCompilerTrace.instance++;}],
  ['native VM result substitution',r=>{r.ledger[r.inputResults[0].executeTrace].result.state.result=999;}],
  ['VM reset substitution',r=>{r.ledger[r.runtimeControl.next].nativeVmTrace.command='RUN';}],
  ['recovery substitution',r=>{r.runtimeControl.recovery=0;}],
  ['unclean native exit',r=>{r.nativeExits[0].code=1;}],
  ['missing native exit',r=>{r.nativeExits.pop();}],
  ['missing generation',r=>{r.generations.pop();}],
  ['missing gate',r=>{r.gates.EXECUTE='UNTESTED';}],
])test('rehashing forged embedded self-hosting '+name+' cannot grant PASS',async()=>{
  const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));
});
