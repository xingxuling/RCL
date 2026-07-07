import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compileTypedHeapLayout,
  runTypedHeapLayoutDemo,
  compileTypedHeapLayoutFromFiles,
  DEFAULT_TYPED_HEAP_SOURCE,
  DEFAULT_TYPED_HEAP_TYPE_MODULES,
} from '../src/index.mjs';

function writeHeapFiles(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/app.rcl'), DEFAULT_TYPED_HEAP_SOURCE);
  fs.writeFileSync(path.join(dir, 'types/core.rcltype'), DEFAULT_TYPED_HEAP_TYPE_MODULES['core.rcltype']);
}

test('P3 typed heap native VM assigns stable object identities to typed records and unions', () => {
  const result = compileTypedHeapLayout();
  assert.equal(result.ok, true);
  assert.equal(result.native.typedHeap.allocated, 4);
  assert.equal(result.native.state['app.session'].__rclObjectId, 3);
  assert.equal(result.native.state['app.session'].user.__rclObjectId, 1);
  assert.equal(result.native.state['app.session'].login.__rclObjectId, 2);
  assert.equal(result.native.state['app.login'].__rclObjectId, 4);
});

test('P3 typed heap report exposes stable field and union offset tables', () => {
  const result = compileTypedHeapLayout();
  const sessionTable = result.report.stableFieldOffsetTables.find(item => item.type === 'core::Session');
  assert.ok(sessionTable);
  assert.deepEqual(sessionTable.fields.map(item => [item.name, item.offset, item.traceable]), [['user', 0, true], ['login', 1, true]]);
  const userTable = result.report.stableFieldOffsetTables.find(item => item.type === 'core::User');
  assert.deepEqual(userTable.fields.map(item => [item.name, item.offset]), [['id', 0], ['payload', 1]]);
  const loginTable = result.report.stableUnionOffsetTables.find(item => item.type === 'core::LoginResult');
  assert.deepEqual(loginTable.variants.map(item => [item.name, item.variantOffset]), [['Ok', 0], ['Err', 1]]);
});

test('P3 typed heap report exposes GC roots, objects and trace edges', () => {
  const result = compileTypedHeapLayout();
  assert.equal(result.report.format, 'rcl.typed-heap-layout.v0.35');
  assert.equal(result.report.objectIdentityCount, 4);
  assert.equal(result.report.rootCount, 2);
  assert.equal(result.report.edgeCount, 2);
  assert.deepEqual(result.report.gcTraceTable.roots.map(item => item.rootPath).sort(), ['app.login', 'app.session']);
  assert.deepEqual(result.report.gcTraceTable.edges.map(item => [item.fromObjectId, item.toObjectId, item.slot]), [[3, 2, 'login'], [3, 1, 'user']].sort());
  assert.match(result.report.heapLayoutRoot, /^[0-9a-f]{64}$/);
});

test('P3 typed heap demo and CLI expose heap evidence', () => {
  const demo = runTypedHeapLayoutDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.nativeTypedHeap.allocated, 4);
  assert.equal(demo.edgeCount, 2);

  const cwd = new URL('..', import.meta.url);
  const cliDemo = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-heap-demo'], { cwd, encoding: 'utf8' }));
  assert.equal(cliDemo.ok, true);
  assert.equal(cliDemo.objectIdentityCount, 4);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-heap-cli-'));
  writeHeapFiles(dir);
  const cliBuild = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-heap-build', path.join(dir, 'src/app.rcl'), path.join(dir, 'types'), path.join(dir, 'out')], { cwd, encoding: 'utf8' }));
  assert.equal(cliBuild.ok, true);
  assert.equal(cliBuild.edgeCount, 2);
  assert.equal(fs.existsSync(cliBuild.bytecodePath), true);
  assert.equal(fs.existsSync(cliBuild.reportPath), true);
});
