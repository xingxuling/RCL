import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-http-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-http-admission.mjs';
const directory='examples/universal-stress/selfhost-http/',inputs=validateSelfhostInputs();
const read=()=>JSON.parse(fs.readFileSync(directory+'general-compiler-http-server-runtime.json','utf8'));
test('actual HTTP worker admits complete compiler generations, sealed programs, unchanged fresh repairs and denied requests',async()=>{
  const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K119']);assert.equal(result.claims.length,1);
});
for(const [name,mutate] of [
  ['local one-shot substitution',r=>{r.binding.compilerLocation='WINDOWS_ONE_SHOT';}],
  ['worker PID substitution',r=>{r.binding.service.serverPid++;}],
  ['native compiler PID substitution',r=>{r.ledger[0].pid++;}],
  ['HTTP route substitution',r=>{r.ledger[0].httpTrace.route='/execute';}],
  ['HTTP reply substitution',r=>{r.ledger[0].httpTrace.reply.serverPid++;}],
  ['returned compiler artifact substitution',r=>{r.ledger[0].httpTrace.reply.bytecodeBase64='UkNMQg==';}],
  ['native compiler request substitution',r=>{r.ledger[1].nativeCompilerTrace.metrics.request=1;}],
  ['native wire reply substitution',r=>{r.ledger[0].nativeCompilerTrace.replyLine='{}';}],
  ['unauthorized request acceptance',r=>{r.runtimeControl.unauthorized.status=200;}],
  ['missing recovery',r=>{r.runtimeControl.recovery=0;}],
  ['unclean server exit',r=>{r.nativeExits.find(e=>e.kind==='server').code=1;}],
  ['missing complete generation',r=>{r.generations.pop();}],
])test('rehashing forged HTTP self-hosting '+name+' cannot grant K119',async()=>{
  const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));
});
