import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-phase-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-phase-admission.mjs';
const inputs=validateSelfhostInputs(),read=e=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-phase/general-compiler-phase-'+e+'-runtime.json','utf8'));
test('actual native RCL controller admits both complete compiler profiles K359 and K379',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K359','K379']);});
for(const environment of inputs.contract.environments)for(const [name,mutate]of [
  ['controller PID substitution',r=>{r.binding.controller.processId++;}],
  ['controller source substitution',r=>{r.binding.controller.sourceHash='0'.repeat(64);}],
  ['compile root semantic substitution',r=>{r.ledger[0].phaseTrace.root=inputs.contract.sourceRoot;}],
  ['controller completion omission',r=>{r.ledger[0].phaseTrace.completion=null;}],
  ['controller ledger command substitution',r=>{r.controllerLedger[0].command.inputs['event.root']='0'.repeat(64);}],
  ['paused compilation invokes native worker',r=>{r.ledger[r.runtimeControl.deniedCompile].phaseTrace.nativeCalled=true;}],
  ['paused execution invokes native worker',r=>{r.ledger[r.runtimeControl.deniedExecute].phaseTrace.nativeCalled=true;}],
  ['denied output publication',r=>{r.runtimeControl.deniedOutputPublished=true;}],
  ['native failure drops settlement trace',r=>{r.ledger[r.negativeControls.malformed].phaseTrace.snapshot.stateRoot='0'.repeat(64);}],
  ['unbounded flow acceptance',r=>{r.runtimeControl.backpressure.rejected=false;}],
  ['unobserved controller termination',r=>{r.shutdown.controller.terminationObserved=false;}],
  ['invented controller zero exit',r=>{r.shutdown.controller.exitCode=0;}],
  ['unclean compiler exit',r=>{r.shutdown.graph.shutdown[0].compilerExit.code=1;}],
  ['missing complete generation',r=>{r.generations.pop();}],
])test('rehashing forged '+environment+' '+name+' cannot grant self-hosting',async()=>{const report=read(environment);mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
