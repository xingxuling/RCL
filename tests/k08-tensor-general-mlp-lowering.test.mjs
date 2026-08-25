import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  runGeneralMlpTensorLoweringCampaign,
  runPortableGeneralMlpTensorPlan,
} from '../scripts/run-k08-general-mlp-tensor-lowering.mjs';
import { runGeneralMlpOracle } from '../scripts/run-k08-general-mlp.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const root = path.resolve('.');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'general-mlp-contract.v0.1.json'), 'utf8'));
const evidenceDirectory = path.join(root, 'examples', 'native-ai', 'evidence', 'general-mlp-tensor-v0.1');

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function maximumDifference(left, right) {
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - right[index])), 0);
}

function artifactHash(relativePaths) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of relativePaths) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

test('K08-D lowers the existing General MLP to a bounded generic Tensor SSA plan', { timeout: 180_000 }, () => {
  const { plan, outputIds, result } = runPortableGeneralMlpTensorPlan(contract);
  assert.equal(result.status, 'ok');
  assert.equal(plan.nodes.length, 29_980);
  assert.ok(plan.nodes.length < 32_768);
  assert.deepEqual([...new Set(plan.nodes.map((node) => node.operation))].sort(), ['abs', 'add', 'div', 'matmul', 'mul', 'sub', 'sum', 'transpose']);
  assert.equal(plan.nodes.some((node) => /xor|majority|mlp|train/i.test(node.operation)), false);
  const outputs = new Map(result.outputs.map((output) => [output.tensor.id, output.storage.data]));
  const oracle = runGeneralMlpOracle(contract);
  for (const task of contract.tasks) {
    const predictions = outputs.get(outputIds.tasks[task.id].predictions);
    assert.equal(predictions.length, task.dataset.length);
    assert.ok(maximumDifference(predictions, oracle.tasks[task.id].final.outputs) <= 1e-9);
  }
  for (const key of ['w1', 'b1', 'w2', 'b2']) {
    assert.deepEqual(outputs.get(outputIds.checkpoint.direct[key]), outputs.get(outputIds.checkpoint.resumed[key]));
  }
});

test('K08-D accepted evidence binds the current lowering organ and Tensor backend', () => {
  const evidencePath = path.join(root, 'examples', 'native-ai', 'evidence', 'general-mlp-tensor-v0.1', 'k08-d-general-mlp-tensor-evidence.json');
  const report = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const reportRoot = report.reportRoot;
  report.generatedAt = undefined;
  report.reportRoot = undefined;
  assert.equal(evidenceRoot(report), reportRoot);
  assert.equal(report.artifactHashes.rustBackend, artifactHash(['native/tensor-engine/Cargo.toml', 'native/tensor-engine/Cargo.lock', 'native/tensor-engine/src/lib.rs', 'native/tensor-engine/src/main.rs', 'native/tensor-engine/src/rclvm_provider.rs']));
  assert.equal(report.artifactHashes.loweringOrgan, artifactHash(['scripts/run-k08-general-mlp-tensor-lowering.mjs']));
  assert.equal(report.checks.checkpoint, true);
  assert.equal(report.checks.differential, true);
  assert.ok(report.performance.scalarToTensorSpeedup > 1);
});

test('K08-D GitHub replay receipt binds the exact implementation and accepted evidence root', () => {
  const receipt = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'github-replay.json'), 'utf8'));
  const authorityRoot = receipt.authorityRoot;
  delete receipt.authorityRoot;
  assert.equal(sha256(receipt), authorityRoot);
  assert.equal(receipt.status, 'PASS_GITHUB_HOSTED_REPLAY_BOUND');
  assert.equal(receipt.sourceCommit, '8b53c60321345fdcc9449c1a5b7b522a3e7939a9');
  assert.equal(receipt.runId, 32810795935);
  assert.equal(receipt.runConclusion, 'success');
  assert.deepEqual(receipt.jobs.map(({ platform, conclusion }) => [platform, conclusion]), [
    ['ubuntu-latest', 'success'],
    ['windows-latest', 'success'],
  ]);
  const evidence = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'k08-d-general-mlp-tensor-evidence.json'), 'utf8'));
  assert.equal(receipt.localEvidenceReportRoot, evidence.reportRoot);
  assert.ok(receipt.claimsNotGranted.includes('K400_PASS'));
  assert.ok(receipt.claimsNotGranted.includes('PERFORMANCE_PARITY_WITH_JAVASCRIPT'));
});

test('K08-D real Windows Provider path reduces the scalar MLP gap and preserves exact checkpoint resume', { timeout: 240_000, skip: process.platform !== 'win32' || process.env.RCL_K08_D_FULL !== '1' }, () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-d-mlp-tensor-'));
  const report = runGeneralMlpTensorLoweringCampaign({ outputDir });
  assert.equal(report.status, 'ENGINE_E1_GENERAL_MLP_TENSOR_LOWERING_CANDIDATE');
  assert.equal(Object.values(report.checks).every(Boolean), true);
  assert.equal(report.checkpoint.serializedBoundaryExactResumeParity, true);
  assert.equal(report.checkpoint.maximumBoundaryDrift, 0);
  assert.ok(report.performance.scalarToTensorSpeedup > 1);
  assert.ok(report.performance.optimizedTensorToOracleRatio < report.performance.priorNativeToOracleRatio);
  assert.equal(report.plan.forbiddenModelSpecialOperations.length, 0);
});
