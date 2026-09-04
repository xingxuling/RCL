import { realityRoot } from './canonical.mjs';

export const RCL_PHYSICAL_PROPERTY_LAW_VERSION = '0.1.0-candidate.1';
const SHA=/^[0-9a-f]{64}$/u;
const DIM_KEYS=Object.freeze(['L','M','T','I','Theta','N','J']);
function text(v,c){if(typeof v!=='string'||!v.trim())throw new TypeError(c);return v.trim();}
function root(v,c){if(typeof v!=='string'||!SHA.test(v))throw new TypeError(c);return v;}
function roots(v,c){if(!Array.isArray(v))throw new TypeError(c);const a=v.map(x=>root(x,c));if(new Set(a).size!==a.length)throw new TypeError(`${c}_DUPLICATE`);return a.sort();}
function dimension(v={}){const out={};for(const k of DIM_KEYS){const n=Number(v[k]??0);if(!Number.isInteger(n)||Math.abs(n)>16)throw new TypeError(`RCL_PHYSICAL_DIMENSION_INVALID:${k}`);out[k]=n;}return out;}
function sameDimension(a,b){return DIM_KEYS.every(k=>a[k]===b[k]);}

export function physicalQuantity(input={}){
 const value=Number(input.value), uncertainty=Number(input.uncertainty??0);
 if(!Number.isFinite(value))throw new TypeError('RCL_PHYSICAL_QUANTITY_VALUE_INVALID');
 if(!Number.isFinite(uncertainty)||uncertainty<0)throw new TypeError('RCL_PHYSICAL_QUANTITY_UNCERTAINTY_INVALID');
 const core={format:'rcl.physical-quantity.v0.1',version:RCL_PHYSICAL_PROPERTY_LAW_VERSION,value,unit:text(input.unit,'RCL_PHYSICAL_UNIT_REQUIRED'),dimension:dimension(input.dimension),
   uncertainty,referenceFrame:input.referenceFrame==null?null:text(input.referenceFrame,'RCL_PHYSICAL_FRAME_INVALID'),
   validFrom:input.validFrom??null,validUntil:input.validUntil??null,provenanceRoots:roots(input.provenanceRoots??[],'RCL_PHYSICAL_PROVENANCE_ROOT_INVALID'),
   authorityRoot:root(input.authorityRoot,'RCL_PHYSICAL_AUTHORITY_ROOT_INVALID')};
 return Object.freeze({...core,quantityRoot:realityRoot(core)});
}
export function addPhysicalQuantities(a,b){
 if(!sameDimension(a.dimension,b.dimension))throw new Error('RCL_PHYSICAL_DIMENSION_MISMATCH');
 if(a.unit!==b.unit)throw new Error('RCL_PHYSICAL_UNIT_CONVERSION_REQUIRED');
 return physicalQuantity({value:a.value+b.value,unit:a.unit,dimension:a.dimension,uncertainty:a.uncertainty+b.uncertainty,referenceFrame:a.referenceFrame??b.referenceFrame,provenanceRoots:[a.quantityRoot,b.quantityRoot].sort(),authorityRoot:a.authorityRoot});
}
export function multiplyPhysicalQuantities(a,b,{unit}={}){
 const dim=Object.fromEntries(DIM_KEYS.map(k=>[k,a.dimension[k]+b.dimension[k]]));
 return physicalQuantity({value:a.value*b.value,unit:unit??`${a.unit}*${b.unit}`,dimension:dim,uncertainty:Math.abs(b.value)*a.uncertainty+Math.abs(a.value)*b.uncertainty,referenceFrame:a.referenceFrame??b.referenceFrame,provenanceRoots:[a.quantityRoot,b.quantityRoot].sort(),authorityRoot:a.authorityRoot});
}
export function createPhysicalPropertySet(input={}){
 const objectId=text(input.objectId,'RCL_PROPERTY_OBJECT_ID_REQUIRED');
 if(!input.properties||typeof input.properties!=='object'||Array.isArray(input.properties))throw new TypeError('RCL_PROPERTY_MAP_REQUIRED');
 const properties={};for(const [name,q] of Object.entries(input.properties)){if(!q||q.format!=='rcl.physical-quantity.v0.1')throw new TypeError(`RCL_PROPERTY_QUANTITY_REQUIRED:${name}`);properties[name]=q;}
 const core={format:'rcl.physical-property-set.v0.1',version:RCL_PHYSICAL_PROPERTY_LAW_VERSION,objectId,detailLevel:text(input.detailLevel??'P2','RCL_PROPERTY_DETAIL_LEVEL_REQUIRED'),properties,
   evidenceRoots:roots(input.evidenceRoots??[],'RCL_PROPERTY_EVIDENCE_ROOT_INVALID'),canonicalTruthOwner:'rncs',semanticOwner:'rcl',providerMayRewriteCanonicalTruth:false};
 return Object.freeze({...core,propertySetRoot:realityRoot(core)});
}
export function createWorldLawSet(input={}){
 const laws=(input.laws??[]).map(l=>({lawId:text(l.lawId,'RCL_WORLD_LAW_ID_REQUIRED'),domain:text(l.domain,'RCL_WORLD_LAW_DOMAIN_REQUIRED'),expressionRoot:root(l.expressionRoot,'RCL_WORLD_LAW_EXPRESSION_ROOT_INVALID'),kind:text(l.kind??'constitutive','RCL_WORLD_LAW_KIND_REQUIRED')}));
 if(!laws.length)throw new Error('RCL_WORLD_LAW_REQUIRED');
 const core={format:'rcl.world-law-set.v0.1',version:RCL_PHYSICAL_PROPERTY_LAW_VERSION,lawSetId:text(input.lawSetId,'RCL_WORLD_LAW_SET_ID_REQUIRED'),lawSetVersion:text(input.lawSetVersion,'RCL_WORLD_LAW_SET_VERSION_REQUIRED'),laws,evidenceRoots:roots(input.evidenceRoots??[],'RCL_WORLD_LAW_EVIDENCE_ROOT_INVALID'),canonicalTruthOwner:'rncs',semanticOwner:'rcl'};
 return Object.freeze({...core,lawSetRoot:realityRoot(core)});
}
export function bindPropertyLaw(input={}){
 const core={format:'rcl.property-law-binding.v0.1',version:RCL_PHYSICAL_PROPERTY_LAW_VERSION,objectId:text(input.objectId,'RCL_PROPERTY_OBJECT_ID_REQUIRED'),propertySetRoot:root(input.propertySetRoot,'RCL_PROPERTY_SET_ROOT_INVALID'),lawSetRoot:root(input.lawSetRoot,'RCL_WORLD_LAW_SET_ROOT_INVALID'),domains:[...new Set((input.domains??[]).map(x=>text(x,'RCL_PROPERTY_LAW_DOMAIN_INVALID')))].sort(),authorityRoot:root(input.authorityRoot,'RCL_PROPERTY_LAW_AUTHORITY_ROOT_INVALID'),canonicalTruthOwner:'rncs',semanticOwner:'rcl'};
 if(!core.domains.length)throw new Error('RCL_PROPERTY_LAW_DOMAIN_REQUIRED');
 return Object.freeze({...core,bindingRoot:realityRoot(core)});
}
export function createPropertyTransitionProposal(input={}){
 const core={format:'rcl.property-transition-proposal.v0.1',version:RCL_PHYSICAL_PROPERTY_LAW_VERSION,objectId:text(input.objectId,'RCL_PROPERTY_OBJECT_ID_REQUIRED'),sourcePropertyRoot:root(input.sourcePropertyRoot,'RCL_PROPERTY_SOURCE_ROOT_INVALID'),sourceStateRoot:root(input.sourceStateRoot,'RCL_PROPERTY_SOURCE_STATE_ROOT_INVALID'),lawBindingRoot:root(input.lawBindingRoot,'RCL_PROPERTY_LAW_BINDING_ROOT_INVALID'),appliedInputRoot:root(input.appliedInputRoot,'RCL_PROPERTY_INPUT_ROOT_INVALID'),providerId:text(input.providerId,'RCL_PROPERTY_PROVIDER_ID_REQUIRED'),predictedOutputRoot:root(input.predictedOutputRoot,'RCL_PROPERTY_PREDICTED_ROOT_INVALID'),constraintReceiptRoot:root(input.constraintReceiptRoot,'RCL_PROPERTY_CONSTRAINT_ROOT_INVALID'),authorityRoot:root(input.authorityRoot,'RCL_PROPERTY_AUTHORITY_ROOT_INVALID'),uncertainty:Number(input.uncertainty??0),status:'CANDIDATE_ONLY',rncsCommitPerformed:false,rclEvidenceCommitPerformed:false,providerMayRewriteCanonicalTruth:false};
 if(!Number.isFinite(core.uncertainty)||core.uncertainty<0)throw new TypeError('RCL_PROPERTY_TRANSITION_UNCERTAINTY_INVALID');
 return Object.freeze({...core,proposalRoot:realityRoot(core)});
}
