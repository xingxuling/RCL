import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import {
  knowledgeReceiptRoot,
  verifyFoundationKnowledgeReceiptParity,
} from '../src/foundation-knowledge-native-parity.mjs';

const source = [
  'reality KnowledgeReceiptParity {',
  '  facet world.signal : Truth = true',
  '  facet decision.allowed : Truth = false',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '  }',
  '  learn mind',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

async function fixture() {
  const program = compileReality(source);
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  const reference = await runReality(program);
  const item = compiled.foundationKnowledgeDirectLowering.lowered[0];
  const referenceReceipt = reference.history.find(record => (
    record?.kind === 'DomainTransition'
    && record?.domainKind === 'knowledge'
    && record?.name === item.declaration
  ));
  assert.ok(referenceReceipt);
  const nativeReceipt = {
    ...structuredClone(referenceReceipt),
    rule: item.syntheticRule,
    witnesses: [...(referenceReceipt.witnesses ?? []), item.witness],
  };
  return { lowering: compiled.foundationKnowledgeDirectLowering, referenceReceipt, nativeReceipt };
}

test('Knowledge receipt parity binds one reference Learn transition to one synthetic native transaction', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [nativeReceipt]);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, true);
  assert.equal(report.entries[0].checks.referenceKnowledgeClaimAligned, true);
  assert.equal(report.entries[0].checks.formedAtRootRetained, true);
  assert.equal(report.entries[0].checks.boundaryRootsEquivalent, true);
  assert.equal(report.entries[0].checks.syntheticWitnessPresent, true);
  assert.match(report.receiptRoot, /^[0-9a-f]{64}$/);
  assert.equal(report.receiptRoot, knowledgeReceiptRoot(report));
});

test('Knowledge receipt parity fails closed on a native claim-value mismatch', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  mutated.changes[0].after.confidence = 0.4;
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, false);
});

test('Knowledge receipt parity fails closed when the synthetic lowering witness is absent', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  mutated.witnesses = [...(referenceReceipt.witnesses ?? [])];
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.syntheticWitnessPresent, false);
});

test('Knowledge receipt parity rejects duplicate native receipts for one synthetic rule', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const report = verifyFoundationKnowledgeReceiptParity(
    lowering,
    [referenceReceipt],
    [nativeReceipt, structuredClone(nativeReceipt)],
  );
  assert.equal(report.ok, false);
  assert.equal(report.nativeCoverageExact, false);
});

test('Knowledge receipt parity fails closed on pre-Learn boundary-root drift', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  mutated.beforeRoot = '0'.repeat(64);
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.boundaryRootsEquivalent, false);
});
