import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-game-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-game-admission.mjs';
const inputs=validateSelfhostInputs(),read=()=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-game/general-compiler-game-game-runtime-runtime.json','utf8'));
test('actual supplied complete compiler and rooted native RCL game frames admit only K199',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K199']);});
for(const [name,mutate]of [
  ['controller PID substitution',r=>{r.binding.game.controller.processId++;}],
  ['compiler token substitution',r=>{r.ledger[0].metrics.token='0'.repeat(36);}],
  ['compiler duplicate metrics substitution',r=>{r.ledger[0].nativeCompilerTrace.metrics.instance++;}],
  ['compile root substitution',r=>{r.ledger[0].compilerGameTrace.inputRoot=inputs.contract.sourceRoot;}],
  ['native preflight omission',r=>{r.ledger[0].compilerGameTrace.preflight=null;}],
  ['preflight scene mutation',r=>{r.controllerLedger[0].after.state['game.frame']++;}],
  ['publication preview omission',r=>{r.ledger[0].compilerGameTrace.publication=null;}],
  ['compiler metric substitution',r=>{r.ledger[0].compilerGameTrace.metrics.bytes++;}],
  ['compiler artifact root substitution',r=>{r.ledger[0].compilerGameTrace.artifactHash='0'.repeat(64);}],
  ['native scene load omission',r=>{r.ledger[0].compilerGameTrace.load=null;}],
  ['compiler frame omission',r=>{r.ledger[0].compilerGameTrace.frames.pop();}],
  ['compiler frame authority substitution',r=>{r.ledger[0].compilerGameTrace.frames[0].commit.transition.actor='ai:predictor';}],
  ['physics substitution',r=>{r.ledger[0].compilerGameTrace.frames[0].snapshot.state['player.y']++;}],
  ['scene projection substitution',r=>{r.ledger[0].compilerGameTrace.frames[0].scene.svg='<svg></svg>';}],
  ['paused compiler invokes native',r=>{r.ledger[r.runtimeControl.deniedCompile].compilerGameTrace.nativeCalled=true;}],
  ['paused native hook invocation',r=>{r.ledger[r.runtimeControl.deniedExecute].executionGameTrace.nativeCalled=true;}],
  ['foreign admission root accepted',r=>{r.ledger[r.runtimeControl.wrongRoot].options.admissionRoot=r.ledger[r.runtimeControl.wrongRoot].compilerGameTrace.before.state['plugin.source_root'];}],
  ['invalid publication accepted',r=>{r.ledger[r.runtimeControl.publicationDenied].compilerGameTrace.publication.status='projected';}],
  ['failed compiler changes scene',r=>{r.ledger[r.negativeControls.malformed].compilerGameTrace.snapshot.state['game.frame']++;}],
  ['denied output publication',r=>{r.runtimeControl.deniedOutputPublished=true;}],
  ['unbounded dispatch',r=>{r.runtimeControl.backpressure.rejected=false;}],
  ['native execute preflight omitted',r=>{r.ledger[r.inputResults[0].executeTrace].executionGameTrace.preflight=null;}],
  ['native hook omission',r=>{r.ledger[r.inputResults[0].executeTrace].runtimeTrace.frames.pop();}],
  ['native hook nonzero exit',r=>{r.ledger[r.inputResults[0].executeTrace].runtimeTrace.frames[0].hookTrace.status=1;}],
  ['native hook source substitution',r=>{r.ledger[r.inputResults[0].executeTrace].runtimeTrace.frames[0].hookSourceRoot='0'.repeat(64);}],
  ['native hook exit omission',r=>{r.nativeExits.shift();}],
  ['unclean compiler exit',r=>{r.shutdown.compiler.code=1;}],
  ['unobserved controller termination',r=>{r.shutdown.controller.terminationObserved=false;}],
  ['invented controller exit code',r=>{r.shutdown.controller.exitCode=0;}],
  ['missing generation',r=>{r.generations.pop();}],
])test('rehashing forged game '+name+' cannot grant K199',async()=>{const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
