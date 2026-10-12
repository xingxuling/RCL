import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { semanticStateRootForAlgorithm } from '../src/semantic-state-root.mjs';
import { verifyPortableAlgorithmReceipt } from '../scripts/verify-k400-expansion-receipts.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/expansion-wave1/' + name, import.meta.url), 'utf8'));
const records = () => ({ contract: read('algorithm-contract.json'), report: read('algorithm-runtime.json'), proposals: read('algorithm-independent-proposals.json') });
const seal = report => { report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined }); };

test('portable admission credits only four frozen coordinates', () => {
  const result = verifyPortableAlgorithmReceipt();
  assert.deepEqual(result.eligibleCells, ['K001', 'K002', 'K041', 'K042']);
  assert.equal(result.claims.length, 4);
});

test('a freshly hashed wrong result cannot pass admission through a matching semantic root', () => {
  const input = records();
  input.report.inputResults[0].state['result.gcd'] = 999;
  input.report.inputResults[0].stateRoot = semanticStateRootForAlgorithm(input.report.inputResults[0].state, 'rcl.semantic-state-root.v2');
  input.report.inputResults[0].wasiStateRoot = input.report.inputResults[0].stateRoot;
  seal(input.report);
  assert.throws(() => verifyPortableAlgorithmReceipt(input));
});

test('rehashed performance summaries and replay labels cannot conceal failed measurements', () => {
  const timing = records(); timing.report.rounds[0].wasiMs = 5000; seal(timing.report);
  assert.throws(() => verifyPortableAlgorithmReceipt(timing));
  const scope = records(); scope.report.eligibleCells.push('K021'); seal(scope.report);
  assert.throws(() => verifyPortableAlgorithmReceipt(scope));
  const generation = records(); generation.report.independentGeneration.trials[0].proposal.new = 'fabricated'; seal(generation.report);
  assert.throws(() => verifyPortableAlgorithmReceipt(generation));
});
