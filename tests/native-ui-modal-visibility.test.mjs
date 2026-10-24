import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { compileReality, tryCompileReality } from '../src/compiler.mjs';
import { createNativeUiRuntime, runNativeUiSemanticTrace } from '../src/ui/ui-event.mjs';
import { validateCanonicalNativeUi } from '../src/ui/ui-validator.mjs';
import { compileRclWebApplication,emitStandaloneRclWebHtml } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication,emitNativeAndroidActivity } from '../src/android-application-compiler.mjs';

const source = fs.readFileSync(new URL('../examples/native-ui/modal-workspace.rcl', import.meta.url), 'utf8');
const compile = () => compileReality(source).nativeUis[0];
function rejectSource(mutated, expected) {
  const result = tryCompileReality(mutated);
  assert.match(result.diagnostics?.[0]?.message ?? '', expected);
}

test('v0.6 modal compiles to stable governed IR with one labelled overlay', () => {
  const program = compile();
  assert.equal(validateCanonicalNativeUi(program), true);
  assert.equal(program.viewTree.layout.mode, 'overlay');
  assert.equal(program.viewTree.children[1].localProperties.find(x => x.property === 'modal').value, true);
  assert.equal(program.semanticRoot, compile().semanticRoot);
});

test('v0.6 background is usable until dialog opens, then blocked without trace mutation', () => {
  const rt = createNativeUiRuntime(compile());
  rt.dispatch('Increment', 'activate');
  rt.dispatch('OpenDialog', 'activate');
  const snap = rt.snapshot(), entries = rt.trace.length;
  assert.throws(() => rt.dispatch('Increment', 'activate'), /RCL_UI_MODAL_BLOCKED/);
  assert.throws(() => rt.dispatch('OpenDialog', 'activate'), /RCL_UI_MODAL_BLOCKED/);
  assert.deepEqual(rt.snapshot(), snap);
  assert.equal(rt.trace.length, entries);
  rt.dispatch('Cancel', 'activate');
  assert.throws(() => rt.dispatch('Confirm', 'activate'), /RCL_UI_EVENT_HIDDEN/);
  rt.dispatch('Increment', 'activate');
  assert.equal(rt.snapshot().count, 2);
});

test('v0.6 open-confirm-close and Web/Android semantic parity', () => {
  const actions = [{nodeId:'OpenDialog',type:'activate'}, {nodeId:'Confirm',type:'activate'}];
  const left = runNativeUiSemanticTrace(compile(), actions, 'web');
  const right = runNativeUiSemanticTrace(compile(), actions, 'android');
  assert.deepEqual(left.finalState, right.finalState);
  assert.equal(right.finalState.confirmation, 'Confirmed');
  assert.equal(right.finalState.dialogOpen, false);
});

test('v0.6 rejects illegal modal nesting, missing visible binding and missing accessible name', () => {
  rejectSource(source.replace('layout overlay { width fill height fill padding 0 }','layout vertical { width fill gap 10 }'), /RCL_UI_MODAL_PARENT/);
  rejectSource(source.replace('bind visible <- dialogOpen',''), /RCL_UI_MODAL_VISIBLE_BIND_REQUIRED/);
  rejectSource(source.replace('accessibility_label "Confirmation dialog"',''), /RCL_UI_MODAL_LABEL_REQUIRED/);
  rejectSource(source.replace('property modal = true', 'property modal = "yes"'), /RCL_UI_NODE_PROPERTY_TYPE/);
  rejectSource(source.replace('property modal = true','property modal = true').replace('view ConfirmDialog {','view ConfirmDialog {\n      view Another { property modal = true accessibility_label "Another" bind visible <- dialogOpen }'), /RCL_UI_MODAL_PARENT/);
});

test('v0.6 sealed IR cannot silently relocate or strip protected dialog metadata', () => {
  const forged = structuredClone(compile());
  forged.viewTree.children[1].localProperties.find(x => x.property === 'modal').value = false;
  assert.throws(() => validateCanonicalNativeUi(forged), /RCL_UI_MODAL_ROLE/);
  const forged2 = structuredClone(compile());
  forged2.viewTree.children[1].bindings = [];
  assert.throws(() => validateCanonicalNativeUi(forged2), /RCL_UI_MODAL_VISIBLE_BIND_REQUIRED/);
});

test('v0.6 generated web has hidden state, aria-modal, inert background and executable JS', () => {
  const html = emitStandaloneRclWebHtml(compileRclWebApplication(source,{schema:'rcl.native-ui.web-target.v0.1'}));
  assert.match(html,/role="dialog" aria-modal="true"/);
  assert.match(html,/RCL_UI_MODAL_BLOCKED:/);
  assert.match(html,/RCL_UI_EVENT_HIDDEN:/);
  assert.match(html,/\.inert=!!modalId/);
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  new vm.Script(script);
});

test('v0.6 generated Android has guarded event route, modal visibility and no plaintext state logs', () => {
  const java=emitNativeAndroidActivity(compileRclAndroidApplication(source,{schema:'rcl.native-ui.android-target.v0.1',applicationId:'com.taowind.rcl.modal'}));
  assert.match(java,/assertUiInteractable\("Increment", "activate"\)/);
  assert.match(java,/RCL_UI_MODAL_BLOCKED:/);
  assert.match(java,/RCL_UI_EVENT_HIDDEN:/);
  assert.match(java,/view_ConfirmDialog\.setVisibility\(/);
  assert.match(java,/Color\.argb\(239, 17, 24, 39\)/);
  assert.doesNotMatch(java,/Log\.i\([^\n]*state\.toString\(\)/);
});

test('v0.6 generic container visibility blocks descendants without any modal', () => {
  const noModal = source
    .replace('property modal = true', '')
    .replace('layout overlay { width fill height fill padding 0 }', 'layout vertical { width fill gap 8 }');
  const rt = createNativeUiRuntime(compileReality(noModal).nativeUis[0]);
  assert.throws(() => rt.dispatch('Cancel','activate'),/RCL_UI_EVENT_HIDDEN/);
  rt.dispatch('OpenDialog','activate');
  rt.dispatch('Increment','activate');
  assert.equal(rt.snapshot().count,1);
  rt.dispatch('Cancel','activate');
  assert.equal(rt.snapshot().dialogOpen,false);
});
