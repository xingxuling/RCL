import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

let directory, compiler;
test.before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ui-tree-locations-'));
  compiler = process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT ?? path.join(directory, 'compiler.rbc');
  const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
  if (!process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT) fs.writeFileSync(compiler, compileRealityToBytecode(read('compiler-core.rcl') + '\n' + read('compiler-main.rcl')));
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const ui = (view, navigation = '') => `reality Locations {
  ui App {
    state open : Truth = false
    ${navigation}
    ${view}
  }
}`;
const cases = [
  ['duplicate IDs', ui('view Root { text Label { value "one" } text Label { value "two" } }'), 'RCL_UI_NODE_ID_DUPLICATE', 'Label', true],
  ['missing text content', ui('view Root { text Label {} }'), 'RCL_UI_TEXT_VALUE_REQUIRED', 'Label'],
  ['columns after supplementary Unicode', ui('view Root { text Icon { value "🦊" } text Label {} }'), 'RCL_UI_TEXT_VALUE_REQUIRED', 'Label'],
  ['missing action label', ui('view Root { action Save { on activate {} } }'), 'RCL_UI_ACTION_LABEL_REQUIRED', 'Save'],
  ['missing action handler', ui('view Root { action Save { label "Save" } }'), 'RCL_UI_ACTION_ACTIVATE_REQUIRED', 'Save'],
  ['invalid modal parent', ui('view Root { view Dialog { property modal = true accessibility_label "Dialog" bind visible <- open } }'), 'RCL_UI_MODAL_PARENT', 'Dialog'],
  ['missing modal label', ui('view Root { layout overlay {} view Dialog { property modal = true bind visible <- open } }'), 'RCL_UI_MODAL_LABEL_REQUIRED', 'Dialog'],
  ['invalid form scope', ui('view Root { action Save { label "Save" property require_valid_form = true property validation_scope = "Missing" on activate {} } }'), 'RCL_UI_FORM_SCOPE_ANCESTOR', '"Missing"'],
  ['duplicate events', ui('view Root { action Save { label "Save" on activate {} on activate {} } }'), 'RCL_UI_EVENT_DUPLICATE', 'activate', true],
  ['missing navigation declaration', ui('view Root { action Save { label "Save" on activate { navigate Missing } } }'), 'RCL_UI_NAVIGATION_REQUIRED', 'Missing'],
  ['unknown reality rule', ui('view Root { action Save { label "Save" on activate { realize missing } } }'), 'RCL_UI_REALITY_RULE_UNKNOWN', 'missing'],
  ['multiple navigation statements', ui('view Root { view PageA {} view PageB {} action Save { label "Save" on activate { navigate First navigate Second } } }', 'navigation { initial First route First -> PageA route Second -> PageB }'), 'RCL_UI_EVENT_MULTIPLE_NAVIGATION', 'Second', true],
  ['unknown initial route', ui('view Root { view PageA {} }', 'navigation { initial Missing route First -> PageA }'), 'RCL_UI_NAVIGATION_INITIAL_UNKNOWN', 'Missing'],
  ['unknown route target', ui('view Root { view PageA {} }', 'navigation { initial First route First -> Absent }'), 'RCL_UI_NAVIGATION_TARGET_UNKNOWN', 'Absent'],
  ['duplicate initial declaration', ui('view Root { view PageA {} }', 'navigation { initial First initial First route First -> PageA }'), 'RCL_UI_NAVIGATION_INITIAL_DUPLICATE', 'initial First', true, 8],
  ['duplicate route IDs', ui('view Root { view PageA {} view PageB {} }', 'navigation { initial First route First -> PageA route First -> PageB }'), 'RCL_UI_NAVIGATION_ROUTE_DUPLICATE', 'First', true],
  ['duplicate route targets', ui('view Root { view PageA {} }', 'navigation { initial First route First -> PageA route Second -> PageA }'), 'RCL_UI_NAVIGATION_TARGET_DUPLICATE', '-> PageA', true, 3],
  ['missing initial declaration', ui('view Root { view PageA {} }', 'navigation { route First -> PageA }'), 'RCL_UI_NAVIGATION_INITIAL_REQUIRED', 'navigation'],
  ['missing route declaration', ui('view Root {}', 'navigation { initial First }'), 'RCL_UI_NAVIGATION_ROUTE_REQUIRED', 'navigation'],
  ['duplicate navigation blocks', ui('view Root { view PageA {} }', 'navigation { initial First route First -> PageA } navigation { initial First route First -> PageA }'), 'RCL_UI_NAVIGATION_DUPLICATE', 'navigation', true],
];
for (const [name, original, code, needle, last, adjustment = 0] of cases) for (const newline of ['\n', '\r\n']) test(`native UI locates ${name} with ${JSON.stringify(newline)}`, () => {
  const source = original.replaceAll('\n', newline);
  const index = (last ? source.lastIndexOf(needle) : source.indexOf(needle)) + adjustment;
  const lines = source.slice(0, index).split('\n'), position = `${lines.length}:${lines.at(-1).length + 1}`;
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'), kept = Buffer.from('retained-ui-output');
  fs.writeFileSync(input, source); fs.writeFileSync(output, kept);
  assert.throws(() => runNativeCompiler(compiler, input, output), error => {
    assert.ok(error.message.includes(code), error.message);
    assert.ok(error.message.endsWith(' at ' + position), error.message);
    return true;
  });
  assert.deepEqual(fs.readFileSync(output), kept);
});
