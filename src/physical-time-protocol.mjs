import { realityRoot } from './canonical.mjs';

export const RCL_PHYSICAL_TIME_PROTOCOL_VERSION = '0.1.0-candidate.1';
const SHA = /^[0-9a-f]{64}$/u;
const UINT = /^(0|[1-9][0-9]*)$/u;
function text(v,c){if(typeof v!=='string'||!v.trim())throw new TypeError(c);return v.trim();}
function root(v,c){if(typeof v!=='string'||!SHA.test(v))throw new TypeError(c);return v;}
function uint(v,c){const s=typeof v==='bigint'?v.toString():String(v??'');if(!UINT.test(s))throw new TypeError(c);return s;}
function big(v){return BigInt(v);}

export function createPhysicalTimeObservation(input={}) {
  const core={
    format:'rcl.physical-time-observation.v0.1',version:RCL_PHYSICAL_TIME_PROTOCOL_VERSION,
    clockId:text(input.clockId,'RCL_TIME_CLOCK_ID_REQUIRED'),
    providerId:text(input.providerId,'RCL_TIME_PROVIDER_ID_REQUIRED'),
    sampleId:text(input.sampleId,'RCL_TIME_SAMPLE_ID_REQUIRED'),
    monotonicNs:uint(input.monotonicNs,'RCL_TIME_MONOTONIC_NS_INVALID'),
    uncertaintyNs:uint(input.uncertaintyNs??'0','RCL_TIME_UNCERTAINTY_NS_INVALID'),
    sourceRoot:root(input.sourceRoot,'RCL_TIME_SOURCE_ROOT_INVALID'),
    wallTime:input.wallTime==null?null:text(input.wallTime,'RCL_TIME_WALL_TIME_INVALID'),
    authority:'OBSERVATION_ONLY',
    physicalTimeCommitPerformed:false,
    canonicalPromotionPerformed:false,
  };
  return Object.freeze({...core,observationRoot:realityRoot(core)});
}

export function verifyPhysicalTimeMonotonicity(previous,next){
  if(!previous||!next)throw new TypeError('RCL_TIME_OBSERVATIONS_REQUIRED');
  if(previous.clockId!==next.clockId||previous.providerId!==next.providerId)throw new Error('RCL_TIME_CLOCK_IDENTITY_DRIFT');
  if(big(next.monotonicNs)<big(previous.monotonicNs))throw new Error('RCL_TIME_MONOTONICITY_VIOLATION');
  const core={format:'rcl.physical-time-monotonicity-receipt.v0.1',clockId:next.clockId,providerId:next.providerId,
    previousRoot:previous.observationRoot,nextRoot:next.observationRoot,deltaNs:(big(next.monotonicNs)-big(previous.monotonicNs)).toString(),
    monotonic:true,hardRealtimeGuaranteed:false,distributedConsensusProven:false,canonicalPromotionPerformed:false};
  return Object.freeze({...core,receiptRoot:realityRoot(core)});
}

export function createDeadlineInterruptContract(input={}){
  const deadlineNs=uint(input.deadlineNs,'RCL_TIME_DEADLINE_NS_INVALID');
  const jitterBudgetNs=uint(input.jitterBudgetNs??'0','RCL_TIME_JITTER_BUDGET_INVALID');
  const core={format:'rcl.deadline-interrupt-contract.v0.1',version:RCL_PHYSICAL_TIME_PROTOCOL_VERSION,
    clockId:text(input.clockId,'RCL_TIME_CLOCK_ID_REQUIRED'),providerId:text(input.providerId,'RCL_TIME_PROVIDER_ID_REQUIRED'),
    interruptCapability:text(input.interruptCapability,'RCL_TIME_INTERRUPT_CAPABILITY_REQUIRED'),target:text(input.target,'RCL_TIME_INTERRUPT_TARGET_REQUIRED'),
    deadlineNs,jitterBudgetNs,idempotencyKey:text(input.idempotencyKey,'RCL_TIME_IDEMPOTENCY_KEY_REQUIRED'),
    authorityRoot:root(input.authorityRoot,'RCL_TIME_AUTHORITY_ROOT_INVALID'),
    semantics:'PROTOCOL_ONLY_PROVIDER_MUST_EXECUTE',hardRealtimeGuaranteed:false,interruptExecuted:false};
  return Object.freeze({...core,contractRoot:realityRoot(core)});
}

export function settleDeadlineInterrupt(contract,providerReceipt={}){
  if(providerReceipt.contractRoot!==contract.contractRoot)throw new Error('RCL_TIME_INTERRUPT_RECEIPT_ROOT_MISMATCH');
  if(providerReceipt.idempotencyKey!==contract.idempotencyKey)throw new Error('RCL_TIME_INTERRUPT_IDEMPOTENCY_MISMATCH');
  const firedAtNs=uint(providerReceipt.firedAtNs,'RCL_TIME_INTERRUPT_FIRED_AT_INVALID');
  const lateness=big(firedAtNs)-big(contract.deadlineNs);
  const withinDeadline=lateness<=0n;
  const withinJitter=lateness<=big(contract.jitterBudgetNs);
  const core={format:'rcl.deadline-interrupt-receipt.v0.1',contractRoot:contract.contractRoot,
    providerReceiptRoot:root(providerReceipt.receiptRoot,'RCL_TIME_PROVIDER_RECEIPT_ROOT_INVALID'),status:text(providerReceipt.status,'RCL_TIME_INTERRUPT_STATUS_REQUIRED'),
    firedAtNs,latenessNs:lateness.toString(),withinDeadline,withinJitterBudget:withinJitter,
    providerExecuted:true,rclExecutedInterrupt:false,hardRealtimeGuaranteed:false,canonicalPromotionPerformed:false};
  return Object.freeze({...core,receiptRoot:realityRoot(core)});
}
