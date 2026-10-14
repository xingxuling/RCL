import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-sqlite-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-sqlite-admission.mjs';
const directory='examples/universal-stress/selfhost-sqlite/',inputs=validateSelfhostInputs(),read=()=>JSON.parse(fs.readFileSync(directory+'general-compiler-sqlite-database-runtime.json','utf8'));
test('actual SQL-function compilation, committed artifacts and rollback/reopen controls admit K159',async()=>{
  const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K159']);assert.equal(result.claims.length,1);
});
for(const [name,mutate] of [
  ['compiler outside SQL callback',r=>{r.binding.compilerLocation='WINDOWS_ONE_SHOT';}],
  ['SQL statement substitution',r=>{r.ledger[0].transaction.sql='SELECT 1';}],
  ['missing SQL invocation',r=>{r.ledger[0].transaction.sqlInvocations=0;}],
  ['native compiler PID substitution',r=>{r.ledger[0].pid++;}],
  ['commit before native exit',r=>{r.ledger[0].nativeCompilerTrace.exitObservedBeforeSqlReturn=false;}],
  ['persisted artifact substitution',r=>{r.ledger[0].transaction.persisted.outputHash='0'.repeat(64);}],
  ['rollback leaves a job',r=>{r.ledger[r.negativeControls.malformed].transaction.after.jobs++;}],
  ['native output mismatch accepted',r=>{r.ledger[r.runtimeControl.compilationRollback].transaction.completion='COMMIT';}],
  ['wrong source root committed',r=>{r.ledger[r.runtimeControl.executionRollback].transaction.persisted={};}],
  ['reopened job substitution',r=>{r.runtimeControl.persistedGeneration.after.inputHash='0'.repeat(64);}],
  ['unclean native exit',r=>{r.nativeExits[0].code=1;}],
  ['missing complete generation',r=>{r.generations.pop();}],
])test('rehashing forged SQLite self-hosting '+name+' cannot grant K159',async()=>{
  const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));
});
