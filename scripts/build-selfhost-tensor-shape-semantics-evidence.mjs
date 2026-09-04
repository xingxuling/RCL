import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { runSelfHostedTensorShapeSemantics } from '../src/selfhost-tensor-shape-semantics.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'tensor-genome.rcl');
const CONTRACT_PATH = path.join(ROOT, 'examples', 'native-ai', 'tensor-shape-semantics-contract.v0.1.json');
const OUTPUT_PATH = path.join(ROOT, 'examples', 'native-ai', 'evidence', 'tensor-shape-semantics-v0.1', 'ai001-tensor-shape-semantics-local-evidence.json');

function product(shape) {
  return shape.reduce((total, value) => total * value, 1);
}

function strides(shape) {
  return shape.map((_, index) => product(shape.slice(index + 1)));
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
    tensors: [tensor('x', [2, 3]), tensor('bias', [1, 3]), tensor('weight', [3, 2])],
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

function bindings() {
  return {
    modelSourceSha256: crypto.createHash('sha256').update(fs.readFileSync(SOURCE_PATH)).digest('hex'),
    contractRoot: evidenceRoot(JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'))),
  };
}

function run(input, options = {}) {
  return runSelfHostedTensorShapeSemantics(input, bindings(), {
    requireNativeStateRoot: true,
    ...options,
  });
}

function negativeCases() {
  const shapeDrift = fixture();
  shapeDrift.operations[0].output.shape = [2, 2];
  shapeDrift.operations[0].output.strides = [2, 1];
  shapeDrift.operations[0].output.elementCount = 4;

  const strideDrift = fixture();
  strideDrift.tensors[0].strides = [1, 2];

  const metadataDrift = fixture();
  metadataDrift.operations[1].output.dtype = 'f32';

  const referenceDrift = fixture();
  referenceDrift.operations[2].inputs = ['missing'];

  return {
    shape: run(shapeDrift).evaluation,
    stride: run(strideDrift).evaluation,
    metadata: run(metadataDrift).evaluation,
    reference: run(referenceDrift).evaluation,
    manifestRoot: run(fixture(), { declaredManifestRoot: '0'.repeat(64) }).evaluation,
  };
}

const implementationCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const positive = run(fixture());
const payload = {
  format: 'rcl.ai001.tensor-shape-semantics-local-evidence.v0.1',
  status: 'PASS_LOCAL_SELFHOST_TYPED_TENSOR_SHAPE_SEMANTICS_CANDIDATE',
  implementationCommit,
  candidate: positive,
  negativeCases: negativeCases(),
  claimsGranted: [
    'RCL_OWNS_TYPED_TENSOR_DESCRIPTOR_ADMISSION',
    'RCL_OWNS_SHAPE_STRIDE_LAYOUT_DTYPE_DEVICE_INTENT_RULES',
    'RCL_OWNS_BROADCAST_MATMUL_TRANSPOSE_RESHAPE_REDUCTION_SHAPE_RULES',
    'RCL_SELFHOST_NATIVE_ROOT_VERIFIED',
  ],
  claimsNotGranted: [
    'AI001_CANONICAL_PROMOTION',
    'NUMERICAL_KERNEL_PARITY',
    'GPU_EXECUTION',
    'K400_PASS',
  ],
  reproduction: 'npm run test:selfhost-tensor-shape-semantics',
  evidenceBoundary: 'RCL_SEMANTIC_ADMISSION_ONLY; NUMERICAL_STORAGE_KERNEL_DEVICE_PLACEMENT_AND_CANONICAL_PROMOTION_REMAIN_EXTERNAL',
  reportRoot: null,
};
payload.reportRoot = evidenceRoot({ ...payload, reportRoot: undefined });
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ status: payload.status, implementationCommit, reportRoot: payload.reportRoot, outputPath: OUTPUT_PATH }, null, 2));
