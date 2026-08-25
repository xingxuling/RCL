import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'optimizer-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'optimizer-genome-contract.v0.1.json');
let nativeRun;

function firstMismatch(left, right) {
  const limit = Math.max(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) return { index, left: left[index], right: right[index] };
  }
  return null;
}

function runOptimizerGenome() {
  if (nativeRun) return nativeRun;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-optimizer-genome-'));
  const rbcPath = path.join(directory, 'optimizer-genome.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(compiled.status, 'ok');
  const source = fs.readFileSync(SOURCE, 'utf8');
  const nativeRbc = fs.readFileSync(rbcPath);
  const bootstrapRbc = Buffer.from(compileRealityToBytecode(source));
  if (!nativeRbc.equals(bootstrapRbc)) {
    const nativeDecoded = decodeBytecode(nativeRbc);
    const bootstrapDecoded = decodeBytecode(bootstrapRbc);
    throw new Error(`self-host/bootstrap RBC drift: ${JSON.stringify({
      byteLength: [nativeRbc.length, bootstrapRbc.length],
      sourceRoot: [nativeDecoded.sourceRoot, bootstrapDecoded.sourceRoot],
      stringMismatch: firstMismatch(nativeDecoded.strings, bootstrapDecoded.strings),
      numberMismatch: firstMismatch(nativeDecoded.numbers, bootstrapDecoded.numbers),
      instructionMismatch: firstMismatch(nativeDecoded.instructions, bootstrapDecoded.instructions),
      instructionCount: [nativeDecoded.instructions.length, bootstrapDecoded.instructions.length],
    })}`);
  }
  nativeRun = runNativeBytecode(rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    requireNativeStateRoot: true,
  });
  return nativeRun;
}

test('K08-H Optimizer Genome contract freezes model-agnostic SGD/Momentum/Adam/AdamW semantics', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-h.optimizer-genome-contract.v0.1');
  assert.deepEqual(contract.algorithms, ['sgd', 'momentum', 'adam', 'adamw']);
  assert.equal(contract.adamw.decoupledWeightDecay, true);
  assert.ok(contract.claimsNotGranted.includes('TRANSFORMER'));
  assert.ok(contract.claimsNotGranted.includes('K400_PROMOTION'));
});

test('K08-H RCL Optimizer Genome self-host compiles and executes natively', { timeout: 180_000 }, () => {
  const run = runOptimizerGenome();
  assert.equal(run.stateRootVerified, true);
  assert.equal(run.state['evaluation.sgd_correct'], true);
  assert.equal(run.state['evaluation.momentum_correct'], true);
  assert.equal(run.state['evaluation.adam_correct'], true);
  assert.equal(run.state['evaluation.adamw_correct'], true);
  assert.equal(run.state['evaluation.adamw_second_correct'], true);
  assert.equal(run.state['evaluation.checkpoint_resume_exact'], true);
  assert.equal(run.state['evaluation.invalid_configs_rejected'], true);
  assert.equal(run.state['evaluation.state_binding_valid'], true);
});

test('K08-H numeric fixture agrees with independent JavaScript AdamW oracle', { timeout: 180_000 }, () => {
  const run = runOptimizerGenome();
  const cfg = { learningRate: 0.01, beta1: 0.9, beta2: 0.999, epsilon: 0.01, weightDecay: 0.1 };
  let parameter = 1;
  let firstMoment = 0;
  let secondMoment = 0;
  const gradient = 0.5;
  for (let step = 1; step <= 2; step += 1) {
    firstMoment = cfg.beta1 * firstMoment + (1 - cfg.beta1) * gradient;
    secondMoment = cfg.beta2 * secondMoment + (1 - cfg.beta2) * gradient * gradient;
    const correctedFirst = firstMoment / (1 - cfg.beta1 ** step);
    const correctedSecond = secondMoment / (1 - cfg.beta2 ** step);
    parameter = parameter * (1 - cfg.learningRate * cfg.weightDecay)
      - cfg.learningRate * correctedFirst / (Math.sqrt(correctedSecond) + cfg.epsilon);
  }
  assert.ok(Math.abs(run.state['fixture.adamw.step2.parameter'] - parameter) <= 1e-12);
  assert.ok(Math.abs(run.state['fixture.adamw.step2.first_moment'] - firstMoment) <= 1e-12);
  assert.ok(Math.abs(run.state['fixture.adamw.step2.second_moment'] - secondMoment) <= 1e-12);
  assert.equal(run.state['fixture.adamw.step2.step'], 2);
});

test('K08-H source contains no model-special optimizer path', () => {
  const source = fs.readFileSync(SOURCE, 'utf8');
  assert.match(source, /optimizer_update/);
  assert.match(source, /adamw/);
  assert.match(source, /TrainingCheckpoint/);
  assert.doesNotMatch(source, /xor_special|mlp_special|transformer_special|gpt_special/i);
  assert.match(source, /CANDIDATE_ONLY_NO_TRANSFORMER_TINY_LM_ACCELERATOR_OR_K400_PROMOTION/);
});
