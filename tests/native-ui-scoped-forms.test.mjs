import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { compileReality, tryCompileReality } from '../src/compiler.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';
import { formValidation } from '../src/ui/ui-controls.mjs';
import { validateCanonicalNativeUi } from '../src/ui/ui-validator.mjs';
import { compileRclWebApplication, emitStandaloneRclWebHtml } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication, emitNativeAndroidActivity } from '../src/android-application-compiler.mjs';

const source = fs.readFileSync(new URL('../examples/native-ui/scoped-forms.rcl', import.meta.url), 'utf8');
const ui = () => compileReality(source).nativeUis[0];
const fail = (text, pattern) => assert.match(tryCompileReality(text).diagnostics[0]?.message ?? '', pattern);

test('scoped submits isolate sibling forms and failed submits preserve state and trace', () => {
  const runtime = createNativeUiRuntime(ui());
  assert.throws(() => runtime.dispatch('SaveContact', 'activate'), /FORM_INVALID:SaveContact:Email$/);
  assert.equal(runtime.trace.length, 0);
  runtime.dispatch('Email', 'input', { value: 'alice@example.com' });
  runtime.dispatch('SaveContact', 'activate');
  assert.equal(runtime.snapshot().contactSaved, true);
  assert.equal(runtime.snapshot().profileSaved, false);
  assert.deepEqual(runtime.projection().validation.fields, { Nickname: 'required' });
  const before = runtime.snapshot(), length = runtime.trace.length;
  assert.throws(() => runtime.dispatch('SaveProfile', 'activate'), /FORM_INVALID:SaveProfile:Nickname$/);
  assert.deepEqual(runtime.snapshot(), before);
  assert.equal(runtime.trace.length, length);
  runtime.dispatch('Nickname', 'input', { value: '舟舟' });
  runtime.dispatch('SaveProfile', 'activate');
  assert.equal(runtime.snapshot().profileSaved, true);
});

test('omitted scope retains global validation and explicit root scope includes all descendants', () => {
  for (const candidate of [source.replace('property validation_scope = "ContactForm"', ''), source.replace('validation_scope = "ContactForm"', 'validation_scope = "Root"')]) {
    const runtime = createNativeUiRuntime(compileReality(candidate).nativeUis[0]);
    runtime.dispatch('Email', 'input', { value: 'alice@example.com' });
    assert.throws(() => runtime.dispatch('SaveContact', 'activate'), /FORM_INVALID:SaveContact:Nickname$/);
  }
});

test('compiler rejects nonexistent, sibling, leaf, empty, unguarded and non-text scopes', () => {
  for (const target of ['Missing', 'ProfileForm', 'Email', '']) fail(source.replace('validation_scope = "ContactForm"', `validation_scope = "${target}"`), /RCL_UI_FORM_SCOPE_(ANCESTOR|TARGET)/);
  fail(source.replace('property require_valid_form = true', 'property require_valid_form = false'), /RCL_UI_FORM_SCOPE_GUARD_REQUIRED/);
  fail(source.replace('validation_scope = "ContactForm"', 'validation_scope = true'), /RCL_UI_NODE_PROPERTY_TYPE/);
});

test('sealed scope tampering and direct helper invalid target fail closed', () => {
  const forged = structuredClone(ui());
  forged.viewTree.children.find(n => n.id === 'ContactForm').children.find(n => n.id === 'SaveContact').localProperties.find(p => p.property === 'validation_scope').value = 'ProfileForm';
  assert.throws(() => validateCanonicalNativeUi(forged), /RCL_UI_FORM_SCOPE_ANCESTOR/);
  assert.throws(() => formValidation([ui().viewTree], {}, 'missing'), /RCL_UI_FORM_SCOPE_TARGET/);
});

test('web script parses with scope-specific validation and feedback', () => {
  const html = emitStandaloneRclWebHtml(compileRclWebApplication(source, { schema: 'rcl.native-ui.web-target.v0.1' }));
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.match(html, /rclFormValidation\(scope\)/);
  assert.match(html, /attemptedFields\.has\(id\)/);
});

test('Android emits scoped guard calls and ancestor membership for each field', () => {
  const java = emitNativeAndroidActivity(compileRclAndroidApplication(source, { schema: 'rcl.native-ui.android-target.v0.1', applicationId: 'com.taowind.rcl.scopedforms' }));
  assert.match(java, /String error=rclFormValidation\("ContactForm"\)/);
  assert.match(java, /String error=rclFormValidation\("ProfileForm"\)/);
  assert.match(java, /scope == null \|\| "Root"\.equals\(scope\) \|\| "ContactForm"\.equals\(scope\)/);
});
