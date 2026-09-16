import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_LIVING_STAGED_RECEIPT_ROOT_ALGORITHM,
  verifyLivingStagedReceiptParity,
} from '../src/foundation-living-staged-receipt.mjs';

const RS='__rcl_foundation_living_organism_0_1_sense';
const RF='__rcl_foundation_living_organism_feed_0_1_1';
const RH='__rcl_foundation_living_organism_heal_0_1_2';
const WS='rcl:foundation:living:organism:step:1:sense';
const WF='rcl:foundation:living:organism.feed:step:1:cycle:1';
const WH='rcl:foundation:living:organism.heal:step:1:cycle:2';
const senseChange={target:'organism.foodSense',before:0,after:4,source:'living:sense'};
const lowering=()=>({ lowered:[
  {domain:'living',declaration:'organism',directive:'Live',directiveIndex:0,stage:'sense',stageIndex:1,stageCount:3,syntheticRule:RS,stateTargets:['organism.foodSense'],witness:WS,authorityClass:'intrinsic-life-cycle',sourceReality:'organism',stepIndex:1,stepCount:1,cycleIndex:null,cycleName:null,originalWitnesses:[],body:'organism.body',livingNeeds:['food'],changeModes:['sense-sync']},
  {domain:'living',declaration:'organism',directive:'Live',directiveIndex:0,stage:'cycle',stageIndex:2,stageCount:3,syntheticRule:RF,stateTargets:['organism.energy'],witness:WF,authorityClass:'intrinsic-life-cycle',sourceReality:'organism',stepIndex:1,stepCount:1,cycleIndex:1,cycleName:'organism.feed',originalWitnesses:['living:feed'],body:'organism.body',livingNeeds:['food'],changeModes:['metabolize']},
  {domain:'living',declaration:'organism',directive:'Live',directiveIndex:0,stage:'cycle',stageIndex:3,stageCount:3,syntheticRule:RH,stateTargets:['organism.health'],witness:WH,authorityClass:'intrinsic-life-cycle',sourceReality:'organism',stepIndex:1,stepCount:1,cycleIndex:2,cycleName:'organism.heal',originalWitnesses:['living:heal'],body:'organism.body',livingNeeds:['food'],changeModes:['heal']},
], summary:{loweredCount:3,livingLoweredStageCount:3} });
const refFeed=()=>({kind:'DomainTransition',domainKind:'living',name:'organism.feed',status:'realized',step:1,body:'organism.body',needs:['food'],witnesses:['living:feed'],authorityClass:'intrinsic-life-cycle',beforeRoot:'r1',afterRoot:'r2',changes:[senseChange,{target:'organism.energy',before:1,after:5,source:'living'}]});
const refHeal=()=>({kind:'DomainTransition',domainKind:'living',name:'organism.heal',status:'realized',step:1,body:'organism.body',needs:['food'],witnesses:['living:heal'],authorityClass:'intrinsic-life-cycle',beforeRoot:'r2',afterRoot:'r3',changes:[senseChange,{target:'organism.health',before:1,after:2,source:'living'}]});
const natSense=()=>({rule:RS,status:'realized',beforeRoot:'r0',afterRoot:'r1',witnesses:[WS],changes:[{target:'organism.foodSense',before:0,after:4}]});
const natFeed=()=>({rule:RF,status:'realized',beforeRoot:'r1',afterRoot:'r2',witnesses:['living:feed',WF],changes:[{target:'organism.energy',before:1,after:5}]});
const natHeal=()=>({rule:RH,status:'realized',beforeRoot:'r2',afterRoot:'r3',witnesses:['living:heal',WH],changes:[{target:'organism.health',before:1,after:2}]});
const semanticValue=v=>v;

function report(ref=[refFeed(),refHeal()],nat=[natSense(),natFeed(),natHeal()],low=lowering()){
  return verifyLivingStagedReceiptParity(low,ref,nat,semanticValue);
}

test('living staged receipt binds sense sync followed by ordered cycle receipts',()=>{
  const value=report();
  assert.equal(value.ok,true); assert.equal(value.rootAlgorithm,FOUNDATION_LIVING_STAGED_RECEIPT_ROOT_ALGORITHM);
  assert.equal(value.entries[0].checks.referenceSenseEvidencePresent,true);
  assert.equal(value.stepContinuityPreserved,true);
});

test('living sense evidence is the repeated living:sense partition, not cycle changes',()=>{
  const value=report();
  assert.deepEqual(value.entries[0].referenceChanges,[{target:'organism.foodSense',before:0,after:4}]);
  assert.deepEqual(value.entries[1].referenceChanges,[{target:'organism.energy',before:1,after:5}]);
});

test('inconsistent repeated sense partitions fail closed',()=>{
  const bad=refHeal(); bad.changes[0]={...senseChange,after:9};
  const value=report([refFeed(),bad]);
  assert.equal(value.ok,false); assert.equal(value.entries[0].checks.referenceSenseEvidenceConsistent,false);
});

