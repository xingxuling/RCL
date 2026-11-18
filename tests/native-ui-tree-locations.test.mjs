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
  ['string cannot close parenthesized expression', 'reality Locations { ui App { state open : Truth = (false ")" view Root {} } }', 'RCL_EXPRESSION_CLOSE', '")"'],
  ['string cannot close function call', 'reality Locations { ui App { state open : Truth = false derived flag : Truth = choose(true, false, true ")" view Root {} } }', 'RCL_CALL_CLOSE', '")"'],
  ['string cannot act as binary operator', 'reality Locations { ui App { state text : Text = ("a" "+" "b") view Root {} } }', 'RCL_EXPRESSION_CLOSE', '"+"'],
  ['missing closing parenthesis', 'reality Locations { ui App { state open : Truth = (false wrong view Root {} } }', 'RCL_EXPRESSION_CLOSE', 'wrong'],
  ['missing call closing parenthesis', 'reality Locations { ui App { state open : Truth = false derived flag : Truth = choose(true, false, true wrong view Root {} } }', 'RCL_CALL_CLOSE', 'wrong'],
  ['duplicate UI program', 'reality Locations { ui App { view One {} } ui App { view Two {} } }', 'RCL_UI_PROGRAM_DUPLICATE', 'App', true],
  ['duplicate lifecycle block', ui('view Root {}', 'lifecycle {} lifecycle {}'), 'RCL_UI_LIFECYCLE_DUPLICATE', 'lifecycle', true],
  ['invalid lifecycle stage', ui('view Root {}', 'lifecycle { activate teleport }'), 'RCL_UI_LIFECYCLE_STAGE', 'teleport'],
  ['unknown lifecycle restore after repeated valid state', ui('view Root {}', 'lifecycle { restore open restore open restore missing } adaptation { default compact profile compact min_width 0 }'), 'RCL_UI_LIFECYCLE_RESTORE_UNKNOWN', 'missing'],
  ['unknown lifecycle restore with navigation', ui('view Root { view Page {} }', 'lifecycle { restore missing } navigation { initial Home route Home -> Page }'), 'RCL_UI_LIFECYCLE_RESTORE_UNKNOWN', 'missing'],
  ['unknown lifecycle restore', ui('view Root {}', 'lifecycle { restore missing }'), 'RCL_UI_LIFECYCLE_RESTORE_UNKNOWN', 'missing'],
  ['missing root view', ui(''), 'RCL_UI_VIEW_TREE_COUNT', 'App'],
  ['multiple root views', ui('view First {} view Second {}'), 'RCL_UI_VIEW_TREE_COUNT', 'App'],
  ['unknown style node target', ui('view Root {}', 'style Highlight { target node Missing }'), 'RCL_UI_STYLE_NODE_UNKNOWN', 'Highlight'],
  ['unknown style class target', ui('view Root {}', 'style Highlight { target class missing }'), 'RCL_UI_STYLE_CLASS_UNKNOWN', 'Highlight'],
  ['unknown style selector kind', ui('view Root {}', 'style Highlight { target invalid Root }'), 'RCL_UI_STYLE_SELECTOR', 'Highlight'],
  ['unknown style role', ui('view Root {}', 'style Highlight { target role invalid }'), 'RCL_UI_STYLE_ROLE', 'Highlight'],
  ['unknown theme property', ui('view Root {}', 'theme Colors { property bogus = "red" }'), 'RCL_UI_STYLE_PROPERTY', '"red"'],
  ['wrong style property type', ui('view Root {}', 'style Highlight { target node Root property font_size = "large" }'), 'RCL_UI_STYLE_PROPERTY_TYPE', '"large"'],
  ['nonliteral style property', ui('view Root {}', 'style Highlight { target node Root property foreground = open }'), 'RCL_UI_STYLE_PROPERTY_TYPE', 'open', true],
  ['style without selector', ui('view Root {}', 'style Highlight { property foreground = "red" }'), 'RCL_UI_STYLE_SELECTOR', 'Highlight'],
  ['duplicate IDs', ui('view Root { text Label { value "one" } text Label { value "two" } }'), 'RCL_UI_NODE_ID_DUPLICATE', 'Label', true],
  ['adaptive layout with final overlay', ui('view Root { adapt compact layout horizontal layout overlay {} }', 'adaptation { default compact profile compact min_width 0 }'), 'RCL_UI_DEVICE_ADAPTATION_LAYOUT_MODE', 'Root'],
  ['duplicate node layout', ui('view Root { layout vertical {} layout horizontal {} }'), 'RCL_UI_LAYOUT_DUPLICATE', 'layout', true],
  ['missing text content', ui('view Root { text Label {} }'), 'RCL_UI_TEXT_VALUE_REQUIRED', 'Label'],
  ['columns after supplementary Unicode', ui('view Root { text Icon { value "🦊" } text Label {} }'), 'RCL_UI_TEXT_VALUE_REQUIRED', 'Label'],
  ['missing action label', ui('view Root { action Save { on activate {} } }'), 'RCL_UI_ACTION_LABEL_REQUIRED', 'Save'],
  ['missing action handler', ui('view Root { action Save { label "Save" } }'), 'RCL_UI_ACTION_ACTIVATE_REQUIRED', 'Save'],
  ['invalid modal parent', ui('view Root { view Dialog { property modal = true accessibility_label "Dialog" bind visible <- open } }'), 'RCL_UI_MODAL_PARENT', 'Dialog'],
  ['missing modal label', ui('view Root { layout overlay {} view Dialog { property modal = true bind visible <- open } }'), 'RCL_UI_MODAL_LABEL_REQUIRED', 'Dialog'],
  ['invalid form scope', ui('view Root { action Save { label "Save" property require_valid_form = true property validation_scope = "Missing" on activate {} } }'), 'RCL_UI_FORM_SCOPE_ANCESTOR', '"Missing"'],
  ['duplicate events', ui('view Root { action Save { label "Save" on activate {} on activate {} } }'), 'RCL_UI_EVENT_DUPLICATE', 'activate', true],
  ['unknown event type', ui('view Root { action Save { label "Save" on imaginary {} } }'), 'RCL_UI_EVENT_TYPE', 'imaginary'],
  ['duplicate event parameter', ui('view Root { action Save { label "Save" on custom(value : Number, value : Text) {} } }'), 'RCL_UI_EVENT_PARAMETER_DUPLICATE', 'value', true],
  ['invalid event parameter type', ui('view Root { action Save { label "Save" on custom(value : Unsupported) {} } }'), 'RCL_UI_EVENT_PARAMETER_TYPE', 'value'],
  ['duplicate adaptation default', ui('view Root {}', 'adaptation { default compact default expanded profile compact min_width 0 }'), 'RCL_UI_DEVICE_ADAPTATION_DEFAULT_DUPLICATE', 'expanded'],
  ['duplicate adaptation minimum', ui('view Root {}', 'adaptation { default compact profile compact min_width 0 min_width 1 }'), 'RCL_UI_DEVICE_ADAPTATION_MIN_WIDTH_DUPLICATE', 'min_width', true],
  ['duplicate adaptation maximum', ui('view Root {}', 'adaptation { default compact profile compact max_width 10 max_width 20 }'), 'RCL_UI_DEVICE_ADAPTATION_MAX_WIDTH_DUPLICATE', 'max_width', true],
  ['duplicate adaptation profile', ui('view Root {}', 'adaptation { default compact profile compact max_width 5 profile compact min_width 6 }'), 'RCL_UI_DEVICE_ADAPTATION_PROFILE_DUPLICATE', 'compact', true],
  ['fractional adaptation minimum', ui('view Root {}', 'adaptation { default compact profile compact min_width 1.5 }'), 'RCL_UI_DEVICE_ADAPTATION_WIDTH', 'compact', true],
  ['fractional adaptation maximum', ui('view Root {}', 'adaptation { default compact profile compact max_width 9.5 }'), 'RCL_UI_DEVICE_ADAPTATION_WIDTH', 'compact', true],
  ['large overlapping adaptation profile', ui('view Root {}', 'adaptation { default wide profile wide min_width 2000000000 profile larger min_width 2500000000 max_width 3000000000 }'), 'RCL_UI_DEVICE_ADAPTATION_PROFILE_OVERLAP', 'larger'],
  ['invalid adaptation width', ui('view Root {}', 'adaptation { default compact profile compact min_width 10 max_width 5 }'), 'RCL_UI_DEVICE_ADAPTATION_WIDTH', 'compact', true],
  ['overlapping adaptation profile', ui('view Root {}', 'adaptation { default compact profile compact max_width 10 profile wide min_width 5 }'), 'RCL_UI_DEVICE_ADAPTATION_PROFILE_OVERLAP', 'wide'],
  ['missing adaptation default', ui('view Root {}', 'adaptation { profile compact min_width 0 }'), 'RCL_UI_DEVICE_ADAPTATION_DEFAULT_REQUIRED', 'adaptation'],
  ['missing adaptation profile', ui('view Root {}', 'adaptation { default compact }'), 'RCL_UI_DEVICE_ADAPTATION_PROFILE_REQUIRED', 'adaptation'],
  ['unknown adaptation default', ui('view Root {}', 'adaptation { default missing profile compact min_width 0 }'), 'RCL_UI_DEVICE_ADAPTATION_DEFAULT_UNKNOWN', 'missing'],
  ['duplicate adaptation block', ui('view Root {}', 'adaptation { default compact profile compact min_width 0 } adaptation { default wide profile wide min_width 0 }'), 'RCL_UI_DEVICE_ADAPTATION_DUPLICATE', 'adaptation', true],
  ['duplicate adaptive layout', ui('view Root { layout vertical {} adapt compact layout horizontal adapt compact layout vertical }'), 'RCL_UI_DEVICE_ADAPTATION_LAYOUT_DUPLICATE', 'compact', true],
  ['invalid layout mode', ui('view Root { layout diagonal {} }'), 'RCL_UI_LAYOUT_MODE', 'diagonal'],
  ['invalid layout alignment', ui('view Root { layout vertical { align nowhere } }'), 'RCL_UI_LAYOUT_ALIGNMENT', 'nowhere'],
  ['invalid layout distribution', ui('view Root { layout vertical { distribute nowhere } }'), 'RCL_UI_LAYOUT_DISTRIBUTION', 'nowhere'],
  ['invalid layout overflow', ui('view Root { layout vertical { overflow nowhere } }'), 'RCL_UI_LAYOUT_OVERFLOW', 'nowhere'],
  ['zero layout columns', ui('view Root { layout grid { columns 0 } }'), 'RCL_UI_LAYOUT_COLUMNS', '0'],
  ['fractional layout columns', ui('view Root { layout grid { columns 1.5 } }'), 'RCL_UI_LAYOUT_COLUMNS', '1.5'],
  ['invalid layout width mode', ui('view Root { layout vertical { width automatic } }'), 'RCL_UI_LAYOUT_SIZE_MODE', 'automatic'],
  ['invalid layout height mode', ui('view Root { layout vertical { height stretch } }'), 'RCL_UI_LAYOUT_SIZE_MODE', 'stretch'],
  ['invalid adaptive layout mode', ui('view Root { layout vertical {} adapt compact layout diagonal }'), 'RCL_UI_DEVICE_ADAPTATION_LAYOUT_MODE', 'diagonal'],
  ['adaptive layout missing configuration', ui('view Root { layout vertical {} adapt missing layout horizontal }'), 'RCL_UI_DEVICE_ADAPTATION_REQUIRED', 'missing'],
  ['adaptive layout unknown profile', ui('view Root { layout vertical {} adapt missing layout horizontal }', 'adaptation { default compact profile compact min_width 0 }'), 'RCL_UI_DEVICE_ADAPTATION_PROFILE_UNKNOWN', 'missing'],
  ['form length bound', ui('view Root { input Name { property input_kind = "text" property min_length = 10001 } }'), 'RCL_UI_FORM_LENGTH_BOUND', '10001'],
  ['form length order', ui('view Root { input Name { property input_kind = "text" property min_length = 10 property max_length = 2 } }'), 'RCL_UI_FORM_LENGTH_ORDER', 'max_length = 2', false, 13],
  ['form length unsupported control', ui('view Root { input Toggle { property input_kind = "checkbox" property min_length = 2 } }'), 'RCL_UI_FORM_LENGTH_KIND', 'min_length = 2', false, 13],
  ['slider required property', ui('view Root { input Slider { property input_kind = "slider" property required = true } }'), 'RCL_UI_FORM_REQUIRED_KIND', 'true'],
  ['slider property on text', ui('view Root { input Name { property input_kind = "text" property min = 0 } }'), 'RCL_UI_CONTROL_PROPERTY_KIND', 'min = 0', false, 6],
  ['options property on text', ui('view Root { input Name { property input_kind = "text" property options = "basic|pro" } }'), 'RCL_UI_CONTROL_PROPERTY_KIND', '"basic|pro"'],
  ['control missing value binding', ui('view Root { input Toggle { property input_kind = "checkbox" } }'), 'RCL_UI_CONTROL_BIND_VALUE_REQUIRED', 'Toggle'],
  ['typed control event without value parameter', ui('view Root { input Toggle { property input_kind = "checkbox" accessibility_label "Toggle" bind value <- open on change { set open <- false } } }'), 'RCL_UI_CONTROL_EVENT_VALUE_TYPE', 'change'],
  ['control missing label or event', ui('view Root { input Toggle { property input_kind = "checkbox" bind value <- open on change(value : Truth) { set open <- value } } }'), 'RCL_UI_CONTROL_CHANGE_OR_LABEL_REQUIRED', 'Toggle'],
  ['invalid select options', `reality ChoiceLocation { ui App { state choice : Text = "basic" view Root { input Choice { property input_kind = "select" property options = "basic||pro" accessibility_label "Choice" bind value <- choice on change(value : Text) { set choice <- value } } } } }`, 'RCL_UI_SELECT_OPTIONS', '"basic||pro"'],
  ['invalid date value', `reality DateLocation { ui App { state date : Text = "2026-01-01" view Root { input Date { property input_kind = "date" property value = "2026-02-30" accessibility_label "Date" bind value <- date on change(value : Text) { set date <- value } } } } }`, 'RCL_UI_DATE_VALUE', '"2026-02-30"'],
  ['invalid slider range', `reality SliderLocation { ui App { state volume : Number = 0 view Root { input Volume { property input_kind = "slider" property min = 10 property max = 5 property step = 1 accessibility_label "Volume" bind value <- volume on input(value : Number) { set volume <- value } } } } }`, 'RCL_UI_SLIDER_RANGE', 'Volume'],
  ['invalid slider step', `reality SliderLocation { ui App { state volume : Number = 0 view Root { input Volume { property input_kind = "slider" property min = 0 property max = 10 property step = 3 accessibility_label "Volume" bind value <- volume on input(value : Number) { set volume <- value } } } } }`, 'RCL_UI_SLIDER_STEP', 'step = 3', false, 7],
  ['missing navigation declaration', ui('view Root { action Save { label "Save" on activate { navigate Missing } } }'), 'RCL_UI_NAVIGATION_REQUIRED', 'Missing'],
  ['mixed event authority set then realize', ui('view Root { action Save { label "Save" on activate { set open <- true realize publish } } }'), 'RCL_UI_EVENT_MIXED_AUTHORITY', 'activate'],
  ['mixed event authority realize then navigate', ui('view Root { action Save { label "Save" on custom(value : Text) { realize publish navigate First } } }'), 'RCL_UI_EVENT_MIXED_AUTHORITY', 'custom'],
  ['unknown reality rule', ui('view Root { action Save { label "Save" on activate { realize missing } } }'), 'RCL_UI_REALITY_RULE_UNKNOWN', 'missing'],
  ['unknown event state target', ui('view Root { action Save { label "Save" on activate { set missing <- true } } }'), 'RCL_UI_EVENT_TARGET_UNKNOWN', 'missing'],
  ['unknown binding reference', ui('view Root { text Label { bind value <- missing } }'), 'RCL_UI_REFERENCE_UNKNOWN', 'missing'],
  ['unknown nested event reference', ui('view Root { action Save { label "Save" on activate { set open <- true and missing } } }'), 'RCL_UI_REFERENCE_UNKNOWN', 'missing'],
  ['invalid event mutation type', ui('view Root { action Save { label "Save" on activate { set open <- 12 } } }'), 'RCL_UI_EVENT_MUTATION_TYPE', '12'],
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


