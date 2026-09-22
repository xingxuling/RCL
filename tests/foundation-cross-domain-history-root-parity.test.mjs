import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_ALGORITHM,
  verifyFoundationCrossDomainHistoryRootParity,
} from '../src/foundation-cross-domain-history-root-parity.mjs';

const r = ch => ch.repeat(64);
const receipt = overrides => ({
  ok: true,
  referenceOrderPreserved: true,
  nativeOrderPreserved: true,
  entries: [
    {
      index: 0, domain: 'physical', declaration: 'world.drift', directive: 'Advance', directiveIndex: 0,
      referenceActive: true, nativeActive: true, referenceBeforeRoot: r('1'), nativeBeforeRoot: r('1'),
      referenceAfterRoot: r('2'), nativeAfterRoot: r('2'),
      referenceChanges: [{ target: 'world.x', before: 0, after: 1 }], nativeChanges: [{ target: 'world.x', before: 0, after: 1 }], ok: true,
    },
    {
      index: 1, domain: 'perception', declaration: 'sight', directive: 'Observe', directiveIndex: 1,
      referenceActive: true, nativeActive: true, referenceBeforeRoot: r('2'), nativeBeforeRoot: r('2'),
      referenceAfterRoot: r('3'), nativeAfterRoot: r('3'),
      referenceChanges: [{ target: 'sight.x', before: null, after: 1 }], nativeChanges: [{ target: 'sight.x', before: null, after: 1 }], ok: true,
    },
  ],
  ...overrides,
});

function withNeural(base = receipt()) {
  const copy = structuredClone(base);
  copy.entries.push({
    index: 2, domain: 'neural', declaration: 'brain.integrate', directive: 'Propagate', directiveIndex: 2,
    referenceActive: true, nativeActive: true, referenceBeforeRoot: r('3'), nativeBeforeRoot: r('3'),
    referenceAfterRoot: r('4'), nativeAfterRoot: r('4'),
    referenceChanges: [{ target: 'brain.response', before: 0, after: 0.5 }], nativeChanges: [{ target: 'brain.response', before: 0, after: 0.5 }], ok: true,
  });
  return copy;
}

test('two verified direct domains produce one equal cross-domain history root', () => {
  const result = verifyFoundationCrossDomainHistoryRootParity(receipt());
  assert.equal(result.required, true);
  assert.equal(result.ok, true);
  assert.equal(result.rootAlgorithm, FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_ALGORITHM);
  assert.deepEqual(result.domains, ['physical', 'perception']);
  assert.equal(result.referenceHistoryRoot, result.nativeHistoryRoot);
  assert.match(result.referenceHistoryRoot, /^[0-9a-f]{64}$/);
  assert.equal(result.truthBoundary.fullHistoryParityClaimed, false);
});

test('three verified direct domains include Neural in the same ordered history root', () => {
  const result = verifyFoundationCrossDomainHistoryRootParity(withNeural());
  assert.equal(result.required, true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.domains, ['physical', 'perception', 'neural']);
  assert.equal(result.domainCount, 3);
  assert.equal(result.entryCount, 3);
  assert.equal(result.checks.referenceContinuityPreserved, true);
  assert.equal(result.checks.nativeContinuityPreserved, true);
  assert.equal(result.referenceHistoryRoot, result.nativeHistoryRoot);
  assert.match(result.referenceHistoryRoot, /^[0-9a-f]{64}$/);
});

test('boundary-root drift fails closed even when transition values remain equal', () => {
  const bad = receipt();
  bad.entries[1] = { ...bad.entries[1], nativeAfterRoot: r('4') };
  const result = verifyFoundationCrossDomainHistoryRootParity(bad);
  assert.equal(result.required, true);
  assert.equal(result.ok, false);
  assert.equal(result.checks.everyBoundaryAndTransitionExact, false);
  assert.notEqual(result.referenceHistoryRoot, result.nativeHistoryRoot);
});

test('transition-value drift fails closed', () => {
  const bad = receipt();
  bad.entries[0] = { ...bad.entries[0], nativeChanges: [{ target: 'world.x', before: 0, after: 2 }] };
  const result = verifyFoundationCrossDomainHistoryRootParity(bad);
  assert.equal(result.ok, false);
  assert.equal(result.checks.everyBoundaryAndTransitionExact, false);
});

test('Neural transition drift fails closed in a three-domain history', () => {
  const bad = withNeural();
  bad.entries[2] = { ...bad.entries[2], nativeChanges: [{ target: 'brain.response', before: 0, after: 1 }] };
  const result = verifyFoundationCrossDomainHistoryRootParity(bad);
  assert.equal(result.ok, false);
  assert.equal(result.checks.everyBoundaryAndTransitionExact, false);
});

test('order evidence is mandatory for a cross-domain claim', () => {
  const result = verifyFoundationCrossDomainHistoryRootParity(receipt({ nativeOrderPreserved: false }));
  assert.equal(result.ok, false);
  assert.equal(result.checks.nativeOrderPreserved, false);
});

test('single-domain receipt stays compatible and makes no cross-domain claim', () => {
  const one = receipt();
  one.entries = [one.entries[0]];
  const result = verifyFoundationCrossDomainHistoryRootParity(one);
  assert.equal(result.required, false);
  assert.equal(result.ok, true);
  assert.equal(result.referenceHistoryRoot, null);
  assert.equal(result.rootsEqual, null);
});

test('staged genetic and living entries remain outside the bounded cross-domain root', () => {
  const mixed = withNeural();
  mixed.entries.push({ index: 3, domain: 'genetic', ok: false });
  mixed.entries.push({ index: 4, domain: 'living', ok: false });
  const result = verifyFoundationCrossDomainHistoryRootParity(mixed);
  assert.equal(result.ok, true);
  assert.equal(result.entryCount, 3);
  assert.equal(result.truthBoundary.stagedGeneticHistoryExcluded, true);
  assert.equal(result.truthBoundary.livingStagedHistoryExcluded, true);
});
