import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ENGINE = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-opencl-tensor-residency.exe' : 'rcl-opencl-tensor-residency',
);
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-training-graph-residency-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-training-graph-residency-contract.v0.1.json');

const graphRequest = {
  format: 'rcl.k18.opencl-amd-tensor-training-graph-residency-probe-request.v0.1',
  backend: 'opencl-amd',
  providerPath: PROVIDER,
  steps: 3,
  tensors: [
    {
      tensorId: 'left',
      storageIdentity: 'storage:left',
      dtype: 'bf16',
      shape: [1, 2],
      bits: ['3f80', '4000'],
    },
    {
      tensorId: 'projection',
      storageIdentity: 'storage:projection',
      dtype: 'bf16',
      shape: [2, 2],
      bits: ['3f80', '0000', '0000', '3f80'],
    },
    {
      tensorId: 'bias',
      storageIdentity: 'storage:bias',
      dtype: 'bf16',
      shape: [1, 2],
      bits: ['0000', '0000'],
    },
    {
      tensorId: 'mask',
      storageIdentity: 'storage:mask',
      dtype: 'bf16',
      shape: [1, 2],
      bits: ['0000', 'bf80'],
    },
  ],
  nodes: [
    {
      nodeId: 'node:training.projection',
      outputResource: 'resource:logits',
      operation: 'matmul',
      leftTensorId: 'left',
      rightTensorId: 'projection',
      rows: 1,
      columns: 2,
      shared: 2,
      readback: false,
    },
    {
      nodeId: 'node:training.bias',
      outputResource: 'resource:shifted',
      operation: 'add',
      leftResource: 'resource:logits',
      rightTensorId: 'bias',
      rows: 1,
      columns: 2,
      readback: false,
    },
    {
      nodeId: 'node:training.masked-softmax',
      outputResource: 'resource:probabilities',
      operation: 'masked-softmax',
      maskMode: 'additive',
      leftResource: 'resource:shifted',
      rightTensorId: 'mask',
      rows: 1,
      columns: 2,
      readback: true,
    },
  ],
};

function unavailable(code) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_OPENCL_SYMBOL_UNAVAILABLE',
    'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE',
  ].includes(code);
}

function buildEngine() {
  const run = spawnSync(
    'cargo',
    ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-opencl-tensor-residency'],
    { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024 },
  );
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

function executeProbe(request) {
  const run = spawnSync(ENGINE, ['-'], {
    cwd: ROOT,
    input: JSON.stringify(request),
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const raw = (run.status === 0 ? run.stdout : run.stderr).trim();
  return { status: run.status, value: JSON.parse(raw) };
}

test.before(() => {
  buildEngine();
});

test('K18 genome and contract keep full-graph step residency bounded and RCL-owned', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_TENSOR_TRAINING_GRAPH_RESIDENCY_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.operations, 'generic Tensor matmul, elementwise add and additive masked softmax');
  assert.equal(contract.semanticBoundary.trainingStep, 'repeated forward graph execution only; no reverse-mode gradient or optimizer semantics');
  assert.equal(contract.residency.maxSteps, 16);
  assert.equal(contract.residency.intermediateReadbacks, 'forbidden');
  assert.equal(contract.residency.finalReadback, 'required exactly once after the final step');
  assert.ok(contract.claimsGranted.includes('OPENCL_AMD_FULL_GRAPH_RESIDENCY_CANDIDATE'));
  assert.ok(contract.claimsGranted.includes('OPENCL_AMD_TRAINING_STEP_RESOURCE_REUSE_CANDIDATE'));
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('OPENCL_FULL_GRAPH_TRAINING_SEMANTICS'));
});

