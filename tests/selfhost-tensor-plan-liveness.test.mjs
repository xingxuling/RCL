import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderSelfHostedTensorPlanLiveness,
  runSelfHostedTensorPlanLiveness,
  tensorPlanLivenessCanonical,
} from '../src/selfhost-tensor-plan-liveness.mjs';

function referencePlan(graph) {
  const lastUse = graph.nodes.map((node, index) => {
    let last = index;
    for (let later = index + 1; later < graph.nodes.length; later += 1) {
      if (graph.nodes[later].inputs.includes(node.id)) last = later;
    }
    if (graph.outputs.includes(node.id)) last = graph.nodes.length;
    return [node.id, last];
  });
  const lastById = new Map(lastUse);
  const active = new Map();
  const free = [];
  const assignments = [];
  let nextSlot = 0;
  let allocatedBytes = 0;
  let livePeakBytes = 0;
  for (let index = 0; index < graph.nodes.length; index += 1) {
    for (const [id, value] of [...active.entries()]) {
      if (value.last <= index) {
        active.delete(id);
        free.push({ slot: value.slot, bytes: value.bytes });
      }
    }
    const reusableIndex = free.findIndex((slot) => slot.bytes === graph.nodes[index].bytes);
    const reused = reusableIndex >= 0;
    const slot = reused ? free.splice(reusableIndex, 1)[0].slot : nextSlot++;
    if (!reused) allocatedBytes += graph.nodes[index].bytes;
    active.set(graph.nodes[index].id, { slot, bytes: graph.nodes[index].bytes, last: lastById.get(graph.nodes[index].id) });
    const liveBytes = [...active.values()].reduce((sum, value) => sum + value.bytes, 0);
    livePeakBytes = Math.max(livePeakBytes, liveBytes);
    assignments.push([
      graph.nodes[index].id,
      graph.nodes[index].operation,
      slot,
      reused,
      graph.nodes[index].bytes,
      lastById.get(graph.nodes[index].id),
    ]);
  }
  return {
    lastUse,
    assignments,
    active: [...active.entries()].map(([id, value]) => [id, value.slot, value.bytes, value.last]),
    free: free.map((value) => [value.slot, value.bytes]),
    slotCount: nextSlot,
    allocatedBytes,
    livePeakBytes,
    reusedCount: assignments.filter((item) => item[3]).length,
  };
}

const linearGraph = {
  nodes: [
    { id: 'x', operation: 'input', inputs: [], bytes: 16 },
    { id: 'w', operation: 'input', inputs: [], bytes: 16 },
    { id: 'h', operation: 'matmul', inputs: ['x', 'w'], bytes: 16 },
    { id: 'b', operation: 'input', inputs: [], bytes: 16 },
    { id: 'y', operation: 'add', inputs: ['h', 'b'], bytes: 16 },
    { id: 'z', operation: 'relu', inputs: ['y'], bytes: 16 },
    { id: 'loss', operation: 'sum', inputs: ['z'], bytes: 8 },
  ],
  outputs: ['loss'],
};

test('AI011 RCL self-hosted compact plan matches the generic liveness oracle', () => {
  const report = runSelfHostedTensorPlanLiveness(linearGraph, { requireNativeStateRoot: true });
  const expected = referencePlan(linearGraph);
  assert.equal(report.evaluation.graphValid, true);
  assert.equal(report.evaluation.compactReuse, true);
  assert.equal(report.evaluation.outputRetained, true);
  assert.equal(report.native.stateRootVerified, true);
  assert.deepEqual(report.plan.lastUse, expected.lastUse);
  assert.deepEqual(report.plan.assignments, expected.assignments);
  assert.deepEqual(report.plan.active, expected.active);
  assert.deepEqual(report.plan.free, expected.free);
  assert.equal(report.plan.slotCount, expected.slotCount);
  assert.equal(report.plan.allocatedBytes, expected.allocatedBytes);
  assert.equal(report.plan.livePeakBytes, expected.livePeakBytes);
  assert.equal(report.plan.reusedCount, expected.reusedCount);
});

test('AI011 releases dead values and only reuses an exact-size storage slot', () => {
  const graph = {
    nodes: [
      { id: 'input', operation: 'input', inputs: [], bytes: 8 },
      { id: 'dead', operation: 'temporary', inputs: [], bytes: 16 },
      { id: 'live', operation: 'unary', inputs: ['input'], bytes: 8 },
      { id: 'out', operation: 'reduce', inputs: ['live'], bytes: 4 },
    ],
    outputs: ['out'],
  };
  const report = runSelfHostedTensorPlanLiveness(graph, { requireNativeStateRoot: true });
  const expected = referencePlan(graph);
  assert.equal(report.evaluation.graphValid, true);
  assert.deepEqual(report.plan.assignments, expected.assignments);
  assert.equal(report.plan.assignments[2][3], true);
  assert.equal(report.plan.assignments[2][4], 8);
  assert.equal(report.plan.assignments[3][3], false);
  assert.equal(report.plan.allocatedBytes, 28);
});

test('AI011 rejects duplicate, forward-reference and missing-output graphs before planning', () => {
  const invalid = {
    nodes: [
      { id: 'same', operation: 'input', inputs: [], bytes: 8 },
      { id: 'same', operation: 'add', inputs: ['future'], bytes: 8 },
      { id: 'future', operation: 'input', inputs: [], bytes: 8 },
    ],
    outputs: ['missing'],
  };
  const report = runSelfHostedTensorPlanLiveness(invalid, { requireNativeStateRoot: true });
  assert.equal(report.evaluation.graphValid, false);
  assert.equal(report.plan.status, 'rejected');
  assert.deepEqual(report.plan.assignments, []);
  assert.equal(report.plan.allocatedBytes, 0);
  assert.equal(report.plan.slotCount, 0);
});

test('AI011 source and canonical plan report remain deterministic', () => {
  const first = runSelfHostedTensorPlanLiveness(linearGraph, { requireNativeStateRoot: true });
  const second = runSelfHostedTensorPlanLiveness(linearGraph, { requireNativeStateRoot: true });
  assert.equal(renderSelfHostedTensorPlanLiveness(linearGraph), renderSelfHostedTensorPlanLiveness(linearGraph));
  assert.equal(tensorPlanLivenessCanonical(first), tensorPlanLivenessCanonical(second));
  assert.equal(first.reportRoot, second.reportRoot);
});
