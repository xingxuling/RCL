import test from 'node:test';import assert from 'node:assert/strict';
import {createWorldTimeContract,createRepresentationFlowTime,createFactWorldTreeRef,createConsistencyProfile,createAuthorityLease,verifyLeaseUse,createRealityHorizon,createInterestGraph,createReplicationPolicy,createTransportRequirement,createPowerBudget,createResourceGovernorPolicy} from '../src/second-world-governance.mjs';
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64),E='e'.repeat(64);

test('second-world truth/time contracts preserve RNCS canonical ownership and separate representation flow time',()=>{
 const t=createWorldTimeContract({worldId:'world:1',worldEpoch:2,worldTick:100,causalClockRoot:A,timeScale:2,authorityRoot:B});assert.equal(t.canonicalOwner,'rncs');
 const f=createRepresentationFlowTime({objectId:'o',sourceStateRoot:A,targetStateRoot:B,startTick:100,endTick:110,motionFieldRoot:C,interpolationPolicy:'linear',errorBudget:0.01});assert.equal(f.canonicalWorldTimeOwner,'rncs');assert.equal(f.worldCommitPerformed,false);
 const facts=createFactWorldTreeRef({worldId:'world:1',factRoot:A,eventLogRoot:B,canopyRoot:C,authorityRoot:D});assert.equal(facts.memoryTreeMayOverwriteFacts,false);
});

test('consistency + lease/epoch/fencing fail closed on stale authority',()=>{
 const p=createConsistencyProfile({profileId:'city',mode:'causal',staleReadBudget:5});assert.equal(p.requiresFencing,true);
 const l=createAuthorityLease({leaseId:'lease:1',scope:'city:a',ownerNode:'node:a',epoch:7,fencingToken:A,validFromTick:10,validUntilTick:20});
 assert.equal(verifyLeaseUse(l,{node:'node:a',epoch:7,fencingToken:A,tick:15}).fencingVerified,true);
 assert.throws(()=>verifyLeaseUse(l,{node:'node:a',epoch:6,fencingToken:A,tick:15}),/RCL_AUTHORITY_LEASE_FENCING_REJECTED/u);
 assert.throws(()=>verifyLeaseUse(l,{node:'node:b',epoch:7,fencingToken:A,tick:15}),/RCL_AUTHORITY_LEASE_FENCING_REJECTED/u);
});

test('subject horizon and interest graph remain scoped and do not acquire subject/world identity ownership',()=>{
 const h=createRealityHorizon({subjectId:'s',perceptionScope:A,cognitionScope:B,knowledgeScope:C,actionScope:D,authorityScope:E,dimensions:{visual:10,semantic:4,causal:2}});assert.equal(h.subjectIdentityOwner,'updia');assert.equal(h.worldOwner,'rncs');
 const g=createInterestGraph({subjectId:'s',nodes:['city','npc'],edges:[{from:'city',to:'npc',domain:'social',weight:0.8}]});assert.equal(g.semanticOwner,'rcl');
});

test('replication/transport/power/resource policies express requirements without owning provider execution or world truth',()=>{
 const r=createReplicationPolicy({policyId:'rep1',mode:'hybrid',maxLag:10,authorityRoot:A});assert.equal(r.canonicalOwner,'rncs');assert.equal(r.idempotencyRequired,true);
 const t=createTransportRequirement({trafficClass:'authority',maxLatencyMs:50,reliability:1,ordered:true,lossTolerance:0,encrypted:true,freshnessMs:100});assert.equal(t.providerImplementationOwnedExternally,true);
 const p=createPowerBudget({nodeId:'node',energyJ:1000,powerW:100,thermalHeadroomC:20,emergencyReserveJ:100,loadSheddingOrder:['visual','physics']});assert.deepEqual(p.preserve,['safety','authority','control']);
 const g=createResourceGovernorPolicy({policyId:'gov',compute:100,memoryBytes:1000,transportBytesPerSecond:1000,energyJ:100,priorityRoots:[B]});assert.equal(g.worldOwner,'rncs');assert.equal(g.semanticOwner,'rcl');
});
