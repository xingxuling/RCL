import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runGeneralMlpCampaign } from '../scripts/run-k08-general-mlp.mjs';

test('K08-B trains two distinct supervised tasks through one native General MLP profile', { timeout: 120_000 }, () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-general-mlp-'));
  const report = runGeneralMlpCampaign({ outputDir });

  assert.equal(report.maturity, 'AI-N2');
  assert.equal(report.k400Cell.campaignId, 'K233');
  assert.equal(report.k400Cell.status, 'PASS');
  assert.equal(report.pureExecutionPath.javascriptTrainerParticipated, false);
  assert.equal(report.pureExecutionPath.referenceOracleParticipatedInNativeParameters, false);
  assert.equal(report.pureExecutionPath.dependencyAudit.ok, true);
  assert.equal(report.pureExecutionPath.dependencyAudit.providerOpcodeCount, 0);
  assert.equal(report.compiler.bytecodeParityWithJsReferenceCompiler, true);
  assert.deepEqual(report.tasks.xor.architecture, [2, 2, 1]);
  assert.deepEqual(report.tasks.majority3.architecture, [3, 3, 1]);
  assert.equal(report.tasks.xor.accuracy, 1);
  assert.equal(report.tasks.majority3.accuracy, 1);
  assert.ok(report.tasks.xor.loss <= 0.03);
  assert.ok(report.tasks.majority3.loss <= 0.03);
  assert.ok(report.tasks.xor.maximumParameterDrift <= 1e-9);
  assert.ok(report.tasks.majority3.maximumParameterDrift <= 1e-9);
  assert.equal(report.checkpoint.exactResumeParity, true);
  assert.equal(report.negativeControls.invalidShapeRejected, true);
  assert.equal(report.negativeControls.invalidDatasetRejected, true);
  assert.equal(report.robustness.replayCount, 3);
  assert.equal(report.robustness.identicalSemanticStateRoots, true);
  assert.equal(report.robustness.exactReplayStates, true);
  assert.equal(report.gates.AI_GENERATE.status, 'PASS');
  assert.equal(report.githubAuthority.admitted, true);
  for (const gate of ['EXPRESS', 'COMPILE', 'LOWER', 'EXECUTE', 'CORRECT', 'ROBUST', 'PERFORMANCE', 'EVIDENCE']) {
    assert.equal(report.gates[gate].status, 'PASS', gate);
  }
  for (const file of ['general-mlp.rbc', 'native-run.json', 'reference-oracle.json', 'k08-b-evidence.json', 'README.md']) {
    assert.equal(fs.existsSync(path.join(outputDir, file)), true, file);
  }
});
