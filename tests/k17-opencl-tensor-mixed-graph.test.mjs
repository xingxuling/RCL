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
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-mixed-graph-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-mixed-graph-contract.v0.1.json');

const graphRequest = {
  format: 'rcl.k17.opencl-amd-tensor-mixed-graph-probe-request.v0.1',
  backend: 'opencl-amd',
  providerPath: PROVIDER,
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
      tensorId: 'mask',
      storageIdentity: 'storage:mask',
      dtype: 'bf16',
      shape: [1, 2],
      bits: ['0000', 'bf80'],
    },
  ],
  nodes: [
    {
      nodeId: 'node:mixed.projection',
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
      nodeId: 'node:mixed.masked-softmax',
      outputResource: 'resource:probabilities',
      operation: 'masked-softmax',
      maskMode: 'additive',
      leftResource: 'resource:logits',
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
test('K17 genome and contract keep mixed graph semantics RCL-owned', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_TENSOR_MIXED_GRAPH_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.operations, 'generic Tensor matmul and additive masked softmax only');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.residency.intermediateReadbacks, 'forbidden');
  assert.equal(contract.residency.finalReadback, 'required exactly once');
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('K400_PASS'));
});

test('K17 keeps matmul and masked-softmax resources device-resident until one final readback', () => {
  const first = executeProbe(graphRequest);
  if (first.status !== 0) {
    assert.equal(unavailable(first.value.code), true, JSON.stringify(first.value));
    return;
  }
  assert.equal(first.value.status, 'PASS_LOCAL_OPENCL_TENSOR_MIXED_GRAPH_CANDIDATE');
  assert.equal(first.value.canonicalOwner, 'RCL');
  assert.equal(first.value.closed, true);
  assert.deepEqual(first.value.outputBits, ['3f00', '3f00']);
  assert.equal(first.value.intermediateReadbackCount, 0);
  assert.equal(first.value.finalReadbackCount, 1);
  assert.deepEqual(first.value.graph.nodes.map((node) => node.operation), ['matmul', 'masked-softmax']);
  assert.equal(first.value.graph.nodes[1].maskMode, 'additive');
  assert.deepEqual(first.value.graph.nodes.map((node) => node.deviceResidentAfter), [true, false]);
  assert.deepEqual(first.value.graph.nodes.map((node) => node.shape), [[1, 2], [1, 2]]);
  assert.equal(first.value.graph.intermediateReadbackCount, 0);
  assert.equal(first.value.graph.finalReadbackCount, 1);
  assert.equal(first.value.telemetry.tensorBindCount, 3);
  assert.equal(first.value.telemetry.tensorHostToDeviceTransfers, 3);
  assert.equal(first.value.telemetry.tensorDeviceToHostTransfers, 1);
  assert.equal(first.value.telemetry.tensorReleaseCount, 3);
  assert.equal(first.value.telemetry.residentTensorCount, 0);
  assert.equal(first.value.telemetry.residentBytes, 0);
  assert.equal(first.value.telemetry.bufferAllocationCount, 5);
  assert.equal(first.value.telemetry.bufferAllocationBytes, 24);
  assert.equal(first.value.telemetry.bufferReleaseCount, 5);
  assert.match(first.value.graph.executionRoot, /^[0-9a-f]{64}$/);
  const replay = executeProbe(graphRequest);
  assert.equal(replay.status, 0);
  assert.deepEqual(replay.value.outputBits, first.value.outputBits);
  assert.equal(replay.value.graph.executionRoot, first.value.graph.executionRoot);
  if (process.env.RCL_K17_EVIDENCE === '1') {
    console.log(`K17_EVIDENCE ${JSON.stringify({
      device: first.value.device,
      outputBits: first.value.outputBits,
      nodes: first.value.graph.nodes,
      intermediateReadbackCount: first.value.intermediateReadbackCount,
      finalReadbackCount: first.value.finalReadbackCount,
      telemetry: first.value.telemetry,
      executionRoot: first.value.graph.executionRoot,
      exactCpuDifferential: true,
      deterministicReplay: true,
    })}`);
  }
});

test('K17 rejects mixed-graph operation, mask and readback drift before provider execution', () => {
  const badOperation = {
    ...graphRequest,
    nodes: [{ ...graphRequest.nodes[0], operation: 'softmax-special' }, graphRequest.nodes[1]],
  };
  const operationError = executeProbe(badOperation);
  assert.equal(operationError.status, 1);
  assert.equal(operationError.value.code, 'RCL_K17_GRAPH_OPERATION');

  const badMaskMode = {
    ...graphRequest,
    nodes: [graphRequest.nodes[0], { ...graphRequest.nodes[1], maskMode: 'boolean' }],
  };
  const maskError = executeProbe(badMaskMode);
  assert.equal(maskError.status, 1);
  assert.equal(maskError.value.code, 'RCL_K17_GRAPH_MASK_MODE');

  const badReadback = {
    ...graphRequest,
    nodes: [{ ...graphRequest.nodes[0], readback: true }, graphRequest.nodes[1]],
  };
  const readbackError = executeProbe(badReadback);
  assert.equal(readbackError.status, 1);
  assert.equal(readbackError.value.code, 'RCL_K15_GRAPH_READBACK');

  const badMaskShape = {
    ...graphRequest,
    tensors: graphRequest.tensors.map((tensor) => tensor.tensorId === 'mask'
      ? { ...tensor, shape: [1, 1], bits: ['bf80'] }
      : tensor),
  };
  const shapeError = executeProbe(badMaskShape);
  assert.equal(shapeError.status, 1);
  assert.equal(shapeError.value.code, 'RCL_K15_GRAPH_SHAPE');
});
