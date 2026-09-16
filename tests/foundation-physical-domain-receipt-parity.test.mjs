import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM,
  verifyFoundationDirectLoweringLineage,
  verifyFoundationDomainReceiptParity,
  verifyFoundationDirectNativeParity,
} from '../src/foundation-direct-native-parity.mjs';

const RULE1 = '__rcl_foundation_physical_world_fall_0_1';
const RULE2 = '__rcl_foundation_physical_world_fall_0_2';
const W1 = 'rcl:foundation:physical:world.fall:step:1';
const W2 = 'rcl:foundation:physical:world.fall:step:2';
const LAW_WITNESS = 'physical:gravity';

function semanticValue(value) {
  if (Array.isArray(value)) return value.map(semanticValue);
  if (!value || typeof value !== 'object') return value;
  if (value.kind === 'NumberValue') return value.value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, semanticValue(item)]));
}

function stateRoot(state) {
  return `root:${JSON.stringify(semanticValue(state))}`;
}

function physicalLowering() {
  return {
    lowered: [
      {
        domain: 'physical', declaration: 'world.fall', directive: 'Advance', directiveIndex: 0,
        syntheticRule: RULE1, stateTargets: ['world.velocity', 'world.position'], witness: W1,
        authorityClass: 'natural-law', sourceReality: 'world', stepIndex: 1, stepCount: 2,
        dtExpression: { kind: 'CallExpr', name: 'seconds', args: [{ kind: 'LiteralExpr', valueType: 'Number', value: 1 }] },
        originalWitnesses: [LAW_WITNESS],
      },
      {
        domain: 'physical', declaration: 'world.fall', directive: 'Advance', directiveIndex: 0,
        syntheticRule: RULE2, stateTargets: ['world.velocity', 'world.position'], witness: W2,
        authorityClass: 'natural-law', sourceReality: 'world', stepIndex: 2, stepCount: 2,
        dtExpression: { kind: 'CallExpr', name: 'seconds', args: [{ kind: 'LiteralExpr', valueType: 'Number', value: 1 }] },
        originalWitnesses: [LAW_WITNESS],
      },
    ],
    summary: { loweredCount: 2 },
  };
}

function change(step) {
  return step === 1
    ? [
      { target: 'world.velocity', before: 0, after: -1 },
      { target: 'world.position', before: 10, after: 10 },
    ]
    : [
      { target: 'world.velocity', before: -1, after: -2 },
      { target: 'world.position', before: 10, after: 9 },
    ];
}

function reference(step) {
  return {
    kind: 'DomainTransition', domainKind: 'physical', name: 'world.fall', status: 'realized',
    step, dt: { kind: 'Quantity', type: 'Time', value: 1, unit: 's' },
    witnesses: [LAW_WITNESS], authorityClass: 'natural-law', changes: change(step),
  };
}

function native(step) {
  return {
    rule: step === 1 ? RULE1 : RULE2, status: 'realized',
    witnesses: [LAW_WITNESS, step === 1 ? W1 : W2], changes: change(step),
  };
}

test('active physical steps produce exact domain receipt parity and deterministic root', () => {
  const lowering = physicalLowering();
  const report = verifyFoundationDomainReceiptParity(lowering, [reference(1), reference(2)], [native(1), native(2)], semanticValue);
  assert.equal(report.ok, true);
  assert.equal(report.activeReferenceReceiptCount, 2);
  assert.equal(report.referenceCoverageExact, true);
  assert.equal(report.referenceOrderPreserved, true);
  assert.equal(report.nativeOrderPreserved, true);
  assert.equal(report.rootAlgorithm, FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM);
  assert.match(report.receiptRoot, /^[0-9a-f]{64}$/);
  assert.ok(report.entries.every(entry => entry.checks.originalWitnessesPreserved));
});

