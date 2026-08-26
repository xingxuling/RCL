import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ENGINE = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-bf16-autodiff-adamw.exe' : 'rcl-bf16-autodiff-adamw');
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'bf16-autodiff-adamw-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'bf16-autodiff-adamw-contract.v0.2.json');

const view = new DataView(new ArrayBuffer(4));
function f32(value) { return Math.fround(value); }
function f32Bits(value) { view.setFloat32(0, f32(value), false); return view.getUint32(0, false); }
function exactBits(value) { return f32Bits(value).toString(16).padStart(8, '0'); }
function f32FromBits(bits) { view.setUint32(0, bits >>> 0, false); return view.getFloat32(0, false); }
function bf16Bits(value) {
  const bits = f32Bits(value);
  const lsb = (bits >>> 16) & 1;
  return ((bits + 0x7fff + lsb) >>> 16) & 0xffff;
}
function q(value) { return f32FromBits((bf16Bits(value) << 16) >>> 0); }
function hex16(value) { return value.toString(16).padStart(4, '0'); }
function bf16ValueFromBits(bits) { return f32FromBits((bits & 0xffff) << 16); }

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-bf16-autodiff-adamw'], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_S_BUILD_FAILED');
}

function tensor(id, shape, storageIdentity, gradientIdentity = `derived:${id}`) {
  return { id, shape, dtype: 'bf16', layout: 'row-major', device: 'cpu', gradientIdentity, storageIdentity };
}

function output(id, shape) {
  return { id, shape, dtype: 'bf16', layout: 'row-major', device: 'cpu', gradientIdentity: `derived:${id}` };
}

function baseRequest(steps = 12) {
  const graph = {
    format: 'rcl.tensor-execution-plan.v0.1',
    bindings: { semanticOwner: 'RCL', precisionPolicy: 'bf16-rne-fp32-accumulation' },
    tensors: [
      tensor('input', [4, 1], 'storage:input'),
      tensor('target', [4, 1], 'storage:target'),
      tensor('w', [1, 1], 'storage:w', 'parameter:w'),
      tensor('b', [1], 'storage:b', 'parameter:b'),
    ],
    storages: [
      { identity: 'storage:input', kind: 'cpu-dense', data: [0, 1, 2, 3] },
      { identity: 'storage:target', kind: 'cpu-dense', data: [0, 1, 2, 3] },
      { identity: 'storage:w', kind: 'cpu-dense', data: [0] },
      { identity: 'storage:b', kind: 'cpu-dense', data: [0] },
    ],
    exactF32StorageBits: {
      'storage:w': [exactBits(0)],
      'storage:b': [exactBits(0)],
    },
    nodes: [
      { id: 'project', operation: 'matmul', inputs: ['input', 'w'], output: output('projected', [4, 1]), attributes: {} },
      { id: 'bias', operation: 'broadcast', inputs: ['b'], output: output('biasExpanded', [4, 1]), attributes: { shape: [4, 1] } },
      { id: 'addBias', operation: 'add', inputs: ['projected', 'biasExpanded'], output: output('prediction', [4, 1]), attributes: {} },
      { id: 'error', operation: 'sub', inputs: ['prediction', 'target'], output: output('error', [4, 1]), attributes: {} },
      { id: 'square', operation: 'mul', inputs: ['error', 'error'], output: output('squaredError', [4, 1]), attributes: {} },
      { id: 'sampleMean', operation: 'mean', inputs: ['squaredError'], output: output('sampleLoss', [4]), attributes: { axis: 1 } },
      { id: 'loss', operation: 'mean', inputs: ['sampleLoss'], output: output('loss', []), attributes: { axis: 0 } },
    ],
    outputs: ['loss', 'prediction'],
  };
  return {
    format: 'rcl.bf16-autodiff-adamw-request.v0.2',
    backend: 'cpu-reference',
    steps,
    autodiff: {
      format: 'rcl.tensor-autodiff-request.v0.1',
      graph,
      loss: 'loss',
      parameters: [
        { tensorId: 'w', gradientIdentity: 'parameter:w' },
        { tensorId: 'b', gradientIdentity: 'parameter:b' },
      ],
      stopGradients: [],
      precision: 'bf16-rne-fp32-accumulation',
    },
    config: {
      learningRate: 0.05,
      beta1: 0.9,
      beta2: 0.999,
      epsilon: 1e-5,
      weightDecay: 0.01,
      gradientClip: 10,
    },
    optimizerStates: [],
  };
}

function execute(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-s-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_S_EXECUTION_STATUS');
  return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim());
}

