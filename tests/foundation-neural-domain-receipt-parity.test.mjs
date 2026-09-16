import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM,
  verifyFoundationDirectLoweringLineage,
  verifyFoundationDomainReceiptParity,
  verifyFoundationDirectNativeParityGeneric as verifyFoundationDirectNativeParity,
} from '../src/foundation-direct-native-parity.mjs';

const R1 = '__rcl_foundation_neural_brain_integrate_0_1_1';
const R2 = '__rcl_foundation_neural_brain_trace_0_1_2';
const W1 = 'rcl:foundation:neural:brain.integrate:step:1';
const W2 = 'rcl:foundation:neural:brain.trace:step:1';

function semanticValue(value) {
  if (Array.isArray(value)) return value.map(semanticValue);
  if (!value || typeof value !== 'object') return value;
  if (value.kind === 'NumberValue') return value.value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, semanticValue(item)]));
}
function root(state) { return `root:${JSON.stringify(semanticValue(state))}`; }
function lowering() {
  return {
    lowered: [
      { domain:'neural', declaration:'brain.integrate', directive:'Propagate', directiveIndex:0, syntheticRule:R1, stateTargets:['brain.response'], witness:W1, authorityClass:'intrinsic-neural-dynamics', sourceReality:'brain', stepIndex:1, stepCount:1, pathwayIndex:1, originalWitnesses:['neural:integrate'], changeModes:['transmit'] },
      { domain:'neural', declaration:'brain.trace', directive:'Propagate', directiveIndex:0, syntheticRule:R2, stateTargets:['brain.trace'], witness:W2, authorityClass:'intrinsic-neural-dynamics', sourceReality:'brain', stepIndex:1, stepCount:1, pathwayIndex:2, originalWitnesses:['neural:trace'], changeModes:['learn'] },
    ],
    summary: { loweredCount: 2 },
  };
}
function refIntegrate() { return { kind:'DomainTransition', domainKind:'neural', name:'brain.integrate', status:'realized', step:1, witnesses:['neural:integrate'], authorityClass:'intrinsic-neural-dynamics', changes:[{target:'brain.response',before:0,after:1}] }; }
function refTrace() { return { kind:'DomainTransition', domainKind:'neural', name:'brain.trace', status:'realized', step:1, witnesses:['neural:trace'], authorityClass:'intrinsic-neural-dynamics', changes:[{target:'brain.trace',before:0,after:1}] }; }
function nativeIntegrate() { return { rule:R1,status:'realized',witnesses:['neural:integrate',W1],changes:[{target:'brain.response',before:0,after:1}] }; }
function nativeTrace() { return { rule:R2,status:'realized',witnesses:['neural:trace',W2],changes:[{target:'brain.trace',before:0,after:1}] }; }

test('active neural pathways produce exact domain receipt parity', () => {
  const report = verifyFoundationDomainReceiptParity(lowering(), [refIntegrate(), refTrace()], [nativeIntegrate(), nativeTrace()], semanticValue);
  assert.equal(report.ok, true);
  assert.equal(report.activeReferenceReceiptCount, 2);
  assert.equal(report.rootAlgorithm, FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM);
  assert.ok(report.entries.every(entry => entry.checks.originalWitnessesPreserved));
});

test('inactive neural pathway is aligned only when reference and native both omit it', () => {
  const report = verifyFoundationDirectLoweringLineage(lowering(), [nativeTrace()], [refTrace()]);
  assert.equal(report.ok, true);
  assert.equal(report.entries[0].referenceActive, false);
  assert.equal(report.entries[0].checks.inactiveStepAligned, true);
});

test('neural lineage requires reference execution evidence for conditional inactivity', () => {
  const report = verifyFoundationDirectLoweringLineage(lowering(), [nativeIntegrate(), nativeTrace()]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.referenceExecutionEvidencePresent, false);
});

test('native execution of an inactive neural pathway fails closed', () => {
  const report = verifyFoundationDomainReceiptParity(lowering(), [refTrace()], [nativeIntegrate(), nativeTrace()], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.exactNativeRecord, false);
});

test('active neural pathway missing from native history fails closed', () => {
  const report = verifyFoundationDomainReceiptParity(lowering(), [refIntegrate(), refTrace()], [nativeTrace()], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.exactNativeRecord, false);
});

test('neural receipt binds original pathway witnesses', () => {
  const bad = refIntegrate(); bad.witnesses = ['wrong'];
  const report = verifyFoundationDomainReceiptParity(lowering(), [bad, refTrace()], [nativeIntegrate(), nativeTrace()], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.originalWitnessesPreserved, false);
});

test('neural receipt rejects extra native state mutation', () => {
  const bad = nativeIntegrate(); bad.changes.push({target:'brain.secret',before:0,after:1});
  const report = verifyFoundationDomainReceiptParity(lowering(), [refIntegrate(), refTrace()], [bad, nativeTrace()], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.nativeTargetsExact, false);
});

test('neural receipt preserves pathway transaction order', () => {
  const report = verifyFoundationDomainReceiptParity(lowering(), [refIntegrate(), refTrace()], [nativeTrace(), nativeIntegrate()], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.nativeOrderPreserved, false);
});

test('neural receipt root binds pathway and change-mode metadata', () => {
  const baseline = verifyFoundationDomainReceiptParity(lowering(), [refIntegrate(), refTrace()], [nativeIntegrate(), nativeTrace()], semanticValue);
  const changed = structuredClone(lowering()); changed.lowered[0].changeModes = ['inhibit'];
  const report = verifyFoundationDomainReceiptParity(changed, [refIntegrate(), refTrace()], [nativeIntegrate(), nativeTrace()], semanticValue);
  assert.equal(report.ok, true);
  assert.notEqual(report.receiptRoot, baseline.receiptRoot);
});

test('top-level native parity can certify neural active/inactive pathway alignment without wider claims', async () => {
  const referenceState = { 'brain.response': 0, 'brain.trace': 1 };
  const nativeState = { ...referenceState };
  const result = await verifyFoundationDirectNativeParity({name:'Neural'}, {
    compileProgram: value => value,
    compileDirectBytecode: async () => ({ok:true,bytecode:new Uint8Array([82,67,76,66]),foundationDirectLowering:lowering()}),
    runReference: async () => ({state:referenceState,history:[refTrace()]}),
    runNative: async () => ({state:nativeState,semanticStateRoot:root(nativeState),nativeStateRoot:'native-root',stateRootVerified:true,stateRootParity:true,history:[nativeTrace()]}),
    semanticStateRoot:root, semanticValue,
  });
  assert.equal(result.status, 'native-verified');
  assert.equal(result.domainReceipt.entries[0].referenceActive, false);
  assert.equal(result.truthBoundary.neuralInactivePathwayRequiresReferenceAndNativeAbsence, true);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
});
