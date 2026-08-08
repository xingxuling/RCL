import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRbc13LegacyEvidenceClosure,
  readRbc13LegacyExpectedInventory,
  verifyRbc13LegacyEvidenceClosure,
} from '../src/rbc13-legacy-evidence-closure.mjs';

test('RBC 1.3 A3 inventory is committed, stable, and closes current RBC 1.1/RBC 1.2 receipts', () => {
  const inventory = readRbc13LegacyExpectedInventory();
  assert.equal(inventory.cases.length, 6);
  assert.deepEqual(inventory.cases.map(item => item.id), [
    'rbc11.stage5.encoder',
    'rbc12.foundation.batch-a',
    'rbc12.foundation.meta-batch-b',
    'rbc12.foundation.batch-c',
    'rbc12.foundation.batch-d',
    'rbc12.foundation.batch-e',
  ]);
  const report = buildRbc13LegacyEvidenceClosure();
  assert.equal(report.status, 'VERIFIED');
  assert.equal(report.summary.expectedCaseCount, 6);
  assert.equal(report.summary.verifiedReceiptCount, 6);
  assert.equal(report.summary.missing.length, 0);
  assert.equal(report.summary.duplicate.length, 0);
  assert.equal(report.summary.stale.length, 0);
  assert.equal(report.summary.altered.length, 0);
  assert.equal(report.summary.replayMismatches.length, 0);
  assert.equal(report.checks.rbc11Verified, true);
  assert.equal(report.checks.rbc12Verified, true);
  for (const record of report.records) {
    assert.match(record.sourceRoot, /^[a-f0-9]{64}$/);
    assert.match(record.bytecodeRoot, /^[a-f0-9]{64}$/);
    assert.match(record.resultRoot, /^[a-f0-9]{64}$/);
    assert.match(record.receiptRoot, /^[a-f0-9]{64}$/);
    assert.match(record.replayRoot, /^[a-f0-9]{64}$/);
  }
});

test('A3 verifier rejects duplicate, missing, stale, and altered receipts', () => {
  const report = buildRbc13LegacyEvidenceClosure();
  const duplicate = structuredClone(report);
  duplicate.records.push(structuredClone(duplicate.records[0]));
  const duplicateCheck = verifyRbc13LegacyEvidenceClosure(duplicate);
  assert.equal(duplicateCheck.verified, false);
  assert.deepEqual(duplicateCheck.duplicateIds, [duplicate.records[0].id]);

  const missing = structuredClone(report);
  missing.records = missing.records.slice(1);
  const missingCheck = verifyRbc13LegacyEvidenceClosure(missing);
  assert.equal(missingCheck.verified, false);
  assert.deepEqual(missingCheck.missing, ['rbc11.stage5.encoder']);

  const stale = structuredClone(report);
  stale.records[0].receipt.sourceCommit = 'stale-commit';
  const staleCheck = verifyRbc13LegacyEvidenceClosure(stale);
  assert.equal(staleCheck.verified, false);
  assert.deepEqual(staleCheck.staleReceipts, ['rbc11.stage5.encoder']);

  const altered = structuredClone(report);
  altered.records[0].receipt.resultRoot = '0'.repeat(64);
  const alteredCheck = verifyRbc13LegacyEvidenceClosure(altered);
  assert.equal(alteredCheck.verified, false);
  assert.deepEqual(alteredCheck.alteredReceipts, ['rbc11.stage5.encoder']);
});
