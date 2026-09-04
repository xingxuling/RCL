import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysicalTimeObservation, verifyPhysicalTimeMonotonicity, createDeadlineInterruptContract, settleDeadlineInterrupt } from '../src/physical-time-protocol.mjs';
import { createExternalAgentIoRequest, settleExternalAgentIo } from '../src/external-agent-io-protocol.mjs';
import { createExternalEffectPlan, authorizeExternalEffect, ExternalEffectSettlementLedger } from '../src/external-effect-protocol.mjs';
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64),E='e'.repeat(64);

test('K331 physical-time observations preserve monotonic clock identity without claiming hard realtime',()=>{
 const a=createPhysicalTimeObservation({clockId:'mono0',providerId:'clock-provider',sampleId:'s1',monotonicNs:'1000',uncertaintyNs:'5',sourceRoot:A});
 const b=createPhysicalTimeObservation({clockId:'mono0',providerId:'clock-provider',sampleId:'s2',monotonicNs:'1500',uncertaintyNs:'5',sourceRoot:B});
 const r=verifyPhysicalTimeMonotonicity(a,b); assert.equal(r.deltaNs,'500');assert.equal(r.hardRealtimeGuaranteed,false);
 assert.throws(()=>verifyPhysicalTimeMonotonicity(b,a),/RCL_TIME_MONOTONICITY_VIOLATION/u);
});

test('K331 deadline/interrupt protocol records measured lateness but does not fabricate timing guarantee',()=>{
 const c=createDeadlineInterruptContract({clockId:'mono0',providerId:'clock-provider',interruptCapability:'timer.fire',target:'job:1',deadlineNs:'1000',jitterBudgetNs:'50',idempotencyKey:'timer:1',authorityRoot:A});
 const r=settleDeadlineInterrupt(c,{contractRoot:c.contractRoot,idempotencyKey:'timer:1',firedAtNs:'1020',receiptRoot:B,status:'FIRED'});
 assert.equal(r.withinDeadline,false);assert.equal(r.withinJitterBudget,true);assert.equal(r.rclExecutedInterrupt,false);assert.equal(r.hardRealtimeGuaranteed,false);
});

test('K334 external agent IO binds provider/model/session/idempotency and forbids effect laundering',()=>{
 const q=createExternalAgentIoRequest({requestId:'q1',agentId:'agent1',providerId:'model-provider',capability:'reasoning.query',inputRoot:A,modelProvenanceRoot:B,idempotencyKey:'q1:once',sessionRoot:C,sequence:1,budget:{maxTokens:1000,maxToolCalls:0}});
 const r=settleExternalAgentIo(q,{requestRoot:q.requestRoot,idempotencyKey:q.idempotencyKey,providerId:q.providerId,modelProvenanceRoot:q.modelProvenanceRoot,responseRoot:D,receiptRoot:E,status:'SUCCESS',nextSessionRoot:A});
 assert.equal(r.externalEffectPerformed,false);assert.equal(r.memoryCommitPerformed,false);assert.equal(r.modelProvenanceRoot,B);
 assert.throws(()=>settleExternalAgentIo(q,{requestRoot:q.requestRoot,idempotencyKey:q.idempotencyKey,providerId:q.providerId,modelProvenanceRoot:q.modelProvenanceRoot,responseRoot:D,receiptRoot:E,status:'SUCCESS',nextSessionRoot:A,externalEffectPerformed:true}),/RCL_AGENT_IO_FORBIDDEN_EFFECT_CLAIM/u);
});

test('K336 external effect protocol requires authorization, kill-switch clearance and provider receipt binding',()=>{
 const p=createExternalEffectPlan({effectId:'deploy:1',providerId:'deploy-provider',capability:'deployment.apply',target:'service:x',inputRoot:A,idempotencyKey:'deploy:once',authorityRoot:B,killSwitchRoot:C,reversible:true,compensationCapability:'deployment.rollback'});
 assert.throws(()=>authorizeExternalEffect(p,{planRoot:p.planRoot,approved:false,approvalRoot:D}),/RCL_EFFECT_APPROVAL_REQUIRED/u);
 assert.throws(()=>authorizeExternalEffect(p,{planRoot:p.planRoot,approved:true,approvalRoot:D,killSwitchActive:true}),/RCL_EFFECT_KILL_SWITCH_ACTIVE/u);
 const a=authorizeExternalEffect(p,{planRoot:p.planRoot,approved:true,approvalRoot:D,killSwitchActive:false});
 const ledger=new ExternalEffectSettlementLedger();
 const r=ledger.settle(p,a,{planRoot:p.planRoot,authorizationRoot:a.authorizationRoot,idempotencyKey:p.idempotencyKey,status:'FAILED',receiptRoot:E,resultRoot:A});
 assert.equal(r.compensationRequired,true);assert.equal(r.rclExecutedEffect,false);assert.equal(r.durableQueueProven,false);
 assert.throws(()=>ledger.settle(p,a,{planRoot:p.planRoot,authorizationRoot:a.authorizationRoot,idempotencyKey:p.idempotencyKey,status:'SUCCESS',receiptRoot:E,resultRoot:A}),/RCL_EFFECT_DUPLICATE_IDEMPOTENCY_KEY/u);
});
