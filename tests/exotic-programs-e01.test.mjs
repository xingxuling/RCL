import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMinimalLivingIntelligence } from '../experiments/exotic-programs/E01/src/minimal-living-intelligence.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E01_ROOT = path.join(ROOT, 'experiments', 'exotic-programs', 'E01');

test('E01 is a real bounded program lifecycle, not an answer shortcut', async () => {
  const programSource = fs.readFileSync(path.join(E01_ROOT, 'program.rcl'), 'utf8');
  const { report } = await runMinimalLivingIntelligence({ programSource });
  assert.equal(report.status, 'VERIFIED');
  assert.equal(report.program.compiled, true);
  assert.equal(report.taskResults.taskA.status, 'VERIFIED');
  assert.equal(report.taskResults.taskBInitial.failure.failureKind, 'CAPABILITY_FAILURE');
  assert.equal(report.taskResults.taskBRetry.usedCapability, 'weighted_sum');
  assert.equal(report.taskResults.taskBReplayAfterDeletion.failure.root, report.taskResults.taskBInitial.failure.root);
  assert.equal(report.donorTrials[1].status, 'BLOCKED');
  assert.equal(report.donorTrials[1].candidateNotInstalled, true);
  assert.equal(report.authorityBoundary.candidateOrganCanonical, false);
  assert.ok(Object.values(report.checks).every(Boolean));
});
