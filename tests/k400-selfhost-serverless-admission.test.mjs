import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-serverless-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-serverless-admission.mjs';
const directory='examples/universal-stress/selfhost-serverless/',inputs=validateSelfhostInputs();
const read=()=>JSON.parse(fs.readFileSync(directory+'general-compiler-serverless-serverless-runtime.json','utf8'));
test('actual cold handlers admit complete compiler generations and unchanged fresh repairs for K139',async()=>{
  const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K139']);assert.equal(result.claims.length,1);
});
for(const [name,mutate] of [
  ['warm reuse claim',r=>{r.binding.service.warmReuse=true;}],
  ['reused invocation',r=>{r.ledger[1].coldInvocation.id=r.ledger[0].coldInvocation.id;}],
  ['reused compiler context',r=>{r.ledger[1].coldInvocation.service.compiler.token=r.ledger[0].coldInvocation.service.compiler.token;}],
  ['worker PID substitution',r=>{r.ledger[0].coldInvocation.service.serverPid++;}],
  ['missing exit barrier',r=>{r.ledger[0].coldInvocation.exitObservedBeforeResult=false;}],
  ['unclean worker exit',r=>{r.ledger[0].coldInvocation.exit.code=1;}],
  ['unclean compiler exit after rejection',r=>{r.ledger[r.negativeControls.corruptCompiler].coldInvocation.exit.compilerExit.code=1;}],
  ['missing native exit',r=>{r.nativeExits.pop();}],
  ['returned compiler artifact substitution',r=>{r.ledger[0].httpTrace.reply.bytecodeBase64='UkNMQg==';}],
  ['unauthorized acceptance',r=>{r.runtimeControl.denied.unauthorized.status=200;}],
  ['missing complete generation',r=>{r.generations.pop();}],
])test('rehashing forged cold self-hosting '+name+' cannot grant K139',async()=>{
  const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));
});
