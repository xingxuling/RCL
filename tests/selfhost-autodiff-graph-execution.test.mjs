import test from 'node:test';
import assert from 'node:assert/strict';

import {
  autodiffGraphExecutionCanonical,
  runSelfHostedAutodiffGraphExecution,
} from '../src/selfhost-autodiff-graph-execution.mjs';

const descriptor = (id, shape, values, gradientIdentity = `constant:${id}`) => ({
  id,
  shape,
  dtype: 'f64',
  layout: 'row-major',
  device: 'cpu',
  storageIdentity: `storage:${id}`,
  elementCount: shape.reduce((count, dimension) => count * dimension, 1),
  values,
  gradientIdentity,
});

const output = (id, shape, kind) => ({
  id,
  shape,
  dtype: 'f64',
  layout: 'row-major',
  device: 'cpu',
  storageIdentity: `derived-storage:${id}`,
  elementCount: shape.reduce((count, dimension) => count * dimension, 1),
  gradientIdentity: `derived:${kind}:${id}`,
});

function analyticRequest(overrides = {}) {
  return {
    format: 'rcl.autodiff-graph-execution-request.v0.1',
    tensors: [
      descriptor('x', [2], [-0.4, 0.7], 'parameter:x'),
      descriptor('y', [2], [1.5, 2.0], 'parameter:y'),
    ],
    operations: [
      { id: 'xy', kind: 'mul', inputs: ['x', 'y'], output: output('xy', [2], 'mul') },
      { id: 'x_over_y', kind: 'div', inputs: ['x', 'y'], output: output('x_over_y', [2], 'div') },
      { id: 'terms', kind: 'add', inputs: ['xy', 'x_over_y'], output: output('terms', [2], 'add') },
      { id: 'loss', kind: 'sum', inputs: ['terms'], axis: 0, output: output('loss', [], 'sum') },
    ],
    parameters: [
      { tensorId: 'x', gradientIdentity: 'parameter:x' },
      { tensorId: 'y', gradientIdentity: 'parameter:y' },
    ],
    loss: 'loss',
    ...overrides,
  };
}

test('AI002 binds RCL shape and reverse graph admissions to native numeric execution', () => {
  const report = runSelfHostedAutodiffGraphExecution(analyticRequest(), { timeout: 120_000 });
  assert.equal(report.admission.shape.accepted, true);
  assert.equal(report.admission.graph.accepted, true);
  assert.equal(report.admission.storage.accepted, true);
  assert.equal(report.admission.accepted, true);
  assert.equal(report.execution.status, 'executed');
  assert.equal(report.execution.attempted, true);
  assert.equal(report.execution.edgeParity, true);
  assert.equal(report.execution.gradientShapeValid, true);
  assert.equal(report.execution.loss, 0.8833333333333333);
  const gradients = new Map(report.execution.gradients.map((item) => [item.parameter.tensorId, item.storage.data]));
  assert.deepEqual(gradients.get('x'), [2.1666666666666665, 2.5]);
  assert.deepEqual(gradients.get('y'), [-0.22222222222222224, 0.5249999999999999]);
});

test('AI002 rejects shape drift before the provider is attempted', () => {
  const request = analyticRequest();
  request.operations[0].output = output('xy', [3], 'mul');
  const report = runSelfHostedAutodiffGraphExecution(request, { timeout: 120_000 });
  assert.equal(report.admission.shape.accepted, false);
  assert.equal(report.admission.accepted, false);
  assert.equal(report.execution.status, 'not-run');
  assert.equal(report.execution.attempted, false);
});

test('AI002 rejects a provider profile mismatch instead of silently falling back', () => {
  const request = analyticRequest({ executionOwner: 'unregistered-provider' });
  const report = runSelfHostedAutodiffGraphExecution(request, { timeout: 120_000 });
  assert.equal(report.admission.shape.accepted, true);
  assert.equal(report.admission.graph.accepted, true);
  assert.equal(report.admission.accepted, false);
  assert.equal(report.execution.status, 'not-run');
  assert.equal(report.execution.attempted, false);
  assert.match(report.boundary, /NO_IMPLICIT_PROVIDER_FALLBACK/);
});

test('AI002 execution admission is deterministic across native replays', () => {
  const first = runSelfHostedAutodiffGraphExecution(analyticRequest(), { timeout: 120_000 });
  const second = runSelfHostedAutodiffGraphExecution(analyticRequest(), { timeout: 120_000 });
  assert.equal(autodiffGraphExecutionCanonical(first), autodiffGraphExecutionCanonical(second));
  assert.equal(first.reportRoot, second.reportRoot);
  assert.equal(first.execution.planRoot, second.execution.planRoot);
});
