import { realityRoot } from './canonical.mjs';

export const RCL_SECOND_WORLD_GOVERNANCE_VERSION='0.1.0-candidate.1';
const SHA=/^[0-9a-f]{64}$/u;
function text(v,c){if(typeof v!=='string'||!v.trim())throw new TypeError(c);return v.trim();}
function root(v,c){if(typeof v!=='string'||!SHA.test(v))throw new TypeError(c);return v;}
function roots(v,c){if(!Array.isArray(v))throw new TypeError(c);const a=v.map(x=>root(x,c));if(new Set(a).size!==a.length)throw new TypeError(`${c}_DUPLICATE`);return a.sort();}
function nonneg(v,c){const n=Number(v??0);if(!Number.isFinite(n)||n<0)throw new TypeError(c);return n;}
function integer(v,c){const n=Number(v);if(!Number.isInteger(n)||n<0)throw new TypeError(c);return n;}
function rooted(format,core){const body={format,version:RCL_SECOND_WORLD_GOVERNANCE_VERSION,...core};return Object.freeze({...body,root:realityRoot(body)});}

export function createWorldTimeContract(input={}){
 const timeScale=Number(input.timeScale??1);if(!Number.isFinite(timeScale)||timeScale<0)throw new TypeError('RCL_WORLD_TIME_SCALE_INVALID');
 return rooted('rcl.world-time-contract.v0.1',{worldId:text(input.worldId,'RCL_WORLD_ID_REQUIRED'),worldEpoch:integer(input.worldEpoch,'RCL_WORLD_EPOCH_INVALID'),worldTick:integer(input.worldTick,'RCL_WORLD_TICK_INVALID'),logicalTime:integer(input.logicalTime??input.worldTick,'RCL_WORLD_LOGICAL_TIME_INVALID'),causalClockRoot:root(input.causalClockRoot,'RCL_WORLD_CAUSAL_CLOCK_ROOT_INVALID'),timeScale,paused:Boolean(input.paused),authorityRoot:root(input.authorityRoot,'RCL_WORLD_TIME_AUTHORITY_ROOT_INVALID'),canonicalOwner:'rncs',semanticOwner:'rcl'});
}
export function createRepresentationFlowTime(input={}){
 const start=integer(input.startTick,'RCL_REP_FLOW_START_INVALID'),end=integer(input.endTick,'RCL_REP_FLOW_END_INVALID');if(end<start)throw new Error('RCL_REP_FLOW_INTERVAL_INVALID');
 return rooted('rcl.representation-flow-time.v0.1',{objectId:text(input.objectId,'RCL_REP_FLOW_OBJECT_ID_REQUIRED'),sourceStateRoot:root(input.sourceStateRoot,'RCL_REP_FLOW_SOURCE_ROOT_INVALID'),targetStateRoot:root(input.targetStateRoot,'RCL_REP_FLOW_TARGET_ROOT_INVALID'),startTick:start,endTick:end,motionFieldRoot:root(input.motionFieldRoot,'RCL_REP_FLOW_MOTION_ROOT_INVALID'),interpolationPolicy:text(input.interpolationPolicy,'RCL_REP_FLOW_POLICY_REQUIRED'),errorBudget:nonneg(input.errorBudget,'RCL_REP_FLOW_ERROR_BUDGET_INVALID'),authorityScope:text(input.authorityScope??'representation-only','RCL_REP_FLOW_AUTHORITY_SCOPE_REQUIRED'),canonicalWorldTimeOwner:'rncs',representationFlowOwner:'urrf/vsr',worldCommitPerformed:false});
}
export function createFactWorldTreeRef(input={}){
 return rooted('rcl.fact-world-tree-ref.v0.1',{worldId:text(input.worldId,'RCL_WORLD_ID_REQUIRED'),factRoot:root(input.factRoot,'RCL_FACT_ROOT_INVALID'),eventLogRoot:root(input.eventLogRoot,'RCL_EVENT_LOG_ROOT_INVALID'),canopyRoot:root(input.canopyRoot,'RCL_FACT_CANOPY_ROOT_INVALID'),authorityRoot:root(input.authorityRoot,'RCL_FACT_AUTHORITY_ROOT_INVALID'),canonicalOwner:'rncs',memoryTreeMayOverwriteFacts:false});
}
export function createConsistencyProfile(input={}){
 const mode=text(input.mode,'RCL_CONSISTENCY_MODE_REQUIRED');if(!['linearizable','serializable','causal','snapshot','eventual'].includes(mode))throw new Error('RCL_CONSISTENCY_MODE_UNSUPPORTED');
 return rooted('rcl.reality-consistency-profile.v0.1',{profileId:text(input.profileId,'RCL_CONSISTENCY_PROFILE_ID_REQUIRED'),mode,staleReadBudget:nonneg(input.staleReadBudget??0,'RCL_CONSISTENCY_STALE_BUDGET_INVALID'),conflictPolicy:text(input.conflictPolicy??'fail-closed','RCL_CONSISTENCY_CONFLICT_POLICY_REQUIRED'),requiresLease:input.requiresLease!==false,requiresEpoch:true,requiresFencing:true,canonicalOwner:'rncs',semanticOwner:'rcl'});
}
export function createAuthorityLease(input={}){
 const start=integer(input.validFromTick,'RCL_LEASE_START_INVALID'),end=integer(input.validUntilTick,'RCL_LEASE_END_INVALID');if(end<=start)throw new Error('RCL_LEASE_INTERVAL_INVALID');
 return rooted('rcl.authority-lease.v0.1',{leaseId:text(input.leaseId,'RCL_LEASE_ID_REQUIRED'),scope:text(input.scope,'RCL_LEASE_SCOPE_REQUIRED'),ownerNode:text(input.ownerNode,'RCL_LEASE_OWNER_REQUIRED'),epoch:integer(input.epoch,'RCL_LEASE_EPOCH_INVALID'),fencingToken:root(input.fencingToken,'RCL_LEASE_FENCING_TOKEN_INVALID'),validFromTick:start,validUntilTick:end,revocable:true,canonicalAuthorityOwner:'rncs'});
}
export function verifyLeaseUse(lease,{node,epoch,fencingToken,tick}={}){
 const ok=node===lease.ownerNode&&Number(epoch)===lease.epoch&&fencingToken===lease.fencingToken&&Number(tick)>=lease.validFromTick&&Number(tick)<lease.validUntilTick;
 if(!ok)throw new Error('RCL_AUTHORITY_LEASE_FENCING_REJECTED');
 return rooted('rcl.authority-lease-use-receipt.v0.1',{leaseRoot:lease.root,node,epoch:Number(epoch),tick:Number(tick),fencingVerified:true,authorityEscalationPerformed:false});
}
export function createRealityHorizon(input={}){
 const dimensions={};for(const k of ['visual','auditory','spatial','semantic','social','temporal','causal','cognitive','actionable'])dimensions[k]=nonneg(input.dimensions?.[k]??0,`RCL_HORIZON_${k.toUpperCase()}_INVALID`);
 return rooted('rcl.subject-reality-horizon.v0.1',{subjectId:text(input.subjectId,'RCL_HORIZON_SUBJECT_ID_REQUIRED'),perceptionScope:root(input.perceptionScope,'RCL_HORIZON_PERCEPTION_ROOT_INVALID'),cognitionScope:root(input.cognitionScope,'RCL_HORIZON_COGNITION_ROOT_INVALID'),knowledgeScope:root(input.knowledgeScope,'RCL_HORIZON_KNOWLEDGE_ROOT_INVALID'),actionScope:root(input.actionScope,'RCL_HORIZON_ACTION_ROOT_INVALID'),authorityScope:root(input.authorityScope,'RCL_HORIZON_AUTHORITY_ROOT_INVALID'),dimensions,subjectIdentityOwner:'updia',worldOwner:'rncs',semanticOwner:'rcl'});
}
export function createInterestGraph(input={}){
 const nodes=[...new Set((input.nodes??[]).map(x=>text(x,'RCL_INTEREST_NODE_INVALID')))].sort();if(!nodes.length)throw new Error('RCL_INTEREST_NODE_REQUIRED');
 const edges=(input.edges??[]).map(e=>{if(!nodes.includes(e.from)||!nodes.includes(e.to))throw new Error('RCL_INTEREST_EDGE_UNKNOWN_NODE');return{from:e.from,to:e.to,domain:text(e.domain,'RCL_INTEREST_DOMAIN_REQUIRED'),weight:nonneg(e.weight??0,'RCL_INTEREST_WEIGHT_INVALID')};});
 return rooted('rcl.multi-domain-interest-graph.v0.1',{subjectId:text(input.subjectId,'RCL_INTEREST_SUBJECT_ID_REQUIRED'),nodes,edges,canonicalWorldOwner:'rncs',semanticOwner:'rcl'});
}
export function createReplicationPolicy(input={}){
 const mode=text(input.mode,'RCL_REPLICATION_MODE_REQUIRED');if(!['snapshot','delta','subscription','hybrid'].includes(mode))throw new Error('RCL_REPLICATION_MODE_UNSUPPORTED');
 return rooted('rcl.state-replication-policy.v0.1',{policyId:text(input.policyId,'RCL_REPLICATION_POLICY_ID_REQUIRED'),mode,sequenceRequired:true,ackRequired:input.ackRequired!==false,dedupRequired:true,idempotencyRequired:true,resyncOnGap:true,maxLag:nonneg(input.maxLag??0,'RCL_REPLICATION_MAX_LAG_INVALID'),authorityRoot:root(input.authorityRoot,'RCL_REPLICATION_AUTHORITY_ROOT_INVALID'),canonicalOwner:'rncs'});
}
export function createTransportRequirement(input={}){
 return rooted('rcl.reality-transport-requirement.v0.1',{trafficClass:text(input.trafficClass,'RCL_TRANSPORT_CLASS_REQUIRED'),maxLatencyMs:nonneg(input.maxLatencyMs,'RCL_TRANSPORT_LATENCY_INVALID'),reliability:nonneg(input.reliability,'RCL_TRANSPORT_RELIABILITY_INVALID'),ordered:Boolean(input.ordered),lossTolerance:nonneg(input.lossTolerance??0,'RCL_TRANSPORT_LOSS_INVALID'),encrypted:input.encrypted!==false,freshnessMs:nonneg(input.freshnessMs??0,'RCL_TRANSPORT_FRESHNESS_INVALID'),providerImplementationOwnedExternally:true});
}
export function createPowerBudget(input={}){
 return rooted('rcl.reality-power-budget.v0.1',{nodeId:text(input.nodeId,'RCL_POWER_NODE_ID_REQUIRED'),energyJ:nonneg(input.energyJ,'RCL_POWER_ENERGY_INVALID'),powerW:nonneg(input.powerW,'RCL_POWER_WATTS_INVALID'),thermalHeadroomC:nonneg(input.thermalHeadroomC,'RCL_POWER_THERMAL_INVALID'),emergencyReserveJ:nonneg(input.emergencyReserveJ??0,'RCL_POWER_RESERVE_INVALID'),loadSheddingOrder:[...new Set((input.loadSheddingOrder??[]).map(x=>text(x,'RCL_POWER_SHED_ITEM_INVALID')))],preserve:['safety','authority','control'],canonicalWorldTruthChanged:false});
}
export function createResourceGovernorPolicy(input={}){
 return rooted('rcl.reality-resource-governor-policy.v0.1',{policyId:text(input.policyId,'RCL_RESOURCE_POLICY_ID_REQUIRED'),compute:nonneg(input.compute,'RCL_RESOURCE_COMPUTE_INVALID'),memoryBytes:nonneg(input.memoryBytes,'RCL_RESOURCE_MEMORY_INVALID'),transportBytesPerSecond:nonneg(input.transportBytesPerSecond,'RCL_RESOURCE_TRANSPORT_INVALID'),energyJ:nonneg(input.energyJ,'RCL_RESOURCE_ENERGY_INVALID'),priorityRoots:roots(input.priorityRoots??[],'RCL_RESOURCE_PRIORITY_ROOT_INVALID'),minimumPreserved:['safety','authority','control'],worldOwner:'rncs',semanticOwner:'rcl'});
}
