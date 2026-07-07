import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_PACKAGE_ECOSYSTEM_VERSION,
  RCL_PACKAGE_ECOSYSTEM_MANIFEST_FORMAT,
  RCL_PACKAGE_ECOSYSTEM_LOCK_FORMAT,
  RCL_CONTENT_ADDRESSED_CACHE_FORMAT,
  RCL_RELEASE_BUNDLE_FORMAT,
  renderRclToml,
  parseRclToml,
  satisfiesSemanticVersion,
  initPackageEcosystem,
  buildPackageLock,
  verifyPackageLock,
  populateContentAddressedCache,
  buildTargetMatrix,
  buildReleaseBundle,
  verifyReleaseBundle,
  runPackageEcosystemDemo,
} from '../src/index.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const helloSource = fileURLToPath(new URL('../examples/hello-reality.rcl', import.meta.url));

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

function initTempProject(name = 'package-ecosystem') {
  const dir = tempDir(name);
  const report = initPackageEcosystem(helloSource, dir, { name: 'rcl.firstlight.test' });
  assert.match(report.root, /^[0-9a-f]{64}$/);
  return dir;
}

test('v0.42 renders and parses rcl.toml package manifest with target and dependency sections', () => {
  const toml = renderRclToml();
  assert.match(toml, /format = "rcl\.package-ecosystem\.manifest\.v0\.42"/);
  assert.match(toml, /\[targets\]/);
  const parsed = parseRclToml(toml);
  assert.equal(parsed.format, RCL_PACKAGE_ECOSYSTEM_MANIFEST_FORMAT);
  assert.equal(parsed.package.name, 'rcl.firstlight.package');
  assert.equal(parsed.dependencies.rcl_core.source, 'local');
  assert.equal(parsed.dependencies.rcl_provider_abi.source, 'remote');
  assert.equal(parsed.targets.android, 'android-debug-apk');
});

test('v0.42 semantic version compatibility supports exact, caret and bounded ranges', () => {
  assert.equal(satisfiesSemanticVersion('0.42.0-alpha.1', '0.42.0-alpha.1'), true);
  assert.equal(satisfiesSemanticVersion('0.42.1', '^0.42.0'), true);
  assert.equal(satisfiesSemanticVersion('0.43.0', '^0.42.0'), false);
  assert.equal(satisfiesSemanticVersion('0.25.0', '>=0.25.0 <1.0.0'), true);
  assert.equal(satisfiesSemanticVersion('1.0.0', '>=0.25.0 <1.0.0'), false);
});

test('v0.42 package init writes rcl.toml and deterministic source project scaffold', () => {
  const dir = initTempProject('ecosystem-init');
  assert.equal(fs.existsSync(path.join(dir, 'rcl.toml')), true);
  assert.equal(fs.existsSync(path.join(dir, 'src', 'app.rcl')), true);
  assert.equal(fs.existsSync(path.join(dir, 'README.md')), true);
  const source = fs.readFileSync(path.join(dir, 'src', 'app.rcl'), 'utf8');
  assert.match(source, /reality FirstLight/);
});

test('v0.42 package lock records source root, local dependency, remote pinned dependency and four targets', () => {
  const dir = initTempProject('ecosystem-lock');
  const result = buildPackageLock(dir);
  assert.equal(result.ok, true);
  assert.equal(result.lock.format, RCL_PACKAGE_ECOSYSTEM_LOCK_FORMAT);
  assert.equal(result.lock.version, RCL_PACKAGE_ECOSYSTEM_VERSION);
  assert.match(result.lock.lockRoot, /^[0-9a-f]{64}$/);
  assert.equal(fs.existsSync(path.join(dir, 'rcl.lock.json')), true);
  assert.equal(result.lock.targets.linux, 'native-rbc');
  assert.equal(result.lock.targets.windows, 'node-cli');
  assert.equal(result.lock.targets.android, 'android-debug-apk');
  assert.equal(result.lock.targets.web, 'web-static');
  assert.ok(result.lock.dependencies.some(item => item.source === 'local' && item.sha256));
  assert.ok(result.lock.dependencies.some(item => item.source === 'remote' && item.offlinePinned === true));
});

