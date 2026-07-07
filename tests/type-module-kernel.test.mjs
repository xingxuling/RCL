import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compileTypedModuleGraph,
  parseTypeExpression,
  parseTypedModuleSource,
  readTypedModuleSourcesFromDir,
  runTypeModuleDemo,
} from '../src/type-module-kernel.mjs';

const sampleSources = {
  'core.rcltype': `module core
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
}`,
  'app.rcltype': `module app
import core
record Session {
  user: MaybeUser
  state: AuthState
  output: Result<Text, Text>
}`,
};

test('P3 Type Module Kernel compiles records, tagged unions, generics, Option/Result and interfaces into stable semantic IR', () => {
  const report = compileTypedModuleGraph(sampleSources, { throwOnError: true });
  assert.equal(report.ok, true);
  assert.equal(report.ir.format, 'rcl.type-module.semantic-ir.v0.29');
  assert.equal(report.ir.moduleCount, 2);
  assert.equal(report.ir.declarationCount, 5);
  assert.match(report.irRoot, /^[0-9a-f]{64}$/);
  const app = report.ir.modules.find(item => item.name === 'app');
  const session = app.declarations.find(item => item.name === 'Session');
  assert.deepEqual(session.fields.map(field => [field.name, field.canonicalType]), [
    ['user', 'core::MaybeUser'],
    ['state', 'core::AuthState'],
    ['output', 'Result<Text,Text>'],
  ]);
  const renderer = report.ir.modules.find(item => item.name === 'core').declarations.find(item => item.name === 'Renderer');
  assert.equal(renderer.methods[0].canonicalReturnType, 'Result<Text,Text>');
  assert.equal(renderer.methods[0].params[0].canonicalType, 'core::User<Text>');
});

test('P3 Type Module Kernel keeps source locations for declarations and nested type references', () => {
  const parsed = parseTypedModuleSource(sampleSources['core.rcltype'], { modulePath: 'core.rcltype' });
  const user = parsed.declarations.find(item => item.name === 'User');
  assert.equal(user.location.modulePath, 'core.rcltype');
  assert.equal(user.location.line, 2);
  assert.equal(user.fields[1].type.name, 'T');
  assert.equal(user.fields[1].type.location.line, 4);
  const type = parseTypeExpression('Result<Option<Text>, core.User<Text>>', { modulePath: 'inline', line: 1, column: 1 });
  assert.equal(type.name, 'Result');
  assert.equal(type.args[0].name, 'Option');
  assert.equal(type.args[1].name, 'core.User');
});

test('P3 Type Module Kernel diagnoses missing modules, cycles, arity mismatch and duplicate declarations', () => {
  const report = compileTypedModuleGraph({
    'a.rcltype': `module a
import b
import missing
export record Box<T> { value: T }
record Box { broken: Option<Text, Number> }`,
    'b.rcltype': `module b
import a
record Use { item: UnknownType }`,
  });
  assert.equal(report.ok, false);
  const codes = report.diagnostics.map(item => item.code);
  assert.ok(codes.includes('RCL_MODULE_MISSING'));
  assert.ok(codes.includes('RCL_MODULE_CYCLE'));
  assert.ok(codes.includes('RCL_TYPE_DECL_DUPLICATE'));
  assert.ok(codes.includes('RCL_TYPE_ARITY_MISMATCH'));
  assert.ok(codes.includes('RCL_TYPE_REFERENCE_MISSING'));
});

test('P3 Type Module Kernel reads multi-file typed modules and demo emits verified closure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-type-mod-'));
  fs.writeFileSync(path.join(dir, 'core.rcltype'), sampleSources['core.rcltype']);
  fs.writeFileSync(path.join(dir, 'app.rcltype'), sampleSources['app.rcltype']);
  const sources = readTypedModuleSourcesFromDir(dir);
  assert.deepEqual(Object.keys(sources).sort(), ['app.rcltype', 'core.rcltype']);
  const report = compileTypedModuleGraph(sources, { throwOnError: true });
  assert.equal(report.ok, true);
  const demo = runTypeModuleDemo();
  assert.equal(demo.stage, 'type-module-kernel-v0.29');
  assert.equal(demo.ok, true);
  assert.equal(demo.moduleCount, 2);
  assert.match(demo.root, /^[0-9a-f]{64}$/);
});

test('P3 Type Module CLI exposes demo and directory check reports source-located semantic IR', () => {
  const cwd = new URL('..', import.meta.url);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'type-module-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.declarationCount, 5);
  const reportPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-type-report-')), 'report.json');
  const checkOut = execFileSync('node', ['src/cli.mjs', 'type-module-check', 'examples/type-modules', reportPath], { cwd, encoding: 'utf8' });
  const report = JSON.parse(checkOut);
  assert.equal(report.ok, true);
  assert.equal(report.sourceCount, 2);
  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).ir.moduleCount, 2);
});