test('inactive conditional cycle requires matching native absence',()=>{
  const ref=refHeal(); ref.beforeRoot='r1';
  const nat=natHeal(); nat.beforeRoot='r1';
  const value=report([ref],[natSense(),nat]);
  assert.equal(value.ok,true); assert.equal(value.entries[1].referenceActive,false); assert.equal(value.entries[1].nativeActive,false);
});

test('inactive reference cycle rejects a native execution',()=>{
  const value=report([refHeal()],[natSense(),natFeed(),natHeal()]);
  assert.equal(value.ok,false); assert.equal(value.entries[1].checks.exactNativeRecord,false);
});

test('sense-only reference step cannot be certified because reference runtime emits no receipt',()=>{
  const value=report([],[natSense()]);
  assert.equal(value.ok,false); assert.equal(value.entries[0].checks.referenceSenseEvidencePresent,false);
  assert.equal(value.truthBoundary.silentReferenceSenseOnlyStepCannotBeCertified,true);
});

test('cycle receipt rejects extra native target',()=>{
  const bad=natFeed(); bad.changes.push({target:'secret',before:0,after:1});
  const value=report([refFeed(),refHeal()],[natSense(),bad,natHeal()]);
  assert.equal(value.ok,false); assert.equal(value.entries[1].checks.nativeTargetsExact,false);
});

test('cycle receipt requires original witness preservation',()=>{
  const bad=natFeed(); bad.witnesses=[WF];
  const value=report([refFeed(),refHeal()],[natSense(),bad,natHeal()]);
  assert.equal(value.ok,false); assert.equal(value.entries[1].checks.originalWitnessesPreserved,false);
});

test('cycle native roots must equal reference cycle boundary roots',()=>{
  const bad=natFeed(); bad.beforeRoot='wrong';
  const value=report([refFeed(),refHeal()],[natSense(),bad,natHeal()]);
  assert.equal(value.ok,false); assert.equal(value.entries[1].checks.referenceBoundaryRootsPreserved,false);
});

test('sense native afterRoot must join the first active reference cycle beforeRoot',()=>{
  const bad=natSense(); bad.afterRoot='wrong';
  const value=report([refFeed(),refHeal()],[bad,natFeed(),natHeal()]);
  assert.equal(value.ok,false); assert.equal(value.stepContinuityPreserved,false);
});

test('native staged order is non-compensating',()=>{
  const value=report([refFeed(),refHeal()],[natSense(),natHeal(),natFeed()]);
  assert.equal(value.ok,false); assert.equal(value.nativeOrderPreserved,false);
});

test('step metadata must be contiguous and internally consistent',()=>{
  const low=lowering(); low.lowered[2].stageIndex=2;
  const value=report([refFeed(),refHeal()],[natSense(),natFeed(),natHeal()],low);
  assert.equal(value.ok,false); assert.equal(value.stepShapeComplete,false);
});

test('receipt root binds negative evidence as well as successful evidence',()=>{
  const good=report(); const bad=natFeed(); bad.changes[0].after=6;
  const failed=report([refFeed(),refHeal()],[natSense(),bad,natHeal()]);
  assert.notEqual(good.receiptRoot,failed.receiptRoot);
});

test('verifier declares its integration and reality boundaries explicitly',()=>{
  const value=report();
  assert.equal(value.truthBoundary.integratedIntoFoundationDirectNativeParity,false);
  assert.equal(value.truthBoundary.actualCNativeVmExecutionClaimed,false);
  assert.equal(value.truthBoundary.fullHistoryParityClaimed,false);
});

test('unchanged reference sense target can be certified only by an exact native no-op',()=>{
  const feed=refFeed(); feed.changes=feed.changes.filter(change=>change.source!=='living:sense');
  const heal=refHeal(); heal.changes=heal.changes.filter(change=>change.source!=='living:sense');
  const sense=natSense(); sense.beforeRoot='r1'; sense.afterRoot='r1'; sense.changes=[{target:'organism.foodSense',before:4,after:4}];
  const value=report([feed,heal],[sense,natFeed(),natHeal()]);
  assert.equal(value.ok,true);
  assert.equal(value.entries[0].checks.referenceTargetsExact,true);
  assert.equal(value.entries[0].checks.omittedReferenceSenseTargetsAreNativeNoOps,true);
  assert.equal(value.entries[0].checks.transitionValuesEquivalent,true);
  assert.equal(value.truthBoundary.unchangedReferenceSenseTargetsMayBeCertifiedOnlyByExactNativeNoOps,true);
});

test('silent reference sense partition rejects a native value-changing transition',()=>{
  const feed=refFeed(); feed.changes=feed.changes.filter(change=>change.source!=='living:sense');
  const heal=refHeal(); heal.changes=heal.changes.filter(change=>change.source!=='living:sense');
  const sense=natSense(); sense.beforeRoot='r1'; sense.afterRoot='r1'; sense.changes=[{target:'organism.foodSense',before:0,after:4}];
  const value=report([feed,heal],[sense,natFeed(),natHeal()]);
  assert.equal(value.ok,false);
  assert.equal(value.entries[0].checks.omittedReferenceSenseTargetsAreNativeNoOps,false);
  assert.equal(value.entries[0].checks.transitionValuesEquivalent,false);
});
