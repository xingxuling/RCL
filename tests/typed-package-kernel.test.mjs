import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compileTypedPackage,
  verifyTypedPackageLock,
  runTypedPackageDemo,
  RCL_TYPED_PACKAGE_LOCK_FORMAT,
} from '../src/index.mjs';

function writePackage(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'rcl.package.json'), JSON.stringify({
    format: 'rcl.typed-package.manifest.v0.32',
    name: 'firstlight.typed',
    version: '0.1.0',
    entry: 'src/app.rcl',
    types: ['types/core.rcltype'],
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'types/core.rcltype'), `module core
export record User<T> {
  id: Text
  payload: T
}
export union LoginResult<T,E> {
  Ok(T)
  Err(E)
}
`);
  fs.writeFileSync(path.join(dir, 'src/app.rcl'), `reality TypedPackageDemo {
  facet app.user : core.User<Text> = { id: "u-1", payload: "seed" }
  facet app.login : core.LoginResult<Text, Text> = Ok("accepted")
}
`);
}

test('P3 typed package build writes a reproducible lockfile with type and program roots', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-package-'));
  writePackage(dir);
  const result = compileTypedPackage(dir);
  assert.equal(result.ok, true);
  assert.equal(result.lock.format, RCL_TYPED_PACKAGE_LOCK_FORMAT);
  assert.equal(result.lock.package.name, 'firstlight.typed');
  assert.equal(result.lock.semantic.typedFacetCount, 2);
  assert.equal(result.lock.semantic.constructorCount, 2);
  assert.match(result.lock.lockRoot, /^[0-9a-f]{64}$/);
  assert.equal(fs.existsSync(path.join(dir, 'rcl.package.lock.json')), true);

  const lock = JSON.parse(fs.readFileSync(path.join(dir, 'rcl.package.lock.json'), 'utf8'));
  assert.equal(lock.lockRoot, result.lock.lockRoot);
  assert.equal(lock.roots.programRoot, result.programRoot);
  assert.ok(lock.files.some(item => item.path === 'types/core.rcltype' && item.role === 'type'));
});

test('P3 typed package verify detects source drift after lock generation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-package-drift-'));
  writePackage(dir);
  const build = compileTypedPackage(dir);
  assert.equal(build.ok, true);
  const verified = verifyTypedPackageLock(dir);
  assert.equal(verified.ok, true);

  fs.appendFileSync(path.join(dir, 'types/core.rcltype'), '\nexport alias MaybeUser = Option<User<Text>>\n');
  const drift = verifyTypedPackageLock(dir);
  assert.equal(drift.ok, false);
  assert.ok(drift.diagnostics.some(item => item.code === 'RCL_TYPED_PACKAGE_LOCK_MISMATCH'));
});

test('P3 typed package diagnostics reject unsafe or invalid manifests', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-package-bad-'));
  fs.writeFileSync(path.join(dir, 'rcl.package.json'), JSON.stringify({
    format: 'rcl.typed-package.manifest.v0.32',
    name: 'bad package name',
    version: 'draft',
    entry: '../escape.rcl',
    types: [],
  }, null, 2));
  const result = compileTypedPackage(dir);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_TYPED_PACKAGE_NAME_INVALID'));
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_TYPED_PACKAGE_VERSION_INVALID'));
});

test('P3 typed package demo and CLI expose build and verify reports', () => {
  const demo = runTypedPackageDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.typedFacetCount, 2);
  assert.equal(demo.constructorCount, 2);
  assert.match(demo.lockRoot, /^[0-9a-f]{64}$/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-package-cli-'));
  writePackage(dir);
  const cwd = new URL('..', import.meta.url);
  const buildOut = execFileSync('node', ['src/cli.mjs', 'type-package-build', dir], { cwd, encoding: 'utf8' });
  const build = JSON.parse(buildOut);
  assert.equal(build.ok, true);
  assert.equal(build.lock.semantic.constructorCount, 2);

  const verifyOut = execFileSync('node', ['src/cli.mjs', 'type-package-verify', dir], { cwd, encoding: 'utf8' });
  const verify = JSON.parse(verifyOut);
  assert.equal(verify.ok, true);
  assert.equal(verify.expectedLockRoot, build.lock.lockRoot);

  const demoOut = execFileSync('node', ['src/cli.mjs', 'type-package-demo'], { cwd, encoding: 'utf8' });
  const cliDemo = JSON.parse(demoOut);
  assert.equal(cliDemo.ok, true);
  assert.equal(cliDemo.verifyOk, true);
});
