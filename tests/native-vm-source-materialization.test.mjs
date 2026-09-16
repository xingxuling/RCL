import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  defaultNativeVmPath,
  materializeNativeVm,
  RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
} from '../src/native-vm-materialization.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-materialization-test-'));
  const nativeDir = path.join(root, 'native');
  fs.mkdirSync(nativeDir, { recursive: true });
  fs.writeFileSync(path.join(nativeDir, 'Makefile'), 'rclvm:\n\t@true\n');
  fs.writeFileSync(path.join(nativeDir, 'rclvm.c'), 'int main(void){return 0;}\n');
  fs.writeFileSync(path.join(nativeDir, 'rclvm.h'), '#define RCLVM_TEST 1\n');
  return { root, nativeDir, vmPath: defaultNativeVmPath(root, 'linux') };
}

function clean(item) { fs.rmSync(item.root, { recursive: true, force: true }); }

test('existing canonical binary wins without invoking build', () => {
  const item = fixture();
  try {
    fs.writeFileSync(item.vmPath, 'already-built');
    let calls = 0;
    const result = materializeNativeVm(item.root, {
      platform: 'linux',
      spawnSyncImpl() { calls += 1; return { status: 0, stdout: '', stderr: '' }; },
    });
    assert.equal(calls, 0);
    assert.equal(result.built, false);
    assert.equal(result.provenance, 'bundled-or-prebuilt-binary');
    assert.equal(result.format, RCL_NATIVE_VM_MATERIALIZATION_FORMAT);
  } finally { clean(item); }
});

test('missing default Linux binary is materialized through the repository Makefile target', () => {
  const item = fixture();
  try {
    let invocation = null;
    const result = materializeNativeVm(item.root, {
      platform: 'linux',
      makePath: 'make-test',
      spawnSyncImpl(command, args, options) {
        invocation = { command, args, options };
        fs.writeFileSync(item.vmPath, 'built-from-source');
        return { status: 0, stdout: 'ok', stderr: '' };
      },
    });
    assert.equal(result.built, true);
    assert.equal(result.provenance, 'repository-source-makefile');
    assert.equal(invocation.command, 'make-test');
    assert.deepEqual(invocation.args, ['-C', item.nativeDir, 'rclvm']);
    assert.equal(invocation.options.cwd, item.root);
    assert.equal(fs.readFileSync(item.vmPath, 'utf8'), 'built-from-source');
  } finally { clean(item); }
});

test('explicit missing binary remains fail-closed and is never replaced by an implicit build', () => {
  const item = fixture();
  try {
    let calls = 0;
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      vmPath: path.join(item.root, 'custom', 'rclvm'),
      spawnSyncImpl() { calls += 1; return { status: 0, stdout: '', stderr: '' }; },
    }), error => error?.code === 'RCL_NATIVE_VM_MISSING' && error?.details?.explicitPath === true);
    assert.equal(calls, 0);
  } finally { clean(item); }
});

test('failed source build is fail-closed with build evidence', () => {
  const item = fixture();
  try {
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      spawnSyncImpl() { return { status: 2, stdout: 'compile-output', stderr: 'compile-error' }; },
    }), error => error?.code === 'RCL_NATIVE_VM_BUILD_FAILED'
      && error?.details?.buildAttempted === true
      && error?.details?.stderr === 'compile-error');
    assert.equal(fs.existsSync(item.vmPath), false);
  } finally { clean(item); }
});

test('missing source inputs cannot be mistaken for a successful materialization', () => {
  const item = fixture();
  try {
    fs.rmSync(path.join(item.nativeDir, 'rclvm.h'));
    assert.throws(() => materializeNativeVm(item.root, { platform: 'linux' }), error =>
      error?.code === 'RCL_NATIVE_VM_SOURCE_MISSING' && error?.details?.buildAttempted === false);
  } finally { clean(item); }
});
