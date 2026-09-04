import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseTypedModuleSource,
} from '../src/type-module-kernel.mjs';
import {
  parseTypedModuleSourceSelfHosted,
} from '../src/selfhost-typed-module-parser.mjs';

function typeCanonical(type) {
  return `${type.name}${type.args.length ? `<${type.args.map(typeCanonical).join(',')}>` : ''}`;
}

function normalizeReference(parsed) {
  return {
    module: parsed.module,
    imports: parsed.imports.map(item => item.module),
    declarations: parsed.declarations.map(declaration => {
      const base = [declaration.kind, declaration.name, declaration.exported, declaration.typeParams];
      if (declaration.kind === 'RecordDecl') {
        return [...base, declaration.fields.map(field => [field.name, typeCanonical(field.type)])];
      }
      if (declaration.kind === 'UnionDecl') {
        return [...base, declaration.variants.map(variant => [variant.name, variant.payload.map(item => typeCanonical(item.type))])];
      }
      if (declaration.kind === 'AliasDecl') return [...base, [typeCanonical(declaration.target)]];
      return [...base, declaration.methods.map(method => [
        method.name,
        method.params.map(item => typeCanonical(item.type)),
        typeCanonical(method.returns),
      ])];
    }),
  };
}

function normalizeSelfHosted(parsed) {
  return {
    module: parsed.module,
    imports: parsed.imports,
    declarations: parsed.declarations,
  };
}

const tensorModule = `module tensor
export record Tensor {
  shape: Sequence
  rank: Number
  dtype: Text
  layout: Text
  strides: Sequence
  storageIdentity: Text
  device: Text
  gradientIdentity: Text
}`;

const richModule = `# typed parser corpus
module core
import base
export record User<T> {
  id: Text
  payload: T
  tags: Array<Text>
}
export union AuthState {
  Guest
  LoggedIn(User<Text>)
  Failed(Text)
}
export alias MaybeUser = Option<User<Text>>
export interface Renderer {
  render(User<Text>) -> Result<Text, Text>
}`;

test('AI008 self-host parser byte-executes the Tensor .rcltype syntax and matches the reference parser', () => {
  const expected = normalizeReference(parseTypedModuleSource(tensorModule, { modulePath: 'tensor.rcltype' }));
  const actual = parseTypedModuleSourceSelfHosted(tensorModule);
  assert.deepEqual(normalizeSelfHosted(actual), expected);
  assert.equal(actual.native.stateRootVerified, true);
  assert.match(actual.root, /^[0-9a-f]{64}$/u);
});

test('AI008 self-host parser covers imports, generic records, tagged unions, aliases and interfaces', () => {
  const expected = normalizeReference(parseTypedModuleSource(richModule, { modulePath: 'core.rcltype' }));
  const actual = parseTypedModuleSourceSelfHosted(richModule);
  assert.deepEqual(normalizeSelfHosted(actual), expected);
  assert.equal(actual.imports[0], 'base');
  assert.equal(actual.declarations.length, 4);
});

test('AI008 self-host parser is deterministic and fails closed on malformed record fields', () => {
  const first = parseTypedModuleSourceSelfHosted(tensorModule);
  const second = parseTypedModuleSourceSelfHosted(tensorModule);
  assert.equal(first.root, second.root);
  assert.equal(first.canonical, second.canonical);
  assert.throws(
    () => parseTypedModuleSourceSelfHosted('module Bad\nrecord Broken { missing Nope }'),
    error => error?.code === 'RCL_SEMANTIC_ASSERT' && /at 2:25/u.test(error.message),
  );
  assert.throws(
    () => parseTypedModuleSourceSelfHosted('module Bad\nunknown declaration'),
    error => error?.code === 'RCL_SEMANTIC_ASSERT' && /at 2:1/u.test(error.message),
  );
});