test('K18 reuses one generic full graph across three steps with one final readback', () => {
  const first = executeProbe(graphRequest);
  if (first.status !== 0) {
    assert.equal(unavailable(first.value.code), true, JSON.stringify(first.value));
    return;
  }
  assert.equal(first.value.status, 'PASS_LOCAL_OPENCL_TENSOR_TRAINING_GRAPH_RESIDENCY_CANDIDATE');
  assert.equal(first.value.canonicalOwner, 'RCL');
  assert.equal(first.value.closed, true);
  assert.equal(first.value.steps, 3);
  assert.deepEqual(first.value.outputBits, ['3f00', '3f00']);
  assert.equal(first.value.intermediateReadbackCount, 0);
  assert.equal(first.value.finalReadbackCount, 1);
  assert.deepEqual(first.value.graph.nodes.map((node) => node.operation), ['matmul', 'add', 'masked-softmax']);
  assert.deepEqual(first.value.graph.nodes.map((node) => node.shape), [[1, 2], [1, 2], [1, 2]]);
  assert.deepEqual(first.value.graph.nodes.map((node) => node.deviceResidentAcrossSteps), [true, true, true]);
  assert.deepEqual(first.value.graph.nodes.map((node) => node.resourceReuseAcrossSteps), [true, true, true]);
  assert.equal(first.value.graph.telemetry.trainingStepResidency, true);
  assert.equal(first.value.graph.telemetry.resourceReuseAcrossSteps, true);
  assert.equal(first.value.graph.telemetry.graphNodeCount, 3);
  assert.equal(first.value.graph.telemetry.stepCount, 3);
  assert.equal(first.value.graph.telemetry.dispatchCount, 9);
  assert.equal(first.value.telemetry.tensorBindCount, 4);
  assert.equal(first.value.telemetry.tensorHostToDeviceTransfers, 4);
  assert.equal(first.value.telemetry.tensorDeviceToHostTransfers, 1);
  assert.equal(first.value.telemetry.tensorReleaseCount, 4);
  assert.equal(first.value.telemetry.bufferAllocationCount, 7);
  assert.equal(first.value.telemetry.bufferAllocationBytes, 32);
  assert.equal(first.value.telemetry.bufferReleaseCount, 7);
  assert.equal(first.value.telemetry.residentTensorCount, 0);
  assert.equal(first.value.telemetry.residentBytes, 0);
  assert.match(first.value.graph.executionRoot, /^[0-9a-f]{64}$/);
  const replay = executeProbe(graphRequest);
  assert.equal(replay.status, 0);
  assert.deepEqual(replay.value.outputBits, first.value.outputBits);
  assert.equal(replay.value.graph.executionRoot, first.value.graph.executionRoot);
  if (process.env.RCL_K18_EVIDENCE === '1') {
    console.log(`K18_EVIDENCE ${JSON.stringify({
      device: first.value.device,
      steps: first.value.steps,
      outputBits: first.value.outputBits,
      nodes: first.value.graph.nodes,
      intermediateReadbackCount: first.value.intermediateReadbackCount,
      finalReadbackCount: first.value.finalReadbackCount,
      telemetry: first.value.telemetry,
      graphTelemetry: first.value.graph.telemetry,
      executionRoot: first.value.graph.executionRoot,
      exactCpuDifferential: true,
      deterministicReplay: true,
    })}`);
  }
});

test('K18 rejects operation, step, readback, shape and backend drift before provider execution', () => {
  const badOperation = structuredClone(graphRequest);
  badOperation.nodes[0].operation = 'softmax-special';
  const operationError = executeProbe(badOperation);
  assert.equal(operationError.status, 1);
  assert.equal(operationError.value.code, 'RCL_K18_GRAPH_OPERATION');

  const badSteps = { ...graphRequest, steps: 0 };
  const stepError = executeProbe(badSteps);
  assert.equal(stepError.status, 1);
  assert.equal(stepError.value.code, 'RCL_K18_GRAPH_STEPS');

  const badReadback = structuredClone(graphRequest);
  badReadback.nodes[0].readback = true;
  const readbackError = executeProbe(badReadback);
  assert.equal(readbackError.status, 1);
  assert.equal(readbackError.value.code, 'RCL_K18_GRAPH_READBACK');

  const badShape = structuredClone(graphRequest);
  badShape.tensors.find((tensor) => tensor.tensorId === 'bias').shape = [1, 1];
  badShape.tensors.find((tensor) => tensor.tensorId === 'bias').bits = ['0000'];
  const shapeError = executeProbe(badShape);
  assert.equal(shapeError.status, 1);
  assert.equal(shapeError.value.code, 'RCL_K18_GRAPH_SHAPE');

  const badBackend = { ...graphRequest, backend: 'cpu' };
  const backendError = executeProbe(badBackend);
  assert.equal(backendError.status, 1);
  assert.equal(backendError.value.code, 'RCL_K18_BACKEND');
});
