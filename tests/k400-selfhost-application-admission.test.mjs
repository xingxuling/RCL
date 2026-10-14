import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-application-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-application-admission.mjs';
const inputs=validateSelfhostInputs(),read=e=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-application/general-compiler-application-'+e+'-runtime.json','utf8'));
test('actual complete compiler in native advisory AI and independent scientific workflows admits K239/K219',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K239','K219']);});
for(const environment of inputs.contract.environments)for(const [name,mutate]of [
  ['controller PID substitution',r=>{r.binding.workflow.controller.processId++;}],
  ['compiler token substitution',r=>{r.ledger[0].metrics.token='0'.repeat(36);}],
  ['compile root semantic substitution',r=>{r.ledger[0].workflowTrace.inputRoot=inputs.contract.sourceRoot;}],
  ['compiler metric feature substitution',r=>{r.ledger[0].workflowTrace.observation.samples[0]=0;}],
  ['native observation omission',r=>{r.ledger[0].workflowTrace.observation=null;}],
  ['controller completion omission',r=>{r.ledger[0].workflowTrace.completion=null;}],
  ['controller ledger root substitution',r=>{r.controllerLedger[r.ledger[0].workflowTrace.ledgerRange.start].command.inputs['event.source_root']='0'.repeat(64);}],
  ['paused compiler invokes native',r=>{r.ledger[r.runtimeControl.deniedCompile].workflowTrace.nativeCalled=true;}],
  ['paused execution invokes native',r=>{r.ledger[r.runtimeControl.deniedExecute].applicationTrace.nativeCalled=true;}],
  ['invalid publication accepted',r=>{r.ledger[r.runtimeControl.publicationDenied].error.code=null;}],
  ['failed compiler settlement omitted',r=>{r.ledger[r.negativeControls.malformed].workflowTrace.settlement=null;}],
  ['denied output publication',r=>{r.runtimeControl.deniedOutputPublished=true;}],
  ['unbounded flow',r=>{r.runtimeControl.backpressure.rejected=false;}],
  ['unclean compiler exit',r=>{r.shutdown.compiler.code=1;}],
  ['unobserved controller termination',r=>{r.shutdown.controller.terminationObserved=false;}],
  ['invented controller zero exit',r=>{r.shutdown.controller.exitCode=0;}],
  ['missing generation',r=>{r.generations.pop();}],
])test('rehashing forged '+environment+' '+name+' cannot grant complete compiler credit',async()=>{const report=read(environment);mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
for(const [name,mutate]of [
  ['observer PID substitution',r=>{r.ledger[0].workflowTrace.observation.independent.processPid++;}],
  ['observer result substitution',r=>{r.ledger[0].workflowTrace.observation.independent.result.mean++;}],
  ['observer ledger omission',r=>{r.observerRecords.pop();}],
  ['unclean observer exit',r=>{r.shutdown.observer.code=1;}],
])test('rehashing forged scientific '+name+' cannot grant K219',async()=>{const report=read('scientific-runtime');mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
for(const [name,mutate]of [
  ['foreign model compiler entry',r=>{r.ledger[r.runtimeControl.wrongModel].workflowTrace.nativeCalled=true;}],
  ['predictor authority substitution',r=>{r.ledger[0].workflowTrace.observation.authorityGranted=true;}],
  ['model parameter substitution',r=>{r.binding.workflow.training.model[1][4][1][0]++;}],
])test('rehashing forged advisory AI '+name+' cannot grant K239',async()=>{const report=read('ai-runtime');mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