test('layout validation agrees with the reference compiler and preserves valid bytecode', () => {
  for (const [name, source] of cases.filter(([name]) => /^(invalid layout (mode|alignment|distribution|overflow)|zero layout columns|fractional layout columns)$/.test(name))) {
    assert.throws(() => compileRealityToBytecode(source), name);
  }
  const layouts = [
    ...['vertical', 'horizontal', 'overlay', 'grid'].map(mode => `${mode} {}`),
    ...['start', 'center', 'end', 'stretch'].map(value => `vertical { align ${value} }`),
    ...['start', 'center', 'end', 'space_between', 'space_around', 'space_evenly'].map(value => `vertical { distribute ${value} }`),
    ...['clip', 'scroll', 'visible'].map(value => `vertical { overflow ${value} }`),
    'grid { columns 1 }', 'grid { columns 4 }',
    'vertical { align nowhere align start }', 'vertical { distribute nowhere distribute end }',
    'vertical { overflow nowhere overflow clip }', 'grid { columns 0 columns 2 }',
  ];
  const input = path.join(directory, 'valid-layout.rcl'), output = path.join(directory, 'valid-layout.rbc');
  for (const layout of layouts) {
    const source = ui(`view Root { layout ${layout} }`);
    fs.writeFileSync(input, source);
    runNativeCompiler(compiler, input, output);
    assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source), layout);
  }
});


