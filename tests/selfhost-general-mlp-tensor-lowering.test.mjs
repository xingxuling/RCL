import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { buildGeneralMlpTensorPlan } from '../scripts/run-k08-general-mlp-tensor-lowering.mjs';
import {
  generalMlpTensorLoweringCanonical,
  runSelfHostedGeneralMlpTensorLowering,
} from '../src/selfhost-general-mlp-tensor-lowering.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const root = path.resolve('.');
const sourcePath = path.join(root, 'examples', 'native-ai', 'general-mlp.rcl');
const contractPath = path.join(root, 'examples', 'native-ai', 'general-mlp-contract.v0.1.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const bindings = {
  modelSourceSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
  contractRoot: evidenceRoot(contract),
};

test('AI009 RCL native self-host lowering admits the existing generic General MLP Tensor plan', { timeout: 180_000 }, () => {
  const built = buildGeneralMlpTensorPlan(contract, {
    semanticOwner: 'RCL',
    ...bindings,
    lowering: 'generic-tensor-ssa-plan-v0.1',
  });
  const report = runSelfHostedGeneralMlpTensorLowering(built.plan, bindings, { requireNativeStateRoot: true });

  assert.equal(report.lowering.status, 'accepted');
  assert.equal(report.lowering.accepted, true);
  assert.equal(report.evaluation.manifestRootValid, true);
  assert.equal(report.evaluation.genericOnly, true);
  assert.equal(report.evaluation.planCardinalityValid, true);
  assert.equal(report.native.stateRootVerified, true);
  assert.equal(report.manifest.nodeCount, built.plan.nodes.length);
  assert.equal(report.lowering.operationTotal, built.plan.nodes.length);
  const expectedInventory = new Map();
  for (const node of built.plan.nodes) expectedInventory.set(node.operation, (expectedInventory.get(node.operation) ?? 0) + 1);
  assert.deepEqual(
    report.manifest.operationInventory,
    [...expectedInventory.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
});

test('AI009 RCL admission rejects model-special operations and cardinality drift', { timeout: 120_000 }, () => {
  const invalid = {
    format: 'rcl.tensor-execution-plan.v0.1',
    tensors: [{ id: 'x' }],
    nodes: [{ operation: 'mlp_special' }],
    outputs: ['out'],
  };
  const rejected = runSelfHostedGeneralMlpTensorLowering(invalid, bindings, { requireNativeStateRoot: true });
  assert.equal(rejected.lowering.status, 'rejected');
  assert.equal(rejected.lowering.accepted, false);
  assert.equal(rejected.evaluation.genericOnly, false);
  assert.equal(rejected.evaluation.planCardinalityValid, true);

  const built = buildGeneralMlpTensorPlan(contract, bindings);
  const drifted = runSelfHostedGeneralMlpTensorLowering(built.plan, bindings, {
    declaredManifestRoot: '0'.repeat(64),
    requireNativeStateRoot: true,
  });
  assert.equal(drifted.lowering.accepted, false);
  assert.equal(drifted.evaluation.manifestRootValid, false);
});

test('AI009 self-host admission is deterministic and canonical', { timeout: 120_000 }, () => {
  const built = buildGeneralMlpTensorPlan(contract, bindings);
  const first = runSelfHostedGeneralMlpTensorLowering(built.plan, bindings, { requireNativeStateRoot: true });
  const second = runSelfHostedGeneralMlpTensorLowering(built.plan, bindings, { requireNativeStateRoot: true });
  assert.equal(first.reportRoot, second.reportRoot);
  assert.deepEqual(generalMlpTensorLoweringCanonical(first), generalMlpTensorLoweringCanonical(second));
});
