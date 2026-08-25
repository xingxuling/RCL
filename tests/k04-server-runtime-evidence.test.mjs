import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { verifyK04ServerRuntimeEvidence } from '../scripts/verify-k04-server-runtime-evidence.mjs';

test('K04 Server runtime receipt binds 20 loopback rounds and frozen performance budgets', async () => {
  const result = await verifyK04ServerRuntimeEvidence();
  assert.equal(result.admitted, true);
  assert.deepEqual(result.eligibleCells, ['K124', 'K138']);
  assert.ok(result.performance.transactionP95Ms <= result.performance.transactionP95BudgetMs);
  assert.ok(result.performance.startupProxyP95Ms <= result.performance.startupProxyP95BudgetMs);
});

test('K04 Server runtime receipt rejects a rooted performance regression', async () => {
  const source = JSON.parse(fs.readFileSync('examples/universal-stress/evidence/k04-server-runtime-v0.1.json', 'utf8'));
  const invalid = structuredClone(source);
  invalid.performance.transactionP95Ms = invalid.performance.transactionP95BudgetMs + 1;
  invalid.performance.status = 'FAIL';
  invalid.gates.PERFORMANCE = 'FAIL';
  invalid.status = 'FAIL';
  invalid.reportRoot = evidenceRoot({ ...invalid, generatedAt: undefined, reportRoot: undefined });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k04-server-runtime-negative-'));
  try {
    const evidencePath = path.join(directory, 'receipt.json');
    fs.writeFileSync(evidencePath, `${JSON.stringify(invalid, null, 2)}\n`, 'utf8');
    assert.equal((await verifyK04ServerRuntimeEvidence({ evidencePath })).admitted, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
