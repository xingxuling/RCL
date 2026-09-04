import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderSelfHostedAutodiffGraphGovernance,
  runSelfHostedAutodiffGraphGovernance,
} from '../src/selfhost-autodiff-graph-governance.mjs';

const simpleGraph = {
  parameters: [
    { id: 'x', gradientIdentity: 'parameter:x' },
    { id: 'w', gradientIdentity: 'parameter:w' },
  ],
  operations: [
    { id: 'project', kind: 'matmul', inputs: ['x', 'w'], output: 'projected' },
    { id: 'loss', kind: 'mean', inputs: ['projected'], output: 'loss' },
  ],
  stopGradients: [],
  loss: 'loss',
};

const multiUseGraph = {
  parameters: [
    { id: 'a', gradientIdentity: 'parameter:a' },
    { id: 'b', gradientIdentity: 'parameter:b' },
  ],
  operations: [
    { id: 'left', kind: 'mul', inputs: ['a', 'b'], output: 'left' },
    { id: 'right', kind: 'add', inputs: ['a', 'left'], output: 'right' },
    { id: 'loss', kind: 'mean', inputs: ['right'], output: 'loss' },
  ],
  stopGradients: [],
  loss: 'loss',
};

test('AI002 RCL graph governance emits ordered reverse edges and parameter accumulators', () => {
  const report = runSelfHostedAutodiffGraphGovernance(simpleGraph, { requireNativeStateRoot: true });
  assert.equal(report.evaluation.graphValid, true);
  assert.equal(report.evaluation.backwardEdgesExist, true);
  assert.equal(report.evaluation.deterministicAccumulation, true);
  assert.equal(report.evaluation.stopGradientBlocks, true);
  assert.equal(report.semantic.edgeCount, 3);
  assert.deepEqual(report.semantic.backwardEdges.map((edge) => [edge[1], edge[4], edge[6]]), [
    ['loss', 'projected', 'scaled-broadcast-to-input-shape'],
    ['project', 'x', 'adjoint-matmul'],
    ['project', 'w', 'adjoint-matmul'],
  ]);
  assert.deepEqual(report.semantic.accumulators.map((item) => [item[1], item[3]]), [['x', 1], ['w', 1]]);
  assert.equal(report.native.stateRootVerified, true);
});

test('AI002 aggregates multiple reverse contributions in deterministic reverse traversal order', () => {
  const report = runSelfHostedAutodiffGraphGovernance(multiUseGraph, { requireNativeStateRoot: true });
  assert.equal(report.evaluation.graphValid, true);
  assert.deepEqual(report.semantic.accumulators.map((item) => [item[1], item[3]]), [['a', 2], ['b', 1]]);
  assert.deepEqual(report.semantic.accumulators[0][2].map((edge) => [edge[1], edge[4]]), [
    ['right', 'a'],
    ['left', 'a'],
  ]);
  assert.equal(report.semantic.accumulators[1][2][0][1], 'left');
});

test('AI002 StopGradient blocks only the selected parameter contribution', () => {
  const report = runSelfHostedAutodiffGraphGovernance({ ...multiUseGraph, stopGradients: ['a'] }, { requireNativeStateRoot: true });
  assert.equal(report.evaluation.graphValid, true);
  assert.deepEqual(report.semantic.accumulators.map((item) => [item[1], item[3]]), [['a', 0], ['b', 1]]);
  assert.equal(report.semantic.backwardEdges.some((edge) => edge[4] === 'a'), false);
  assert.equal(report.evaluation.stopGradientBlocks, true);
});

test('AI002 rejects duplicate, forward-reference and unsupported-operation graphs before reverse planning', () => {
  const invalid = {
    parameters: [
      { id: 'same', gradientIdentity: 'parameter:same' },
      { id: 'same', gradientIdentity: 'parameter:same' },
    ],
    operations: [
      { id: 'bad', kind: 'not-differentiable', inputs: ['future'], output: 'bad' },
      { id: 'loss', kind: 'mean', inputs: ['bad'], output: 'loss' },
      { id: 'future', kind: 'add', inputs: ['same', 'same'], output: 'future' },
    ],
    stopGradients: ['missing'],
    loss: 'loss',
  };
  const report = runSelfHostedAutodiffGraphGovernance(invalid, { requireNativeStateRoot: true });
  assert.equal(report.evaluation.graphValid, false);
  assert.deepEqual(report.semantic.backwardEdges, []);
  assert.deepEqual(report.semantic.accumulators, []);
  assert.equal(report.semantic.edgeCount, 0);
  assert.equal(renderSelfHostedAutodiffGraphGovernance(invalid), renderSelfHostedAutodiffGraphGovernance(invalid));
});
