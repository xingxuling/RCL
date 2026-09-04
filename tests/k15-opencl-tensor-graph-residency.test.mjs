import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

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
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-graph-residency-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-graph-residency-contract.v0.1.json');
const EVIDENCE = path.join(
  ROOT,
  'examples',
  'native-ai',
  'evidence',
  'gpu-opencl-tensor-graph-residency-v0.1',
  'k15-opencl-tensor-graph-residency-local-evidence.json',
);
const PYTHON = process.env.RCL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

function valueRoot(dtype, shape, bits) {
  const chunks = [
    Buffer.from('rcl.tensor.value-residency.v0.1\0', 'utf8'),
    Buffer.from(`${dtype}\0`, 'ascii'),
  ];
  const count = Buffer.alloc(8);
  count.writeBigUInt64LE(BigInt(shape.length));
  chunks.push(count);
  for (const dimension of shape) {
    const encoded = Buffer.alloc(8);
    encoded.writeBigUInt64LE(BigInt(dimension));
    chunks.push(encoded);
  }
  for (const bitsValue of bits) chunks.push(Buffer.from(`${bitsValue}\0`, 'ascii'));
  return `sha256:${createHash('sha256').update(Buffer.concat(chunks)).digest('hex')}`;
}

function tensor(tensorId, storageIdentity, bits, shape) {
  return { tensorId, storageIdentity, dtype: 'bf16', shape, bits };
}

const left = tensor('left', 'storage:left', ['3f80', '4000'], [1, 2]);
const projection = tensor(
  'projection',
  'storage:projection',
  ['3f80', '0000', '0000', '3f80'],
  [2, 2],
);
const reduce = tensor('reduce', 'storage:reduce', ['3f80', '3f80'], [2, 1]);

