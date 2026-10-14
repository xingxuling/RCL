import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-rncs-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-rncs-admission.mjs';
import {issueAuthorityDecision,createAuthorityRequest,rootHash} from '../src/vendor/rncs-reality-branch/src/index.mjs';
const inputs=validateSelfhostInputs(),read=()=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-rncs/general-compiler-rncs-rncs-runtime-runtime.json','utf8'));
test('actual complete compiler provider in canonical RNCS candidate workflow admits only K399',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K399']);});
for(const [name,mutate]of [
  ['vendor provenance substitution',r=>{r.binding.vendor.commit='0'.repeat(40);}],
  ['controller PID substitution',r=>{r.binding.phase.controller.processId++;}],
  ['provider invocation omission',r=>{r.ledger[0].rncsTrace.provider=null;}],
  ['preview artifact substitution',r=>{r.ledger[0].rncsTrace.preview.stageTrace.outputHash='0'.repeat(64);}],
  ['primary compiler token substitution',r=>{r.ledger[0].metrics.token='0'.repeat(36);}],
  ['provider compiler token substitution',r=>{r.ledger[0].rncsTrace.provider.stageTrace.nativeCompilerTrace.metrics.token='0'.repeat(36);}],
  ['compile source root substitution',r=>{r.ledger[0].rncsTrace.inputRoot=inputs.contract.sourceRoot;}],
  ['candidate artifact substitution',r=>{r.ledger[0].rncsTrace.after.state.body.artifactHash='0'.repeat(64);r.ledger[0].rncsTrace.after.stateRoot=rootHash(r.ledger[0].rncsTrace.after.state);}],
  ['candidate generation discontinuity',r=>{r.ledger[1].rncsTrace.before.generationRoot='0'.repeat(64);}],
  ['provider receipt substitution',r=>{r.ledger[0].rncsTrace.executionReceipt.step_receipts[0].provider_receipt.controllerRoot='0'.repeat(64);}],
  ['native completion omission',r=>{r.ledger[0].rncsTrace.provider.phaseTrace.completion=null;}],
  ['resealed authority bypass',r=>{const t=r.ledger[0].rncsTrace;t.authorityDecision=issueAuthorityDecision(t.authorityRequest,{decision:'approved',authority_actor:'ai:predictor',reason:t.authorityDecision.reason,conditions:t.authorityDecision.conditions});}],
  ['resealed native authority root substitution',r=>{const t=r.ledger[0].rncsTrace,conditions=structuredClone(t.authorityDecision.conditions);conditions[0].root='0'.repeat(64);t.authorityDecision=issueAuthorityDecision(t.authorityRequest,{decision:'approved',authority_actor:t.authorityDecision.authority_actor,reason:t.authorityDecision.reason,conditions});}],
  ['resealed authority request risk substitution',r=>{const t=r.ledger[0].rncsTrace;t.authorityRequest=createAuthorityRequest(t.proposal,{resolver:'rcl:source-owned-local-admission',risk_class:'production'});}],
  ['rollback provider omission',r=>{r.ledger[r.runtimeControl.rejected[0].index].rncsTrace.rollbacks=0;}],
  ['rollback candidate mutation',r=>{r.ledger[r.runtimeControl.rejected[0].index].rncsTrace.after.generation++;}],
  ['denied merge accepted',r=>{r.ledger[r.runtimeControl.rejected[1].index].error.code=null;}],
  ['stale candidate root accepted',r=>{r.ledger[r.runtimeControl.rejected[2].index].options.currentGenerationRoot=r.runtimeControl.beforeRejected.generationRoot;}],
  ['paused native compiler dispatch',r=>{r.ledger[r.runtimeControl.deniedCompile].rncsTrace.nativeCalled=true;}],
  ['paused native VM dispatch',r=>{r.ledger[r.runtimeControl.deniedExecute].rncsTrace.nativeCalled=true;}],
  ['failed native job settlement omission',r=>{r.ledger[r.negativeControls.malformed].rncsTrace.phaseFailure.settlement=null;}],
  ['denied output publication',r=>{r.runtimeControl.deniedOutputPublished=true;}],
  ['unbounded dispatch',r=>{r.runtimeControl.backpressure.rejected=false;}],
  ['preview VM exit omission',r=>{r.nativeExits.shift();}],
  ['unclean compiler exit',r=>{r.shutdown.graph.shutdown[0].compilerExit.code=1;}],
  ['unobserved controller termination',r=>{r.shutdown.controller.terminationObserved=false;}],
  ['invented controller exit code',r=>{r.shutdown.controller.exitCode=0;}],
  ['missing generation',r=>{r.generations.pop();}],
])test('rehashing forged RNCS '+name+' cannot grant K399',async()=>{const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
