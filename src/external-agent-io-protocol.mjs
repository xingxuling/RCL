import { realityRoot } from './canonical.mjs';

export const RCL_EXTERNAL_AGENT_IO_VERSION='0.1.0-candidate.1';
const SHA=/^[0-9a-f]{64}$/u;
function text(v,c){if(typeof v!=='string'||!v.trim())throw new TypeError(c);return v.trim();}
function root(v,c){if(typeof v!=='string'||!SHA.test(v))throw new TypeError(c);return v;}
function nonneg(v,c){const n=Number(v??0);if(!Number.isFinite(n)||n<0)throw new TypeError(c);return n;}

export function createExternalAgentIoRequest(input={}){
  const core={format:'rcl.external-agent-io-request.v0.1',version:RCL_EXTERNAL_AGENT_IO_VERSION,
    requestId:text(input.requestId,'RCL_AGENT_IO_REQUEST_ID_REQUIRED'),agentId:text(input.agentId,'RCL_AGENT_IO_AGENT_ID_REQUIRED'),
    providerId:text(input.providerId,'RCL_AGENT_IO_PROVIDER_ID_REQUIRED'),capability:text(input.capability,'RCL_AGENT_IO_CAPABILITY_REQUIRED'),
    inputRoot:root(input.inputRoot,'RCL_AGENT_IO_INPUT_ROOT_INVALID'),modelProvenanceRoot:root(input.modelProvenanceRoot,'RCL_AGENT_IO_MODEL_PROVENANCE_ROOT_INVALID'),
    idempotencyKey:text(input.idempotencyKey,'RCL_AGENT_IO_IDEMPOTENCY_KEY_REQUIRED'),
    sessionRoot:root(input.sessionRoot,'RCL_AGENT_IO_SESSION_ROOT_INVALID'),previousReceiptRoot:input.previousReceiptRoot==null?null:root(input.previousReceiptRoot,'RCL_AGENT_IO_PREVIOUS_RECEIPT_ROOT_INVALID'),
    sequence:Number(input.sequence),budget:{maxTokens:nonneg(input.budget?.maxTokens,'RCL_AGENT_IO_TOKEN_BUDGET_INVALID'),maxToolCalls:nonneg(input.budget?.maxToolCalls,'RCL_AGENT_IO_TOOL_BUDGET_INVALID')},
    authorityMode:input.authorityMode??'candidate-only',externalEffectAllowed:false,memoryCommitAllowed:false,worldFactPromotionAllowed:false};
  if(!Number.isInteger(core.sequence)||core.sequence<0)throw new TypeError('RCL_AGENT_IO_SEQUENCE_INVALID');
  if(!['observe-only','candidate-only'].includes(core.authorityMode))throw new Error('RCL_AGENT_IO_AUTHORITY_MODE_UNSUPPORTED');
  return Object.freeze({...core,requestRoot:realityRoot(core)});
}

export function settleExternalAgentIo(request,receipt={}){
  if(receipt.requestRoot!==request.requestRoot)throw new Error('RCL_AGENT_IO_REQUEST_ROOT_MISMATCH');
  if(receipt.idempotencyKey!==request.idempotencyKey)throw new Error('RCL_AGENT_IO_IDEMPOTENCY_MISMATCH');
  if(receipt.providerId!==request.providerId)throw new Error('RCL_AGENT_IO_PROVIDER_DRIFT');
  if(receipt.modelProvenanceRoot!==request.modelProvenanceRoot)throw new Error('RCL_AGENT_IO_MODEL_PROVENANCE_DRIFT');
  if(receipt.externalEffectPerformed===true||receipt.memoryCommitPerformed===true||receipt.worldFactPromoted===true)throw new Error('RCL_AGENT_IO_FORBIDDEN_EFFECT_CLAIM');
  const core={format:'rcl.external-agent-io-receipt.v0.1',version:RCL_EXTERNAL_AGENT_IO_VERSION,
    requestRoot:request.requestRoot,responseRoot:root(receipt.responseRoot,'RCL_AGENT_IO_RESPONSE_ROOT_INVALID'),
    providerReceiptRoot:root(receipt.receiptRoot,'RCL_AGENT_IO_RECEIPT_ROOT_INVALID'),status:text(receipt.status,'RCL_AGENT_IO_STATUS_REQUIRED'),
    idempotencyKey:request.idempotencyKey,sequence:request.sequence,nextSessionRoot:root(receipt.nextSessionRoot,'RCL_AGENT_IO_NEXT_SESSION_ROOT_INVALID'),
    modelProvenanceRoot:request.modelProvenanceRoot,providerId:request.providerId,
    externalEffectPerformed:false,memoryCommitPerformed:false,worldFactPromoted:false,canonicalPromotionPerformed:false,
    crashRecoveryAnchor:{previousReceiptRoot:request.previousReceiptRoot,sessionRoot:request.sessionRoot,nextSessionRoot:receipt.nextSessionRoot}};
  return Object.freeze({...core,receiptRoot:realityRoot(core)});
}
