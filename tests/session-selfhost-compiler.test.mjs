import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileReality } from '../src/compiler.mjs';
import { compileRealitySessionNative } from '../src/session-compiler.mjs';
import { compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';
import { createRealitySession } from '../src/runtime.mjs';

const counter = fs.readFileSync(new URL('../examples/sessions/governed-counter.rcl', import.meta.url), 'utf8');
const sequence = `reality EventSequence {
  input event.enabled : Truth = true
  input event.text : Text = ""
  facet seen : Sequence = empty_sequence()
  reckon append_event(items : Sequence, label : Text) -> Sequence = sequence_append(items, label)
  subject recorder { warrant event.write on seen while event.enabled }
  emergence append {
    cause recorder when true needs event.write on seen
    alter seen <- append_event(seen, event.text)
    preserve length(seen) <= 3
    witness "events:append"
  }
}`;

test('RCL-authored native session compiler matches bootstrap for conditional warrants, typed inputs and function addresses', async () => {
  for (const source of [counter, sequence]) {
    const compiled = compileRealitySessionNative(source);
    assert.ok(compiled.bytecode.equals(compileRealitySessionBytecode(source)));
    assert.equal(compiled.evidence.compilerOwner, 'RCL');
    assert.equal(compiled.evidence.referenceExecutionFallback, false);
    const native = await createNativeRealitySession(source, { bytecode: compiled.bytecode });
    const reference = createRealitySession(source);
    try {
      const command = source === counter ? { rule: 'increment', inputs: { 'event.delta': 0.1, 'event.label': 'native' } }
        : { rule: 'append', inputs: { 'event.enabled': true, 'event.text': '🌀' } };
      assert.deepEqual(await native.invoke(command), await reference.invoke(command));
      if (source === sequence) {
        const before = native.snapshot().stateRoot;
        await assert.rejects(async () => native.invoke({ rule: 'append', inputs: { 'event.enabled': false } }), error => error.code === 'RCL_AUTHORITY_DENIED');
        assert.equal(native.snapshot().stateRoot, before);
      }
    } finally { await native.close(); }
  }
});

test('input declaration ownership changes the program root and unsupported inputs fail visibly', () => {
  const declared = 'reality InputOwner { input delta : Number = 0 }';
  const ordinary = 'reality InputOwner { facet delta : Number = 0 }';
  assert.notEqual(compileReality(declared).programRoot, compileReality(ordinary).programRoot);
  assert.throws(() => compileRealitySessionBytecode('reality BadInput { input values : Sequence = empty_sequence() }'), error => error.code === 'RCL_SESSION_INPUT_TYPE_UNSUPPORTED');
  assert.throws(() => compileRealitySessionNative('reality BadInput { input values : Sequence = empty_sequence() }'), error => error.code === 'RCL_SESSION_INPUT_TYPE_UNSUPPORTED');
});
