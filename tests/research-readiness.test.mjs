import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateResearchReadiness, getResearchReadiness } from '../src/research-readiness.mjs';
import { COVERAGE_MODE, buildUniversalStressMatrix, UNIVERSAL_STRESS_GATES } from '../src/universal-program-stress.mjs';

const evidence = JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/k400-current-evidence.json', import.meta.url), 'utf8'));
const policy = JSON.parse(fs.readFileSync(new URL('../VERSION-CONTRACT.json', import.meta.url), 'utf8')).researchStatus;
const registeredPassCount = evidence.claims.filter(claim => UNIVERSAL_STRESS_GATES.every(gate => claim.gates[gate]?.status === 'PASS')).length;

test('current research maturity comes from the K400 evidence rather than the package number', () => {
  const report = getResearchReadiness();
  assert.equal(report.status, 'RESEARCH_PREVIEW');
  assert.equal(report.formalLanguageRelease, false);
  assert.equal(report.versionPromotionFrozen, true);
  assert.equal(report.k400.totalCells, 400);
  assert.equal(report.k400.passedCells, registeredPassCount);
  assert.equal(report.k400.statusCounts.UNTESTED, 400 - evidence.claims.length);
  assert.equal(report.k400.verdict, registeredPassCount === 400 ? 'COMPLETE' : 'INCOMPLETE');
  assert.equal(report.passedFraction, registeredPassCount / 400);
});

test('raising the build identity or claiming a formal release fails the frozen policy', () => {
  assert.throws(() => evaluateResearchReadiness(evidence, policy, '2.1.0'), /PROMOTION_FROZEN/u);
  assert.throws(() => evaluateResearchReadiness(evidence, { ...policy, formalLanguageRelease: true }, '2.0.0'), /POLICY_INVALID/u);
  assert.throws(() => evaluateResearchReadiness(evidence, { ...policy, versionPromotionFrozen: false }, '2.0.0'), /POLICY_INVALID/u);
});

test('duplicate or unknown cell claims cannot inflate the maturity report', () => {
  const duplicate = structuredClone(evidence); duplicate.claims.push(structuredClone(duplicate.claims[0]));
  assert.throws(() => evaluateResearchReadiness(duplicate, policy, '2.0.0'), /EVIDENCE_INVALID/u);
  const unknown = structuredClone(evidence); unknown.claims[0].id = 'invented::cell';
  assert.throws(() => evaluateResearchReadiness(unknown, policy, '2.0.0'), /EVIDENCE_INVALID/u);
});

test('one missing required gate blocks its cell even when every other gate passes', () => {
  const incomplete = structuredClone(evidence); delete incomplete.claims[0].gates.CORRECT;
  const result = evaluateResearchReadiness(incomplete, policy, '2.0.0');
  assert.equal(result.k400.passedCells, registeredPassCount - 1);
  assert.equal(result.k400.statusCounts.BLOCKED, 1);
  assert.equal(result.k400.verdict, 'INCOMPLETE');
});

test('400 synthetic opaque PASS cells neither complete universal growth nor authorize release', () => {
  const synthetic = { schema: evidence.schema, generation: 'synthetic-test-only', claims: buildUniversalStressMatrix().map(cell => ({
    id: cell.id, coverageMode: COVERAGE_MODE.OPAQUE_DELEGATION, changes: [],
    gates: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, { status: 'PASS', evidence: ['synthetic:test-only'] }])),
  })) };
  const result = evaluateResearchReadiness(synthetic, policy, '2.0.0');
  assert.equal(result.k400.passedCells, 400);
  assert.equal(result.k400.universalGrowthComplete, false);
  assert.equal(result.k400.verdict, 'INCOMPLETE');
  assert.equal(result.formalLanguageRelease, false);
  assert.equal(result.versionPromotionFrozen, true);
});

test('synthetic complete native evidence still requires explicit release review', () => {
  const synthetic = { schema: evidence.schema, generation: 'synthetic-test-only', claims: buildUniversalStressMatrix().map(cell => ({
    id: cell.id, coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC, changes: [],
    gates: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, { status: 'PASS', evidence: ['synthetic:test-only'] }])),
  })) };
  const result = evaluateResearchReadiness(synthetic, policy, '2.0.0');
  assert.equal(result.k400.verdict, 'COMPLETE');
  assert.equal(result.formalLanguageRelease, false);
  assert.equal(result.releaseReviewRequired, true);
  assert.equal(result.versionPromotionFrozen, true);
});
