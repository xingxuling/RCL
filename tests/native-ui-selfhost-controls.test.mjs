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
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ui-selfhost-controls-')); });
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const kinds = ['text', 'email', 'password', 'checkbox', 'switch', 'slider', 'select', 'radio', 'date', 'textarea'];
function control(kind, options = {}) {
  const type = options.stateType ?? (['checkbox', 'switch'].includes(kind) ? 'Truth' : kind === 'slider' ? 'Number' : 'Text');
  const initial = options.initial ?? (type === 'Truth' ? 'false' : type === 'Number' ? '20' : JSON.stringify(kind === 'date' ? '2024-02-29' : ['select', 'radio'].includes(kind) ? 'alpha' : 'hello'));
  const properties = options.properties ?? (kind === 'slider' ? 'property min = 0 property max = 100 property step = 5' : ['select', 'radio'].includes(kind) ? 'property options = "alpha|beta"' : '');
  const handler = options.handler ?? `on change(value${options.inferred ? '' : ' : ' + (options.parameterType ?? type)}) { set field <- value }`;
  const kindProperty = `property input_kind = ${JSON.stringify(kind)}`;
  return `reality NativeControl { ui App {
    state field : ${type} = ${initial}
    view Root { input Field {
      ${options.kindLast ? '' : kindProperty}
      ${properties}
      ${options.label === false ? '' : 'accessibility_label "Field"'}
      ${options.binding === false ? '' : 'bind value <- field'}
      ${handler}
      ${options.kindLast ? kindProperty : ''}
    } }
  } }`;
}
function native(source) {
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc');
  fs.writeFileSync(input, source);
  return runNativeCompiler(compiler, input, output, { outputState: 'compiler.output', timeout: 30000 }).bytecode;
}
function reject(source, pattern = /RCL_UI_/) {
  assert.throws(() => compileRealityToBytecode(source), 'independent reference admission must reject');
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-valid-output');
  fs.writeFileSync(input, source); fs.writeFileSync(output, retained);
  assert.throws(() => runNativeCompiler(compiler, input, output, { outputState: 'compiler.output', timeout: 30000 }), error => pattern.test(error.message));
  assert.deepEqual(fs.readFileSync(output), retained);
}

for (const kind of kinds) for (const inferred of [false, true]) {
  test(`self-hosted ${kind} value/parameter types preserve exact bytes (${inferred ? 'inferred' : 'declared'})`, () => {
    const source = control(kind, { inferred, kindLast: inferred });
    assert.deepEqual(native(source), compileRealityToBytecode(source));
  });
}

test('all current typed/form/modal fixtures preserve native/bootstrap bytes', () => {
  for (const name of ['typed-control-showcase', 'validated-signup-form', 'advanced-form-controls', 'scoped-forms', 'modal-workspace', 'component-controls']) {
    const source = fs.readFileSync(new URL('../examples/native-ui/' + name + '.rcl', import.meta.url), 'utf8');
    assert.deepEqual(native(source), compileRealityToBytecode(source), name);
  }
});

test('wrong event/binding/property types and unknown kinds reject without output replacement', () => {
  reject(control('checkbox', { parameterType: 'Number' }));
  reject(control('slider', { parameterType: 'Truth' }));
  reject(control('checkbox', { stateType: 'Text', initial: '""' }));
  reject(control('unsupported'));
  reject(control('text', { properties: 'property disabled = "no"' }));
  reject(control('text', { properties: 'property modal = true' }));
  reject(control('text', { properties: 'property unknown = "value"' }));
});

test('typed controls require bound value, accessibility label and change/input handler', () => {
  reject(control('checkbox', { binding: false }));
  reject(control('checkbox', { label: false }));
  reject(control('checkbox', { handler: 'on focus { set field <- false }' }));
  reject(control('checkbox', { handler: 'on change { set field <- false }' }));
  reject(control('checkbox', { handler: 'on change(other : Truth) { set field <- other }' }));
});

test('slider range, step count and invalid kind-specific properties reject', () => {
  for (const properties of [
    'property min = 10 property max = 0 property step = 1',
    'property min = 0 property max = 10 property step = 0',
    'property min = 0 property max = 10 property step = 3',
    'property min = 0 property max = 100001 property step = 1',
    'property min = 0 property max = 100 property step = 5 property required = true',
    '',
  ]) reject(control('slider', { properties }));
  reject(control('text', { properties: 'property min = 0' }));
  reject(control('checkbox', { properties: 'property options = "a|b"' }));
});

test('option list uniqueness, count, whitespace and initial radio membership reject', () => {
  for (const options of ['alpha', 'alpha|alpha', 'alpha| beta', 'alpha|\u00a0beta', 'alpha|beta\u3000', 'alpha|\ufeffbeta', 'alpha|', Array.from({ length: 65 }, (_, index) => 'option' + index).join('|')]) {
    reject(control('select', { properties: 'property options = ' + JSON.stringify(options) }));
  }
  reject(control('radio', { initial: '"outside"' }));
});

test('date validation matches Gregorian boundaries and preserves valid leap dates', () => {
  for (const value of ['1900-02-29', '2024-02-30', '2024-13-01', '0000-01-01', '2024-2-01', '2024-aa-01', '']) reject(control('date', { initial: JSON.stringify(value) }));
  for (const value of ['2000-02-29', '2024-02-29', '1900-02-28']) {
    const source = control('date', { initial: JSON.stringify(value) }); assert.deepEqual(native(source), compileRealityToBytecode(source));
  }
});

test('form length bounds and expression operand types reject in native admission', () => {
  for (const properties of ['property min_length = 1.5', 'property min_length = 10 property max_length = 2', 'property max_length = 10001']) reject(control('text', { properties }));
  reject(control('checkbox', { properties: 'property min_length = 1' }));
  reject(control('slider', { handler: 'on change(value : Number) { set field <- true + false }' }));
  reject(control('checkbox', { handler: 'on change(value : Truth) { set field <- choose(1, true, false) }' }));
  reject(control('checkbox', { handler: 'on change(value : Truth) { set field <- not 1 }' }));
});
