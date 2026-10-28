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
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ui-tree-')); });
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const program = (view, extra = '') => `reality Tree { ui App { state open : Truth = false ${extra} ${view} } }`;
const action = (properties = '') => `action Save { label "Save" ${properties} on activate {} }`;
const scoped = scope => action(`property require_valid_form = true property validation_scope = ${JSON.stringify(scope)}`);
const modal = (id = 'Dialog', extra = '') => `view ${id} { property modal = true accessibility_label "Dialog" bind visible <- open ${extra} }`;
function native(source) {
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'); fs.writeFileSync(input, source);
  return runNativeCompiler(compiler, input, output, { outputState: 'compiler.output', timeout: 30000 }).bytecode;
}
const cases = [
  ['duplicate sibling IDs', program('view Root { text Label { value "a" } text Label { value "b" } }'), /RCL_UI_NODE_ID_DUPLICATE/],
  ['duplicate ancestor ID', program('view Root { view Root {} }'), /RCL_UI_NODE_ID_DUPLICATE/],
  ['duplicate IDs across branches', program('view Root { view Left { text Shared { value "a" } } view Right { text Shared { value "b" } } }'), /RCL_UI_NODE_ID_DUPLICATE/],
  ['text without content', program('view Root { text Label {} }'), /RCL_UI_TEXT_VALUE_REQUIRED/],
  ['action without label', program('view Root { action Save { on activate {} } }'), /RCL_UI_ACTION_LABEL_REQUIRED/],
  ['action without activate handler', program('view Root { action Save { label "Save" on custom {} } }'), /RCL_UI_ACTION_ACTIVATE_REQUIRED/],
  ['duplicate event handlers', program('view Root { action Save { label "Save" on activate {} on activate {} } }'), /RCL_UI_EVENT_DUPLICATE/],
  ['multiple navigation statements', program('view Root { view PageA {} view PageB {} action Save { label "Save" on activate { navigate First navigate Second } } }', 'navigation { initial First route First -> PageA route Second -> PageB }'), /RCL_UI_EVENT_MULTIPLE_NAVIGATION/],
  ['scope outside ancestors', program(`view Root { view Form {} ${scoped('Form')} }`), /RCL_UI_FORM_SCOPE_ANCESTOR/],
  ['unknown form scope', program(`view Root { ${scoped('Missing')} }`), /RCL_UI_FORM_SCOPE_ANCESTOR/],
  ['scope points to a leaf', program(`view Root { text Label { value "x" } ${scoped('Label')} }`), /RCL_UI_FORM_SCOPE_ANCESTOR/],
  ['scope points to itself', program(`view Root { ${scoped('Save')} }`), /RCL_UI_FORM_SCOPE_ANCESTOR/],
  ['empty form scope', program(`view Root { ${scoped('')} }`), /RCL_UI_FORM_SCOPE_TARGET/],
  ['scope without form guard', program(`view Root { view Form { ${action('property validation_scope = "Form"')} } }`), /RCL_UI_FORM_SCOPE_GUARD_REQUIRED/],
  ['scope with false form guard', program(`view Root { view Form { ${action('property require_valid_form = false property validation_scope = "Form"')} } }`), /RCL_UI_FORM_SCOPE_GUARD_REQUIRED/],
  ['modal outside overlay root', program(`view Root { ${modal()} }`), /RCL_UI_MODAL_PARENT/],
  ['modal nested below a child', program(`view Root { layout overlay {} view Wrapper { ${modal()} } }`), /RCL_UI_MODAL_PARENT/],
  ['modal at root', program('view Root { layout overlay {} property modal = true accessibility_label "Dialog" bind visible <- open }'), /RCL_UI_MODAL_PARENT/],
  ['modal without accessible label', program('view Root { layout overlay {} view Dialog { property modal = true bind visible <- open } }'), /RCL_UI_MODAL_LABEL_REQUIRED/],
  ['modal with empty accessible label', program('view Root { layout overlay {} view Dialog { property modal = true accessibility_label "" bind visible <- open } }'), /RCL_UI_MODAL_LABEL_REQUIRED/],
  ['modal without visible binding', program('view Root { layout overlay {} view Dialog { property modal = true accessibility_label "Dialog" } }'), /RCL_UI_MODAL_VISIBLE_BIND_REQUIRED/],
  ['false modal declaration', program('view Root { layout overlay {} view Dialog { property modal = false accessibility_label "Dialog" bind visible <- open } }'), /RCL_UI_MODAL_ROLE/],
  ['multiple modal declarations', program(`view Root { layout overlay {} ${modal('First')} ${modal('Second')} }`), /RCL_UI_MODAL_LIMIT/],
];
for (const [name, source, code] of cases) test(`native UI tree rejects ${name} and retains output`, () => {
  assert.throws(() => compileRealityToBytecode(source), code, 'reference owner rejects');
  const output = path.join(directory, 'output.rbc'), retained = Buffer.from('keep-valid-output'); fs.writeFileSync(output, retained);
  assert.throws(() => native(source), code); assert.deepEqual(fs.readFileSync(output), retained);
});

test('nested scoped actions and a single labelled modal preserve exact reference bytes', () => {
  for (const source of [program(`view Root { view Form { view Inner { ${scoped('Form')} } } }`), program(`view Root { layout overlay {} view Main { text Empty { value "" } } ${modal()} }`)]) {
    assert.deepEqual(native(source), compileRealityToBytecode(source));
  }
});

test('current scoped-form/modal/navigation fixture bytes remain identical', () => {
  for (const name of ['scoped-forms', 'modal-workspace', 'navigation']) {
    const source = fs.readFileSync(new URL('../examples/native-ui/' + name + '.rcl', import.meta.url), 'utf8');
    assert.deepEqual(native(source), compileRealityToBytecode(source), name);
  }
});