test('style and theme admission agrees with reference for covered declarations', () => {
  const invalid = /^(unknown style selector kind|unknown style role|unknown theme property|wrong style property type|nonliteral style property)$/;
  for (const [name, source] of cases.filter(([name]) => invalid.test(name))) assert.throws(() => compileRealityToBytecode(source), name);
  const declarations = [
    'theme Colors { property foreground = "red" property background = "white" property font_family = "sans" property font_size = 12 property text_align = "center" property corner_radius = 2 property language = "en" }',
    ...['container', 'text', 'action', 'input'].map(role => `style Highlight { target role ${role} property foreground = "red" }`),
    'style Highlight { target class active property foreground = "red" }',
    'style Highlight { target node Root property foreground = "red" }',
    'style Highlight { target invalid Root target node Root property foreground = "red" }',
  ];
  const input = path.join(directory, 'valid-style.rcl'), output = path.join(directory, 'valid-style.rbc');
  for (const declaration of declarations) {
    const source = ui('view Root { class active }', declaration);
    fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
    assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source), declaration);
  }
});


test('style targets resolve throughout the view tree and reject missing references', () => {
  for (const [name, source] of cases.filter(([name]) => /^unknown style (node|class) target$/.test(name))) assert.throws(() => compileRealityToBytecode(source), name);
  const source = ui('view Root { class shared view Group { text Label { class shared class inner value "ok" } } }',
    'style RootStyle { target node Root } style ChildStyle { target node Label } style ClassStyle { target class inner } style SharedStyle { target class shared }');
  const input = path.join(directory, 'nested-style.rcl'), output = path.join(directory, 'nested-style.rbc');
  fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
  assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source));
});


