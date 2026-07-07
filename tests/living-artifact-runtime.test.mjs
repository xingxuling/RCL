import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runLivingArtifactRuntimeDemo,
  buildLivingArtifactRuntimeSpec,
  runLivingArtifactRuntime,
  livingArtifactRuntimeCanonicalRoot,
} from '../src/living-artifact-runtime.mjs';

test('living artifact demo establishes stateful artifacts', () => {
  const bundle = runLivingArtifactRuntimeDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.livingArtifactRuntimeEstablished, true);
  assert.equal(bundle.result.artifactCount, 8);
  assert.equal(bundle.result.stateCapsuleCount, 8);
  assert.equal(bundle.result.versionLedgerCount, 8);
  assert.equal(bundle.result.branchRegistryCount, 8);
  assert.equal(bundle.result.lifecyclePolicyCount, 8);
  assert.equal(bundle.result.mutationContractCount, 8);
  assert.equal(bundle.result.evidenceContinuityCount, 8);
  assert.equal(bundle.result.humanReviewGateCount, 8);
  assert.equal(bundle.result.averageArtifactScore, 1);
  assert.equal(bundle.result.recursiveGovernanceHandoffReady, true);
});

test('living artifact runtime is deterministic', () => {
  const spec = buildLivingArtifactRuntimeSpec();
  const a = runLivingArtifactRuntime(spec).result.rootHash;
  const b = runLivingArtifactRuntime(spec).result.rootHash;
  assert.equal(a, b);
  assert.equal(a, livingArtifactRuntimeCanonicalRoot(spec));
});

test('living artifacts preserve evidence continuity and branch rules', () => {
  const bundle = runLivingArtifactRuntimeDemo();
  for (const artifact of bundle.artifacts) {
    assert.ok(artifact.stateCapsule.capsuleRoot);
    assert.ok(artifact.evidenceContinuity.continuityRoot);
    assert.equal(artifact.branchRegistry.length, 2);
    assert.ok(artifact.mutationContract.requiredGates.includes('rollback-path-declared'));
    assert.ok(artifact.mutationContract.forbiddenMutations.includes('erase-dissent-ledger'));
  }
});
