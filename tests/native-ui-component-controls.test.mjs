import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality, tryCompileReality } from '../src/compiler.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';
import { validateCanonicalNativeUi } from '../src/ui/ui-validator.mjs';
import { serializeNativeUiProgram, deserializeNativeUiProgram } from '../src/ui/ui-ir.mjs';
import { compileRclWebApplication, emitStandaloneRclWebHtml, traceNativeUiWebApplication } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication, emitNativeAndroidActivity, traceNativeUiAndroidApplication } from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT, 'examples/native-ui/component-controls.rcl'), 'utf8');
const EVENTS = [{ nodeId: 'EmailField', type: 'input', payload: { value: 'demo@example.test' } }, { nodeId: 'ToggleLockButton', type: 'activate' }];

function compiled() { return compileReality(SOURCE).nativeUis[0]; }
function node(ui, id) { return ui.viewTree.children.find((item) => item.id === id); }

test('component roles validate, seal and deserialize with a stable shared semantic identity', () => {
  const first = compiled();
  assert.equal(validateCanonicalNativeUi(first), true);
  assert.equal(compiled().semanticRoot, first.semanticRoot);
  assert.equal(deserializeNativeUiProgram(serializeNativeUiProgram(first), validateCanonicalNativeUi).semanticRoot, first.semanticRoot);
  assert.deepEqual(node(first, 'EmailField').bindings.map((item) => [item.property, item.expression.valueType]), [['value','Text'],['disabled','Truth']]);
  assert.deepEqual(node(first, 'DemoPasswordField').bindings.map((item) => [item.property, item.expression.valueType]), [['value','Text'],['read_only','Truth']]);
});

test('runtime refuses disabled actions/inputs and read-only changes before state or witness changes', () => {
  const runtime = createNativeUiRuntime(compiled());
  runtime.dispatch('EmailField', 'input', { value: 'demo@example.test' });
  runtime.dispatch('DemoPasswordField', 'input', { value: 'not-a-credential' });
  runtime.dispatch('ToggleLockButton', 'activate');
  assert.deepEqual(runtime.snapshot(), { locked: true, email: 'demo@example.test', demonstration_password: 'not-a-credential', submitted: false });
  assert.equal(runtime.projection().rendered.EmailField.disabled, true);
  assert.equal(runtime.projection().rendered.DemoPasswordField.read_only, true);
  assert.throws(() => runtime.dispatch('EmailField', 'input', { value: 'evil' }), /RCL_UI_EVENT_DISABLED:EmailField:input/);
  assert.throws(() => runtime.dispatch('DemoPasswordField', 'input', { value: 'evil' }), /RCL_UI_EVENT_READ_ONLY:DemoPasswordField:input/);
  assert.throws(() => runtime.dispatch('SubmitButton', 'activate'), /RCL_UI_EVENT_DISABLED:SubmitButton:activate/);
  assert.equal(runtime.trace.length, 3, 'rejected actions must not create a committed trace');
  runtime.dispatch('ToggleLockButton', 'activate');
  runtime.dispatch('SubmitButton', 'activate');
  assert.equal(runtime.snapshot().submitted, true);
  assert.equal(runtime.trace.length, 5);
});

test('Web + Android backends share semantic roots and expose actual platform component attributes', () => {
  const web = compileRclWebApplication(SOURCE, { schema:'rcl.native-ui.web-target.v0.1' });
  const android = compileRclAndroidApplication(SOURCE, { schema:'rcl.native-ui.android-target.v0.1', applicationId:'com.taowind.rcl.components' });
  assert.equal(web.uiProgramRoot, android.uiProgramRoot);
  const html = emitStandaloneRclWebHtml(web);
  const java = emitNativeAndroidActivity(android);
  assert.match(html, /data-rcl-node="EmailField"[^>]*type="email"/);
  assert.match(html, /data-rcl-node="DemoPasswordField"[^>]*type="password"/);
  assert.match(html, /el\.disabled=props\.disabled/);
  assert.match(html, /el\.readOnly=props\.read_only/);
  assert.match(html, /RCL_UI_EVENT_DISABLED/);
  assert.match(html, /RCL_UI_EVENT_READ_ONLY/);
  assert.match(java, /TYPE_TEXT_VARIATION_EMAIL_ADDRESS/);
  assert.match(java, /TYPE_TEXT_VARIATION_PASSWORD/);
  assert.match(java, /setKeyListener\(rclTruthy/);
  assert.match(java, /setEnabled\(!rclTruthy/);
  assert.match(java, /RCL_UI_EVENT_DISABLED:EmailField:input/);
  assert.match(java, /RCL_UI_EVENT_READ_ONLY:DemoPasswordField:input/);
  assert.deepEqual(traceNativeUiWebApplication(web, EVENTS).finalState, traceNativeUiAndroidApplication(android, EVENTS).finalState);
});

test('unknown input kinds, wrong roles and wrong property types fail closed', () => {
  const badType = SOURCE.replace('property input_kind = "email"', 'property input_kind = "file"');
  assert.match(tryCompileReality(badType).diagnostics[0].message, /RCL_UI_INPUT_KIND/);
  const badRole = SOURCE.replace('text Title { value "RCL Native UI · Component Controls" }', 'text Title { value "RCL Native UI · Component Controls" property disabled = true }');
  assert.match(tryCompileReality(badRole).diagnostics[0].message, /RCL_UI_NODE_PROPERTY/);
  const badBoolean = SOURCE.replace('bind disabled <- locked', 'bind disabled <- email');
  assert.match(tryCompileReality(badBoolean).diagnostics[0].message, /RCL_UI_BINDING_TYPE/);
  const altered = structuredClone(compiled());
  node(altered, 'EmailField').localProperties.find((p) => p.property === 'input_kind').value = 'file';
  assert.throws(() => validateCanonicalNativeUi(altered), /RCL_UI_INPUT_KIND/);
});

test('static disabled and read_only compile to HTML attributes and canonical guards', () => {
  const staticSource = SOURCE.replace('bind disabled <- locked', 'property disabled = true')
    .replace('bind read_only <- locked', 'property read_only = true');
  const ui = compileReality(staticSource).nativeUis[0];
  const html = emitStandaloneRclWebHtml(compileRclWebApplication(staticSource, { schema:'rcl.native-ui.web-target.v0.1' }));
  assert.match(html, /data-rcl-node="EmailField"[^>]*disabled/);
  assert.match(html, /data-rcl-node="DemoPasswordField"[^>]*readonly/);
  const runtime = createNativeUiRuntime(ui);
  assert.throws(() => runtime.dispatch('EmailField','input',{value:'x'}), /RCL_UI_EVENT_DISABLED/);
  assert.throws(() => runtime.dispatch('DemoPasswordField','input',{value:'x'}), /RCL_UI_EVENT_READ_ONLY/);
});
