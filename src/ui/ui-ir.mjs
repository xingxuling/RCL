import { createHash } from 'node:crypto';
import { RCL_NATIVE_UI_FORMAT } from './ui-schema.mjs';

export function canonicalUiJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalUiJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalUiJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function nativeUiRoot(value) {
  return createHash('sha256').update(canonicalUiJson(value)).digest('hex');
}

export function sealNativeUiProgram(program) {
  const draft = structuredClone(program);
  delete draft.semanticRoot;
  return Object.freeze({ ...draft, semanticRoot: nativeUiRoot(draft) });
}

export function serializeNativeUiProgram(program, spacing = 2) {
  if (program?.format !== RCL_NATIVE_UI_FORMAT) throw new Error('RCL_UI_SERIALIZE_FORMAT');
  return `${JSON.stringify(program, null, spacing)}\n`;
}

export function deserializeNativeUiProgram(source, validate) {
  const value = JSON.parse(source);
  if (value?.format !== RCL_NATIVE_UI_FORMAT) throw new Error('RCL_UI_DESERIALIZE_FORMAT');
  if (typeof validate === 'function') validate(value);
  const expected = value.semanticRoot;
  const draft = structuredClone(value);
  delete draft.semanticRoot;
  if (nativeUiRoot(draft) !== expected) throw new Error('RCL_UI_SEMANTIC_ROOT_MISMATCH');
  return Object.freeze(value);
}

