import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { realityRoot } from '../src/canonical.mjs';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { packageRclSource, verifyRclPackage } from '../src/package-compiler.mjs';
import { initPackageEcosystem, buildReleaseBundle, verifyReleaseBundle } from '../src/package-ecosystem-runtime.mjs';

let directory, baseline, bundle;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-package-manifest-'));
  const fixture = fileURLToPath(new URL('../examples/hello-reality.rcl', import.meta.url));
  baseline = path.join(directory, 'package');
  await packageRclSource(fixture, { target: 'native-rbc', outputDir: baseline });
  const project = path.join(directory, 'project'); initPackageEcosystem(fixture, project);
  bundle = path.join(directory, 'bundle'); await buildReleaseBundle(project, bundle);
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
function copy(name, from = baseline) { const target = path.join(directory, name); fs.cpSync(from, target, { recursive: true }); return target; }
function rewrite(target, mutate, reroot = false) {
  const file = path.join(target, 'rcl-package.json'), manifest = JSON.parse(fs.readFileSync(file));
  mutate(manifest);
  if (reroot) {
    if (manifest.inventoryProfile) {
      const { root, semanticRoot, sourcePath, outputDir, ...base } = manifest;
      if (base.android) { base.android = { ...base.android }; delete base.android.buildReport; }
      manifest.semanticRoot = realityRoot(base);
    }
    manifest.root = realityRoot({ ...manifest, root: undefined });
  }
  fs.writeFileSync(file, JSON.stringify(manifest));
  return manifest;
}

test('new package binds README and complete payload with an independently pinable manifest root', () => {
  const verified = verifyRclPackage(baseline);
  assert.equal(verified.status, 'verified');
  assert.equal(verified.inventoryProfile, 'complete-payload-v1');
  assert.deepEqual(verified.unboundFiles, ['rcl-package-report.json']);
  assert.equal(verified.publisherAuthenticationVerified, false);
  assert.equal(verifyRclPackage(baseline, { expectedManifestRoot: verified.manifestRoot }).status, 'verified');
  assert.equal(verifyRclPackage(baseline, { expectedManifestRoot: '0'.repeat(64) }).status, 'rejected');
});

test('manifest edits, empty self-consistent inventories and source identity claims reject', () => {
  for (const [name, mutate, reroot] of [
    ['entrypoint', value => { value.entrypoints = ['unexpected-command']; }, false],
    ['empty', value => { value.files = []; value.fileCount = 0; }, true],
    ['source-claim', value => { value.sourceSha256 = '0'.repeat(64); }, true],
    ['count', value => { value.fileCount += 1; }, true],
    ['unsafe-path', value => { value.files[0].path = '../outside'; }, true],
    ['duplicate', value => { value.files[1].path = value.files[0].path.toUpperCase(); }, true],
  ]) {
    const target = copy(name); rewrite(target, mutate, reroot);
    assert.equal(verifyRclPackage(target).status, 'rejected', name);
  }
});

test('fresh bytecode with internally consistent file hashes cannot replace the declared source program', () => {
  const target = copy('foreign-bytecode'), bytes = compileRealityToBytecode('reality Other { facet value : Number = 7 }');
  fs.writeFileSync(path.join(target, 'program.rbc'), bytes);
  rewrite(target, manifest => {
    manifest.bytecodeSha256 = hash(bytes);
    const item = manifest.files.find(file => file.path === 'program.rbc'); item.sha256 = hash(bytes); item.bytes = bytes.length;
  }, true);
  assert.ok(verifyRclPackage(target).diagnostics.some(item => item.code === 'RCL_PACKAGE_SOURCE_BYTECODE_MISMATCH'));
});

test('new README and unlisted payload changes reject while documented diagnostics remain unbound', () => {
  const readme = copy('readme'); fs.appendFileSync(path.join(readme, 'README.md'), 'changed');
  assert.equal(verifyRclPackage(readme).status, 'rejected');
  const extra = copy('unlisted'); fs.writeFileSync(path.join(extra, 'extra.txt'), 'changed');
  assert.equal(verifyRclPackage(extra).status, 'rejected');
  const diagnostic = copy('diagnostic'); fs.writeFileSync(path.join(diagnostic, 'rcl-package-report.json'), 'runtime diagnostic');
  assert.equal(verifyRclPackage(diagnostic).status, 'verified');
});

test('legacy v0.24 inventory has explicit unbound README status and no semantic-manifest claim', () => {
  const legacy = copy('legacy');
  rewrite(legacy, manifest => {
    delete manifest.inventoryProfile; delete manifest.semanticRoot;
    manifest.files = manifest.files.filter(file => file.path !== 'README.md'); manifest.fileCount = manifest.files.length;
  }, true);
  const verified = verifyRclPackage(legacy);
  assert.equal(verified.status, 'verified'); assert.equal(verified.inventoryProfile, 'legacy-readme-unbound');
  assert.equal(verified.semanticManifestRoot, null); assert.ok(verified.unboundFiles.includes('README.md'));
});

test('malformed manifests and symbolic entries produce rejected reports', () => {
  const invalid = copy('malformed'); fs.writeFileSync(path.join(invalid, 'rcl-package.json'), '{');
  assert.equal(verifyRclPackage(invalid).status, 'rejected');
  const linked = copy('linked'), outside = path.join(directory, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(linked, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(verifyRclPackage(linked).status, 'rejected');
});

test('release binds semantic metadata for every target, including unselected RCLApp packages', () => {
  assert.equal(verifyReleaseBundle(bundle).targetManifestBindingVerified, true);
  const target = copy('changed-bundle', bundle), app = path.join(target, 'targets/rclapp');
  rewrite(app, manifest => { manifest.entrypoints = ['unexpected-command']; }, true);
  assert.equal(verifyRclPackage(app).status, 'verified', 'Internal hashes establish consistency, not publisher identity');
  assert.ok(verifyReleaseBundle(target).diagnostics.some(item => item.code === 'RCL_RELEASE_TARGET_MANIFEST_MISMATCH'));
  const moved = copy('moved-bundle', bundle), native = path.join(moved, 'targets/native-rbc');
  rewrite(native, manifest => { manifest.outputDir = '/informational/relocation'; manifest.sourcePath = '/informational/source'; }, true);
  assert.equal(verifyReleaseBundle(moved).ok, true, 'Machine paths do not change the bound semantic metadata');
});

test('public package verifier enforces manifest pins and nonzero failure exits', () => {
  const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, 'package-verify', ...args], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(run([baseline, '--expected-manifest-root', verifyRclPackage(baseline).manifestRoot]).status, 0);
  assert.equal(run([baseline, '--expected-manifest-root', '0'.repeat(64)]).status, 1);
  assert.equal(run([baseline, '--unknown']).status, 1);
});
