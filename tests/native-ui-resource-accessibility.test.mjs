import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { createUiResourceBundle, resolveUiResource, createUiResourceBinding, buildCanonicalAccessibilityTree } from '../src/ui/ui-resource-accessibility.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT, 'examples/native-ui/counter.rcl'), 'utf8');

function ui() {
  return compileReality(SOURCE).nativeUis[0];
}

test('UI004 resource bundle has stable identity and deterministic locale fallback', () => {
  const bundle = createUiResourceBundle({
    bundleId: 'app.copy', defaultLocale: 'en-US',
    resources: {
      'counter.title': { type: 'Text', defaultValue: 'Counter', translations: { 'zh-CN': '计数器', en: 'Counter' } },
      'counter.add': { type: 'Text', defaultValue: 'Add', translations: { 'zh-CN': '增加' } },
    },
  });
  assert.equal(resolveUiResource(bundle, 'counter.title', 'zh-CN').value, '计数器');
  const fallback = resolveUiResource(bundle, 'counter.title', 'en-GB');
  assert.equal(fallback.value, 'Counter');
  assert.equal(fallback.resolvedLocale, 'en');
  assert.equal(fallback.fallbackUsed, true);
  assert.equal(bundle.bundleRoot.length, 64);
});

test('UI004 resource binding is rooted and rejects unknown UI properties', () => {
  const bundle = createUiResourceBundle({ bundleId: 'b', defaultLocale: 'en', resources: { title: { defaultValue: 'Title' } } });
  const binding = createUiResourceBinding({ nodeId: 'Title', property: 'value', resourceId: 'title', bundleRoot: bundle.bundleRoot });
  assert.equal(binding.bindingRoot.length, 64);
  assert.throws(() => createUiResourceBinding({ nodeId: 'Title', property: 'onclick', resourceId: 'title', bundleRoot: bundle.bundleRoot }), /RCL_UI_RESOURCE_BINDING_PROPERTY_UNSUPPORTED/u);
});

test('UI004 canonical accessibility tree preserves UI identity and deterministic focus order', () => {
  const tree = buildCanonicalAccessibilityTree(ui());
  assert.equal(tree.programSemanticRoot, ui().semanticRoot);
  assert.equal(tree.accessibilityRoot.length, 64);
  assert.ok(tree.focusableCount > 0);
  const focusOrders = [];
  const walk = (node) => { if (node.focusable) focusOrders.push(node.focusOrder); node.children.forEach(walk); };
  walk(tree.root);
  assert.deepEqual(focusOrders, [...focusOrders].sort((a, b) => a - b));
  assert.equal(new Set(focusOrders).size, focusOrders.length);
});

test('UI004 actionable/input nodes fail closed when no accessible name is available', () => {
  const program = structuredClone(ui());
  const find = (node) => node.role === 'action' ? node : node.children.map(find).find(Boolean);
  const action = find(program.viewTree);
  assert.ok(action);
  action.accessibility.label = null;
  action.localProperties = action.localProperties.filter((item) => !['label', 'accessibility_label'].includes(item.property));
  assert.throws(() => buildCanonicalAccessibilityTree(program), new RegExp(`RCL_UI_ACCESSIBILITY_NAME_REQUIRED:${action.id}`));
});

test('UI004 candidate remains a semantic accessibility/resource layer, not proof of platform completeness', () => {
  const tree = buildCanonicalAccessibilityTree(ui());
  assert.equal(tree.platformAccessibilityProviderRequired, true);
  const bundle = createUiResourceBundle({ bundleId: 'b', defaultLocale: 'en', resources: { x: { defaultValue: 'x' } } });
  assert.equal(bundle.platformResourceProviderRequired, true);
});
