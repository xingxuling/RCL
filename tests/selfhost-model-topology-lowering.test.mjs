import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  modelTopologyLoweringCanonical,
  runSelfHostedModelTopologyLowering,
} from '../src/selfhost-model-topology-lowering.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const root = path.resolve('.');
const topology = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'model-topology-lowering-contract.v0.1.json'), 'utf8'));
const parameterIds = topology.parameterIds;
const topologySourceSha256 = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'model-topology-lowering-genome.rcl')))
  .digest('hex');

const graph = {
  format: 'rcl.tensor-execution-plan.v0.1',
  tensors: [
    ...parameterIds.map((id) => ({ id, gradientIdentity: `parameter:${id}` })),
    { id: 'inputOneHot', gradientIdentity: 'derived:inputOneHot' },
    { id: 'causalMask', gradientIdentity: 'derived:causalMask' },
  ],
  nodes: [
    { id: 'node:embedding', operation: 'matmul' },
    ...['block.0', 'block.1'].flatMap((prefix) => [
      { id: `node:${prefix}.attention`, operation: 'matmul' },
      { id: `node:${prefix}.rope`, operation: 'mul' },
      { id: `node:${prefix}.masked`, operation: 'add' },
      { id: `node:${prefix}.norm`, operation: 'div' },
      { id: `node:${prefix}.ff`, operation: 'activation' },
      { id: `node:${prefix}.output`, operation: 'add' },
    ]),
    { id: 'node:lm.logits', operation: 'matmul' },
    { id: 'node:lm.probabilities', operation: 'softmax' },
    { id: 'node:lm.logProbabilities', operation: 'log' },
    { id: 'node:loss.selected', operation: 'mul' },
    { id: 'node:loss.token', operation: 'sum' },
    { id: 'node:loss.mean', operation: 'mean' },
    { id: 'node:loss', operation: 'sub' },
    { id: 'node:block.0.reshape', operation: 'reshape' },
    { id: 'node:block.0.broadcast', operation: 'broadcast' },
    { id: 'node:block.0.sqrt', operation: 'sqrt' },
    { id: 'node:block.0.transpose', operation: 'transpose' },
  ],
  outputs: ['block.0.output', 'block.1.output', 'lm.logits', 'loss'],
};

const bindings = {
  topologySourceSha256,
  topologyContractRoot: evidenceRoot(topology),
};

test('AI012 self-host admission binds decoder topology to a complete generic graph manifest', { timeout: 180_000 }, () => {
  const report = runSelfHostedModelTopologyLowering(topology, graph, bindings, { requireNativeStateRoot: true });
  assert.equal(report.lowering.status, 'accepted');
  assert.equal(report.lowering.accepted, true);
  assert.equal(report.evaluation.topologyRootValid, true);
  assert.equal(report.evaluation.graphRootValid, true);
  assert.equal(report.evaluation.topologyValid, true);
  assert.equal(report.evaluation.parameterBindingValid, true);
  assert.equal(report.evaluation.stageCoverageValid, true);
  assert.equal(report.evaluation.genericOperationPolicy, true);
  assert.equal(report.evaluation.graphCardinalityValid, true);
  assert.equal(report.native.stateRootVerified, true);
  assert.equal(report.lowering.blockCount, 2);
  assert.equal(report.lowering.graphNodeCount, graph.nodes.length);
});

test('AI012 rejects parameter drift, missing block stage coverage and model-special operations', { timeout: 180_000 }, () => {
  const missingParameterGraph = structuredClone(graph);
  missingParameterGraph.tensors = missingParameterGraph.tensors.filter((tensor) => tensor.id !== 'block.1.w2');
  const missingParameter = runSelfHostedModelTopologyLowering(topology, missingParameterGraph, bindings, { requireNativeStateRoot: true });
  assert.equal(missingParameter.lowering.accepted, false);
  assert.equal(missingParameter.evaluation.parameterBindingValid, false);

  const missingStageGraph = structuredClone(graph);
  missingStageGraph.nodes = missingStageGraph.nodes.filter((node) => !String(node.id).startsWith('node:block.1'));
  const missingStage = runSelfHostedModelTopologyLowering(topology, missingStageGraph, bindings, { requireNativeStateRoot: true });
  assert.equal(missingStage.lowering.accepted, false);
  assert.equal(missingStage.evaluation.stageCoverageValid, false);

  const forbiddenGraph = structuredClone(graph);
  forbiddenGraph.nodes.push({ id: 'node:block.0.forbidden', operation: 'transformer_special' });
  const forbidden = runSelfHostedModelTopologyLowering(topology, forbiddenGraph, bindings, { requireNativeStateRoot: true });
  assert.equal(forbidden.lowering.accepted, false);
  assert.equal(forbidden.evaluation.genericOperationPolicy, false);
});

test('AI012 rejects topology or graph root drift and is deterministic', { timeout: 180_000 }, () => {
  const first = runSelfHostedModelTopologyLowering(topology, graph, bindings, { requireNativeStateRoot: true });
  const second = runSelfHostedModelTopologyLowering(topology, graph, bindings, { requireNativeStateRoot: true });
  assert.equal(first.reportRoot, second.reportRoot);
  assert.equal(modelTopologyLoweringCanonical(first), modelTopologyLoweringCanonical(second));

  const driftedTopology = runSelfHostedModelTopologyLowering(topology, graph, bindings, {
    declaredTopologyRoot: '0'.repeat(64),
    requireNativeStateRoot: true,
  });
  assert.equal(driftedTopology.lowering.accepted, false);
  assert.equal(driftedTopology.evaluation.topologyRootValid, false);

  const driftedGraph = runSelfHostedModelTopologyLowering(topology, graph, bindings, {
    declaredGraphRoot: '1'.repeat(64),
    requireNativeStateRoot: true,
  });
  assert.equal(driftedGraph.lowering.accepted, false);
  assert.equal(driftedGraph.evaluation.graphRootValid, false);
});
