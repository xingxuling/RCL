import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { realityRoot } from '../src/canonical.mjs';
import { initPackageEcosystem, buildPackageLock, verifyPackageLock, populateContentAddressedCache, verifyContentAddressedCache, materializeContentAddressedCache } from '../src/package-ecosystem-runtime.mjs';

const fixture = fileURLToPath(new URL('../examples/hello-reality.rcl', import.meta.url));
const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cache-materialize-')), project = path.join(root, 'project'), cache = path.join(root, 'cache');
  initPackageEcosystem(fixture, project);
  fs.writeFileSync(path.join(project, 'duplicate.txt'), fs.readFileSync(path.join(project, 'README.md')));
  const populated = populateContentAddressedCache(project, cache);
  assert.equal(populated.ok, true);
  return { root, project, cache, index: populated.index, out: path.join(root, 'restored') };
}
const cleanup = env => fs.rmSync(env.root, { recursive: true, force: true });
function changeIndex(env, change) {
  const index = structuredClone(env.index); change(index);
  const { cacheRoot, ...base } = index; index.cacheRoot = realityRoot(base);
  fs.writeFileSync(path.join(env.cache, 'cache-index.json'), JSON.stringify(index));
}

test('verified cache restores original package bytes and exact lock without network access', () => {
  const env = setup();
  try {
    const verified = verifyContentAddressedCache(env.cache, { expectedCacheRoot: env.index.cacheRoot });
    assert.equal(verified.ok, true);
    assert.equal(verified.uniqueObjectCount, verified.fileCount - 1);
    const restored = materializeContentAddressedCache(env.cache, env.out, { expectedCacheRoot: env.index.cacheRoot, expectedLockRoot: env.index.lockRoot });
    assert.equal(restored.ok, true);
    assert.equal(restored.networkAccess, false);
    assert.equal(restored.lockRoot, buildPackageLock(env.project, { write: false }).root);
    assert.equal(verifyPackageLock(env.out).ok, true);
    for (const file of env.index.objects) assert.deepEqual(fs.readFileSync(path.join(env.project, file.path)), fs.readFileSync(path.join(env.out, file.path)));
  } finally { cleanup(env); }
});

test('invalid source lock does not publish a cache index or successful CLI result', () => {
  const env = setup();
  try {
    fs.writeFileSync(path.join(env.project, 'src/app.rcl'), 'invalid');
    const absent = path.join(env.root, 'absent');
    const failed = populateContentAddressedCache(env.project, absent);
    assert.equal(failed.ok, false);
    assert.equal(fs.existsSync(absent), false);
    const result = spawnSync(process.execPath, [cli, 'package-cache', env.project, absent], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).ok, false);
  } finally { cleanup(env); }
});

test('default cache can be repopulated without feeding cached objects into the package lock', () => {
  const env = setup();
  try {
    const first = populateContentAddressedCache(env.project), second = populateContentAddressedCache(env.project);
    assert.equal(first.index.cacheRoot, second.index.cacheRoot);
    assert.equal(first.index.lockRoot, second.index.lockRoot);
    const nested = path.join(env.project, 'unexcluded-cache');
    assert.throws(() => populateContentAddressedCache(env.project, nested), /RCL_CACHE_DIRECTORY_IN_PROJECT/);
    assert.equal(fs.existsSync(nested), false);
  } finally { cleanup(env); }
});

test('corrupt objects and indexes fail before a destination is created', () => {
  const env = setup();
  try {
    const object = path.join(env.cache, env.index.objects[0].object);
    fs.appendFileSync(object, 'corrupt');
    assert.equal(verifyContentAddressedCache(env.cache).ok, false);
    assert.equal(materializeContentAddressedCache(env.cache, env.out).ok, false);
    assert.equal(fs.existsSync(env.out), false);
    assert.throws(() => populateContentAddressedCache(env.project, env.cache), /RCL_CACHE_OBJECT_MISMATCH/);
    assert.ok(fs.readFileSync(object, 'utf8').endsWith('corrupt'));
    fs.writeFileSync(path.join(env.cache, 'cache-index.json'), '{');
    assert.equal(materializeContentAddressedCache(env.cache, env.out).ok, false);
  } finally { cleanup(env); }
});

