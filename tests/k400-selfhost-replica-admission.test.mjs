import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-replica-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-replica-admission.mjs';
const inputs=validateSelfhostInputs(),read=()=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-replica/general-compiler-replica-distributed-runtime-runtime.json','utf8'));
test('two actual native peers and fail-closed recovery admit K259',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K259']);});
for(const [name,mutate] of [
  ['one-peer quorum',r=>{r.binding.service.quorum=1;}],
  ['peer PID substitution',r=>{r.ledger[0].replicaTrace.peers[1].binding.serverPid++;}],
  ['secondary compiler byte substitution',r=>{r.ledger[0].replicaTrace.peers[1].httpTrace.reply.bytecodeBase64='UkNMQg==';}],
  ['secondary native request substitution',r=>{r.ledger[1].replicaTrace.peers[1].nativeCompilerTrace.metrics.request=1;}],
  ['secondary result disagreement',r=>{r.ledger[r.inputResults[0].executeTrace].replicaTrace.peers[1].result.stateRoot='0'.repeat(64);}],
  ['partial result publication',r=>{r.runtimeControl.peerRecovery.artifactPublished=true;}],
  ['failed peer reported complete',r=>{r.runtimeControl.peerRecovery.partialFailure.replicaTrace.peers[1].status='OK';}],
  ['unclean lost peer exit',r=>{r.runtimeControl.peerRecovery.exit.code=1;}],
  ['replacement context reused',r=>{r.runtimeControl.peerRecovery.replacement.compiler.token=r.runtimeControl.peerRecovery.lost.compiler.token;}],
  ['unclean final compiler exit',r=>{r.shutdown[1].compilerExit.code=1;}],
  ['missing native exit',r=>{r.nativeExits.pop();}],
  ['missing complete generation',r=>{r.generations.pop();}],
])test('rehashing forged replica '+name+' cannot grant K259',async()=>{const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
