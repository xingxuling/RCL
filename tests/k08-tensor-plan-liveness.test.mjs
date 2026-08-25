import assert from 'node:assert/strict';
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
  'tensor-plan-liveness-v0.1',
  'k08-e-tensor-plan-liveness-evidence.json',
);

test('K08-E reclaims dead Tensor Plan values while preserving requested outputs', { timeout: 180_000 }, () => {
  const { result } = runPortableGeneralMlpTensorPlan(contract);
  assert.equal(result.status, 'ok');
  assert.equal(result.telemetry.nodeCount, 29_980);
  assert.equal(result.telemetry.cumulativeAllocatedElements, 207_135);
  assert.equal(result.telemetry.peakLiveElements, 232);
  assert.equal(result.telemetry.liveElements, 55);
  assert.equal(result.telemetry.retainedOutputElements, 55);
  assert.equal(result.telemetry.reclaimedTensorCount, 30_002);
  assert.equal(result.telemetry.reclaimedElements, 207_080);
  assert.equal(
    result.telemetry.reclaimedElements + result.telemetry.retainedOutputElements,
    result.telemetry.cumulativeAllocatedElements,
  );
});

test('K08-E accepted local receipt is self-rooted and keeps claims bounded', () => {
  const report = JSON.parse(fs.readFileSync(acceptedEvidencePath, 'utf8'));
  const reportRoot = report.reportRoot;
  report.generatedAt = undefined;
  report.reportRoot = undefined;
  assert.equal(evidenceRoot(report), reportRoot);
  assert.equal(report.status, 'ENGINE_E1_TENSOR_PLAN_LIVENESS_CANDIDATE');
  assert.equal(Object.values(report.checks).every(Boolean), true);
  assert.equal(report.sourceEvidence.baselineCommit, 'ccfab80217a76d8ad5ab923e891cb8e8fbd538d7');
  assert.ok(report.planStore.peakPlanStoreReductionFactor > 800);
  assert.ok(report.controlledPerformance.speedup > 1);
  assert.ok(report.claimsNotGranted.includes('PROCESS_RSS_REDUCTION'));
  assert.ok(report.claimsNotGranted.includes('GENERAL_TENSOR_WORKLOAD_SPEEDUP'));
  assert.ok(report.claimsNotGranted.includes('K400_PROMOTION_FROM_THIS_CANDIDATE'));
});
