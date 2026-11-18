import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';
import { runReality } from '../src/runtime.mjs';
import { compileRealitySessionNative } from '../src/session-compiler.mjs';
import { compileSourceSelfHosted } from '../src/selfhost-compiler.mjs';

const cases = [
  ['direct', 'facet a : Number = b + 1 facet b : Number = 2', { a: 3, b: 2 }],
  ['through reckon and shadowed parameter',
    'facet a : Number = read(4) + b reckon read(c : Number) -> Number = c facet c : Number = a + 1 facet b : Number = 2',
    { a: 6, b: 2, c: 7 }],
  ['recursive reckon',
    'facet a : Number = steps(2) reckon steps(n : Number) -> Number = choose(n == 0, seed, steps(n - 1) + 1) facet seed : Number = 3',
    { a: 5, seed: 3 }],
  ['dead choose branch', 'facet a : Number = b + 1 facet b : Number = choose(false, a, 2)', { a: 3, b: 2 }],
  ['dead logical operand', 'facet a : Truth = not b facet b : Truth = false and a', { a: true, b: false }],
  ['ordinary reckon names',
    'facet a : Number = constructor() + toString() reckon constructor() -> Number = b reckon toString() -> Number = 2 facet b : Number = 3',
    { a: 5, b: 3 }],
];
for (const [name, body, expected] of cases) {
  test(`native initializer ordering resolves ${name}`, async () => {
    const source = `reality Initializers { ${body} }`;
    const bytes = compileRealityToBytecode(source);
    assert.deepEqual(Buffer.from(compileSourceSelfHosted(source)), bytes);
    assert.deepEqual(runNativeBytecode(bytes).state, expected);
    assert.deepEqual((await runReality(source)).state, expected);
  });
}

test('forward dependencies work in a genuine native session', async () => {
  const source = `reality SessionInitializers {
    facet total : Number = initial + 1
    input initial : Number = 2
    subject actor {}
    emergence step { cause actor when true alter total <- total + initial }
  }`;
  const compiled = compileRealitySessionNative(source);
  assert.equal(compiled.evidence.targetByteParity, true);
  const session = await createNativeRealitySession(source, { bytecode: compiled.bytecode });
  try {
    assert.deepEqual(session.snapshot().state, { initial: 2, total: 3 });
    const stepped = await session.invoke({ rule: 'step', inputs: { initial: 4 } });
    assert.deepEqual(stepped.state, { initial: 4, total: 7 });
  } finally {
    await session.close();
  }
});

test('effectful and potentially cyclic programs retain the previous source order', async () => {
  const effectful = 'reality Unchanged { facet a : Number = b facet c : Text = provider_call("echo", "text", "{}") facet b : Number = 2 }';
  const conditional = 'reality Conditional { facet a : Number = choose(guard, b, 3) facet b : Number = a + 1 facet guard : Truth = false }';
  for (const source of [effectful, conditional]) {
    const bytes = compileRealityToBytecode(source);
    const decoded = decodeBytecode(bytes);
    assert.deepEqual(Buffer.from(compileSourceSelfHosted(source)), bytes);
    assert.deepEqual(decoded.instructions.filter(item => item.name === 'STORE_STATE').map(item => decoded.strings[item.a]),
      source === effectful ? ['a', 'c', 'b'] : ['a', 'b', 'guard']);
  }
  const safe = 'reality Conditional { facet guard : Truth = false facet a : Number = choose(guard, b, 3) facet b : Number = a + 1 }';
  const bytes = compileRealityToBytecode(safe);
  assert.deepEqual(Buffer.from(compileSourceSelfHosted(safe)), bytes);
  assert.deepEqual(runNativeBytecode(bytes).state, (await runReality(safe)).state);
});
