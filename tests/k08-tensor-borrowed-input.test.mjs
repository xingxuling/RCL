import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { runPortableGeneralMlpTensorPlan } from '../scripts/run-k08-general-mlp-tensor-lowering.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const root = path.resolve('.');
const contract = JSON.parse(fs.readFileSync(
  path.join(root, 'examples', 'native-ai', 'general-mlp-contract.v0.1.json'),
  'utf8',
));
const acceptedEvidencePath = path.join(
  root,
  'examples',
  'native-ai',
  'evidence',
  'tensor-plan-borrowed-inputs-v0.1',
  'k08-f-tensor-borrowed-input-evidence.json',
);

test('K08-F binds Tensor Plan inputs by reference without cloning Dense Storage', { timeout: 180_000 }, () => {
  const { result } = runPortableGeneralMlpTensorPlan(contract);
  assert.equal(result.status, 'ok');
  assert.equal(result.telemetry.nodeCount, 29_980);
  assert.equal(result.telemetry.inputBindingCount, 54_964);
  assert.equal(result.telemetry.borrowedInputBindingCount, 54_964);
  assert.equal(result.telemetry.avoidedInputCloneElements, 314_521);
  assert.equal(result.telemetry.avoidedInputCloneBytes, 2_516_168);
  assert.equal(result.telemetry.clonedInputElements, 0);
  assert.equal(result.telemetry.clonedInputBytes, 0);
});

test('K08-F accepted evidence is self-rooted and keeps process-memory claims bounded', () => {
  const report = JSON.parse(fs.readFileSync(acceptedEvidencePath, 'utf8'));
  const reportRoot = report.reportRoot;
  report.generatedAt = undefined;
  report.reportRoot = undefined;
  assert.equal(evidenceRoot(report), reportRoot);
  assert.equal(report.status, 'ENGINE_E1_TENSOR_BORROWED_INPUT_CANDIDATE');
  assert.equal(Object.values(report.checks).every(Boolean), true);
  assert.equal(report.sourceEvidence.baselineCommit, '9805956dfd24834d650534a8186ab53eb084f8b5');
  assert.equal(report.productionWorkload.clonedInputBytes, 0);
  assert.equal(report.productionWorkload.avoidedInputCloneBytes, 2_516_168);
  assert.ok(report.controlledPerformance.speedup > 1);
  assert.ok(report.processMemory.production.baselineMedianBytes > 0);
  assert.ok(report.processMemory.production.borrowedMedianBytes > 0);
  assert.ok(report.processMemory.cloneStress.reductionBytes > 0);
  assert.ok(report.claimsNotGranted.includes('GENERAL_TENSOR_MEMORY_REDUCTION'));
  assert.ok(report.claimsNotGranted.includes('BUFFER_REUSE'));
  assert.ok(report.claimsNotGranted.includes('K400_PROMOTION_FROM_THIS_CANDIDATE'));
});

test('K08-F Windows sampler records the child peak Working Set while it is alive', () => {
  const sampler = fs.readFileSync(
    path.join(root, 'scripts', 'measure-process-peak-working-set.ps1'),
    'utf8',
  );
  assert.match(sampler, /PeakWorkingSet64/);
  assert.match(sampler, /WaitForExit\(1\)/);
  assert.match(sampler, /peakWorkingSetBytes = \$peakWorkingSetBytes/);
});

test('K08-F GitHub receipt binds the admitted replay and preserves failed sampler history', () => {
  const receipt = JSON.parse(fs.readFileSync(
    path.join(path.dirname(acceptedEvidencePath), 'github-replay.json'),
    'utf8',
  ));
  const authorityRoot = receipt.authorityRoot;
  delete receipt.authorityRoot;
  assert.equal(
    crypto.createHash('sha256').update(JSON.stringify(receipt)).digest('hex'),
    authorityRoot,
  );
  assert.equal(receipt.status, 'PASS_GITHUB_HOSTED_REPLAY_BOUND');
  assert.equal(receipt.sourceCommit, 'd130a4d91f68159ea7405222ed6658ff2269b459');
  assert.equal(receipt.runId, 32821559973);
  assert.equal(receipt.runConclusion, 'success');
  assert.deepEqual(receipt.jobs.map(({ platform, conclusion }) => [platform, conclusion]), [
    ['ubuntu-latest', 'success'],
    ['windows-latest', 'success'],
  ]);
  assert.deepEqual(receipt.priorFailedRuns.map(({ runId }) => runId), [32819776325, 32820687027]);
  const evidence = JSON.parse(fs.readFileSync(acceptedEvidencePath, 'utf8'));
  assert.equal(receipt.localEvidenceReportRoot, evidence.reportRoot);
  assert.ok(receipt.claimsNotGranted.includes('PORTABLE_RSS_REDUCTION'));
  assert.ok(receipt.claimsNotGranted.includes('K400_PASS'));
});
