import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  RCL_NATIVE_VM_CANONICAL_HEADER,
  RCL_NATIVE_VM_CANONICAL_MAKEFILE,
} from '../src/native-vm-canonical-build-support.mjs';
import {
  defaultNativeVmPath,
  materializeNativeVm,
  RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
} from '../src/native-vm-materialization.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function fixture({ canonicalSupport = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-materialization-test-'));
  const nativeDir = path.join(root, 'native');
  const cacheRoot = path.join(root, '.cache');
  fs.mkdirSync(nativeDir, { recursive: true });
  fs.writeFileSync(
    path.join(nativeDir, 'Makefile'),
    canonicalSupport ? RCL_NATIVE_VM_CANONICAL_MAKEFILE : 'rclvm:\n\t@true\n',
  );
  fs.writeFileSync(path.join(nativeDir, 'rclvm.c'), '#include "rclvm.h"\nint main(void){return 0;}\n');
  fs.writeFileSync(
    path.join(nativeDir, 'rclvm.h'),
    canonicalSupport ? RCL_NATIVE_VM_CANONICAL_HEADER : '#define RCLVM_TEST 1\n',
  );
  return { root, nativeDir, cacheRoot, vmPath: defaultNativeVmPath(root, 'linux') };
}

function clean(item) { fs.rmSync(item.root, { recursive: true, force: true }); }

function successfulMockBuild(invocations = []) {
  return (command, args, options) => {
    invocations.push({ command, args, options });
    const stageDir = args[1];
    fs.writeFileSync(path.join(stageDir, 'rclvm'), 'built-from-source');
    return { status: 0, stdout: 'ok', stderr: '' };
  };
}

function missingTool(name = 'make-test') {
  const error = new Error(`spawnSync ${name} ENOENT`);
  error.code = 'ENOENT';
  return { status: null, signal: null, stdout: '', stderr: '', error };
}

test('embedded canonical build support stays byte-identical to repository Makefile and rclvm.h', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, 'native', 'Makefile'), 'utf8'), RCL_NATIVE_VM_CANONICAL_MAKEFILE);
  assert.equal(fs.readFileSync(path.join(ROOT, 'native', 'rclvm.h'), 'utf8'), RCL_NATIVE_VM_CANONICAL_HEADER);
});

test('existing canonical binary wins without invoking build', () => {
  const item = fixture();
  try {
    fs.writeFileSync(item.vmPath, 'already-built');
    let calls = 0;
    const result = materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      spawnSyncImpl() { calls += 1; return { status: 0, stdout: '', stderr: '' }; },
    });
    assert.equal(calls, 0);
    assert.equal(result.built, false);
    assert.equal(result.cached, false);
    assert.equal(result.provenance, 'bundled-or-prebuilt-binary');
    assert.equal(result.format, RCL_NATIVE_VM_MATERIALIZATION_FORMAT);
  } finally { clean(item); }
});

test('missing default Linux binary is materialized in a writable staged cache', () => {
  const item = fixture();
  try {
    const invocations = [];
    const result = materializeNativeVm(item.root, {
      platform: 'linux',
      arch: 'test-arch',
      cacheRoot: item.cacheRoot,
      makePath: 'make-test',
      spawnSyncImpl: successfulMockBuild(invocations),
    });
    assert.equal(result.built, true);
    assert.equal(result.cached, false);
    assert.equal(result.provenance, 'staged-repository-source-makefile');
    assert.equal(result.build.strategy, 'makefile');
    assert.equal(invocations.length, 1);
    assert.equal(invocations[0].command, 'make-test');
    assert.equal(invocations[0].args[0], '-C');
    assert.equal(invocations[0].args[2], 'rclvm');
    assert.equal(invocations[0].options.cwd, item.root);
    assert.match(result.vmPath, /test-arch-/);
    assert.equal(fs.readFileSync(result.vmPath, 'utf8'), 'built-from-source');
    assert.equal(fs.existsSync(item.vmPath), false, 'source checkout must not be mutated by staged build');
  } finally { clean(item); }
});

test('missing packaged Makefile and header are restored from canonical embedded support before build', () => {
  const item = fixture({ canonicalSupport: true });
  try {
    fs.rmSync(path.join(item.nativeDir, 'Makefile'));
    fs.rmSync(path.join(item.nativeDir, 'rclvm.h'));
    let staged = null;
    const result = materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      spawnSyncImpl(command, args) {
        staged = args[1];
        assert.equal(fs.readFileSync(path.join(staged, 'Makefile'), 'utf8'), RCL_NATIVE_VM_CANONICAL_MAKEFILE);
        assert.equal(fs.readFileSync(path.join(staged, 'rclvm.h'), 'utf8'), RCL_NATIVE_VM_CANONICAL_HEADER);
        fs.writeFileSync(path.join(staged, 'rclvm'), 'fallback-built');
        return { status: 0, stdout: 'ok', stderr: '' };
      },
    });
    assert.equal(result.built, true);
    assert.equal(result.supportProvenance.makefile, 'embedded-canonical-support');
    assert.equal(result.supportProvenance.header, 'embedded-canonical-support');
    assert.equal(fs.readFileSync(result.vmPath, 'utf8'), 'fallback-built');
    assert.ok(staged?.startsWith(item.cacheRoot));
  } finally { clean(item); }
});

