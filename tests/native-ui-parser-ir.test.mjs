import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality, tryCompileReality } from '../src/compiler.mjs';
import { deserializeNativeUiProgram, serializeNativeUiProgram } from '../src/ui/ui-ir.mjs';
import { validateCanonicalNativeUi } from '../src/ui/ui-validator.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT, 'examples/native-ui/counter.rcl'), 'utf8');

test('native UI syntax is owned by the RCL parser and lowers to a rooted canonical UI IR', () => {
  const compiled = compileReality(SOURCE);
  assert.equal(compiled.nativeUis.length, 1);
  const ui = compiled.nativeUis[0];
  assert.equal(ui.format, 'rcl.native-ui.program.v0.1');
  assert.equal(ui.id, 'CounterApp');
  assert.match(ui.semanticRoot, /^[0-9a-f]{64}$/u);
  assert.equal(ui.viewTree.id, 'Root');
  assert.equal(ui.eventGraph.events.length, 2);
  assert.doesNotMatch(JSON.stringify(ui), /HTMLDiv|CSSFlex|AndroidButton|ComposeColumn|WinUIButton/u);
});

test('native UI identity and serialization are stable across compilation and round trip', () => {
  const first = compileReality(SOURCE).nativeUis[0];
  const second = compileReality(SOURCE).nativeUis[0];
  assert.equal(first.semanticRoot, second.semanticRoot);
  const serialized = serializeNativeUiProgram(first);
  const restored = deserializeNativeUiProgram(serialized, validateCanonicalNativeUi);
  assert.equal(restored.semanticRoot, first.semanticRoot);
  assert.equal(serializeNativeUiProgram(restored), serialized);
});

test('semantic roots ignore diagnostic locations but bind semantic genome mutations', () => {
  const original = compileReality(SOURCE);
  const relocated = compileReality(`\n\n${SOURCE}`);
  assert.notDeepEqual(relocated.nativeUis[0].source, original.nativeUis[0].source);
  assert.equal(relocated.nativeUis[0].semanticRoot, original.nativeUis[0].semanticRoot);
  assert.equal(relocated.programRoot, original.programRoot);

  const changed = compileReality(SOURCE.replace('property corner_radius = 20', 'property corner_radius = 21'));
  assert.notEqual(changed.nativeUis[0].semanticRoot, original.nativeUis[0].semanticRoot);
  assert.notEqual(changed.programRoot, original.programRoot);

  const tampered = structuredClone(original.nativeUis[0]);
  tampered.viewTree.resolvedStyle.values.background = '#000000';
  assert.throws(
    () => deserializeNativeUiProgram(JSON.stringify(tampered), validateCanonicalNativeUi),
    /RCL_UI_SEMANTIC_ROOT_MISMATCH/u,
  );
});

test('programs without UI preserve the governed pre-UI IR shape and program root', () => {
  const program = compileReality(`reality NoUI { facet value : Number = 1 }`);
  assert.equal(Object.hasOwn(program, 'nativeUis'), false);
  assert.match(program.programRoot, /^[0-9a-f]{64}$/u);
});

test('missing node identity, unknown binding and unknown event mutation target fail closed', () => {
  const missingIdentity = SOURCE.replace('text Title {', 'text {');
  assert.equal(tryCompileReality(missingIdentity).ok, false);
  assert.match(tryCompileReality(missingIdentity).diagnostics[0].message, /stable identity/u);

  const unknownBinding = SOURCE.replace('bind value <- count_label', 'bind value <- missing_state');
  assert.equal(tryCompileReality(unknownBinding).ok, false);
  assert.match(tryCompileReality(unknownBinding).diagnostics[0].message, /RCL_UI_REFERENCE_UNKNOWN:missing_state/u);

  const unknownTarget = SOURCE.replace('set count <- count + 1', 'set missing_state <- count + 1');
  assert.equal(tryCompileReality(unknownTarget).ok, false);
  assert.match(tryCompileReality(unknownTarget).diagnostics[0].message, /RCL_UI_EVENT_TARGET_UNKNOWN/u);
});

test('invalid layout, invalid event type and derived cycles fail closed', () => {
  const invalidLayout = SOURCE.replace('layout vertical {', 'layout css_flex {');
  assert.match(tryCompileReality(invalidLayout).diagnostics[0].message, /RCL_UI_LAYOUT_MODE:css_flex/u);
  const invalidEvent = SOURCE.replace('on activate {', 'on onclick {');
  assert.match(tryCompileReality(invalidEvent).diagnostics[0].message, /RCL_UI_EVENT_TYPE/u);
  const cycle = SOURCE.replace(
    'derived count_label : Text = "计数：" + count',
    'derived count_label : Text = other_label\n    derived other_label : Text = count_label',
  );
  assert.match(tryCompileReality(cycle).diagnostics[0].message, /RCL_UI_DERIVED_CYCLE/u);
});

test('content, style and binding properties are role-scoped and fail closed', () => {
  const invalidStyle = SOURCE.replace('property corner_radius = 20', 'property css_box_shadow = "none"');
  assert.match(tryCompileReality(invalidStyle).diagnostics[0].message, /RCL_UI_STYLE_PROPERTY/u);
  const invalidContent = SOURCE.replace('value "RCL Native UI Counter"', 'placeholder "wrong role"');
  assert.match(tryCompileReality(invalidContent).diagnostics[0].message, /RCL_UI_NODE_PROPERTY/u);
  const invalidBinding = SOURCE.replace('bind value <- count_label', 'bind label <- count_label');
  assert.match(tryCompileReality(invalidBinding).diagnostics[0].message, /RCL_UI_BINDING_PROPERTY/u);
});

test('derived values, bindings, event parameters and state mutations are statically typed', () => {
  const wrongDerived = SOURCE.replace('derived count_label : Text', 'derived count_label : Number');
  assert.match(tryCompileReality(wrongDerived).diagnostics[0].message, /RCL_UI_DERIVED_TYPE/u);
  const wrongBinding = SOURCE.replace('bind value <- count_label', 'bind value <- count');
  assert.match(tryCompileReality(wrongBinding).diagnostics[0].message, /RCL_UI_BINDING_TYPE/u);
  const wrongMutation = SOURCE.replace('set count <- count + 1', 'set count <- "not-a-number"');
  assert.match(tryCompileReality(wrongMutation).diagnostics[0].message, /RCL_UI_EVENT_MUTATION_TYPE/u);
  const wrongStyle = SOURCE.replace('property font_size = 28 inherit', 'property font_size = "large" inherit');
  assert.match(tryCompileReality(wrongStyle).diagnostics[0].message, /RCL_UI_STYLE_PROPERTY_TYPE/u);
  const wrongParameter = `reality TypedEvent { ui Form { state name : Text = "" view Root { input Name { bind value <- name on change(value : Number) { set name <- value } } } } }`;
  assert.match(tryCompileReality(wrongParameter).diagnostics[0].message, /RCL_UI_EVENT_PARAMETER_TYPE/u);
});
