import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyFoundationDirectLoweringLineage } from '../src/foundation-direct-native-parity.mjs';

const R1='__rcl_foundation_neural_brain_integrate_0_1_1';
const R2='__rcl_foundation_neural_brain_trace_0_1_2';
const W1='rcl:foundation:neural:brain.integrate:step:1';
const W2='rcl:foundation:neural:brain.trace:step:1';

const lowering={
  lowered:[
    {domain:'neural',declaration:'brain.integrate',directive:'Propagate',directiveIndex:0,syntheticRule:R1,stateTargets:['brain.response'],witness:W1,authorityClass:'intrinsic-neural-dynamics',sourceReality:'brain',stepIndex:1,stepCount:1,pathwayIndex:1,originalWitnesses:['neural:integrate'],changeModes:['transmit']},
    {domain:'neural',declaration:'brain.trace',directive:'Propagate',directiveIndex:0,syntheticRule:R2,stateTargets:['brain.trace'],witness:W2,authorityClass:'intrinsic-neural-dynamics',sourceReality:'brain',stepIndex:1,stepCount:1,pathwayIndex:2,originalWitnesses:['neural:trace'],changeModes:['learn']},
  ],
  summary:{loweredCount:2},
};
const refTrace={kind:'DomainTransition',domainKind:'neural',name:'brain.trace',status:'realized',step:1,witnesses:['neural:trace'],authorityClass:'intrinsic-neural-dynamics',changes:[{target:'brain.trace',before:0,after:1}]};
const nativeTrace={rule:R2,status:'realized',witnesses:['neural:trace',W2],changes:[{target:'brain.trace',before:0,after:1}]};

test('inactive conditional neural pathway treats reference absence as execution evidence when reference history is available',()=>{
  const report=verifyFoundationDirectLoweringLineage(lowering,[nativeTrace],[refTrace]);
  assert.equal(report.ok,true);
  assert.equal(report.entries[0].referenceActive,false);
  assert.equal(report.entries[0].checks.referenceExecutionEvidencePresent,true);
  assert.equal(report.entries[0].checks.exactNativeRecord,true);
  assert.equal(report.entries[0].checks.inactiveStepAligned,true);
});

test('conditional lineage still fails closed when reference history itself is unavailable',()=>{
  const report=verifyFoundationDirectLoweringLineage(lowering,[nativeTrace]);
  assert.equal(report.ok,false);
  assert.equal(report.entries[0].checks.referenceExecutionEvidencePresent,false);
  assert.equal(report.entries[1].checks.referenceExecutionEvidencePresent,false);
});