test('trusted cache/lock roots are checked before materialization', () => {
  const env = setup();
  try {
    for (const options of [{ expectedCacheRoot: '0'.repeat(64) }, { expectedLockRoot: '0'.repeat(64) }]) {
      assert.equal(materializeContentAddressedCache(env.cache, env.out, options).ok, false);
      assert.equal(fs.existsSync(env.out), false);
    }
  } finally { cleanup(env); }
});

test('hostile portable paths, object paths and aliases reject even with recomputed index roots', () => {
  const env = setup();
  try {
    for (const name of ['../escape', '/absolute', 'C:/absolute', 'a\\b', 'a/./b', 'a//b', 'NUL.txt', 'file:stream', 'trailing.']) {
      changeIndex(env, index => { index.objects[0].path = name; });
      assert.equal(materializeContentAddressedCache(env.cache, env.out).ok, false, name);
      assert.equal(fs.existsSync(env.out), false);
    }
    for (const modify of [
      index => { index.objects[0].object = '../outside'; },
      index => { index.objects[1].path = index.objects[0].path.toUpperCase(); },
      index => { index.objects[0].path = 'a'; index.objects[1].path = 'a/b'; },
    ]) {
      changeIndex(env, modify);
      assert.equal(materializeContentAddressedCache(env.cache, env.out).ok, false);
      assert.equal(fs.existsSync(env.out), false);
    }
  } finally { cleanup(env); }
});

test('a self-consistent cache index cannot assert a different materialized package lock', () => {
  const env = setup();
  try {
    changeIndex(env, index => { index.lockRoot = '0'.repeat(64); });
    assert.equal(verifyContentAddressedCache(env.cache).ok, true, 'File integrity is distinct from source recompilation');
    const restored = materializeContentAddressedCache(env.cache, env.out);
    assert.equal(restored.ok, false);
    assert.equal(restored.diagnostics[0].code, 'RCL_CACHE_MATERIALIZED_LOCK_MISMATCH');
    assert.equal(fs.existsSync(path.join(env.out, 'rcl.lock.json')), false);
  } finally { cleanup(env); }
});

test('existing destination remains intact and directory junctions cannot redirect CAS writes', () => {
  const env = setup();
  try {
    fs.mkdirSync(env.out); fs.writeFileSync(path.join(env.out, 'keep'), 'original');
    assert.throws(() => materializeContentAddressedCache(env.cache, env.out), /RCL_CACHE_DESTINATION_EXISTS/);
    assert.equal(fs.readFileSync(path.join(env.out, 'keep'), 'utf8'), 'original');
    const redirected = path.join(env.root, 'redirected'), external = path.join(env.root, 'external');
    fs.mkdirSync(redirected); fs.mkdirSync(external);
    fs.symlinkSync(external, path.join(redirected, 'objects'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => populateContentAddressedCache(env.project, redirected), /RCL_CACHE_DIRECTORY_INVALID/);
    assert.deepEqual(fs.readdirSync(external), []);
  } finally { cleanup(env); }
});

test('CLI verifies and restores with trusted roots and rejects malformed flags before writes', () => {
  const env = setup();
  try {
    const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    const verified = run(['package-cache-verify', env.cache, '--expected-cache-root', env.index.cacheRoot]);
    assert.equal(verified.status, 0, verified.stderr); assert.equal(JSON.parse(verified.stdout).ok, true);
    for (const flags of [['--unknown'], ['--expected-cache-root', 'bad'], ['--expected-lock-root', '0'.repeat(64), '--expected-lock-root', '0'.repeat(64)]]) {
      assert.equal(run(['package-cache-materialize', env.cache, env.out, ...flags]).status, 1);
      assert.equal(fs.existsSync(env.out), false);
    }
    const restored = run(['package-cache-materialize', env.cache, env.out, '--expected-cache-root', env.index.cacheRoot]);
    assert.equal(restored.status, 0, restored.stderr); assert.equal(JSON.parse(restored.stdout).ok, true);
    assert.equal(verifyPackageLock(env.out).ok, true);
  } finally { cleanup(env); }
});
