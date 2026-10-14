import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from '../scripts/k400-selfhost-realtime-engine.mjs';
import {verifySelfhostProfile} from '../scripts/k400-selfhost-realtime-admission.mjs';
const inputs=validateSelfhostInputs(),read=()=>JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-realtime/general-compiler-realtime-realtime-runtime-runtime.json','utf8'));
test('actual complete compiler under native RCL monotonic soft scheduler admits only K279',async()=>{const result=await verifySelfhostProfile();assert.equal(result.admitted,true);assert.deepEqual(result.eligibleCells,['K279']);});
for(const [name,mutate]of [
  ['controller PID substitution',r=>{r.binding.runtimeOwner.controller.processId++;}],
  ['hard realtime claim',r=>{r.binding.hardRealtimeClaimed=true;}],
  ['fresh compiler token substitution',r=>{r.ledger[0].nativeTrace.args[1]='0'.repeat(36);}],
  ['compiler duplicate metric substitution',r=>{r.ledger[0].metrics.instance++;}],
  ['compiler source root substitution',r=>{r.ledger[0].realtimeTrace.inputRoot=inputs.contract.sourceRoot;}],
  ['native compile omitted',r=>{r.ledger[0].realtimeTrace.nativeCalled=false;}],
  ['native admission omitted',r=>{r.ledger[0].realtimeTrace.entry=null;}],
  ['release timer substitution',r=>{r.ledger[0].realtimeTrace.release++;}],
  ['deadline substitution',r=>{r.ledger[0].realtimeTrace.deadline++;}],
  ['late publication accepted',r=>{r.ledger[0].realtimeTrace.publishedAt=r.ledger[0].realtimeTrace.deadline+1;}],
  ['raw compiler reply substitution',r=>{r.ledger[0].nativeTrace.replyLine='{}';}],
  ['compiler raw stdout substitution',r=>{r.ledger[0].nativeTrace.stdout='';}],
  ['compiler completion omission',r=>{r.ledger[0].realtimeTrace.completion=null;}],
  ['paused compiler invocation',r=>{r.ledger[r.runtimeControl.deniedCompile].realtimeTrace.nativeCalled=true;}],
  ['paused VM invocation',r=>{r.ledger[r.runtimeControl.deniedExecute].realtimeTrace.nativeCalled=true;}],
  ['expired compiler invocation',r=>{r.ledger[r.runtimeControl.expiredBeforeStart].realtimeTrace.nativeCalled=true;}],
  ['compiler timeout without dispatched request',r=>{r.ledger[r.runtimeControl.timeout].nativeTrace.frameSentAt=null;}],
  ['compiler timeout without observed exit',r=>{r.ledger[r.runtimeControl.timeout].nativeTrace.exitObserved=false;}],
  ['compiler deadline stopped early',r=>{const t=r.ledger[r.runtimeControl.timeout];t.nativeTrace.stopRequestedAt=t.realtimeTrace.deadline-1;}],
  ['compiler abort without stop signal',r=>{r.ledger[r.runtimeControl.cancelled].nativeTrace.stopSignalSent=false;}],
  ['compiler abort before actual request',r=>{r.ledger[r.runtimeControl.cancelled].nativeTrace.frameSentAt=r.ledger[r.runtimeControl.cancelled].nativeTrace.stopRequestedAt+1;}],
  ['failed compiler settlement omitted',r=>{r.ledger[r.negativeControls.malformed].realtimeTrace.settlement=null;}],
  ['failed job completion inflation',r=>{r.ledger[r.runtimeControl.timeout].realtimeTrace.snapshot.state['job.completed']++;}],
  ['blocked host heartbeat',r=>{r.runtimeControl.heartbeat=[];}],
  ['clock reversal accepted',r=>{r.runtimeControl.reversal.result.status='realized';}],
  ['denied output publication',r=>{r.runtimeControl.deniedOutputPublished=true;}],
  ['unbounded dispatch',r=>{r.runtimeControl.backpressure.rejected=false;}],
  ['native program source mismatch accepted',r=>{r.ledger[r.runtimeControl.wrongRoot].error.code=null;}],
  ['native VM timeout exit omitted',r=>{r.ledger[r.runtimeControl.executeTimeout].nativeTrace.exitObserved=false;}],
  ['native VM abort reason substitution',r=>{r.ledger[r.runtimeControl.executeCancelled].nativeTrace.stopReason=null;}],
  ['native VM result substitution',r=>{r.ledger[r.inputResults[0].executeTrace].result.state.result++;}],
  ['native exit record omitted',r=>{r.nativeExits.shift();}],
  ['unclean successful compiler exit',r=>{r.ledger[0].nativeTrace.code=1;}],
  ['controller termination unobserved',r=>{r.shutdown.controller.terminationObserved=false;}],
  ['invented controller exit code',r=>{r.shutdown.controller.exitCode=0;}],
  ['missing generation',r=>{r.generations.pop();}],
])test('rehashing forged soft realtime '+name+' cannot grant K279',async()=>{const report=read();mutate(report);report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifySelfhostEnvironment(report,inputs));});
