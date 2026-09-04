import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runSelfHostedAutodiffGraphExecution } from '../src/selfhost-autodiff-graph-execution.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT_PATH = path.join(
  ROOT,
  'evidence',
  'RCL_GAP_AI002_SELFHOST_AUTODIFF_EXECUTION_BINDING_CANDIDATE_v0.1.json',
);

function descriptor(id, shape, values, gradientIdentity = `constant:${id}`) {
  return {
    id,
    shape,
    dtype: 'f64',
    layout: 'row-major',
    device: 'cpu',
    storageIdentity: `storage:${id}`,
    elementCount: shape.reduce((count, dimension) => count * dimension, 1),
    values,
    gradientIdentity,
  };
}

function output(id, shape, kind) {
  return {
    id,
    shape,
    dtype: 'f64',
    layout: 'row-major',
    device: 'cpu',
    storageIdentity: `derived-storage:${id}`,
    elementCount: shape.reduce((count, dimension) => count * dimension, 1),
    gradientIdentity: `derived:${kind}:${id}`,
  };
}

function fixture() {
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
  };
}

const report = runSelfHostedAutodiffGraphExecution(fixture(), { timeout: 120_000 });
const sourceCommit = execFileSync('git', ['log', '-1', '--format=%H', '--', 'src/selfhost-autodiff-graph-execution.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const evidence = {
  format: 'rcl.gap.ai002.selfhost-autodiff-execution-binding.local-evidence.v0.1',
  status: report.execution.status === 'executed' && report.admission.accepted && report.execution.edgeParity && report.execution.gradientShapeValid && report.execution.gradientParameterParity
    ? 'PASS_LOCAL_RCL_ADMISSION_PROVIDER_BINDING_CANDIDATE'
    : 'FAIL_LOCAL_RCL_ADMISSION_PROVIDER_BINDING_CANDIDATE',
  sourceCommit,
  semanticOwner: 'RCL typed Tensor shape semantics + RCL Autodiff graph governance',
  executionOwner: report.execution.owner,
  checks: {
    shapeAdmission: report.admission.shape.accepted,
    graphAdmission: report.admission.graph.accepted,
    storageAdmission: report.admission.storage.accepted,
    providerExecution: report.execution.status === 'executed',
    reverseEdgeParity: report.execution.edgeParity,
    gradientShapeValid: report.execution.gradientShapeValid,
    gradientParameterParity: report.execution.gradientParameterParity,
  },
  report: {
    request: report.request,
    admission: report.admission,
    execution: report.execution,
  },
  stressCases: [
    'STRESS_AI_REVERSE_ACCUMULATION',
    'STRESS_AI_INVALID_SHAPE',
    'STRESS_AI_TENSOR_PLAN_SSA',
    'STRESS_AI_AUTODIFF_NO_MODEL_OPCODE',
  ],
  claimsNotGranted: [
    'RCL_CANONICAL_PROMOTION',
    'GPU_TRAINING',
    'GPU_NATIVE_BACKWARD',
    'PRODUCTION_TRANSFORMER',
    'K400_PROMOTION',
  ],
  reportRoot: null,
};
evidence.reportRoot = evidenceRoot({ ...evidence, reportRoot: undefined });
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: evidence.status, sourceCommit, reportRoot: evidence.reportRoot, output: path.relative(ROOT, OUTPUT_PATH).replaceAll('\\', '/') }, null, 2));
if (evidence.status.startsWith('FAIL')) process.exitCode = 1;
