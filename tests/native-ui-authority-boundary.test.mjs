import test from 'node:test';
import assert from 'node:assert/strict';
import { compileNativeUiProgram } from '../src/ui/ui-compiler.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';
import { tryCompileReality } from '../src/compiler.mjs';

const REALITY_ACTION = `reality GovernedUI {
  facet app.published : Truth = false
  subject user { warrant app.publish on app }
  emergence publish { cause user when app.published == false needs app.publish on app alter app.published <- true preserve app.published == true witness "ui:publish" }
  ui Console {
    view Root {
      action PublishButton { label "Publish" on activate { realize publish } }
    }
  }
}`;

test('reality-affecting UI events fail closed without a Reality Transaction gateway', () => {
  const runtime = createNativeUiRuntime(compileNativeUiProgram(REALITY_ACTION));
  runtime.lifecycle('create');
  assert.throws(() => runtime.dispatch('PublishButton', 'activate'), /RCL_UI_REALITY_GATEWAY_REQUIRED/u);
  assert.deepEqual(runtime.state, {});
  assert.equal(runtime.trace.length, 0);
});

test('a governed UI event emits Candidate Reality only through an explicit gateway', () => {
  const candidates = [];
  const runtime = createNativeUiRuntime(compileNativeUiProgram(REALITY_ACTION), { realityGateway: (candidate) => candidates.push(candidate) });
  runtime.lifecycle('create');
  runtime.dispatch('PublishButton', 'activate');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, 'CandidateReality');
  assert.equal(candidates[0].rule, 'publish');
});

test('mixed local mutation and reality dispatch in one handler is rejected', () => {
  const mixed = REALITY_ACTION.replace(
    'ui Console {',
    'ui Console { state local : Truth = false',
  ).replace('on activate { realize publish }', 'on activate { set local <- true realize publish }');
  const result = tryCompileReality(mixed);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /RCL_UI_EVENT_MIXED_AUTHORITY/u);
});

test('in-app navigation cannot be combined with Reality authority in one handler', () => {
  const mixedNavigation = REALITY_ACTION
    .replace('ui Console {', `ui Console {
    navigation { initial home route home -> Root }`)
    .replace('on activate { realize publish }', 'on activate { navigate home realize publish }');
  const result = tryCompileReality(mixedNavigation);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /RCL_UI_EVENT_MIXED_AUTHORITY:PublishButton:activate/u);
});