test('nested UI styles preserve inherited values and provenance in native bytecode', () => {
  const inputs = [
    ui('view Root { class shared view Group { text Label { class shared class inner value "ok" } } }', 'style RootStyle { target node Root property foreground = "red" } style ChildStyle { target node Label property background = "white" } style ClassStyle { target class inner property font_size = 12 } style SharedStyle { target class shared property language = "en" }'),
    ui('view Root { property background = "red" view Group { text Label { value "ok" } } }', 'style Custom { target node Root property background = "blue" inherit }'),
    ui('view Root { property foreground = "red" view Group { property foreground = "blue" text Label { value "ok" } } }', ''),
    ui('view Root { view Group { text Label { value "ok" } } }', 'theme Colors { property foreground = "red" }'),
  ];
  const input = path.join(directory, 'inherited-style.rcl'), output = path.join(directory, 'inherited-style.rbc');
  for (const source of inputs) {
    fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
    assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source));
  }
});


test('style precedence compares priority before specificity and declaration order', () => {
  const sources = [
    ui('view Root {}', 'style NodeRule { target node Root priority 0 property background = "red" } style RoleRule { target role container priority 0.5 property background = "blue" }'),
    ui('view Root {}', 'style One { target node Root property background = "red" property background = "blue" }'),
    ui('view Root {}', 'theme One { property foreground = "red" property foreground = "blue" }'),
    ui('view Root {}', 'style One { target node Root property background = "red" } style Two { target node Root property background = "blue" }'),
  ];
  const input = path.join(directory, 'style-priority.rcl'), output = path.join(directory, 'style-priority.rbc');
  for (const source of sources) { fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source)); }
});


