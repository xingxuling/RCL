import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  tryCompileReality,
  runReality,
  runTypeConstructorDemo,
} from '../src/index.mjs';

const typeModuleSources = {
  'core.rcltype': `module core
export record User<T> {
  id: Text
  payload: T
}
export union LoginResult<T,E> {
  Ok(T)
  Err(E)
}`,
};

const typedConstructors = `reality TypedConstructors {
  facet app.user : core.User<Text> = { id: "u-1", payload: "seed" }
  facet app.login : core.LoginResult<Text, Text> = Ok("accepted")
}`;

test('P3 constructor lowering compiles record literals and union variant calls into typed constructor IR', async () => {
  const result = tryCompileReality(typedConstructors, { typeModuleSources });
  assert.equal(result.ok, true);
  assert.equal(result.program.semanticMap.format, 'rcl.typed-compiler.semantic-map.v0.34');
  assert.equal(result.program.semanticMap.constructorCount, 2);
  assert.equal(result.program.semanticMap.facets['app.user'].constructor.kind, 'Record');
  assert.equal(result.program.semanticMap.facets['app.login'].constructor.variant, 'Ok');

  const userFacet = result.program.facets.find(item => item.path === 'app.user');
  const loginFacet = result.program.facets.find(item => item.path === 'app.login');
  assert.equal(userFacet.value.kind, 'RecordConstructExpr');
  assert.equal(userFacet.value.fields[1].canonicalType, 'Text');
  assert.equal(loginFacet.value.kind, 'UnionConstructExpr');
  assert.equal(loginFacet.value.payload[0].canonicalType, 'Text');

  const runtime = await runReality(result.program);
  assert.equal(runtime.state['app.user'].__rclKind, 'Record');
  assert.equal(runtime.state['app.user'].__rclType, 'core::User<Text>');
  assert.equal(runtime.state['app.user'].id, 'u-1');
  assert.equal(runtime.state['app.login'].__rclKind, 'Union');
  assert.equal(runtime.state['app.login'].variant, 'Ok');
  assert.deepEqual(runtime.state['app.login'].payload, ['accepted']);
});

test('P3 constructor lowering rejects missing, unknown and mistyped record fields', () => {
  const missing = tryCompileReality('reality Bad { facet app.user : core.User<Text> = { id: "u-1" } }', { typeModuleSources });
  assert.equal(missing.ok, false);
  assert.ok(missing.diagnostics.some(item => item.code === 'RCL_RECORD_FIELD_MISSING'));

  const extra = tryCompileReality('reality Bad { facet app.user : core.User<Text> = { id: "u-1", payload: "x", role: "admin" } }', { typeModuleSources });
  assert.equal(extra.ok, false);
  assert.ok(extra.diagnostics.some(item => item.code === 'RCL_RECORD_FIELD_UNKNOWN'));

  const mistyped = tryCompileReality('reality Bad { facet app.user : core.User<Text> = { id: "u-1", payload: 42 } }', { typeModuleSources });
  assert.equal(mistyped.ok, false);
  assert.ok(mistyped.diagnostics.some(item => item.code === 'RCL_RECORD_FIELD_TYPE'));
});

test('P3 constructor lowering rejects unknown union variants and payload type mismatches', () => {
  const unknown = tryCompileReality('reality Bad { facet app.login : core.LoginResult<Text, Text> = Pending("x") }', { typeModuleSources });
  assert.equal(unknown.ok, false);
  assert.ok(unknown.diagnostics.some(item => item.code === 'RCL_UNION_VARIANT_UNKNOWN'));

  const mistyped = tryCompileReality('reality Bad { facet app.login : core.LoginResult<Text, Text> = Ok(42) }', { typeModuleSources });
  assert.equal(mistyped.ok, false);
  assert.ok(mistyped.diagnostics.some(item => item.code === 'RCL_UNION_PAYLOAD_TYPE'));
});

test('P3 constructor lowering demo and CLI expose constructor reports', () => {
  const demo = runTypeConstructorDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.constructorCount, 2);
  assert.equal(demo.loweredUserKind, 'RecordConstructExpr');

  const cwd = new URL('..', import.meta.url);
  const out = execFileSync('node', ['src/cli.mjs', 'type-constructor-demo'], { cwd, encoding: 'utf8' });
  const report = JSON.parse(out);
  assert.equal(report.ok, true);
  assert.equal(report.userConstructor.kind, 'Record');
  assert.equal(report.loginConstructor.variant, 'Ok');
});