test('physical lowering lineage accepts inactive step only when reference and native histories both omit it', () => {
  const lowering = physicalLowering();
  const report = verifyFoundationDirectLoweringLineage(lowering, [native(1)], [reference(1)]);
  assert.equal(report.ok, true);
  assert.equal(report.entries[1].referenceActive, false);
  assert.equal(report.entries[1].nativeRecordCount, 0);
  assert.equal(report.entries[1].checks.inactiveStepAligned, true);
});

test('physical lineage fails closed without reference execution evidence', () => {
  const report = verifyFoundationDirectLoweringLineage(physicalLowering(), [native(1), native(2)]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.referenceExecutionEvidencePresent, false);
});

test('inactive physical step fails if native runtime executes its synthetic rule', () => {
  const report = verifyFoundationDomainReceiptParity(physicalLowering(), [reference(1)], [native(1), native(2)], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[1].referenceActive, false);
  assert.equal(report.entries[1].checks.exactNativeRecord, false);
  assert.equal(report.entries[1].checks.inactiveStepAligned, false);
});

test('active physical step fails if its native transaction is missing', () => {
  const report = verifyFoundationDomainReceiptParity(physicalLowering(), [reference(1), reference(2)], [native(1)], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[1].checks.exactNativeRecord, false);
});

test('physical receipt binds original law witnesses', () => {
  const badReference = reference(1);
  badReference.witnesses = ['wrong'];
  const report = verifyFoundationDomainReceiptParity(physicalLowering(), [badReference, reference(2)], [native(1), native(2)], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.originalWitnessesPreserved, false);
});

test('physical receipt rejects extra native mutation beyond declared state targets', () => {
  const badNative = native(1);
  badNative.changes.push({ target: 'secret.extra', before: 0, after: 1 });
  const report = verifyFoundationDomainReceiptParity(physicalLowering(), [reference(1), reference(2)], [badNative, native(2)], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.nativeTargetsExact, false);
});

test('physical receipt preserves native transaction order across expanded steps', () => {
  const report = verifyFoundationDomainReceiptParity(physicalLowering(), [reference(1), reference(2)], [native(2), native(1)], semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.nativeOrderPreserved, false);
});

test('physical receipt root binds evaluated reference dt evidence', () => {
  const baseline = verifyFoundationDomainReceiptParity(physicalLowering(), [reference(1), reference(2)], [native(1), native(2)], semanticValue);
  const changedReference = reference(1);
  changedReference.dt = { kind: 'Quantity', type: 'Time', value: 2, unit: 's' };
  const changed = verifyFoundationDomainReceiptParity(physicalLowering(), [changedReference, reference(2)], [native(1), native(2)], semanticValue);
  assert.equal(changed.ok, true);
  assert.notEqual(changed.receiptRoot, baseline.receiptRoot);
});

test('top-level native parity can certify bounded physical active and inactive steps without upgrading wider claims', async () => {
  const lowering = physicalLowering();
  const referenceState = { 'world.velocity': -1, 'world.position': 10 };
  const nativeState = { ...referenceState };
  const result = await verifyFoundationDirectNativeParity({ name: 'Physical' }, {
    compileProgram: value => value,
    compileDirectBytecode: async () => ({ ok: true, bytecode: new Uint8Array([82, 67, 76, 66]), foundationDirectLowering: lowering }),
    runReference: async () => ({ state: referenceState, history: [reference(1)] }),
    runNative: async () => ({
      state: nativeState,
      semanticStateRoot: stateRoot(nativeState),
      nativeStateRoot: 'native-root', stateRootVerified: true, stateRootParity: true,
      history: [native(1)],
    }),
    semanticStateRoot: stateRoot,
    semanticValue,
  });
  assert.equal(result.status, 'native-verified');
  assert.equal(result.parity.loweringLineage, true);
  assert.equal(result.parity.domainReceipt, true);
  assert.equal(result.domainReceipt.entries[1].referenceActive, false);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
  assert.equal(result.truthBoundary.physicalInactiveStepRequiresReferenceAndNativeAbsence, true);
});
