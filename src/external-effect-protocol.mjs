import { realityRoot } from './canonical.mjs';

export const RCL_EXTERNAL_EFFECT_PROTOCOL_VERSION='0.1.0-candidate.1';
const SHA=/^[0-9a-f]{64}$/u;
function text(v,c){if(typeof v!=='string'||!v.trim())throw new TypeError(c);return v.trim();}
function root(v,c){if(typeof v!=='string'||!SHA.test(v))throw new TypeError(c);return v;}

export function createExternalEffectPlan(input={}){
  const reversible=Boolean(input.reversible);
  const compensationCapability=input.compensationCapability==null?null:text(input.compensationCapability,'RCL_EFFECT_COMPENSATION_CAPABILITY_INVALID');
  if(reversible&& !compensationCapability)throw new Error('RCL_EFFECT_REVERSIBLE_REQUIRES_COMPENSATION');
  const core={format:'rcl.external-effect-plan.v0.1',version:RCL_EXTERNAL_EFFECT_PROTOCOL_VERSION,
    effectId:text(input.effectId,'RCL_EFFECT_ID_REQUIRED'),providerId:text(input.providerId,'RCL_EFFECT_PROVIDER_ID_REQUIRED'),
    capability:text(input.capability,'RCL_EFFECT_CAPABILITY_REQUIRED'),target:text(input.target,'RCL_EFFECT_TARGET_REQUIRED'),
    inputRoot:root(input.inputRoot,'RCL_EFFECT_INPUT_ROOT_INVALID'),idempotencyKey:text(input.idempotencyKey,'RCL_EFFECT_IDEMPOTENCY_KEY_REQUIRED'),
    authorityRoot:root(input.authorityRoot,'RCL_EFFECT_AUTHORITY_ROOT_INVALID'),killSwitchRoot:root(input.killSwitchRoot,'RCL_EFFECT_KILL_SWITCH_ROOT_INVALID'),
    reversible,compensationCapability,approvalRequired:input.approvalRequired!==false,
    effectExecuted:false,canonicalPromotionPerformed:false,rclEvidenceCommitPerformed:false};
  return Object.freeze({...core,planRoot:realityRoot(core)});
}

export function authorizeExternalEffect(plan,input={}){
  if(input.planRoot!==plan.planRoot)throw new Error('RCL_EFFECT_AUTH_PLAN_ROOT_MISMATCH');
  if(input.killSwitchActive===true)throw new Error('RCL_EFFECT_KILL_SWITCH_ACTIVE');
  if(plan.approvalRequired&&input.approved!==true)throw new Error('RCL_EFFECT_APPROVAL_REQUIRED');
  const core={format:'rcl.external-effect-authorization.v0.1',planRoot:plan.planRoot,authorityRoot:plan.authorityRoot,
    approvalRoot:root(input.approvalRoot,'RCL_EFFECT_APPROVAL_ROOT_INVALID'),approved:true,killSwitchActive:false,
    executionDelegatedToProvider:true,rclExecutedEffect:false,canonicalPromotionPerformed:false};
  return Object.freeze({...core,authorizationRoot:realityRoot(core)});
}

export class ExternalEffectSettlementLedger{
  constructor(){this.idempotency=new Map();}
  settle(plan,authorization,providerReceipt={}){
    if(authorization.planRoot!==plan.planRoot||providerReceipt.planRoot!==plan.planRoot)throw new Error('RCL_EFFECT_SETTLEMENT_PLAN_ROOT_MISMATCH');
    if(providerReceipt.authorizationRoot!==authorization.authorizationRoot)throw new Error('RCL_EFFECT_SETTLEMENT_AUTH_ROOT_MISMATCH');
    if(providerReceipt.idempotencyKey!==plan.idempotencyKey)throw new Error('RCL_EFFECT_SETTLEMENT_IDEMPOTENCY_MISMATCH');
    if(this.idempotency.has(plan.idempotencyKey))throw new Error('RCL_EFFECT_DUPLICATE_IDEMPOTENCY_KEY');
    if(providerReceipt.canonicalPromotionPerformed===true||providerReceipt.rclEvidenceCommitPerformed===true||providerReceipt.worldFactPromoted===true)throw new Error('RCL_EFFECT_PROVIDER_AUTHORITY_ESCALATION');
    const status=text(providerReceipt.status,'RCL_EFFECT_PROVIDER_STATUS_REQUIRED');
    if(!['SUCCESS','FAILED','COMPENSATED'].includes(status))throw new Error('RCL_EFFECT_PROVIDER_STATUS_UNSUPPORTED');
    if(status==='COMPENSATED'&&!plan.reversible)throw new Error('RCL_EFFECT_COMPENSATION_NOT_ALLOWED');
    const core={format:'rcl.external-effect-receipt.v0.1',version:RCL_EXTERNAL_EFFECT_PROTOCOL_VERSION,
      planRoot:plan.planRoot,authorizationRoot:authorization.authorizationRoot,idempotencyKey:plan.idempotencyKey,status,
      providerReceiptRoot:root(providerReceipt.receiptRoot,'RCL_EFFECT_PROVIDER_RECEIPT_ROOT_INVALID'),
      resultRoot:providerReceipt.resultRoot==null?null:root(providerReceipt.resultRoot,'RCL_EFFECT_RESULT_ROOT_INVALID'),
      compensationRequired:status==='FAILED'&&plan.reversible,compensationCapability:plan.compensationCapability,
      providerExecuted:true,rclExecutedEffect:false,exactlyOnceProtocolKeyBound:true,durableQueueProven:false,
      canonicalPromotionPerformed:false,rclEvidenceCommitPerformed:false,worldFactPromoted:false};
    const receipt=Object.freeze({...core,receiptRoot:realityRoot(core)});
    this.idempotency.set(plan.idempotencyKey,receipt.receiptRoot);
    return receipt;
  }
}