test('lifecycle duplicate stages and restore names normalize in native bytecode', () => {
  const source = ui('view Root {}', 'lifecycle { create create activate restore open restore open }');
  const input = path.join(directory, 'lifecycle-normalize.rcl'), output = path.join(directory, 'lifecycle-normalize.rbc');
  fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
  assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source));
});


test('lifecycle admission and normalization agree with the reference compiler', () => {
  for (const [name, source] of cases.filter(([name]) => /^(invalid lifecycle stage|unknown lifecycle restore|duplicate lifecycle block)$/.test(name))) assert.throws(() => compileRealityToBytecode(source), name);
  const sources = [
    ui('view Root {}', 'lifecycle {}'),
    ui('view Root {}', 'lifecycle { destroy resume suspend activate create restore open }'),
    'reality Lifecycle { ui App { lifecycle { restore later } state later : Truth = false view Root {} } }',
    ui('view Root {}', 'lifecycle { restore open restore open }'),
  ];
  const input = path.join(directory, 'valid-lifecycle.rcl'), output = path.join(directory, 'valid-lifecycle.rbc');
  for (const source of sources) { fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source)); }
});


test('native UI supports canonical role overrides and preserves adaptive layouts before base layout', () => {
  const sources = [
    ui('view Root { text Label { role container } }'),
    ui('view Root { view Label { role text value "hello" } }'),
    ui('view Root { adapt compact layout horizontal layout vertical {} }', 'adaptation { default compact profile compact min_width 0 }'),
    ui('view Root { text Pane { adapt compact layout horizontal role container } }', 'adaptation { default compact profile compact min_width 0 }'),
  ];
  const input = path.join(directory, 'ui-view-order.rcl'), output = path.join(directory, 'ui-view-order.rbc');
  for (const source of sources) { fs.writeFileSync(input, source); const expected = compileRealityToBytecode(source); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), expected); }
  for (const name of ['duplicate node layout', 'adaptive layout with final overlay']) { const invalid = cases.find(([caseName]) => caseName === name)[1]; assert.throws(() => compileRealityToBytecode(invalid)); }
});


