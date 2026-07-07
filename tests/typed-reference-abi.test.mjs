import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compileTypedReferenceAbi,
  runTypedReferenceAbiDemo,
  compileTypedReferenceAbiFromFiles,
  DEFAULT_TYPED_REFERENCE_SOURCE,
  DEFAULT_TYPED_REFERENCE_TYPE_MODULES,
} from '../src/index.mjs';

function writeReferenceFiles(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/app.rcl'), DEFAULT_TYPED_REFERENCE_SOURCE);
  fs.writeFileSync(path.join(dir, 'types/core.rcltype'), DEFAULT_TYPED_REFERENCE_TYPE_MODULES['core.rcltype']);
}

test('P3 typed reference ABI creates native refs for typed record and union objects', () => {
  const result = compileTypedReferenceAbi();
  assert.equal(result.ok, true);
  assert.equal(result.native.typedHeap.allocated, 4);
  assert.equal(result.native.typedHeap.references, 2);
  assert.equal(result.native.state['app.sessionRef'].__rclKind, 'Ref');
  assert.equal(result.native.state['app.sessionRef'].__rclRefObjectId, 3);
  assert.equal(result.native.state['app.loginRef'].__rclRefObjectId, 4);
  assert.equal(result.native.state['app.sessionRefId'], 3);
});

test('P3 typed dereference resolves registered heap object and preserves object identity', () => {
  const result = compileTypedReferenceAbi();
  assert.equal(result.native.state['app.sessionAgain'].__rclKind, 'Record');
  assert.equal(result.native.state['app.sessionAgain'].__rclObjectId, 3);
  assert.equal(result.native.state['app.payloadViaRef'], 'referenced');
  assert.equal(result.report.referenceAbi.opcodes.includes('DEREF_TYPED_REF'), true);
});

test('P3 typed reference ABI report exposes mark phase roots and resolved reference edges', () => {
  const result = compileTypedReferenceAbi();
  assert.equal(result.report.format, 'rcl.typed-reference-abi.v0.36');
  assert.equal(result.report.gcMarkPhase.nativeMarked, 4);
  assert.equal(result.report.rootReferenceCount, 2);
  assert.deepEqual(result.report.typedHeapGraph.referenceEdges.map(item => [item.fromPath, item.toObjectId, item.resolved]), [
    ['app.sessionRef', 3, true],
    ['app.loginRef', 4, true],
  ]);
  assert.ok(result.report.referenceInstructions.some(item => item.opcode === 'MAKE_TYPED_REF'));
  assert.ok(result.report.referenceInstructions.some(item => item.opcode === 'GET_TYPED_REF_ID'));
  assert.match(result.report.referenceAbiRoot, /^[0-9a-f]{64}$/);
});

test('P3 typed reference ABI demo and CLI build expose evidence files', () => {
  const demo = runTypedReferenceAbiDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.referenceCount, 2);
  assert.equal(demo.marked, 4);

  const cwd = new URL('..', import.meta.url);
  const cliDemo = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-reference-demo'], { cwd, encoding: 'utf8' }));
  assert.equal(cliDemo.ok, true);
  assert.equal(cliDemo.rootReferenceCount, 2);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-reference-cli-'));
  writeReferenceFiles(dir);
  const cliBuild = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-reference-build', path.join(dir, 'src/app.rcl'), path.join(dir, 'types'), path.join(dir, 'out')], { cwd, encoding: 'utf8' }));
  assert.equal(cliBuild.ok, true);
  assert.equal(cliBuild.referenceCount, 2);
  assert.equal(fs.existsSync(cliBuild.bytecodePath), true);
  assert.equal(fs.existsSync(cliBuild.reportPath), true);
});