function independentLoss(masterWeight, bias) {
  const input = [0, 1, 2, 3].map(q);
  const target = [0, 1, 2, 3].map(q);
  const weight = q(masterWeight);
  const offset = q(bias);
  const sampleLosses = input.map((value, index) => {
    const projected = q(f32(value * weight));
    const prediction = q(f32(projected + offset));
    const error = q(f32(prediction - target[index]));
    return q(f32(error * error));
  });
  return q(f32(sampleLosses.reduce((sum, value) => f32(sum + value), 0) / 4));
}

function surrogateLoss(masterWeight, bias) {
  const input = [0, 1, 2, 3].map(q);
  const target = [0, 1, 2, 3].map(q);
  const sampleLosses = input.map((value, index) => {
    const prediction = f32(f32(value * masterWeight) + bias);
    const error = f32(prediction - target[index]);
    return f32(error * error);
  });
  return f32(sampleLosses.reduce((sum, value) => f32(sum + value), 0) / 4);
}

function finiteDifference(fn, value, epsilon = 1e-3) {
  return f32((fn(value + epsilon) - fn(value - epsilon)) / (2 * epsilon));
}

function gradientOf(result, tensorId) {
  return result.initialGradients.find((item) => item.tensorId === tensorId).gradient;
}

function adamwOneStep(weight, gradient, config) {
  const beta1 = f32(config.beta1);
  const beta2 = f32(config.beta2);
  const m = f32(f32((1 - beta1) * gradient));
  const v = f32(f32((1 - beta2) * gradient * gradient));
  const direction = f32(f32(m / f32(1 - beta1)) / f32(Math.sqrt(f32(v / f32(1 - beta2))) + config.epsilon));
  return f32(f32(weight * f32(1 - config.learningRate * config.weightDecay)) - f32(config.learningRate * direction));
}

let campaign;
test.before(() => buildEngine());