test('v0.42 package lock verification detects source drift', () => {
  const dir = initTempProject('ecosystem-drift');
  const locked = buildPackageLock(dir);
  assert.equal(locked.ok, true);
  assert.equal(verifyPackageLock(dir).ok, true);
  fs.appendFileSync(path.join(dir, 'src', 'app.rcl'), '\n# drift\n');
  const drift = verifyPackageLock(dir);
  assert.equal(drift.ok, false);
  assert.ok(drift.diagnostics.some(item => item.code === 'RCL_PACKAGE_LOCK_MISMATCH'));
});

test('v0.42 content addressed cache stores package files by sha256 object path', () => {
  const dir = initTempProject('ecosystem-cache');
  buildPackageLock(dir);
  const cache = populateContentAddressedCache(dir);
  assert.equal(cache.ok, true);
  assert.equal(cache.index.format, RCL_CONTENT_ADDRESSED_CACHE_FORMAT);
  assert.ok(cache.index.objectCount >= 3);
  for (const object of cache.index.objects) {
    assert.equal(fs.existsSync(path.join(cache.cacheDir, object.object)), true, object.path);
    assert.match(object.sha256, /^[0-9a-f]{64}$/);
  }
});

test('v0.42 target matrix builds verified Linux Windows Android Web release targets', async () => {
  const dir = initTempProject('ecosystem-matrix');
  const matrix = await buildTargetMatrix(dir, path.join(dir, 'release-targets'));
  assert.equal(matrix.ok, true);
  assert.equal(matrix.matrix.format, 'rcl.target-matrix.v0.42');
  assert.deepEqual(matrix.matrix.platforms.map(item => item.platform), ['linux', 'windows', 'android', 'web']);
  assert.equal(matrix.matrix.platforms.every(item => item.status === 'verified'), true);
  assert.equal(fs.existsSync(path.join(dir, 'release-targets', 'target-matrix.json')), true);
});

test('v0.42 release bundle writes signed manifest, sbom, compatibility report and verifies', async () => {
  const dir = initTempProject('ecosystem-release');
  const out = path.join(dir, 'release-bundle');
  const release = await buildReleaseBundle(dir, out);
  assert.equal(release.ok, true);
  assert.equal(release.releaseManifest.format, RCL_RELEASE_BUNDLE_FORMAT);
  assert.equal(fs.existsSync(path.join(out, 'release-manifest.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'release-signature.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'sbom.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'compatibility-report.json')), true);
  assert.equal(fs.existsSync(path.join(out, '.rcl-cache', 'cache-index.json')), true);
  assert.equal(verifyReleaseBundle(out).ok, true);
});

test('v0.42 release bundle root is reproducible across different output directories', async () => {
  const dirA = initTempProject('ecosystem-repro-a');
  const dirB = initTempProject('ecosystem-repro-b');
  const releaseA = await buildReleaseBundle(dirA, path.join(dirA, 'release-a'));
  const releaseB = await buildReleaseBundle(dirB, path.join(dirB, 'release-b'));
  assert.equal(releaseA.ok, true);
  assert.equal(releaseB.ok, true);
  assert.equal(releaseA.root, releaseB.root);
});

test('v0.42 CLI exposes ecosystem demo, init, lock, cache, release and release verification', () => {
  const dir = tempDir('ecosystem-cli');
  const initOut = execFileSync('node', ['src/cli.mjs', 'package-ecosystem-init', 'examples/hello-reality.rcl', dir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(initOut).entry, 'src/app.rcl');

  const lockOut = execFileSync('node', ['src/cli.mjs', 'package-lock', dir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(lockOut).ok, true);

  const cacheOut = execFileSync('node', ['src/cli.mjs', 'package-cache', dir, path.join(dir, 'cache')], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(cacheOut).ok, true);

  const releaseDir = path.join(dir, 'release');
  const releaseOut = execFileSync('node', ['src/cli.mjs', 'package-release', dir, releaseDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(releaseOut).ok, true);

  const verifyOut = execFileSync('node', ['src/cli.mjs', 'package-release-verify', releaseDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(verifyOut).ok, true);

  const demoOut = execFileSync('node', ['src/cli.mjs', 'package-ecosystem-demo'], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(demoOut).ok, true);
});
