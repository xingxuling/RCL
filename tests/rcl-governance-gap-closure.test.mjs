import test from 'node:test';
import assert from 'node:assert/strict';

import { createAsilGovernedEnvelope } from '../src/asil-governed-envelope.mjs';
import { createSemanticProfileTransition } from '../src/semantic-decompression.mjs';
import { createElasticNeuralOrganManifest, ElasticNeuralOrganLifecycle } from '../src/elastic-neural-organ-runtime.mjs';

const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64), D = 'd'.repeat(64);

test('AI019 ASIL governed envelope preserves meaning ownership/root and grants no authority', () => {
  const envelope = createAsilGovernedEnvelope({
    meaningOwner: 'asil', meaningRoot: A, meaningFormat: 'asil.meaning-graph.v1', meaningVersion: '1',
    evidenceRoots: [C, B], unknownRefs: ['unknown:z', 'unknown:a'],
    condition: { locale: 'zh-CN' }, effectScope: { mode: 'candidate-only' },
    authority: { mode: 'candidate-only' }, transition: { mode: 'proposal-only' }, rollback: { required: true },
  });
  assert.equal(envelope.meaning.owner, 'asil');
  assert.equal(envelope.meaning.root, A);
  assert.deepEqual(envelope.evidenceRoots, [B, C]);
  assert.deepEqual(envelope.unknownRefs, ['unknown:a', 'unknown:z']);
  assert.equal(envelope.ownership.governedEnvelope, 'rcl');
  assert.equal(envelope.authority.authorityGranted, false);
  assert.equal(envelope.transition.committed, false);
  assert.equal(envelope.envelopeRoot.length, 64);
});

test('AI019 envelope rejects owner drift, invalid roots and authority/commit laundering', () => {
  const base = { meaningOwner: 'asil', meaningRoot: A, meaningFormat: 'asil.v1', meaningVersion: '1' };
  assert.throws(() => createAsilGovernedEnvelope({ ...base, meaningOwner: 'rcl' }), /RCL_ASIL_MEANING_OWNER_MISMATCH/u);
  assert.throws(() => createAsilGovernedEnvelope({ ...base, meaningRoot: 'x' }), /RCL_ASIL_MEANING_ROOT_INVALID/u);
  assert.throws(() => createAsilGovernedEnvelope({ ...base, authority: { authorityGranted: true } }), /RCL_ASIL_MEANING_CANNOT_GRANT_AUTHORITY/u);
  assert.throws(() => createAsilGovernedEnvelope({ ...base, authority: { rclEvidenceCommitPerformed: true } }), /RCL_ASIL_ENVELOPE_CANNOT_CLAIM_COMMIT/u);
});

test('AI020 semantic decompression reveals only already-encoded withheld information', () => {
  const transition = createSemanticProfileTransition({
    genomeRoot: A,
    inventory: ['intent', 'relation', 'evidence', 'unknown-x'],
    from: { level: 'C3', revealed: ['intent'], withheld: ['relation', 'evidence'], unknown: ['unknown-x'] },
    to: { level: 'C1', revealed: ['intent', 'relation', 'evidence'], withheld: [], unknown: ['unknown-x'] },
  });
  assert.deepEqual(transition.newlyRevealed, ['evidence', 'relation']);
  assert.equal(transition.informationIntroduced, false);
  assert.equal(transition.genomeIdentityChanged, false);
  assert.equal(transition.capabilityRecoveryRatio, 1);
  assert.equal(transition.rollback.genomeRoot, A);
  assert.equal(transition.transitionRoot.length, 64);
});

