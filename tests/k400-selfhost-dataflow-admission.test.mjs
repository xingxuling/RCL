import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-dataflow-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-dataflow-admission.mjs';
const inputs=validateSelfhostInputs(),read=()=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-dataflow/general-compiler-dataflow-dataflow-runtime-runtime.json','utf8'));
test('actual two-stage compiler graph and fresh repairs admit K319',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K319']);});
for(const [name,mutate] of [
  ['single stage substitution',r=>{r.binding.service.stages[1].threadId=r.binding.service.stages[0].threadId;}],
  ['stage role substitution',r=>{r.ledger[0].stageTrace.role='execute';}],
  ['compiler PID substitution',r=>{r.ledger[0].pid++;}],
  ['native invocation omission',r=>{r.ledger[0].stageTrace.nativeCalled=false;}],
  ['unlinked sealed execution',r=>{r.ledger[r.inputResults[0].executeTrace].stageTrace.fromCompile=null;}],
  ['transferred artifact substitution',r=>{r.ledger[r.inputResults[0].executeTrace].stageTrace.fromCompile.artifactHash='0'.repeat(64);}],
  ['flow identity substitution',r=>{r.ledger[r.inputResults[0].executeTrace].stageTrace.flowId='0'.repeat(36);}],
  ['bad input executed natively',r=>{r.runtimeControl.inputRejection.stageTrace.nativeCalled=true;}],
  ['unbounded flow acceptance',r=>{r.runtimeControl.backpressure.rejected=false;}],
  ['unclean compiler exit',r=>{r.shutdown.shutdown[0].compilerExit.code=1;}],
  ['unclean stage exit',r=>{r.shutdown.exits[0].code=1;}],
  ['missing generation',r=>{r.generations.pop();}],
])test('rehashing forged dataflow '+name+' cannot grant K319',async()=>{const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
