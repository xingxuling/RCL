import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMinimalLivingIntelligence } from '../src/minimal-living-intelligence.mjs';

const E01_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const programSource = fs.readFileSync(path.join(E01_ROOT, 'program.rcl'), 'utf8');

test('E01 closes the bounded living-intelligence growth cycle', async () => {
  const { report } = await runMinimalLivingIntelligence({ programSource });
  assert.equal(report.status, 'VERIFIED');
  assert.equal(report.taskResults.taskA.status, 'VERIFIED');
  assert.equal(report.taskResults.taskBInitial.status, 'BLOCKED');
  assert.equal(report.taskResults.taskBRetry.status, 'VERIFIED');
  assert.equal(report.taskResults.taskBRetry.usedCapability, 'weighted_sum');
  assert.equal(report.taskResults.taskBReplayAfterDeletion.failure.root, report.taskResults.taskBInitial.failure.root);
  assert.equal(report.taskResults.taskCInitial.status, 'BLOCKED');
  assert.equal(report.donorTrials[0].status, 'VERIFIED');
  assert.equal(report.donorTrials[1].status, 'BLOCKED');
  assert.equal(report.donorTrials[1].candidateNotInstalled, true);
  assert.ok(Object.values(report.checks).every(Boolean));
});
