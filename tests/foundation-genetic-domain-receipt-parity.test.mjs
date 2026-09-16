import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM,
  verifyFoundationDirectLoweringLineage,
  verifyFoundationDomainReceiptParity,
  verifyFoundationDirectNativeParity,
} from '../src/foundation-direct-native-parity.mjs';

const RM = '__rcl_foundation_genetic_lineage_0_1_mutation';
const RE = '__rcl_foundation_genetic_lineage_0_1_expression';
const WM = 'rcl:foundation:genetic:lineage:generation:1:mutation';
const WE = 'rcl:foundation:genetic:lineage:generation:1:expression';
function semanticValue(value){ return value; }
function root(state){ return `root:${JSON.stringify(state)}`; }
function lowering(){ return {
  lowered:[
    {domain:'genetic',declaration:'lineage',directive:'Inherit',directiveIndex:0,stage:'mutation',stageIndex:1,stageCount:2,syntheticRule:RM,stateTargets:['genome.seed'],preserveCount:0,witness:WM,authorityClass:'lineage-transformation',sourceReality:'lineage',generationIndex:1,generationCount:1,originalWitnesses:['genetic:lineage'],finalStage:false},
    {domain:'genetic',declaration:'lineage',directive:'Inherit',directiveIndex:0,stage:'expression',stageIndex:2,stageCount:2,syntheticRule:RE,stateTargets:['body.trait'],preserveCount:1,witness:WE,authorityClass:'lineage-transformation',sourceReality:'lineage',generationIndex:1,generationCount:1,originalWitnesses:['genetic:lineage'],finalStage:true,generationStateTargets:['genome.seed','body.trait']},
  ], summary:{loweredCount:2}
}; }
function reference(){ return {kind:'DomainTransition',domainKind:'genetic',name:'lineage',status:'realized',generation:1,witnesses:['genetic:lineage'],authorityClass:'lineage-transformation',beforeRoot:'r0',afterRoot:'r2',changes:[
  {target:'genome.seed',before:1,after:3,source:'genetic:mutation'},
  {target:'body.trait',before:0,after:9,source:'genetic:expression'},
]}; }
function nativeMutation(){ return {rule:RM,status:'realized',beforeRoot:'r0',afterRoot:'r1',witnesses:[WM],changes:[{target:'genome.seed',before:1,after:3}]}; }
function nativeExpression(){ return {rule:RE,status:'realized',beforeRoot:'r1',afterRoot:'r2',witnesses:['genetic:lineage',WE],changes:[{target:'body.trait',before:0,after:9}]}; }

test('genetic staged receipt shares one reference generation across two native stages',()=>{
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeMutation(),nativeExpression()],semanticValue);
  assert.equal(report.ok,true); assert.equal(report.referenceReceiptCount,1); assert.equal(report.activeReferenceReceiptCount,1);
  assert.equal(report.rootAlgorithm,FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM);
  assert.equal(report.entries[0].referenceIndex,report.entries[1].referenceIndex);
});

test('mutation and expression compare only their own reference source partitions',()=>{
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeMutation(),nativeExpression()],semanticValue);
  assert.deepEqual(report.entries[0].referenceTargets,['genome.seed']);
  assert.deepEqual(report.entries[1].referenceTargets,['body.trait']);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent,true);
  assert.equal(report.entries[1].checks.transitionValuesEquivalent,true);
});

test('genetic lineage requires reference generation evidence',()=>{
  const report=verifyFoundationDirectLoweringLineage(lowering(),[nativeMutation(),nativeExpression()]);
  assert.equal(report.ok,false); assert.equal(report.entries[0].checks.referenceExecutionEvidencePresent,false);
});

test('staged receipt rejects reversed native order',()=>{
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeExpression(),nativeMutation()],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.nativeOrderPreserved,false);
});

test('staged receipt rejects missing mutation stage',()=>{
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeExpression()],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.entries[0].checks.geneticStagePairExact,false);
});

test('staged receipt rejects broken mutation-to-expression root continuity',()=>{
  const bad=nativeExpression(); bad.beforeRoot='wrong';
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeMutation(),bad],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.entries[0].checks.geneticStageContinuityRoot,false);
});

