import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runRecursiveGovernanceKernelDemo,
  buildRecursiveGovernanceKernelSpec,
  runRecursiveGovernanceKernel,
  recursiveGovernanceKernelCanonicalRoot,
} from '../src/recursive-governance-kernel.mjs';

test('recursive governance kernel establishes governance over living artifacts', () => {
  const bundle = runRecursiveGovernanceKernelDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.recursiveGovernanceKernelEstablished, true);
  assert.equal(bundle.result.governancePolicyCount, 8);
  assert.equal(bundle.result.authorityPolicyCount, 8);
  assert.equal(bundle.result.riskBudgetCount, 8);
  assert.equal(bundle.result.stopConditionSetCount, 8);
  assert.equal(bundle.result.permissionMatrixCount, 8);
  assert.equal(bundle.result.auditCadenceCount, 8);
  assert.equal(bundle.result.releaseGateCount, 8);
  assert.equal(bundle.result.rollbackObligationCount, 8);
  assert.equal(bundle.result.humanFinalAuthorityGateCount, 8);
  assert.equal(bundle.result.averageGovernanceScore, 1);
  assert.equal(bundle.result.superAppPackagingHandoffReady, true);
});

test('recursive governance kernel is deterministic', () => {
  const spec = buildRecursiveGovernanceKernelSpec();
  const a = runRecursiveGovernanceKernel(spec).result.rootHash;
  const b = runRecursiveGovernanceKernel(spec).result.rootHash;
  assert.equal(a, b);
  assert.equal(a, recursiveGovernanceKernelCanonicalRoot(spec));
});

test('governance policies are fail-closed and human-authorized', () => {
  const bundle = runRecursiveGovernanceKernelDemo();
  for (const policy of bundle.policies) {
    assert.equal(policy.authorityPolicy.humanFinalAuthority, true);
    assert.equal(policy.releaseGate.gateMode, 'fail-closed');
    assert.ok(policy.stopConditions.stopConditions.includes('human-kill-switch-triggered'));
    assert.ok(policy.permissionMatrix.forbiddenActions.includes('overwrite-evidence-root'));
    assert.equal(policy.rollbackObligation.rollbackRequired, true);
  }
});