const graphRequest = {
  format: 'rcl.k15.opencl-amd-tensor-graph-residency-probe-request.v0.1',
  backend: 'opencl-amd',
  providerPath: PROVIDER,
  tensors: [left, projection, reduce],
  nodes: [
    {
      nodeId: 'node:graph.projection',
      outputResource: 'resource:projection',
      leftTensorId: 'left',
      rightTensorId: 'projection',
      rows: 1,
      columns: 2,
      shared: 2,
      readback: false,
    },
    {
      nodeId: 'node:graph.reduce',
      outputResource: 'resource:final',
      leftResource: 'resource:projection',
      rightTensorId: 'reduce',
      rows: 1,
      columns: 1,
      shared: 2,
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

function runProviderSession(mode, requests) {
  const args = [PROVIDER, '--session'];
  if (mode) args.push('--buffer-mode', mode);
  const run = spawnSync(PYTHON, args, {
    cwd: ROOT,
    input: `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return run.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test.before(() => {
  buildEngine();
});

test('K15 contract keeps intermediate device resources below RCL Tensor value identity', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_TENSOR_GRAPH_RESIDENCY_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.intermediateResource, 'ephemeral ordered device resource, not canonical Tensor value');
  assert.equal(contract.residency.finalReadback, 'required exactly once');
  assert.equal(contract.residency.intermediateReadbacks, 'forbidden');
  assert.equal(contract.residency.maxGraphNodes, 8);
  assert.ok(contract.claimsNotGranted.includes('OPENCL_TRAINING_STEP_RESIDENCY'));
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
  assert.equal(evidence.reportRoot, evidenceRoot({ ...evidence, reportRoot: undefined }));
  assert.equal(evidence.k400.matrixAfter, '23 PASS / 0 BLOCKED / 377 UNTESTED');
  assert.equal(evidence.k400.verdict, 'INCOMPLETE');
});

test('K15 real AMD graph keeps one intermediate output on device until the final readback', () => {
  const run = executeProbe(graphRequest);
  if (run.status !== 0) {
    assert.equal(unavailable(run.value.code), true, JSON.stringify(run.value));
    return;
  }
  assert.equal(run.value.status, 'PASS_LOCAL_OPENCL_TENSOR_GRAPH_RESIDENCY_CANDIDATE');
  assert.equal(run.value.canonicalOwner, 'RCL');
  assert.equal(run.value.closed, true);
  assert.deepEqual(run.value.outputBits, ['4040']);
  assert.equal(run.value.intermediateReadbackCount, 0);
  assert.equal(run.value.finalReadbackCount, 1);
  assert.equal(run.value.graph.resourceCount, 2);
  assert.equal(run.value.graph.releasedResourceCount, 2);
  assert.deepEqual(run.value.graph.nodes.map((node) => node.deviceResidentAfter), [true, false]);
  assert.deepEqual(run.value.graph.nodes.map((node) => node.shape), [[1, 2], [1, 1]]);
  assert.equal(run.value.telemetry.tensorValueResidency, true);
  assert.equal(run.value.telemetry.tensorBindCount, 3);
  assert.equal(run.value.telemetry.tensorHostToDeviceTransfers, 3);
  assert.equal(run.value.telemetry.tensorDeviceToHostTransfers, 1);
  assert.equal(run.value.telemetry.tensorReleaseCount, 3);
  assert.equal(run.value.telemetry.residentTensorCount, 0);
  assert.equal(run.value.telemetry.residentBytes, 0);
  assert.equal(run.value.telemetry.bufferAllocationCount, 5);
  assert.equal(run.value.telemetry.bufferAllocationBytes, 22);
  assert.equal(run.value.telemetry.bufferReleaseCount, 5);
  assert.match(run.value.graph.executionRoot, /^[0-9a-f]{64}$/);
  if (process.env.RCL_K15_EVIDENCE === '1') {
    console.log(`K15_EVIDENCE ${JSON.stringify({
      device: run.value.device,
      outputBits: run.value.outputBits,
      intermediateReadbackCount: run.value.intermediateReadbackCount,
      finalReadbackCount: run.value.finalReadbackCount,
      telemetry: run.value.telemetry,
      executionRoot: run.value.graph.executionRoot,
      exactOutputParity: true,
    })}`);
  }
});

test('K15 refuses intermediate readback and use-before-produce resources', () => {
  const bind = {
    format: 'rcl.opencl-amd-tensor-residency-request.v0.1',
    backend: 'opencl-amd',
    operation: 'bind',
    tensorIdentity: left.storageIdentity,
    valueRoot: valueRoot(left.dtype, left.shape, left.bits),
    dtype: left.dtype,
    shape: left.shape,
    access: 'read-only',
    bits: left.bits,
  };
  const badReadback = {
    format: 'rcl.opencl-amd-tensor-residency-request.v0.1',
    backend: 'opencl-amd',
    operation: 'graph',
    nodes: [
      {
        nodeId: 'node:bad.intermediate',
        outputResource: 'resource:bad',
        leftTensorIdentity: left.storageIdentity,
        leftValueRoot: bind.valueRoot,
        rightTensorIdentity: left.storageIdentity,
        rightValueRoot: bind.valueRoot,
        rows: 1,
        columns: 1,
        shared: 2,
        readback: true,
      },
      {
        nodeId: 'node:bad.final',
        outputResource: 'resource:final',
        leftResource: 'resource:bad',
        rightTensorIdentity: left.storageIdentity,
        rightValueRoot: bind.valueRoot,
        rows: 1,
        columns: 1,
        shared: 1,
        readback: true,
      },
    ],
  };
  const beforeProduce = {
    ...badReadback,
    nodes: [
      {
        ...badReadback.nodes[1],
        nodeId: 'node:bad.before',
        outputResource: 'resource:before',
        leftResource: 'resource:not-produced',
        leftTensorIdentity: undefined,
        leftValueRoot: undefined,
        readback: false,
      },
      { ...badReadback.nodes[0], nodeId: 'node:bad.after', outputResource: 'resource:after', readback: true },
    ],
  };
  const close = { format: 'rcl.opencl-amd-session-close-request.v0.1', backend: 'opencl-amd' };
  const responses = runProviderSession('tensor-residency-v0.1', [bind, badReadback, close]);
  if (responses[0]?.status === 'error') {
    assert.equal(unavailable(responses[0].code), true, JSON.stringify(responses));
    return;
  }
  assert.equal(responses[1].status, 'error');
  assert.equal(responses[1].code, 'RCL_OPENCL_TENSOR_GRAPH_READBACK');
  assert.equal(responses[2].closed, true);
  const resourceError = runProviderSession('tensor-residency-v0.1', [bind, beforeProduce]);
  if (resourceError[0]?.status === 'error') {
    assert.equal(unavailable(resourceError[0].code), true, JSON.stringify(resourceError));
  } else {
    assert.equal(resourceError[1].status, 'error');
    assert.equal(resourceError[1].code, 'RCL_OPENCL_TENSOR_GRAPH_RESOURCE');
  }
});