test('AI020 semantic decompression fails on compression, new information or unknown mutation', () => {
  const common = { genomeRoot: A, inventory: ['a', 'b', 'u'] };
  assert.throws(() => createSemanticProfileTransition({ ...common,
    from: { level: 'C1', revealed: ['a'], withheld: ['b'], unknown: ['u'] },
    to: { level: 'C3', revealed: ['a', 'b'], withheld: [], unknown: ['u'] },
  }), /RCL_SEMANTIC_DECOMPRESSION_DIRECTION_INVALID/u);
  assert.throws(() => createSemanticProfileTransition({ ...common,
    from: { level: 'C3', revealed: ['a'], withheld: ['b'], unknown: ['u'] },
    to: { level: 'C2', revealed: ['a', 'u'], withheld: ['b'], unknown: [] },
  }), /RCL_SEMANTIC_UNKNOWN_CANNOT_CHANGE_DURING_DECOMPRESSION/u);
  assert.throws(() => createSemanticProfileTransition({ ...common,
    from: { level: 'C3', revealed: ['a'], withheld: ['b'], unknown: ['u'] },
    to: { level: 'C2', revealed: ['a'], withheld: [], unknown: ['u'] },
  }), /RCL_SEMANTIC_TO_PARTITION_NOT_INVENTORY/u);
});

test('AI021 elastic neural organ lifecycle preserves identity and requires provider-bound atomic settlement', () => {
  const manifest = createElasticNeuralOrganManifest({
    organId: 'semantic-organ', identityRoot: A, semanticOwner: 'asil', artifactRoots: [B], dependencyRoots: [C],
    capabilities: ['semantic.canonicalize'], resourceBudget: { cpu: 4, ramBytes: 1024, vramBytes: 2048, networkBytesPerSecond: 4096 },
  });
  const runtime = new ElasticNeuralOrganLifecycle(manifest);
  const stage = runtime.plan('STAGED');
  const staged = runtime.settle(stage, {
    planRoot: stage.planRoot, manifestRoot: manifest.manifestRoot, status: 'SUCCESS', atomic: true,
    receiptRoot: D, resourceUsage: { cpu: 1, ramBytes: 512, vramBytes: 0, networkBytesPerSecond: 100 },
  });
  assert.equal(runtime.state, 'STAGED');
  assert.equal(staged.identityRoot, A);
  assert.equal(staged.semanticOwner, 'asil');
  assert.equal(staged.semanticOwnershipTransferred, false);

  const activate = runtime.plan('ACTIVE');
  assert.throws(() => runtime.settle(activate, {
    planRoot: 'e'.repeat(64), manifestRoot: manifest.manifestRoot, status: 'SUCCESS', atomic: true,
    receiptRoot: D, resourceUsage: {},
  }), /RCL_ELASTIC_PROVIDER_RECEIPT_ROOT_MISMATCH/u);
  const active = runtime.settle(activate, {
    planRoot: activate.planRoot, manifestRoot: manifest.manifestRoot, status: 'SUCCESS', atomic: true,
    receiptRoot: D, resourceUsage: { cpu: 2, ramBytes: 800, vramBytes: 1000, networkBytesPerSecond: 500 },
  });
  assert.equal(runtime.state, 'ACTIVE');
  assert.equal(active.identityPreserved, true);
  assert.equal(active.canonicalPromotionPerformed, false);
});

test('AI021 elastic lifecycle fails closed on stale plans, budget overflow and authority escalation', () => {
  const manifest = createElasticNeuralOrganManifest({
    organId: 'x', identityRoot: A, semanticOwner: 'dncs', artifactRoots: [B], capabilities: ['cognition.route'],
    resourceBudget: { cpu: 1, ramBytes: 100, vramBytes: 100, networkBytesPerSecond: 100 },
  });
  const runtime = new ElasticNeuralOrganLifecycle(manifest);
  const stage = runtime.plan('STAGED');
  assert.throws(() => runtime.settle(stage, {
    planRoot: stage.planRoot, manifestRoot: manifest.manifestRoot, status: 'SUCCESS', atomic: true, receiptRoot: D,
    resourceUsage: { cpu: 2 },
  }), /RCL_ELASTIC_RESOURCE_BUDGET_EXCEEDED:cpu/u);
  assert.throws(() => runtime.settle(stage, {
    planRoot: stage.planRoot, manifestRoot: manifest.manifestRoot, status: 'SUCCESS', atomic: true, receiptRoot: D,
    resourceUsage: { cpu: 1 }, canonicalPromotionPerformed: true,
  }), /RCL_ELASTIC_PROVIDER_RECEIPT_AUTHORITY_ESCALATION/u);
});
