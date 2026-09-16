import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { materializeNativeVm } from '../src/native-vm-materialization.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-makeless-test-'));
  const nativeDir = path.join(root, 'native');
  const cacheRoot = path.join(root, '.cache');
  fs.mkdirSync(nativeDir, { recursive: true });
  fs.writeFileSync(path.join(nativeDir, 'Makefile'), 'rclvm:\n\t@true\n');
  fs.writeFileSync(path.join(nativeDir, 'rclvm.c'), '#include "rclvm.h"\nint main(void){return 0;}\n');
  fs.writeFileSync(path.join(nativeDir, 'rclvm.h'), '#define RCLVM_TEST 1\n');
  return { root, cacheRoot };
}

function clean(item) { fs.rmSync(item.root, { recursive: true, force: true }); }

test('missing make falls back to direct C compiler without weakening source closure', () => {
  const item = fixture();
  try {
    const invocations = [];
    const result = materializeNativeVm(item.root, {
      platform: 'linux',
      arch: 'fallback-arch',
      cacheRoot: item.cacheRoot,
      makePath: 'missing-make',
      compilerPath: 'cc-test',
      spawnSyncImpl(command, args, options) {
        invocations.push({ command, args, options });
        if (command === 'missing-make') {
          return { error: Object.assign(new Error('spawn missing-make ENOENT'), { code: 'ENOENT' }), status: null, stdout: '', stderr: '' };
        }
        assert.equal(command, 'cc-test');
        assert.equal(options.cwd.startsWith(item.cacheRoot), true);
        const outputIndex = args.indexOf('-o');
        assert.notEqual(outputIndex, -1);
        fs.writeFileSync(args[outputIndex + 1], 'direct-compiler-built');
        return { status: 0, stdout: 'cc-ok', stderr: '' };
      },
    });
    assert.deepEqual(invocations.map(entry => entry.command), ['missing-make', 'cc-test']);
    assert.equal(result.built, true);
    assert.equal(result.provenance, 'staged-repository-source-direct-compiler');
    assert.equal(result.build.method, 'direct-c-compiler');
    assert.equal(result.build.tool, 'cc-test');
    assert.equal(result.build.fallbackFrom.tool, 'missing-make');
    assert.equal(result.build.fallbackFrom.errorCode, 'ENOENT');
    assert.equal(fs.readFileSync(result.vmPath, 'utf8'), 'direct-compiler-built');
  } finally { clean(item); }
});

test('missing make and missing direct compiler fail closed with both tool identities', () => {
  const item = fixture();
  try {
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      makePath: 'missing-make',
      compilerPath: 'missing-cc',
      spawnSyncImpl(command) {
        return { error: Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' }), status: null, stdout: '', stderr: '' };
      },
    }), error => error?.code === 'RCL_NATIVE_VM_BUILD_TOOL'
      && error?.details?.buildMethod === 'direct-c-compiler'
      && error?.details?.buildTool === 'missing-cc'
      && error?.details?.fallbackFrom?.tool === 'missing-make'
      && error?.details?.fallbackFrom?.errorCode === 'ENOENT');
  } finally { clean(item); }
});

test('real direct compiler fallback can build staged fixture when make is unavailable', () => {
  const item = fixture();
  try {
    const result = materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      makePath: path.join(item.root, 'definitely-missing-make'),
      compilerPath: process.env.CC ?? 'cc',
    });
    assert.equal(result.built, true);
    assert.equal(result.build.method, 'direct-c-compiler');
    assert.equal(result.provenance, 'staged-repository-source-direct-compiler');
    assert.equal(fs.existsSync(result.vmPath), true);
  } finally { clean(item); }
});
