import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runPureRclXorCampaign } from '../scripts/run-k08-pure-rcl-xor.mjs';

test('K08-A trains and evaluates XOR entirely in native-executed RCL', { timeout: 120_000 }, () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-pure-xor-'));
  const report = runPureRclXorCampaign({ outputDir });

  assert.equal(report.nativeLearningMilestone, 'PASS');
  assert.equal(report.k400Cell.id, 'ai-runtime::machine-learning');
  assert.equal(report.k400Cell.campaignId, 'K233');
  assert.equal(report.k400Cell.status, 'BLOCKED_AI_GENERATE');
  assert.equal(report.pureExecutionPath.javascriptTrainerParticipated, false);
  assert.equal(report.pureExecutionPath.referenceOracleParticipatedInNativeParameters, false);
  assert.equal(report.pureExecutionPath.dependencyAudit.ok, true);
  assert.equal(report.compiler.bytecodeParityWithJsReferenceCompiler, true);
  assert.deepEqual(report.evaluation.predicted, [0, 1, 1, 0]);
  assert.equal(report.evaluation.accuracy, 1);
  assert.ok(report.evaluation.loss <= 0.03);
  assert.ok(report.evaluation.maximumAbsolutePredictionError <= 0.25);
  assert.ok(report.evaluation.maximumParameterDrift <= 1e-9);
  assert.ok(report.evaluation.maximumTraceDrift <= 1e-9);
  assert.match(report.performance.memoryComparison, /^UNMEASURED_/u);
  assert.equal(report.robustness.replayCount, 3);
  assert.equal(report.robustness.identicalSemanticStateRoots, true);
  assert.equal(report.robustness.exactReplayStates, true);
  assert.equal(report.gates.AI_GENERATE.status, 'UNVERIFIED');
  for (const gate of ['EXPRESS', 'COMPILE', 'LOWER', 'EXECUTE', 'CORRECT', 'ROBUST', 'PERFORMANCE', 'EVIDENCE']) {
    assert.equal(report.gates[gate].status, 'PASS', gate);
  }
  for (const file of ['pure-rcl-xor.rbc', 'native-run.json', 'reference-oracle.json', 'k08-a-evidence.json', 'README.md']) {
    assert.equal(fs.existsSync(path.join(outputDir, file)), true, file);
  }
});