test('adaptive width bounds and large intervals agree with reference admission', () => {
  for (const [name, source] of cases.filter(([name]) => /^(fractional adaptation (minimum|maximum)|large overlapping adaptation profile)$/.test(name))) assert.throws(() => compileRealityToBytecode(source), name);
  const profiles = [
    'default small profile small max_width 1000000000 profile large min_width 1000000001',
    'default large profile large min_width 2500000000 profile small max_width 2499999999',
    'default only profile only min_width 3000000000',
    'default small profile small max_width 0 profile large min_width 1',
  ];
  const input = path.join(directory, 'adaptation-boundary.rcl'), output = path.join(directory, 'adaptation-boundary.rbc');
  for (const declaration of profiles) { const source = ui('view Root {}', `adaptation { ${declaration} }`); fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source), declaration); }
});


test('distinct UI programs compile and duplicate names are rejected by both compilers', () => {
  const source = 'reality Multiple { ui First { view A {} } ui Second { view B {} } }';
  const input = path.join(directory, 'ui-programs.rcl'), output = path.join(directory, 'ui-programs.rbc');
  fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source));
  assert.throws(() => compileRealityToBytecode(cases.find(([name]) => name === 'duplicate UI program')[1]));
});


test('parenthesized expressions and call delimiters agree with the reference compiler', () => {
  for (const [name, source] of cases.filter(([name]) => /^(missing (call )?closing parenthesis|string cannot close (parenthesized expression|function call)|string cannot act as binary operator)$/.test(name))) assert.throws(() => compileRealityToBytecode(source), name);
  const sources = [
    'reality Parentheses { facet value : Number = (1 + (2 * 3)) }',
    'reality Calls { facet value : Number = choose(true, (1 + 2), 3) }',
    ui('view Root { text Label { bind value <- choose(open, "yes", "no") } }'),
    ui('view Root { text Label { bind value <- choose(open, ")", ",") } }'),
    ui('view Root { text Label { bind value <- choose(open, "not", "-") } }'),
    ui('view Root { text Label { bind value <- choose(open, "match", "+") } }'),
  ];
  const input = path.join(directory, 'expressions.rcl'), output = path.join(directory, 'expressions.rbc');
  for (const source of sources) { fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source)); }
});


