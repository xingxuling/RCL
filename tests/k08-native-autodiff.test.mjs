import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import {
  buildAnalyticFixture,
  executeRequest,
  primitiveEvidence,
  runNativeAutodiffCampaign,
} from '../scripts/run-k08-native-autodiff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let campaign;

function report() {
  campaign ??= runNativeAutodiffCampaign();
  return campaign;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

test('K08-G reverse-mode Autodiff agrees with analytic and finite-difference oracles', { timeout: 180_000 }, () => {
  const evidence = primitiveEvidence();
  assert.equal(evidence.analyticManualMaximumDrift, 0);
  assert.ok(evidence.finiteDifferenceMaximumDrift <= 2e-6);
  assert.equal(evidence.stopGradient.maximumDrift, 0);
  assert.equal(evidence.deterministic.uniqueRoots, 1);
  assert.equal(evidence.negative.parameterMissingRejected, true);
  const operations = new Set(evidence.fixtures.flatMap((fixture) => fixture.operations));
  for (const operation of [
    'add', 'sub', 'mul', 'div', 'matmul', 'transpose', 'reshape', 'broadcast',
    'sum', 'mean', 'exp', 'log', 'sqrt', 'abs', 'activation', 'softmax',
  ]) assert.equal(operations.has(operation), true, `missing differential fixture for ${operation}`);
});

test('K08-G Autodiff fails closed for GradientIdentity drift and unsupported reverse rules', { timeout: 180_000 }, () => {
  const identityDrift = buildAnalyticFixture();
  identityDrift.parameters[0].gradientIdentity = 'parameter:wrong';
  assert.equal(executeRequest(identityDrift, false).code, 'RCL_AUTODIFF_GRADIENT_IDENTITY');

  const unsupported = buildAnalyticFixture();
  unsupported.graph.nodes.at(-1).operation = 'max';
  assert.equal(executeRequest(unsupported, false).code, 'RCL_AUTODIFF_OPERATION_UNSUPPORTED');

  const nonScalar = buildAnalyticFixture();
  nonScalar.loss = 'terms';
  assert.equal(executeRequest(nonScalar, false).code, 'RCL_AUTODIFF_LOSS_NOT_SCALAR');

  const invalidTraining = {
    format: 'rcl.tensor-autodiff-sgd-training-request.v0.1',
    autodiff: buildAnalyticFixture(),
    steps: 0,
    learningRate: 0.1,
  };
  assert.equal(executeRequest(invalidTraining, false).code, 'RCL_AUTODIFF_TRAINING_STEP_LIMIT');
});

test('K08-G migrates XOR and Majority-3 training from manual backward to generic native Autodiff', { timeout: 180_000 }, () => {
  const result = report();
  assert.equal(result.status, 'ENGINE_E2_AUTODIFF_CANDIDATE');
  assert.equal(result.generalMlp.tasks.xor.accuracy, 1);
  assert.equal(result.generalMlp.tasks.majority3.accuracy, 1);
  assert.ok(result.generalMlp.tasks.xor.finalLoss <= 0.03);
  assert.ok(result.generalMlp.tasks.majority3.finalLoss <= 0.03);
  assert.ok(result.generalMlp.tasks.xor.maximumParameterDriftVsManualOracle <= 1e-9);
  assert.ok(result.generalMlp.tasks.majority3.maximumParameterDriftVsManualOracle <= 1e-9);
  assert.equal(result.generalMlp.checkpoint.exactResumeParity, true);
  assert.equal(result.generalMlp.checkpoint.maximumParameterDrift, 0);
  assert.equal(result.checks.noModelSpecialOperation, true);
});

test('K08-G source preserves generic Tensor IR and explicit authority boundaries', () => {
  const rust = fs.readFileSync(path.join(ROOT, 'native', 'tensor-engine', 'src', 'autodiff.rs'), 'utf8');
  const runner = fs.readFileSync(path.join(ROOT, 'scripts', 'run-k08-native-autodiff.mjs'), 'utf8');
  assert.match(rust, /pub struct BackwardEdge/);
  assert.match(rust, /pub struct GradientAccumulator/);
  assert.match(rust, /pub fn backward/);
  assert.doesNotMatch(rust, /xor_gradient|mlp_backward|attention_backward|transformer_backward/i);
  assert.doesNotMatch(runner, /operation:\s*['"](?:xor|majority|mlp|transformer|attention)/i);
});

test('K08-G RCL Autodiff Genome compiles with self-host parity and executes natively', { timeout: 120_000 }, () => {
  const sourcePath = path.join(ROOT, 'examples', 'native-ai', 'autodiff-genome.rcl');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-autodiff-genome-'));
  const rbcPath = path.join(directory, 'autodiff-genome.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', sourcePath, rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const nativeRbc = fs.readFileSync(rbcPath);
  const bootstrapRbc = Buffer.from(compileRealityToBytecode(fs.readFileSync(sourcePath, 'utf8')));
  assert.equal(compiled.status, 'ok');
  assert.equal(nativeRbc.equals(bootstrapRbc), true);
  const run = runNativeBytecode(rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    requireNativeStateRoot: true,
  });
  assert.equal(run.stateRootVerified, true);
  assert.equal(run.state['evaluation.generic_operations'], true);
  assert.equal(run.state['evaluation.backward_edges_exist'], true);
  assert.equal(run.state['evaluation.stop_gradient_blocks'], true);
  assert.equal(run.state['backward.edge_count'], 3);
});

test('K08-G accepted receipt is self-rooted and K400 remains non-promoted', () => {
  const receiptPath = path.join(ROOT, 'examples', 'native-ai', 'evidence', 'native-autodiff-v0.1', 'k08-g-native-autodiff-evidence.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const rooted = { ...receipt };
  delete rooted.generatedAt;
  delete rooted.reportRoot;
  const actualRoot = createHash('sha256').update(JSON.stringify(stable(rooted))).digest('hex');
  assert.equal(receipt.reportRoot, actualRoot);
  assert.equal(receipt.sourceCommit, '3132b81d9e0b7b7788aaf4b23457656c559b9793');
  assert.equal(Object.values(receipt.checks).every(Boolean), true);

  const k400 = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'universal-stress', 'k400-current-evidence.json'), 'utf8'));
  assert.equal(k400.sourceReceipts.includes('examples/native-ai/evidence/native-autodiff-v0.1/k08-g-native-autodiff-evidence.json'), true);
  assert.equal(k400.sourceReceipts.includes('examples/native-ai/evidence/native-autodiff-v0.1/github-replay.json'), true);
  assert.equal(k400.claims.filter((claim) => claim.campaignId === 'K233').length, 1);
  assert.match(k400.notes.join('\n'), /grants no new K233 gate or K400 cell/);
});

test('K08-G GitHub receipt binds exact Ubuntu and Windows hosted replay', () => {
  const receipt = JSON.parse(fs.readFileSync(path.join(
    ROOT,
    'examples',
    'native-ai',
    'evidence',
    'native-autodiff-v0.1',
    'github-replay.json',
  ), 'utf8'));
  const authorityRoot = receipt.authorityRoot;
  delete receipt.authorityRoot;
  const actualRoot = createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
  assert.equal(authorityRoot, actualRoot);
  assert.equal(receipt.status, 'PASS_GITHUB_HOSTED_REPLAY_BOUND');
  assert.equal(receipt.sourceCommit, '103a330f034a234c52d2d7eb287fd154c4e4b902');
  assert.equal(receipt.runId, 32828410493);
  assert.deepEqual(receipt.jobs.map(({ platform, conclusion }) => [platform, conclusion]), [
    ['ubuntu-latest', 'success'],
    ['windows-latest', 'success'],
  ]);
  assert.equal(receipt.localEvidenceReportRoot, '5028e21e0c0184795cb0375e8aa2ef928c0f22d8fae1c32584f2192c41de7709');
  assert.ok(receipt.claimsNotGranted.includes('K400_PASS'));
});
