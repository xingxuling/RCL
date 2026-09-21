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
  '  facet world.score : Number = 7',
  '  facet decision.allowed : Truth = false',
  '  facet decision.score : Number = 0',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.80 evidence "sensor:score-v1" source "sensor:score"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '    alter decision.score <- belief(mind.score)',
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
  return { compiled, lowering: compiled.foundationKnowledgeDirectLowering, referenceReceipt, nativeReceipt };
}

test('Knowledge native encoding omits every bounded Learn claim initializer so one first transaction owns all claim transitions', async () => {
  const { compiled, lowering } = await fixture();
  const initialization = compiled.foundationKnowledgeNativeInitialization;
  assert.deepEqual(initialization.omittedInitialFacetPaths, ['mind.trusted', 'mind.score']);
  assert.deepEqual(initialization.firstWriteRules, [lowering.lowered[0].syntheticRule]);
  assert.equal(initialization.truthBoundary.omissionPreservesReferencePreLearnRealityBoundary, true);
  assert.equal(initialization.truthBoundary.omittedFacetsAreCreatedByTheFirstNativeTransaction, true);
  assert.equal(initialization.truthBoundary.omittedFacetCount, 2);
  assert.equal(initialization.truthBoundary.genericDeferredFacetSupportClaimed, false);
  assert.equal(Object.hasOwn(initialization, 'program'), false);
});

test('Knowledge receipt parity binds one multi-claim reference Learn transition to one atomic synthetic native transaction', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [nativeReceipt]);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].claimCount, 2);
  assert.deepEqual(report.entries[0].claimPaths, ['mind.score', 'mind.trusted']);
  assert.equal(report.entries[0].formedAtRoots.length, 2);
  assert.notEqual(report.entries[0].formedAtRoots[0].root, report.entries[0].formedAtRoots[1].root);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, true);
  assert.equal(report.entries[0].checks.referenceKnowledgeClaimsExact, true);
  assert.equal(report.entries[0].checks.referenceKnowledgeClaimsAligned, true);
  assert.equal(report.entries[0].checks.formedAtRootsRetained, true);
  assert.equal(report.entries[0].checks.boundaryRootsEquivalent, true);
  assert.equal(report.entries[0].checks.syntheticWitnessPresent, true);
  assert.match(report.receiptRoot, /^[0-9a-f]{64}$/);
  assert.equal(report.receiptRoot, knowledgeReceiptRoot(report));
});

test('Knowledge receipt parity fails closed on one claim-value mismatch inside an atomic multi-claim Learn', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  const target = mutated.changes.find(change => change.target === 'mind.score');
  assert.ok(target);
  target.after.confidence = 0.4;
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, false);
  assert.equal(report.entries[0].checks.referenceKnowledgeClaimsAligned, true);
});

test('Knowledge receipt parity fails closed when one expected claim target is absent from the native transaction', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  mutated.changes = mutated.changes.filter(change => change.target !== 'mind.score');
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.nativeTargetsExact, false);
});

test('Knowledge receipt parity fails closed when one sequential formedAtRoot is replaced by the pre-Learn root', async () => {
  const { lowering, referenceReceipt, nativeReceipt } = await fixture();
  const mutated = structuredClone(nativeReceipt);
  const firstRoot = lowering.lowered[0].formedAtRoots[0].root;
  const second = mutated.changes.find(change => change.target === 'mind.score');
  assert.ok(second);
  second.after.formedAtRoot = firstRoot;
  const report = verifyFoundationKnowledgeReceiptParity(lowering, [referenceReceipt], [mutated]);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.formedAtRootsRetained, false);
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
