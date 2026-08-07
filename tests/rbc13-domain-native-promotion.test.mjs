import assert from 'node:assert/strict';
import test from 'node:test';
import {
  promoteAllRbc13DomainOrgans,
} from '../src/rbc13-domain-native-promotion.mjs';
import { resolveDomainCandidateCompiler } from '../src/rbc13-domain-native-runtime.mjs';

const compiler = resolveDomainCandidateCompiler();

test('Domain Organ Native Promotion reports infrastructure blocking instead of fabricating verification', { skip: Boolean(compiler) }, async () => {
  const suite = await promoteAllRbc13DomainOrgans();
  assert.equal(suite.status, 'native-blocked');
  assert.equal(suite.verified, false);
  assert.equal(suite.blocker, 'native-compiler-missing');
  assert.deepEqual(suite.reports, []);
});

test('all four admitted organs require operation differential + current-source candidate VM + semantic-root replay', { skip: !compiler, timeout: 180_000 }, async () => {
  const suite = await promoteAllRbc13DomainOrgans({
    compiler,
    repeats: 2,
    nativeRepeats: 2,
    timeoutMs: 5_000,
    differentialTimeout: 60_000,
    runTimeout: 30_000,
    buildTimeout: 120_000,
  });

  assert.equal(suite.status, 'native-verified');
  assert.equal(suite.verified, true);
  assert.equal(suite.reports.length, 4);
  assert.equal(suite.verifiedOrgans.length, 4);
  assert.match(suite.hostRoot, /^[a-f0-9]{64}$/);
  assert.match(suite.sharedImplementationRoot, /^[a-f0-9]{64}$/);

  for (const report of suite.reports) {
    assert.equal(report.status, 'native-verified', `${report.operationKey}: ${report.gaps.join(', ')}`);
    assert.equal(report.verified, true);
    assert.equal(report.promotionEligible, true);
    assert.equal(report.failedCaseCount, 0);
    assert.equal(report.verifiedCaseCount, report.caseCount);
    assert.equal(report.checks.semanticDifferentialPassed, true);
    assert.equal(report.checks.nativeDifferentialPassed, true);
    assert.equal(report.checks.currentNativeEquivalent, true);
    assert.equal(report.checks.bytecodeDeterministic, true);
    assert.equal(report.checks.replayDeterministic, true);
    assert.equal(report.checks.nativeRootsVerified, true);
    assert.equal(report.nativeVm.experimental, true);
    assert.equal(report.nativeVm.materializedFromCurrentSource, true);
    assert.match(report.root, /^[a-f0-9]{64}$/);
  }

  for (const organ of suite.verifiedOrgans) {
    assert.equal(organ.evidenceTier, 'native-verified');
    assert.equal(organ.canonicalAdmission, false);
    assert.match(organ.proof.nativePromotionRoot, /^[a-f0-9]{64}$/);
  }
});
