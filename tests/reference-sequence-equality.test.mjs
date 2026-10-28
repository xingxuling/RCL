import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyNativeParity } from '../src/native-vm.mjs';
import { applyBinary, quantity } from '../src/quantity.mjs';
import { openDurableRealitySession } from '../src/durable-session.mjs';

const item = value => `sequence_append(empty_sequence(), ${value})`;
const pair = (a, b) => `sequence_append(${item(a)}, ${b})`;
const cases = [
  ['empty values', 'empty_sequence()', 'empty_sequence()', true],
  ['independent mixed values', pair('1', '"fox🦊"'), pair('1', '"fox🦊"'), true],
  ['nested values', item(pair('1', 'true')), item(pair('1', 'true')), true],
  ['unequal order', pair('1', '2'), pair('2', '1'), false],
  ['unequal lengths', item('1'), pair('1', '1'), false],
  ['unequal element types', item('1'), item('"1"'), false],
  ['equal source spans', item('make_span(0, 2, 3, 4)'), item('make_span(0, 2, 3, 4)'), true],
  ['equal token values', item('make_token("IDENT", "field", make_span(0, 2, 3, 4))'), item('make_token("IDENT", "field", make_span(0, 2, 3, 4))'), true],
  ['unequal token spans', item('make_token("IDENT", "field", make_span(0, 2, 3, 4))'), item('make_token("IDENT", "field", make_span(0, 2, 4, 4))'), false],
];
for (const [name, left, right, expected] of cases) test(`reference/native sequence equality: ${name}`, async () => {
  const result = await verifyNativeParity(`reality Values {
    facet left : Sequence = ${left}
    facet right : Sequence = ${right}
    facet same : Truth = left == right
    facet different : Truth = left != right
  }`, { nativeRuntime: { stateRootAlgorithm: 'rcl.semantic-state-root.v2' } });
  assert.equal(result.native.state.same, expected);
  assert.equal(result.reference.state.same, expected);
  assert.equal(result.reference.state.different, !expected);
  assert.equal(result.ok, true, JSON.stringify(result.parity));
});

test('sequence equality admits a genuine guarded transaction after state snapshots', async () => {
  const result = await verifyNativeParity(`reality GuardedValues {
    facet values : Sequence = ${pair('1', '2')}
    facet applied : Number = 0
    subject actor { warrant world.write on applied }
    emergence save {
      cause actor
      when values == ${pair('1', '2')}
      needs world.write on applied
      alter applied <- 1
      preserve values == ${pair('1', '2')}
    }
    realize save
  }`, { nativeRuntime: { stateRootAlgorithm: 'rcl.semantic-state-root.v2' } });
  assert.equal(result.reference.state.applied, 1);
  assert.equal(result.native.state.applied, 1);
  assert.equal(result.reference.history.length, 1);
  assert.equal(result.ok, true, JSON.stringify(result.parity));
});

test('nested quantity equality retains the existing dimension and numeric-value policy', () => {
  assert.equal(applyBinary('==', [quantity('Length', 1, 'm')], [quantity('Length', 1, 'custom')]), true);
  assert.equal(applyBinary('==', [quantity('Length', 1)], [quantity('Time', 1)]), false);
  assert.equal(applyBinary('!=', [quantity('Length', 1)], [quantity('Length', 2)]), true);
});

test('durable sequence guards retain reference parity through journal replay and retry', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-equality-session-'));
  const source = `reality DurableValues {
    facet values : Sequence = ${pair('1', '2')}
    facet applied : Number = 0
    subject actor { warrant world.write on applied }
    emergence save {
      cause actor
      when values == ${pair('1', '2')}
      needs world.write on applied
      alter applied <- applied + 1
      preserve values == ${pair('1', '2')}
    }
  }`;
  let session;
  try {
    session = await openDurableRealitySession(directory, { source, verifyReference: true });
    const request = { requestId: 'sequence-equality', expectedRevision: 0, rule: 'save' };
    const first = await session.invoke(request);
    assert.equal(session.snapshot().state.applied, 1);
    const journalRoot = session.snapshot().journalRoot;
    await session.close(); session = null;
    session = await openDurableRealitySession(directory, { verifyReference: true, expectedJournalRoot: journalRoot });
    assert.equal(session.snapshot().state.applied, 1);
    const retry = await session.invoke(request);
    assert.equal(first.replayed, false); assert.equal(retry.replayed, true);
    assert.deepEqual(retry.receipt, first.receipt);
    assert.deepEqual(retry.result, first.result);
    assert.equal(session.snapshot().revision, 1);
  } finally {
    if (session) await session.close();
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('rcl-equality-session-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('unknown domain objects keep identity semantics instead of acquiring generic JSON equality', () => {
  const opaque = { kind: 'UnspecifiedDomain', value: 1 };
  assert.equal(applyBinary('==', opaque, opaque), true);
  assert.equal(applyBinary('==', opaque, { ...opaque }), false);
  assert.equal(applyBinary('==', [opaque], [opaque]), true);
  assert.equal(applyBinary('==', [opaque], [{ ...opaque }]), false);
});

test('deeply nested shared sequence comparisons avoid reference call-stack growth', () => {
  let left = [1], right = [1];
  for (let i = 0; i < 20000; i++) { left = [left]; right = [right]; }
  assert.equal(applyBinary('==', left, right), true);
  assert.equal(applyBinary('!=', [left, 2], [right, 3]), true);
});
