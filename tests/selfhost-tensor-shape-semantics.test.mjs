import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  runSelfHostedTensorShapeSemantics,
  tensorShapeSemanticsCanonical,
} from '../src/selfhost-tensor-shape-semantics.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const root = path.resolve('.');
const sourcePath = path.join(root, 'examples', 'native-ai', 'tensor-genome.rcl');
const contractPath = path.join(root, 'examples', 'native-ai', 'tensor-shape-semantics-contract.v0.1.json');
const bindings = {
  modelSourceSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
  contractRoot: evidenceRoot(JSON.parse(fs.readFileSync(contractPath, 'utf8'))),
};

function product(shape) {
  return shape.reduce((total, value) => total * value, 1);
}

function strides(shape) {
  const result = [];
  for (let index = 0; index < shape.length; index += 1) {
    result.push(product(shape.slice(index + 1)));
  }
  return result;
}

function tensor(id, shape, overrides = {}) {
  return {
    id,
    shape,
    strides: strides(shape),
    dtype: 'f64',
    layout: 'row-major',
    device: 'cpu',
    storageIdentity: `storage:${id}`,
    elementCount: product(shape),
    ...overrides,
  };
}

function fixture() {
  return {
    format: 'rcl.tensor-shape-semantics.v0.1',
    dtypePolicy: ['f64'],
    tensors: [
      tensor('x', [2, 3]),
      tensor('bias', [1, 3]),
      tensor('weight', [3, 2]),
    ],
    operations: [
      { id: 'op:add', kind: 'add', inputs: ['x', 'bias'], output: tensor('out:add', [2, 3]) },
      { id: 'op:mm', kind: 'matmul', inputs: ['x', 'weight'], output: tensor('out:mm', [2, 2]) },
      { id: 'op:sum', kind: 'sum', inputs: ['x'], axis: 1, output: tensor('out:sum', [2]) },
      { id: 'op:reshape', kind: 'reshape', inputs: ['x'], output: tensor('out:reshape', [3, 2]) },
      { id: 'op:transpose', kind: 'transpose', inputs: ['x'], output: tensor('out:transpose', [3, 2]) },
      { id: 'op:softmax', kind: 'softmax', inputs: ['x'], output: tensor('out:softmax', [2, 3]) },
    ],
    outputs: ['out:mm', 'out:softmax'],
  };
}

test('AI001 RCL self-hosted Tensor shape semantics admits typed generic operations', { timeout: 180_000 }, () => {
  const report = runSelfHostedTensorShapeSemantics(fixture(), bindings, { requireNativeStateRoot: true });
  assert.equal(report.lowering.status, 'accepted');
  assert.equal(report.evaluation.accepted, true);
  assert.equal(report.evaluation.tensorInventoryValid, true);
  assert.equal(report.evaluation.operationInventoryValid, true);
  assert.equal(report.evaluation.outputsValid, true);
  assert.equal(report.evaluation.manifestRootValid, true);
  assert.equal(report.native.stateRootVerified, true);
  assert.equal(report.semantic.tensorCount, 3);
  assert.equal(report.semantic.operationCount, 6);
  assert.equal(report.semantic.outputCount, 2);
});

test('AI001 rejects shape, stride, metadata and operation-reference drift before backend execution', { timeout: 180_000 }, () => {
  const shapeDrift = fixture();
  shapeDrift.operations[0].output.shape = [2, 2];
  shapeDrift.operations[0].output.strides = [2, 1];
  shapeDrift.operations[0].output.elementCount = 4;
  const rejectedShape = runSelfHostedTensorShapeSemantics(shapeDrift, bindings, { requireNativeStateRoot: true });
  assert.equal(rejectedShape.evaluation.accepted, false);
  assert.equal(rejectedShape.evaluation.operationInventoryValid, false);

  const strideDrift = fixture();
  strideDrift.tensors[0].strides = [1, 2];
  const rejectedStride = runSelfHostedTensorShapeSemantics(strideDrift, bindings, { requireNativeStateRoot: true });
  assert.equal(rejectedStride.evaluation.accepted, false);
  assert.equal(rejectedStride.evaluation.tensorInventoryValid, false);

  const metadataDrift = fixture();
  metadataDrift.operations[1].output.dtype = 'f32';
  const rejectedMetadata = runSelfHostedTensorShapeSemantics(metadataDrift, bindings, { requireNativeStateRoot: true });
  assert.equal(rejectedMetadata.evaluation.accepted, false);
  assert.equal(rejectedMetadata.evaluation.operationInventoryValid, false);

  const referenceDrift = fixture();
  referenceDrift.operations[2].inputs = ['missing'];
  const rejectedReference = runSelfHostedTensorShapeSemantics(referenceDrift, bindings, { requireNativeStateRoot: true });
  assert.equal(rejectedReference.evaluation.accepted, false);
  assert.equal(rejectedReference.evaluation.operationInventoryValid, false);
});

test('AI001 rejects manifest-root drift and remains deterministic', { timeout: 180_000 }, () => {
  const first = runSelfHostedTensorShapeSemantics(fixture(), bindings, { requireNativeStateRoot: true });
  const second = runSelfHostedTensorShapeSemantics(fixture(), bindings, { requireNativeStateRoot: true });
  assert.equal(first.reportRoot, second.reportRoot);
  assert.equal(tensorShapeSemanticsCanonical(first), tensorShapeSemanticsCanonical(second));

  const drifted = runSelfHostedTensorShapeSemantics(fixture(), bindings, {
    declaredManifestRoot: '0'.repeat(64),
    requireNativeStateRoot: true,
  });
  assert.equal(drifted.evaluation.manifestRootValid, false);
  assert.equal(drifted.evaluation.accepted, false);
});
