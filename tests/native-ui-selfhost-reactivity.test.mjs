import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

const compiler = process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT ?? fileURLToPath(new URL('../selfhost/compiler.rbc', import.meta.url));
let directory;
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ui-reactivity-')); });
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const program = (declarations, binding = '"ready"') => `reality Reactive { ui App {
  ${declarations}
  view Root { text Label { bind value <- ${binding} } }
} }`;
function native(source) {
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc');
  fs.writeFileSync(input, source);
  return runNativeCompiler(compiler, input, output, { outputState: 'compiler.output', timeout: 30000 }).bytecode;
}
const rejects = [
  ['state wrong literal type', 'state count : Number = "zero"', /RCL_UI_STATE_TYPE/],
  ['state declared nonscalar type', 'state count : Sequence = 0', /RCL_UI_STATE_TYPE/],
  ['state expression initial', 'state count : Number = 1 + 2', /RCL_UI_LITERAL_REQUIRED/],
  ['state reference initial', 'state a : Number = 1 state b : Number = a', /RCL_UI_LITERAL_REQUIRED/],
  ['negative unary state initial matches reference rejection', 'state count : Number = -1', /RCL_UI_LITERAL_REQUIRED/],
  ['duplicate states', 'state count : Number = 1 state count : Number = 2', /RCL_UI_STATE_DUPLICATE/],
  ['duplicate derived values', 'derived count : Number = 1 derived count : Number = 2', /RCL_UI_DERIVED_DUPLICATE/],
  ['state and derived collision', 'state count : Number = 1 derived count : Number = 2', /RCL_UI_REACTIVE_ID_DUPLICATE/],
  ['derived wrong result type', 'state a : Number = 1 derived b : Text = a + 1', /RCL_UI_DERIVED_TYPE/],
  ['unreferenced derived operand mismatch', 'derived a : Number = true + 1', /RCL_UI_EXPRESSION_TYPE/],
  ['unreferenced unknown derived reference', 'derived a : Number = missing + 1', /RCL_UI_REFERENCE_UNKNOWN/],
  ['unreferenced unsupported derived expression', 'derived a : Number = length("x")', /RCL_UI_EXPRESSION_UNSUPPORTED/],
  ['direct derived cycle', 'derived a : Number = a + 1', /RCL_UI_DERIVED_CYCLE/],
  ['mutual derived cycle', 'derived a : Number = b + 1 derived b : Number = a + 1', /RCL_UI_DERIVED_CYCLE/],
  ['cycle through call and binary branches', 'derived a : Number = choose(true, b, 0) derived b : Number = c * 2 derived c : Number = a', /RCL_UI_DERIVED_CYCLE/],
  ['cycle in an unselected choose branch', 'derived a : Number = choose(true, 0, a)', /RCL_UI_DERIVED_CYCLE/],
];
for (const [label, declarations, code] of rejects) test(`native UI rejects ${label} and retains existing output`, () => {
  const source = program(declarations);
  assert.throws(() => compileRealityToBytecode(source), code, 'reference owner rejects this source');
  const output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-valid-output');
  fs.writeFileSync(output, retained);
  assert.throws(() => native(source), code);
  assert.deepEqual(fs.readFileSync(output), retained);
});

test('forward derived references and shared dependency diamonds preserve exact bytes', () => {
  const source = program(`
    state count : Number = 1 state enabled : Truth = true state name : Text = "RCL"
    derived summary : Text = name + choose(enabled, total, 0)
    derived total : Number = left + right
    derived left : Number = base + 1
    derived right : Number = base + 2
    derived base : Number = count * 2`, 'summary');
  assert.deepEqual(native(source), compileRealityToBytecode(source));
});

test('derived dependency traversal covers unary, binary and choose branches', () => {
  const source = program('state flag : Truth = true derived a : Truth = not b derived b : Truth = flag derived c : Number = choose(a, 1, 2) derived label : Text = "value=" + c', 'label');
  assert.deepEqual(native(source), compileRealityToBytecode(source));
});

test('large shared dependency DAG is admitted without exponential re-traversal', () => {
  const declarations = ['state base : Number = 1', 'derived d0 : Number = base', 'derived d1 : Number = base'];
  for (let index = 2; index < 36; index++) declarations.push(`derived d${index} : Number = d${index - 1} + d${index - 2}`);
  const source = program(declarations.join('\n'), '"value=" + d35');
  assert.deepEqual(native(source), compileRealityToBytecode(source));
});
