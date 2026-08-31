import { realityRoot } from '../canonical.mjs';
import { UI_CONTENT_PROPERTIES, UI_STYLE_PROPERTIES } from './ui-schema.mjs';

export const RCL_UI_RESOURCE_ACCESSIBILITY_VERSION = '0.1.0-candidate.1';
export const RCL_UI_RESOURCE_BUNDLE_FORMAT = 'rcl.native-ui.resource-bundle.v0.1';
export const RCL_UI_ACCESSIBILITY_TREE_FORMAT = 'rcl.native-ui.accessibility-tree.v0.1';

const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9_.-]*$/u;
const LOCALE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

function text(value, code) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(code);
  return value;
}
function resourceId(value) {
  const id = text(value, 'RCL_UI_RESOURCE_ID_REQUIRED');
  if (!RESOURCE_ID.test(id)) throw new TypeError(`RCL_UI_RESOURCE_ID_INVALID:${id}`);
  return id;
}
function localeId(value) {
  const locale = text(value, 'RCL_UI_RESOURCE_LOCALE_REQUIRED');
  if (!LOCALE.test(locale)) throw new TypeError(`RCL_UI_RESOURCE_LOCALE_INVALID:${locale}`);
  return locale;
}
function normalizedTranslations(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('RCL_UI_RESOURCE_TRANSLATIONS_INVALID');
  const out = {};
  for (const locale of Object.keys(value).sort()) out[localeId(locale)] = text(value[locale], `RCL_UI_RESOURCE_TRANSLATION_INVALID:${locale}`);
  return out;
}

export function createUiResourceBundle(input = {}) {
  const defaultLocale = localeId(input.defaultLocale);
  if (!input.resources || typeof input.resources !== 'object' || Array.isArray(input.resources)) {
    throw new TypeError('RCL_UI_RESOURCE_MAP_REQUIRED');
  }
  const resources = {};
  for (const rawId of Object.keys(input.resources).sort()) {
    const id = resourceId(rawId);
    const spec = input.resources[rawId];
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError(`RCL_UI_RESOURCE_SPEC_INVALID:${id}`);
    const type = text(spec.type ?? 'Text', `RCL_UI_RESOURCE_TYPE_REQUIRED:${id}`);
    if (type !== 'Text') throw new Error(`RCL_UI_RESOURCE_TYPE_UNSUPPORTED:${id}:${type}`);
    const translations = normalizedTranslations(spec.translations ?? {});
    const defaultValue = text(spec.defaultValue, `RCL_UI_RESOURCE_DEFAULT_REQUIRED:${id}`);
    resources[id] = Object.freeze({ id, type, defaultValue, translations });
  }
  if (Object.keys(resources).length === 0) throw new Error('RCL_UI_RESOURCE_REQUIRED');
  const core = {
    format: RCL_UI_RESOURCE_BUNDLE_FORMAT,
    version: RCL_UI_RESOURCE_ACCESSIBILITY_VERSION,
    bundleId: resourceId(input.bundleId),
    defaultLocale,
    resources,
    semanticOwner: 'rcl',
    platformResourceProviderRequired: true,
  };
  return Object.freeze({ ...core, bundleRoot: realityRoot(core) });
}

export function resolveUiResource(bundle, rawResourceId, rawLocale) {
  if (!bundle || bundle.format !== RCL_UI_RESOURCE_BUNDLE_FORMAT) throw new TypeError('RCL_UI_RESOURCE_BUNDLE_REQUIRED');
  const id = resourceId(rawResourceId);
  const locale = localeId(rawLocale);
  const spec = bundle.resources[id];
  if (!spec) throw new Error(`RCL_UI_RESOURCE_UNKNOWN:${id}`);
  const baseLocale = locale.split('-')[0];
  const candidates = [...new Set([locale, baseLocale, bundle.defaultLocale])];
  let resolvedLocale = null;
  let value = null;
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(spec.translations, candidate)) {
      resolvedLocale = candidate;
      value = spec.translations[candidate];
      break;
    }
  }
  if (value === null) {
    resolvedLocale = 'default';
    value = spec.defaultValue;
  }
  const core = {
    format: 'rcl.native-ui.resource-resolution.v0.1',
    bundleRoot: bundle.bundleRoot,
    resourceId: id,
    requestedLocale: locale,
    resolvedLocale,
    value,
    fallbackUsed: resolvedLocale !== locale,
  };
  return Object.freeze({ ...core, resolutionRoot: realityRoot(core) });
}

export function createUiResourceBinding(input = {}) {
  const property = text(input.property, 'RCL_UI_RESOURCE_BINDING_PROPERTY_REQUIRED');
  if (![...UI_CONTENT_PROPERTIES, ...UI_STYLE_PROPERTIES].includes(property)) {
    throw new Error(`RCL_UI_RESOURCE_BINDING_PROPERTY_UNSUPPORTED:${property}`);
  }
  const core = {
    format: 'rcl.native-ui.resource-binding.v0.1',
    nodeId: text(input.nodeId, 'RCL_UI_RESOURCE_BINDING_NODE_REQUIRED'),
    property,
    resourceId: resourceId(input.resourceId),
    bundleRoot: input.bundleRoot,
  };
  if (typeof core.bundleRoot !== 'string' || !/^[0-9a-f]{64}$/u.test(core.bundleRoot)) throw new TypeError('RCL_UI_RESOURCE_BINDING_BUNDLE_ROOT_INVALID');
  return Object.freeze({ ...core, bindingRoot: realityRoot(core) });
}

const A11Y_ROLE = Object.freeze({
  container: 'group',
  text: 'text',
  action: 'button',
  input: 'textbox',
});

function propertyValue(node, property) {
  return node.localProperties?.find((item) => item.property === property)?.value ?? null;
}

function accessibleName(node) {
  return node.accessibility?.label
    ?? propertyValue(node, 'accessibility_label')
    ?? (node.role === 'action' ? propertyValue(node, 'label') : null)
    ?? (node.role === 'text' ? propertyValue(node, 'value') : null)
    ?? (node.role === 'input' ? propertyValue(node, 'placeholder') : null);
}

export function buildCanonicalAccessibilityTree(program) {
  if (!program || program.format !== 'rcl.native-ui.program.v0.1') throw new TypeError('RCL_UI_ACCESSIBILITY_PROGRAM_REQUIRED');
  let order = 0;
  const walk = (node) => {
    const role = A11Y_ROLE[node.role];
    if (!role) throw new Error(`RCL_UI_ACCESSIBILITY_ROLE_UNSUPPORTED:${node.role}`);
    const name = accessibleName(node);
    const focusable = node.role === 'action' || node.role === 'input';
    if (focusable && (typeof name !== 'string' || name.length === 0)) {
      throw new Error(`RCL_UI_ACCESSIBILITY_NAME_REQUIRED:${node.id}`);
    }
    const core = {
      id: node.id,
      identityPath: node.identityPath,
      role,
      name: name ?? null,
      focusable,
      focusOrder: focusable ? order++ : null,
      children: (node.children ?? []).map(walk),
    };
    return Object.freeze({ ...core, nodeRoot: realityRoot(core) });
  };
  const root = walk(program.viewTree);
  const core = {
    format: RCL_UI_ACCESSIBILITY_TREE_FORMAT,
    version: RCL_UI_RESOURCE_ACCESSIBILITY_VERSION,
    programSemanticRoot: program.semanticRoot,
    root,
    focusableCount: order,
    platformAccessibilityProviderRequired: true,
  };
  return Object.freeze({ ...core, accessibilityRoot: realityRoot(core) });
}