test('K08-S genome self-hosts with byte parity and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-s-source-'));
  const rbcPath = path.join(directory, 'bf16-autodiff-adamw.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(compiled.status, 'ok');
  assert.equal(fs.readFileSync(rbcPath).equals(Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')))), true);
  const run = runNativeBytecode(rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
  assert.equal(run.stateRootVerified, true);
  assert.equal(run.state['evaluation.steps_valid'], true);
  assert.equal(run.state['evaluation.parameter_order_valid'], true);
  assert.equal(run.state['evaluation.gpu_claim_closed'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-S BF16 forward is bit-level differential and loss decreases', () => {
  campaign = execute(baseRequest(16));
  assert.equal(campaign.status, 'ok');
  assert.equal(campaign.autodiffPrecision, 'bf16-rne-fp32-accumulation');
  assert.equal(campaign.telemetry.forwardComputeDtype, 'bf16');
  assert.equal(campaign.telemetry.accumulationDtype, 'f32');
  assert.equal(campaign.initialLoss, independentLoss(0, 0));
  assert.ok(campaign.finalLoss < campaign.initialLoss, `${campaign.initialLoss} -> ${campaign.finalLoss}`);
});

test('K08-S reverse Autodiff emits FP32 gradients under the explicit straight-through cast rule', () => {
  const result = campaign ?? execute(baseRequest(1));
  assert.equal(result.telemetry.gradientDtype, 'f32');
  assert.equal(result.telemetry.castBackwardPolicy, 'straight-through-fp32');
  const gradientW = gradientOf(result, 'w').data[0];
  const gradientB = gradientOf(result, 'b').data[0];
  const finiteW = finiteDifference((value) => surrogateLoss(value, 0), 0);
  const finiteB = finiteDifference((value) => surrogateLoss(0, value), 0);
  assert.ok(Math.abs(gradientW - finiteW) < 0.2, `${gradientW} vs ${finiteW}`);
  assert.ok(Math.abs(gradientB - finiteB) < 0.2, `${gradientB} vs ${finiteB}`);
  assert.equal(exactBits(gradientW), gradientOf(result, 'w').bitsHex[0]);
});

test('K08-S FP32 master weights differ from BF16 compute weights and one-step AdamW matches the oracle', () => {
  const request = baseRequest(1);
  const result = execute(request);
  const config = request.config;
  for (const parameter of result.parameters) {
    assert.equal(parameter.masterWeight.dtype, 'f32');
    assert.equal(parameter.computeWeight.dtype, 'bf16');
    assert.equal(parameter.masterWeight.bitsHex.length, parameter.computeWeight.bitsHex.length);
    assert.ok(parameter.masterWeight.data.some((value, index) => value !== bf16ValueFromBits(Number.parseInt(parameter.computeWeight.bitsHex[index], 16))), parameter.tensorId);
  }
  const expectedW = adamwOneStep(0, gradientOf(result, 'w').data[0], config);
  const expectedB = adamwOneStep(0, gradientOf(result, 'b').data[0], config);
  assert.equal(result.parameters.find((item) => item.tensorId === 'w').masterWeight.bitsHex[0], exactBits(expectedW));
  assert.equal(result.parameters.find((item) => item.tensorId === 'b').masterWeight.bitsHex[0], exactBits(expectedB));
  assert.equal(result.optimizerStates.every((state) => state.step === 1), true);
  assert.equal(result.optimizerStates.every((state) => state.exactFirstMomentBits.length > 0 && state.exactSecondMomentBits.length > 0), true);
});

test('K08-S every canonical parameter updates and deterministic replay is exact', () => {
  const first = execute(baseRequest(8));
  const second = execute(baseRequest(8));
  assert.deepEqual(second.parameters, first.parameters);
  assert.deepEqual(second.optimizerStates, first.optimizerStates);
  assert.equal(second.checkpointRoot, first.checkpointRoot);
  assert.equal(second.finalLoss, first.finalLoss);
  assert.deepEqual(first.parameterOrder, ['w', 'b']);
  assert.equal(first.parameters.every((parameter) => parameter.masterWeight.bitsHex.some((bits) => bits !== '00000000')), true);
});

test('K08-S direct N steps equals exact checkpoint K plus resume N-K', () => {
  const direct = execute(baseRequest(8));
  const first = execute(baseRequest(4));
  const resumed = baseRequest(4);
  resumed.autodiff.graph.exactF32StorageBits['storage:w'] = [first.parameters.find((item) => item.tensorId === 'w').masterWeight.bitsHex[0]];
  resumed.autodiff.graph.exactF32StorageBits['storage:b'] = [first.parameters.find((item) => item.tensorId === 'b').masterWeight.bitsHex[0]];
  resumed.autodiff.graph.storages.find((item) => item.identity === 'storage:w').data = [first.parameters.find((item) => item.tensorId === 'w').masterWeight.data[0]];
  resumed.autodiff.graph.storages.find((item) => item.identity === 'storage:b').data = [first.parameters.find((item) => item.tensorId === 'b').masterWeight.data[0]];
  resumed.optimizerStates = first.optimizerStates;
  const continuation = execute(resumed);
  assert.deepEqual(continuation.parameters, direct.parameters);
  assert.deepEqual(continuation.optimizerStates, direct.optimizerStates);
  assert.equal(continuation.checkpointRoot, direct.checkpointRoot);
  assert.equal(continuation.finalLoss, direct.finalLoss);
});

test('K08-S malformed, non-finite and reordered exact state inputs fail closed', () => {
  const malformed = baseRequest(1);
  malformed.autodiff.graph.exactF32StorageBits['storage:w'] = ['0000000'];
  assert.equal(execute(malformed, false).code, 'RCL_BF16_AD_EXACT_BITS');
  const nonfinite = baseRequest(1);
  nonfinite.autodiff.graph.exactF32StorageBits['storage:w'] = ['7f800000'];
  assert.equal(execute(nonfinite, false).code, 'RCL_BF16_AD_NONFINITE');
  const first = execute(baseRequest(1));
  const reordered = baseRequest(1);
  reordered.optimizerStates = [...first.optimizerStates].reverse();
  reordered.autodiff.graph.exactF32StorageBits['storage:w'] = [first.parameters.find((item) => item.tensorId === 'w').masterWeight.bitsHex[0]];
  reordered.autodiff.graph.exactF32StorageBits['storage:b'] = [first.parameters.find((item) => item.tensorId === 'b').masterWeight.bitsHex[0]];
  assert.equal(execute(reordered, false).code, 'RCL_BF16_AD_STATE_ORDER');
});

test('K08-S unsupported accelerator fails closed without CPU fallback', () => {
  const request = baseRequest(1);
  request.backend = 'cuda';
  const result = execute(request, false);
  assert.equal(result.code, 'RCL_ACCELERATOR_BACKEND_UNAVAILABLE');
  assert.match(result.message, /silent CPU fallback is forbidden/);
});

test('K08-S contract grants only the bounded BF16 training claims', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.precisionPolicy.bf16CastBackward, 'straight-through-fp32');
  for (const claim of ['BF16_CANONICAL_RNE_FORWARD', 'BF16_GENERIC_AUTODIFF_CPU_REFERENCE', 'FP32_GRADIENT_AND_MASTER_WEIGHT', 'FP32_ADAMW_STATE', 'EXACT_FP32_CHECKPOINT_RESUME', 'NO_SILENT_ACCELERATOR_FALLBACK']) assert.ok(contract.claimsGrantedOnAdmission.includes(claim));
  for (const claim of ['GPU', 'MULTI_BLOCK_BF16_TRAINING', 'RCL_10M', 'RCL_1B', 'K400_PROMOTION']) assert.ok(contract.claimsNotGranted.includes(claim));
  assert.equal(contract.gapRegister.includes('RCL_GAP_GPU_EXECUTION'), true);
});