test('strings cannot impersonate grammar tokens', () => {
  const invalid = [
    'reality P "{" facet value : Number = 1 }',
    'reality P { "ui" App { view Root {} } }',
    'reality P { ui App { "state" open : Truth = false view Root {} } }',
    'reality P { ui App { style S { "target" node Root } view Root {} } }',
    'reality P { ui App { style S { target "node" Root } view Root {} } }',
    'reality P { ui App { style S { target node "Root" } view Root {} } }',
    'reality P { ui App { style S { target node Root priority "1" } view Root {} } }',
    'reality P { ui App { view Root { layout vertical { align "start" } } } }',
    'reality P { ui App { view Root { layout vertical { gap "1" } } } }',
    'reality P { ui App { view Root { layout grid { columns "2" } } } }',
    'reality P { ui App { lifecycle { "restore" open } state open : Truth = false view Root {} } }',
    'reality P { ui App { view Root { layout vertical { "align" start } } } }',
    'reality P { ui App { state open : Truth = false view Root { action Save { label "Save" on activate { "set" open <- true } } } } }',
    'reality P { ui App { adaptation { default compact "profile" compact min_width 0 } view Root {} } }',
    'reality P { ui App { view Root { "class" active } } }',
    'reality P { ui App { view Root { class "active" } } }',
    'reality P { ui App { view Root { property "background" = "red" } } }',
    'reality P { ui App { view Root { property background wrong "red" } } }',
    'reality P { ui App { view Root { text Label { bind "value" <- "hello" } } } }',
    'reality P { facet value : Number = 1 "}"',
    'reality P { ui App { view Root { "}" } } }',
    'reality P { ui App { state open : Truth = false view Root { text Label { bind value "<-" "hello" } } } }',
  ];
  const input = path.join(directory, 'token-spoof.rcl'), output = path.join(directory, 'token-spoof.rbc'), retained = Buffer.from('retained');
  for (const source of invalid) {
    assert.throws(() => compileRealityToBytecode(source));
    fs.writeFileSync(input, source); fs.writeFileSync(output, retained);
    assert.throws(() => runNativeCompiler(compiler, input, output)); assert.deepEqual(fs.readFileSync(output), retained);
  }
});


test('subject and rule clauses require actual recognized keywords', () => {
  const original = fs.readFileSync(new URL('../examples/selfhost-core/emergence-multi.rcl', import.meta.url), 'utf8');
  const invalid = [original.replace('warrant world.audit', 'mystery world.audit'), original.replace('warrant world.audit', '"warrant" world.audit'), original.replace('warrant world.audit on world', 'warrant world.audit on world "while" true'), original.replace('cause founder', '"cause" founder'), original.replace('cause founder', 'cause "founder"'), original.replace('subject founder {', 'subject "founder" {'), original.replace('subject founder {', 'subject founder "{"'), original.replace('emergence promote {', 'emergence "promote" {'), original.replace('emergence promote {', 'emergence promote "{"')];
  const input = path.join(directory, 'rule-clause.rcl'), output = path.join(directory, 'rule-clause.rbc'), retained = Buffer.from('retained');
  for (const source of invalid) { assert.throws(() => compileRealityToBytecode(source)); fs.writeFileSync(input, source); fs.writeFileSync(output, retained); assert.throws(() => runNativeCompiler(compiler, input, output)); assert.deepEqual(fs.readFileSync(output), retained); }
  fs.writeFileSync(input, original); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(original));
});


test('facet and reckon declarations require their syntactic delimiters', () => {
  const invalid = [
    'reality P { facet value wrong Number = 1 }',
    'reality P { facet value : Number wrong 1 }',
    'reality P { reckon "f"(x : Number) -> Number = x }',
    'reality P { reckon f wrong x : Number) -> Number = x }',
    'reality P { reckon f(x wrong Number) -> Number = x }',
    'reality P { reckon f(x : Number wrong -> Number = x }',
    'reality P { reckon f(x : Number) wrong Number = x }',
    'reality P { reckon f(x : Number) -> Number wrong x }',
  ];
  const input = path.join(directory, 'declaration-token.rcl'), output = path.join(directory, 'declaration-token.rbc'), retained = Buffer.from('retained');
  for (const source of invalid) { assert.throws(() => compileRealityToBytecode(source), source); fs.writeFileSync(input, source); fs.writeFileSync(output, retained); assert.throws(() => runNativeCompiler(compiler, input, output), source); assert.deepEqual(fs.readFileSync(output), retained); }
  const valid = 'reality P { facet value : Number = 1 reckon f(x : Number) -> Number = x + value }';
  fs.writeFileSync(input, valid); runNativeCompiler(compiler, input, output); assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(valid));
});