test('missing make falls back to a direct compiler only for canonical build support', () => {
  const item = fixture({ canonicalSupport: true });
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
        if (invocations.length === 1) return missingTool(command);
        assert.equal(command, 'cc-test');
        assert.equal(options.cwd.includes('fallback-arch-'), true);
        assert.deepEqual(args.slice(0, 5), ['-O2', '-std=c11', '-Wall', '-Wextra', '-Wpedantic']);
        assert.deepEqual(args.slice(-4), ['rclvm', 'rclvm.c', '-lcrypto', '-lm']);
        fs.writeFileSync(path.join(options.cwd, 'rclvm'), 'direct-compiler-binary');
        return { status: 0, stdout: 'compiled', stderr: '' };
      },
    });
    assert.equal(invocations.length, 2);
    assert.equal(result.built, true);
    assert.equal(result.cached, false);
    assert.equal(result.provenance, 'staged-repository-source-direct-compiler');
    assert.equal(result.build.strategy, 'direct-compiler');
    assert.equal(result.build.tool, 'cc-test');
    assert.equal(result.build.fallbackFrom.tool, 'missing-make');
    assert.equal(result.build.fallbackFrom.errorCode, 'ENOENT');
    assert.equal(fs.readFileSync(result.vmPath, 'utf8'), 'direct-compiler-binary');
  } finally { clean(item); }
});

test('custom repository Makefile refuses direct compiler fallback instead of changing build semantics', () => {
  const item = fixture();
  try {
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      makePath: 'missing-make',
      compilerPath: 'cc-test',
      spawnSyncImpl() { return missingTool('missing-make'); },
    }), error => error?.code === 'RCL_NATIVE_VM_BUILD_FALLBACK_UNSAFE'
      && error?.details?.primaryBuildFailure?.errorCode === 'ENOENT');
  } finally { clean(item); }
});

test('missing make and missing fallback compiler remain fail-closed with both tool attempts visible', () => {
  const item = fixture({ canonicalSupport: true });
  try {
    let calls = 0;
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      makePath: 'missing-make',
      compilerPath: 'missing-cc',
      spawnSyncImpl(command) { calls += 1; return missingTool(command); },
    }), error => error?.code === 'RCL_NATIVE_VM_BUILD_TOOL'
      && error?.details?.buildStrategy === 'direct-compiler'
      && error?.details?.buildTool === 'missing-cc'
      && error?.details?.primaryBuildFailure?.errorCode === 'ENOENT'
      && error?.details?.errorCode === 'ENOENT');
    assert.equal(calls, 2);
  } finally { clean(item); }
});

test('direct compiler fallback can be explicitly disabled', () => {
  const item = fixture({ canonicalSupport: true });
  try {
    let calls = 0;
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      makePath: 'missing-make',
      directCompilerFallback: false,
      spawnSyncImpl(command) { calls += 1; return missingTool(command); },
    }), error => error?.code === 'RCL_NATIVE_VM_BUILD_TOOL'
      && error?.details?.buildStrategy === 'makefile');
    assert.equal(calls, 1);
  } finally { clean(item); }
});

test('verified staged binary is reused without rebuilding', () => {
  const item = fixture();
  try {
    let calls = 0;
    const build = successfulMockBuild();
    const first = materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      spawnSyncImpl(...args) { calls += 1; return build(...args); },
    });
    const second = materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      spawnSyncImpl() { calls += 1; throw new Error('cache hit must not rebuild'); },
    });
    assert.equal(calls, 1);
    assert.equal(first.vmPath, second.vmPath);
    assert.equal(second.built, false);
    assert.equal(second.cached, true);
    assert.equal(second.provenance, 'staged-source-cache');
  } finally { clean(item); }
});

test('tampered staged binary cannot be trusted as cache and is rebuilt', () => {
  const item = fixture();
  try {
    let calls = 0;
    const first = materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      spawnSyncImpl(...args) { calls += 1; return successfulMockBuild()(...args); },
    });
    fs.writeFileSync(first.vmPath, 'tampered');
    const second = materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      spawnSyncImpl(...args) { calls += 1; return successfulMockBuild()(...args); },
    });
    assert.equal(calls, 2);
    assert.equal(second.built, true);
    assert.equal(fs.readFileSync(second.vmPath, 'utf8'), 'built-from-source');
  } finally { clean(item); }
});

test('explicit missing binary remains fail-closed and is never replaced by an implicit build', () => {
  const item = fixture();
  try {
    let calls = 0;
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      vmPath: path.join(item.root, 'custom', 'rclvm'),
      spawnSyncImpl() { calls += 1; return { status: 0, stdout: '', stderr: '' }; },
    }), error => error?.code === 'RCL_NATIVE_VM_MISSING' && error?.details?.explicitPath === true);
    assert.equal(calls, 0);
  } finally { clean(item); }
});

test('failed staged source build is fail-closed with build and support evidence', () => {
  const item = fixture();
  try {
    assert.throws(() => materializeNativeVm(item.root, {
      platform: 'linux',
      cacheRoot: item.cacheRoot,
      spawnSyncImpl() { return { status: 2, stdout: 'compile-output', stderr: 'compile-error' }; },
    }), error => error?.code === 'RCL_NATIVE_VM_BUILD_FAILED'
      && error?.details?.buildAttempted === true
      && error?.details?.buildStrategy === 'makefile'
      && error?.details?.stderr === 'compile-error'
      && typeof error?.details?.sourceRoot === 'string'
      && error?.details?.supportProvenance?.header === 'repository-source');
  } finally { clean(item); }
});

test('missing implementation source cannot be replaced by support fallback', () => {
  const item = fixture();
  try {
    fs.rmSync(path.join(item.nativeDir, 'rclvm.c'));
    assert.throws(() => materializeNativeVm(item.root, { platform: 'linux', cacheRoot: item.cacheRoot }), error =>
      error?.code === 'RCL_NATIVE_VM_SOURCE_MISSING'
      && error?.details?.missing?.some(entry => entry.endsWith('rclvm.c'))
      && error?.details?.buildAttempted === false);
  } finally { clean(item); }
});
