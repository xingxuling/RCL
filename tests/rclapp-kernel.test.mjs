import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  packageRclSource,
  installRclApp,
  verifyRclApp,
  runRclApp,
  uninstallRclApp,
  listRclApps,
  RCL_APP_KERNEL_VERSION,
} from '../src/index.mjs';

const source = fileURLToPath(new URL('../examples/hello-reality.rcl', import.meta.url));
const testRoot = fileURLToPath(new URL(`../output/test-rclapps-${process.pid}`, import.meta.url));
const packageDir = path.join(testRoot, 'hello-rclapp-package');
const storeDir = path.join(testRoot, 'store');

async function createVerifiedPackage() {
  fs.rmSync(packageDir, { recursive: true, force: true });
  await packageRclSource(source, { target: 'rclapp', outputDir: packageDir });
  assert.equal(fs.existsSync(path.join(packageDir, 'rcl-package.json')), true);
  assert.equal(fs.existsSync(path.join(packageDir, 'program.rbc')), true);
  return packageDir;
}

test('RCLApp kernel installs verifies runs lists and uninstalls a verified RCL package', async () => {
  fs.rmSync(testRoot, { recursive: true, force: true });
  await createVerifiedPackage();

  const directVerification = verifyRclApp(packageDir, { storeDir });
  assert.equal(directVerification.status, 'verified');
  assert.equal(directVerification.installable, true);
  assert.equal(directVerification.program, 'FirstLight');

  const install = installRclApp(packageDir, { storeDir });
  assert.equal(install.status, 'installed');
  assert.equal(install.verification.status, 'verified');
  assert.match(install.appId, /^rcl\.firstlight\.[0-9a-f]{12}$/);
  assert.equal(fs.existsSync(path.join(storeDir, 'rclapp-registry.json')), true);
  assert.equal(fs.existsSync(path.join(storeDir, 'apps', install.appId, 'rclapp.json')), true);
  assert.equal(fs.existsSync(path.join(storeDir, 'apps', install.appId, 'package', 'program.rbc')), true);

  const installedVerification = verifyRclApp(install.appId, { storeDir });
  assert.equal(installedVerification.status, 'verified');
  assert.equal(installedVerification.manifest.program, 'FirstLight');
  assert.equal(installedVerification.packageVerification.status, 'verified');

  const run = runRclApp(install.appId, { storeDir });
  assert.equal(run.status, 'ran');
  assert.deepEqual(run.execution.state, { 'founder.awareness': 1, 'world.greeting': 'Hello, reality.' });

  const listed = listRclApps({ storeDir });
  assert.equal(listed.appCount, 1);
  assert.equal(listed.apps[0].appId, install.appId);
  assert.equal(listed.apps[0].runCount, 1);

  const uninstall = uninstallRclApp(install.appId, { storeDir });
  assert.equal(uninstall.status, 'uninstalled');
  assert.equal(fs.existsSync(path.join(storeDir, 'apps', install.appId)), false);
  assert.equal(listRclApps({ storeDir }).appCount, 0);
});

test('RCLApp CLI exposes install verify run list uninstall commands', async () => {
  const cliRoot = path.join(testRoot, 'cli');
  const cliPackageDir = path.join(cliRoot, 'package');
  const cliStoreDir = path.join(cliRoot, 'store');
  fs.rmSync(cliRoot, { recursive: true, force: true });
  await packageRclSource(source, { target: 'rclapp', outputDir: cliPackageDir });

  const installOut = execFileSync('node', ['src/cli.mjs', 'rclapp-install', cliPackageDir, cliStoreDir], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  const install = JSON.parse(installOut);
  assert.equal(install.status, 'installed');
  assert.equal(install.kernelVersion, RCL_APP_KERNEL_VERSION);

  const verifyOut = execFileSync('node', ['src/cli.mjs', 'rclapp-verify', install.appId, cliStoreDir], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  assert.equal(JSON.parse(verifyOut).status, 'verified');

  const runOut = execFileSync('node', ['src/cli.mjs', 'rclapp-run', install.appId, cliStoreDir], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  assert.deepEqual(JSON.parse(runOut).execution.state, { 'founder.awareness': 1, 'world.greeting': 'Hello, reality.' });

  const listOut = execFileSync('node', ['src/cli.mjs', 'rclapp-list', cliStoreDir], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  assert.equal(JSON.parse(listOut).appCount, 1);

  const uninstallOut = execFileSync('node', ['src/cli.mjs', 'rclapp-uninstall', install.appId, cliStoreDir], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  assert.equal(JSON.parse(uninstallOut).status, 'uninstalled');
});

test('RCLApp install rejects tampered packages before they enter the store', async () => {
  const tamperedPackageDir = path.join(testRoot, 'tampered-package');
  const tamperedStoreDir = path.join(testRoot, 'tampered-store');
  fs.rmSync(tamperedPackageDir, { recursive: true, force: true });
  fs.rmSync(tamperedStoreDir, { recursive: true, force: true });
  await packageRclSource(source, { target: 'rclapp', outputDir: tamperedPackageDir });
  fs.appendFileSync(path.join(tamperedPackageDir, 'program.rbc'), Buffer.from([0]));

  const verification = verifyRclApp(tamperedPackageDir, { storeDir: tamperedStoreDir });
  assert.equal(verification.status, 'rejected');
  assert.ok(verification.diagnostics.some(item => item.code === 'RCL_PACKAGE_FILE_HASH_MISMATCH'));
  assert.throws(
    () => installRclApp(tamperedPackageDir, { storeDir: tamperedStoreDir }),
    /verification failed/
  );
  assert.equal(fs.existsSync(path.join(tamperedStoreDir, 'apps')), false);
});
