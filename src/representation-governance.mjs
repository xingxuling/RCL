import { realityRoot } from './canonical.mjs';
export const RCL_REPRESENTATION_GOVERNANCE_VERSION='0.1.0-candidate.1';
const SHA=/^[0-9a-f]{64}$/u;
function text(v,c){if(typeof v!=='string'||!v.trim())throw new TypeError(c);return v.trim();}
function root(v,c){if(typeof v!=='string'||!SHA.test(v))throw new TypeError(c);return v;}
function roots(v,c){if(!Array.isArray(v))throw new TypeError(c);const a=v.map(x=>root(x,c));if(new Set(a).size!==a.length)throw new TypeError(`${c}_DUPLICATE`);return a.sort();}
export function createRepresentationRef(input={}){
 const core={format:'rcl.representation-ref.v0.1',version:RCL_REPRESENTATION_GOVERNANCE_VERSION,objectId:text(input.objectId,'RCL_REPRESENTATION_OBJECT_ID_REQUIRED'),representationId:text(input.representationId,'RCL_REPRESENTATION_ID_REQUIRED'),representationType:text(input.representationType,'RCL_REPRESENTATION_TYPE_REQUIRED'),providerId:text(input.providerId,'RCL_REPRESENTATION_PROVIDER_ID_REQUIRED'),providerVersion:text(input.providerVersion,'RCL_REPRESENTATION_PROVIDER_VERSION_REQUIRED'),contentRoot:root(input.contentRoot,'RCL_REPRESENTATION_CONTENT_ROOT_INVALID'),authorityScope:text(input.authorityScope??'projection-only','RCL_REPRESENTATION_AUTHORITY_SCOPE_REQUIRED'),evidenceRoots:roots(input.evidenceRoots??[],'RCL_REPRESENTATION_EVIDENCE_ROOT_INVALID'),canonicalWorldOwner:'rncs',representationSemanticOwner:'rcl',providerOwnsWorldTruth:false};
 if(core.authorityScope!=='projection-only')throw new Error('RCL_REPRESENTATION_AUTHORITY_SCOPE_UNSUPPORTED');
 return Object.freeze({...core,representationRoot:realityRoot(core)});
}
export function createRepresentationPolicy(input={}){
 const allowedTypes=[...new Set((input.allowedTypes??[]).map(x=>text(x,'RCL_REPRESENTATION_POLICY_TYPE_INVALID')))].sort();if(!allowedTypes.length)throw new Error('RCL_REPRESENTATION_POLICY_TYPE_REQUIRED');
 const min=Number(input.detailRange?.min??0),max=Number(input.detailRange?.max??5);if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min)throw new TypeError('RCL_REPRESENTATION_DETAIL_RANGE_INVALID');
 const core={format:'rcl.representation-policy.v0.1',version:RCL_REPRESENTATION_GOVERNANCE_VERSION,policyId:text(input.policyId,'RCL_REPRESENTATION_POLICY_ID_REQUIRED'),allowedTypes,detailRange:{min,max},residencyTiers:[...new Set((input.residencyTiers??[]).map(x=>text(x,'RCL_REPRESENTATION_RESIDENCY_TIER_INVALID')))],errorBudget:Number(input.errorBudget??0),authorityRoot:root(input.authorityRoot,'RCL_REPRESENTATION_POLICY_AUTHORITY_ROOT_INVALID')};
 if(!Number.isFinite(core.errorBudget)||core.errorBudget<0)throw new TypeError('RCL_REPRESENTATION_ERROR_BUDGET_INVALID');return Object.freeze({...core,policyRoot:realityRoot(core)});
}
export function createRepresentationEquivalenceReceipt(input={}){
 const dimensions=['visual','physical','semantic','behavioral','task','authority'];const claims={};for(const d of dimensions){const c=input.claims?.[d]??{equivalent:false};if(c.equivalent===true){if(typeof c.evidenceRoot!=='string'||!SHA.test(c.evidenceRoot))throw new Error(`RCL_REPRESENTATION_EQUIVALENCE_EVIDENCE_REQUIRED:${d}`);claims[d]={equivalent:true,evidenceRoot:c.evidenceRoot};}else claims[d]={equivalent:false,evidenceRoot:null};}
 if(claims.visual.equivalent&&claims.physical.equivalent&&claims.visual.evidenceRoot===claims.physical.evidenceRoot)throw new Error('RCL_REPRESENTATION_VISUAL_EVIDENCE_CANNOT_IMPLY_PHYSICAL_EQUIVALENCE');
 const core={format:'rcl.representation-equivalence-receipt.v0.1',version:RCL_REPRESENTATION_GOVERNANCE_VERSION,leftRoot:root(input.leftRoot,'RCL_REPRESENTATION_LEFT_ROOT_INVALID'),rightRoot:root(input.rightRoot,'RCL_REPRESENTATION_RIGHT_ROOT_INVALID'),objectId:text(input.objectId,'RCL_REPRESENTATION_OBJECT_ID_REQUIRED'),task:input.task??null,claims,canonicalWorldTruthChanged:false};return Object.freeze({...core,receiptRoot:realityRoot(core)});
}
export function createRepresentationTransition(input={}){
 if(input.source.objectId!==input.target.objectId)throw new Error('RCL_REPRESENTATION_OBJECT_IDENTITY_MISMATCH');
 const core={format:'rcl.representation-transition.v0.1',version:RCL_REPRESENTATION_GOVERNANCE_VERSION,objectId:input.source.objectId,sourceRoot:root(input.source.representationRoot,'RCL_REPRESENTATION_SOURCE_ROOT_INVALID'),targetRoot:root(input.target.representationRoot,'RCL_REPRESENTATION_TARGET_ROOT_INVALID'),policyRoot:root(input.policyRoot,'RCL_REPRESENTATION_POLICY_ROOT_INVALID'),equivalenceReceiptRoot:root(input.equivalenceReceiptRoot,'RCL_REPRESENTATION_EQUIVALENCE_ROOT_INVALID'),authorityRoot:root(input.authorityRoot,'RCL_REPRESENTATION_AUTHORITY_ROOT_INVALID'),status:'CANDIDATE_TRANSITION',canonicalWorldTruthChanged:false,rncsCommitPerformed:false};return Object.freeze({...core,transitionRoot:realityRoot(core)});
}
