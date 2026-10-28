import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initPackageEcosystem, buildReleaseBundle, verifyReleaseBundle } from '../src/package-ecosystem-runtime.mjs';
let directory, baseline, releaseRoot;
test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-release-integrity-'));
  const project = path.join(directory, 'project');
  initPackageEcosystem(fileURLToPath(new URL('../examples/hello-reality.rcl', import.meta.url)), project);
  baseline = path.join(directory, 'baseline');
  const built = await buildReleaseBundle(project, baseline);
  assert.equal(built.ok, true); releaseRoot = built.root;
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
function copy(name) { const target = path.join(directory, name); fs.cpSync(baseline, target, { recursive: true }); return target; }
function changeJson(dir, name, mutate) {
  const file = path.join(dir, name), value = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(value); fs.writeFileSync(file, JSON.stringify(value));
}

test('valid release binds cached source and all metadata without publisher-authentication claims', () => {
  const verified = verifyReleaseBundle(baseline, { expectedReleaseRoot: releaseRoot });
  assert.equal(verified.ok, true, JSON.stringify(verified.diagnostics));
  assert.equal(verified.publisherAuthenticationVerified, false);
  assert.equal(verified.externalReleaseAnchorChecked, true);
});

for (const [name, file, mutate] of [
  ['lock metadata', 'rcl.lock.json', value => { value.roots.programRoot = '0'.repeat(64); }],
  ['cache index', '.rcl-cache/cache-index.json', value => { value.lockRoot = '0'.repeat(64); }],
  ['target matrix', 'targets/target-matrix.json', value => { value.platforms[0].packageRoot = '0'.repeat(64); }],
  ['compatibility', 'compatibility-report.json', value => { value.ok = false; }],
  ['sbom', 'sbom.json', value => { value.fileCount += 1; }],
  ['signature metadata', 'release-signature.json', value => { value.payloadRoot = '0'.repeat(64); }],
]) {
  test(`release verification rejects changed ${name}`, () => {
    const target = copy(name.replaceAll(' ', '-')); changeJson(target, file, mutate);
    const verified = verifyReleaseBundle(target);
    assert.equal(verified.ok, false, name);
    assert.ok(verified.diagnostics.length > 0);
  });
}

test('cache object corruption and unlisted release files are rejected', () => {
  const target = copy('cache-corruption');
  const index = JSON.parse(fs.readFileSync(path.join(target, '.rcl-cache/cache-index.json')));
  fs.appendFileSync(path.join(target, '.rcl-cache', index.objects[0].object), 'corrupt');
  assert.equal(verifyReleaseBundle(target).ok, false);
  const extra = copy('extra-file'); fs.writeFileSync(path.join(extra, 'unlisted.txt'), 'extra');
  assert.equal(verifyReleaseBundle(extra).ok, false);
});

test('missing or malformed metadata produces a rejected report', () => {
  for (const file of ['rcl.lock.json', '.rcl-cache/cache-index.json', 'targets/target-matrix.json', 'compatibility-report.json', 'sbom.json', 'release-signature.json']) {
    const target = copy('malformed-' + file.replaceAll('/', '-'));
    fs.writeFileSync(path.join(target, file), '{');
    assert.equal(verifyReleaseBundle(target).ok, false, file);
    fs.unlinkSync(path.join(target, file));
    assert.equal(verifyReleaseBundle(target).ok, false, file);
  }
});

test('external release pins and CLI exit status reject corrupt bundles', () => {
  assert.equal(verifyReleaseBundle(baseline, { expectedReleaseRoot: '0'.repeat(64) }).ok, false);
  const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, 'package-release-verify', ...args], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(run([baseline, '--expected-release-root', releaseRoot]).status, 0);
  assert.equal(run([baseline, '--expected-release-root', '0'.repeat(64)]).status, 1);
  assert.equal(run([baseline, '--unknown']).status, 1);
});

test('release validation rejects symbolic file-tree entries', () => {
  const target = copy('junction'), outside = path.join(directory, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(target, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(verifyReleaseBundle(target).ok, false);
});
