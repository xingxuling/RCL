import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileNativeUiProgram } from '../src/ui/ui-compiler.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT, 'examples/native-ui/counter.rcl'), 'utf8');

test('state to binding to event to state to binding closes reactively', () => {
  const ui = compileNativeUiProgram(SOURCE);
  const runtime = createNativeUiRuntime(ui);
  runtime.lifecycle('create');
  assert.equal(runtime.projection().rendered.CounterText.value, '计数：0');
  runtime.dispatch('IncrementButton', 'activate');
  assert.equal(runtime.state.count, 1);
  assert.equal(runtime.projection().rendered.CounterText.value, '计数：1');
  runtime.dispatch('ResetButton', 'activate');
  assert.equal(runtime.state.count, 0);
  assert.equal(runtime.trace.length, 2);
});

test('change event parameters update input state through the canonical event graph', () => {
  const source = `reality InputUI {
    ui Form {
      state name : Text = ""
      view Root {
        input NameInput {
          placeholder "Name"
          bind value <- name
          on change(value) { set name <- value }
        }
      }
    }
  }`;
  const runtime = createNativeUiRuntime(compileNativeUiProgram(source));
  runtime.lifecycle('create');
  runtime.dispatch('NameInput', 'change', { value: 'RCL' });
  assert.equal(runtime.state.name, 'RCL');
  assert.equal(runtime.projection().rendered.NameInput.value, 'RCL');
  assert.throws(() => runtime.dispatch('NameInput', 'change', { value: 7 }), /RCL_UI_EVENT_PARAMETER_RUNTIME_TYPE/u);
  assert.throws(() => runtime.dispatch('NameInput', 'change', {}), /RCL_UI_EVENT_PARAMETER_MISSING/u);
});

test('layout algebra covers vertical, horizontal, overlay, grid, fill, intrinsic and fixed', () => {
  const source = `reality LayoutUI {
    ui Layouts {
      view Root { layout vertical { width fill height intrinsic gap 2 padding 1 align stretch distribute start }
        view Row { layout horizontal { width fixed 120 height intrinsic gap 1 padding 0 align center distribute space_between } }
        view Overlay { layout overlay { width fill height fixed 40 gap 0 padding 0 align center distribute center overflow clip } }
        view Grid { layout grid { width fill height intrinsic gap 4 padding 2 align stretch distribute start columns 2 } }
      }
    }
  }`;
  const ui = compileNativeUiProgram(source);
  assert.deepEqual(ui.viewTree.children.map((node) => node.layout.mode), ['horizontal', 'overlay', 'grid']);
  assert.deepEqual(ui.viewTree.children[0].layout.width, { mode: 'fixed', value: 120 });
  assert.equal(ui.viewTree.children[2].layout.columns, 2);
});

test('style cascade resolves theme, inheritance, specificity, priority and local properties', () => {
  const source = `reality StyledUI {
    ui Styled {
      style RootTone { target node Root priority 1 property foreground = "#111111" inherit }
      style TextTone { target role text priority 2 property foreground = "#222222" }
      style ExactTone { target node Label priority 3 property foreground = "#333333" }
      view Root { property background = "#ffffff" text Label { class emphasized value "hello" property font_size = 20 } }
    }
  }`;
  const ui = compileNativeUiProgram(source);
  const label = ui.viewTree.children[0];
  assert.equal(label.resolvedStyle.values.foreground, '#333333');
  assert.equal(label.resolvedStyle.values.font_size, 20);
  assert.equal(label.resolvedStyle.provenance.foreground, 'rule:ExactTone');
  assert.equal(Object.hasOwn(label.resolvedStyle.values, 'value'), false);
});

test('lifecycle restore is explicit and restores only declared local UI state', () => {
  const ui = compileNativeUiProgram(SOURCE);
  const runtime = createNativeUiRuntime(ui);
  runtime.lifecycle('create', { count: 7, ignored: 9 });
  assert.equal(runtime.state.count, 7);
  assert.deepEqual(runtime.lifecycleTrace.map((item) => item.stage), ['create']);
  const invalid = createNativeUiRuntime(ui);
  assert.throws(() => invalid.lifecycle('create', { count: 'seven' }), /RCL_UI_RESTORE_TYPE/u);
});
