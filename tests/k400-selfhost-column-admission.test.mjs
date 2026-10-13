import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-column-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-column-admission.mjs';
const inputs=validateSelfhostInputs(),file='examples/universal-stress/selfhost-columns/general-compiler-columns-windows-runtime.json';
const receipt=()=>JSON.parse(fs.readFileSync(file,'utf8'));
test('actual Windows compiler generations, sealed programs and fresh repairs pass independent admission',async()=>{await verifySelfhostEnvironment(receipt(),inputs);});
for(const[name,mutate]of [
  ['generation output',r=>{r.ledger[r.generations[4].trace].outputHash='0'.repeat(64);}],
  ['compiler input',r=>{r.ledger[r.generations[4].trace].inputCompilerHash='0'.repeat(64);}],
  ['process exit',r=>{r.ledger[0].exitObserved=false;}],
  ['stdout binding',r=>{r.ledger[0].stdoutHash='0'.repeat(64);}],
  ['acquisition path identity',r=>{r.binding.acquisitionRoot='C:\\forged-workspace';}],
  ['runtime command identity',r=>{r.ledger[0].command='C:\\forged-workspace\\rclc.exe';}],
  ['sealed state',r=>{r.ledger[r.inputResults[0].executeTrace].result.state.result=999;}],
  ['repair proposal',r=>{r.trials[0].proposal.new='';}],
  ['mutant effectiveness',r=>{r.ledger[r.trials[0].brokenCompile].outputHash=r.ledger[r.inputResults[0].compileTrace].outputHash;}],
  ['missing gate',r=>{r.gates.ROBUST='UNTESTED';}],
])test('rehashing cannot admit forged '+name,async()=>{const report=receipt();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
test('a rooted partial index cannot admit the full frozen environment profile',async()=>{
  const index={format:'rcl.k400-selfhost-index.v1',contractRoot:inputs.contract.contractRoot,eligibleCells:inputs.contract.eligibleCells,receipts:[],admissionBindings:[]};index.reportRoot=evidenceRoot(index);await assert.rejects(()=>verifySelfhostProfile(index));
});
