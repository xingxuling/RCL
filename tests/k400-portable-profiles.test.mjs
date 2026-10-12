import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { semanticStateRootForAlgorithm } from '../src/semantic-state-root.mjs';
import { verifyPortableProfileReceipt } from '../scripts/verify-k400-portable-profiles.mjs';

const read = file => JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/portable-profiles/' + file, import.meta.url), 'utf8'));
const records = () => ({ contract: read('relations-contract.json'), report: read('relations-runtime.json') });
const reseal = report => { report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined }); };

test('frozen portable relation receipt has real target bindings for its four eligible cells', () => {
  const result = verifyPortableProfileReceipt('relations');
  assert.equal(result.admitted, true);
  assert.deepEqual(result.eligibleCells, ['K046', 'K006', 'K026', 'K086']);
});

test('rehashed target omissions, missing source bindings and physical-device relabels are rejected', () => {
  const omission = records(); delete omission.report.backendResults.linux; reseal(omission.report);
  assert.throws(() => verifyPortableProfileReceipt('relations', omission));
  const source = records(); source.report.sourceBindings.splice(0, 1); reseal(source.report);
  assert.throws(() => verifyPortableProfileReceipt('relations', source));
  const device = records(); device.report.backendResults.android.binding.physicalDeviceClaimed = true; reseal(device.report);
  assert.throws(() => verifyPortableProfileReceipt('relations', device));
});

test('a rehashed wrong joined sum with a valid state root cannot replace the sealed oracle', () => {
  const wrong = records(), row = wrong.report.backendResults.linux.inputResults[0];
  row.state['query.region_10_committed_sum'] = 9999;
  row.stateRoot = semanticStateRootForAlgorithm(row.state, 'rcl.semantic-state-root.v2'); reseal(wrong.report);
  assert.throws(() => verifyPortableProfileReceipt('relations', wrong));
});

test('pre-sealed empty/absent-region cases and distinct generator contexts cannot be omitted', () => {
  const cases = records(); cases.report.backendResults.android.inputResults.pop(); reseal(cases.report);
  assert.throws(() => verifyPortableProfileReceipt('relations', cases));
  const contexts = records(); const trials = contexts.report.backendResults.windows.independentTrials;
  trials[1].generatorContext = trials[0].generatorContext; reseal(contexts.report);
  assert.throws(() => verifyPortableProfileReceipt('relations', contexts));
});
