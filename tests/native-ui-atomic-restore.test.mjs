import test from 'node:test';
import assert from 'node:assert/strict';
import { compileNativeUiProgram } from '../src/ui/ui-compiler.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';

const source = `reality Restore { ui App {
  state count : Number = 1 state name : Text = "initial" state enabled : Truth = false state transient : Text = "local"
  lifecycle { create activate resume suspend destroy restore count restore name restore enabled }
  view Root { text Label { bind value <- name + count } }
} }`;
const create = () => createNativeUiRuntime(compileNativeUiProgram(source));

test('invalid later restore field leaves every state value and lifecycle trace untouched', () => {
  const runtime = create(), before = runtime.snapshot();
  assert.throws(() => runtime.lifecycle('create', { count: 7, name: 'candidate', enabled: 'wrong' }), /RCL_UI_RESTORE_TYPE:enabled:Truth/);
  assert.deepEqual(runtime.snapshot(), before); assert.deepEqual(runtime.lifecycleTrace, []);
  const record = runtime.lifecycle('create', { count: 8, name: 'accepted', enabled: true });
  assert.deepEqual(record.state, { count: 8, name: 'accepted', enabled: true, transient: 'local' });
  assert.equal(runtime.lifecycleTrace.length, 1);
});

test('snapshot access failure cannot leave a prefix of restored fields committed', () => {
  const runtime = create(), before = runtime.snapshot();
  const snapshot = { count: 7, get name() { throw new Error('snapshot-read-failed'); } };
  assert.throws(() => runtime.lifecycle('create', snapshot), /snapshot-read-failed/);
  assert.deepEqual(runtime.snapshot(), before); assert.deepEqual(runtime.lifecycleTrace, []);
});

test('nonfinite numbers reject while partial valid snapshots restore only declared fields', () => {
  const runtime = create(), stateIdentity = runtime.state;
  for (const count of [NaN, Infinity, -Infinity]) assert.throws(() => runtime.lifecycle('create', { count }), /RCL_UI_RESTORE_TYPE:count:Number/);
  const snapshot = { name: 'restored', transient: 'external', unrelated: true };
  runtime.lifecycle('create', snapshot); snapshot.name = 'changed-later';
  assert.equal(runtime.state, stateIdentity);
  assert.deepEqual(runtime.snapshot(), { count: 1, name: 'restored', enabled: false, transient: 'local' });
  assert.equal(runtime.lifecycleTrace.length, 1);
});

test('each snapshot value is read once and commits the exact value that passed validation', () => {
  const runtime = create(); let reads = 0;
  runtime.lifecycle('create', { get count() { return ++reads === 1 ? 7 : 'different-second-read'; } });
  assert.equal(reads, 1); assert.equal(runtime.snapshot().count, 7);
});
