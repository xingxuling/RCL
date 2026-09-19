import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import {
  energyReceiptRoot,
  verifyFoundationEnergyReceiptParity,
} from '../src/foundation-energy-native-parity.mjs';

const source = [
  'reality EnergyReceiptParity {',
  '  energy grid {',
  '    reservoir source : Energy = joules(100)',
  '    reservoir load : Energy = joules(0)',
  '    flow charge from source to load amount joules(40) efficiency 0.9 evidence "meter:grid-transfer"',
  '    preserve grid.source >= joules(0)',
  '    preserve grid.load >= joules(0)',
  '    witness "energy:atomic-transfer"',
  '  }',
  '  energize grid',
  '}',
  '',
].join('\n');

async function fixture() {
  const program = compileReality(source);
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  const reference = await runReality(program);
  const item = compiled.foundationEnergyDirectLowering.lowered[0];
  const referenceReceipt = reference.history.find(record => (
    record?.kind === 'DomainTransition'
    && record?.domainKind === 'energy'
    && record?.name === item.declaration
  ));
  assert.ok(referenceReceipt);
  const nativeReceipt = {
    ...structuredClone(referenceReceipt),
    rule: item.syntheticRule,
    witnesses: [...(referenceReceipt.witnesses ?? []), item.witness],
  };
  return { lowering: compiled.foundationEnergyDirectLowering, referenceReceipt, nativeReceipt };
}

test('Energy receipt parity binds one reference DomainTransition to one synthetic native transaction', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const report = verifyFoundationEnergyReceiptParity(lowering, [referenceReceipt], [nativeReceipt]);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, true);
  assert.equal(report.entries[0].checks.boundaryRootsEquivalent, true);
  assert.equal(report.entries[0].checks.syntheticWitnessPresent, true);
  assert.equal(report.entries[0].checks.referenceWitnessesPreserved, true);
  assert.match(report.receiptRoot, /^[0-9a-f]{64}$/);
  assert.equal(report.receiptRoot, energyReceiptRoot(report));
});

test('Energy receipt parity fails closed on a native transition-value mismatch', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  mutated.changes[1].after = { kind: 'Quantity', type: 'Energy', unit: 'J', value: 35 };
  const report = verifyFoundationEnergyReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, false);
});

test('Energy receipt parity fails closed when the synthetic lowering witness is absent', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  mutated.witnesses = [...(referenceReceipt.witnesses ?? [])];
  const report = verifyFoundationEnergyReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.syntheticWitnessPresent, false);
});

test('Energy receipt parity rejects duplicate native receipts for one synthetic rule', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const report = verifyFoundationEnergyReceiptParity(
    lowering,
    [referenceReceipt],
    [nativeReceipt, structuredClone(nativeReceipt)],
  );
  assert.equal(report.ok, false);
  assert.equal(report.nativeCoverageExact, false);
});