test('mutation native before root must match reference generation before root',()=>{
  const bad=nativeMutation(); bad.beforeRoot='wrong';
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[bad,nativeExpression()],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.entries[0].checks.geneticReferenceBoundaryRoot,false);
});

test('expression native after root must match reference generation after root',()=>{
  const bad=nativeExpression(); bad.afterRoot='wrong';
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeMutation(),bad],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.entries[1].checks.geneticReferenceBoundaryRoot,false);
});

test('genetic receipt rejects extra native mutation target',()=>{
  const bad=nativeMutation(); bad.changes.push({target:'secret',before:0,after:1});
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[bad,nativeExpression()],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.entries[0].checks.nativeTargetsExact,false);
});

test('genetic final stage must preserve original witnesses',()=>{
  const bad=nativeExpression(); bad.witnesses=[WE];
  const report=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeMutation(),bad],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.entries[1].checks.originalWitnessesPreserved,false);
});

test('unknown reference change source fails partition completeness',()=>{
  const bad=reference(); bad.changes.push({target:'x',before:0,after:1,source:'genetic:other'});
  const report=verifyFoundationDomainReceiptParity(lowering(),[bad],[nativeMutation(),nativeExpression()],semanticValue);
  assert.equal(report.ok,false); assert.equal(report.entries[0].checks.geneticReferencePartitionComplete,false);
});

test('receipt root binds stage metadata and continuity evidence',()=>{
  const baseline=verifyFoundationDomainReceiptParity(lowering(),[reference()],[nativeMutation(),nativeExpression()],semanticValue);
  const changed=structuredClone(lowering()); changed.lowered[1].stageIndex=1;
  const report=verifyFoundationDomainReceiptParity(changed,[reference()],[nativeMutation(),nativeExpression()],semanticValue);
  assert.notEqual(report.receiptRoot,baseline.receiptRoot);
});

test('top-level parity can certify staged genetic receipt with injected real-looking histories',async()=>{
  const referenceState={'genome.seed':3,'body.trait':9}; const nativeState={...referenceState};
  const result=await verifyFoundationDirectNativeParity({name:'Genetic'}, {
    compileProgram:v=>v,
    compileDirectBytecode:async()=>({ok:true,bytecode:new Uint8Array([82,67,76,66]),foundationDirectLowering:lowering()}),
    runReference:async()=>({state:referenceState,history:[reference()]}),
    runNative:async()=>({state:nativeState,semanticStateRoot:root(nativeState),nativeStateRoot:'native-root',stateRootVerified:true,stateRootParity:true,history:[nativeMutation(),nativeExpression()]}),
    semanticStateRoot:root, semanticValue,
  });
  assert.equal(result.status,'native-verified');
  assert.equal(result.domainReceipt.ok,true);
  assert.equal(result.truthBoundary.geneticStagedReceiptRequiresTwoOrderedNativeTransactions,true);
});

// Existing-domain compatibility smoke.
const NR='__rcl_foundation_neural_n_0_1_1', NW='rcl:foundation:neural:n:step:1';
test('existing neural conditional receipt behavior remains accepted',()=>{
  const l={lowered:[{domain:'neural',declaration:'n',directive:'Propagate',directiveIndex:0,syntheticRule:NR,stateTargets:['x'],witness:NW,authorityClass:'intrinsic-neural-dynamics',sourceReality:'brain',stepIndex:1,stepCount:1,pathwayIndex:1,originalWitnesses:['w'],changeModes:['transmit']}],summary:{loweredCount:1}};
  const ref={kind:'DomainTransition',domainKind:'neural',name:'n',status:'realized',step:1,witnesses:['w'],authorityClass:'intrinsic-neural-dynamics',changes:[{target:'x',before:0,after:1}]};
  const nat={rule:NR,status:'realized',witnesses:['w',NW],changes:[{target:'x',before:0,after:1}]};
  assert.equal(verifyFoundationDomainReceiptParity(l,[ref],[nat],semanticValue).ok,true);
});
