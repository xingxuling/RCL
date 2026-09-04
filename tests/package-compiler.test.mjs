import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packageRclSource, listRclPackageTargets, RCL_PACKAGE_TARGETS, verifyRclPackage, detectAndroidBuildEnvironment, buildAndroidDebugPackage } from '../src/index.mjs';

const source = fileURLToPath(new URL('../examples/hello-reality.rcl', import.meta.url));
const outRoot = fileURLToPath(new URL('../output/test-packages/hello-all', import.meta.url));
const expectedTargets = ['native-rbc', 'node-cli', 'web-static', 'android-shell', 'rclapp', 'android-apk-seed', 'android-debug-apk', 'rncs-module'];

test('package compiler lists stable hardened multi-terminal targets', () => {
  assert.deepEqual(listRclPackageTargets(), expectedTargets);
  assert.deepEqual(RCL_PACKAGE_TARGETS, listRclPackageTargets());
});

test('package compiler emits all configured terminal packages with hardened manifests', async () => {
  fs.rmSync(outRoot, { recursive: true, force: true });
  const report = await packageRclSource(source, { target: 'all', outputDir: outRoot });
  assert.equal(report.target, 'all');
  assert.equal(report.packageCount, 8);
  assert.equal(report.verifiedPackageCount, 8);
  assert.match(report.root, /^[0-9a-f]{64}$/);
  for (const target of listRclPackageTargets()) {
    const dir = path.join(outRoot, target);
    assert.equal(fs.existsSync(path.join(dir, 'program.rcl')), true, target);
    assert.equal(fs.existsSync(path.join(dir, 'program.rbc')), true, target);
    assert.equal(fs.existsSync(path.join(dir, 'rcl-package.json')), true, target);
    assert.equal(fs.existsSync(path.join(dir, 'security', 'package-audit.json')), true, target);
    assert.equal(fs.existsSync(path.join(dir, 'signing', 'release-signing.properties.example')), true, target);
    assert.equal(fs.existsSync(path.join(dir, 'runners', 'posix', 'run.sh')), true, target);
    assert.equal(fs.existsSync(path.join(dir, 'runners', 'windows', 'run.cmd')), true, target);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'rcl-package.json'), 'utf8'));
    assert.equal(manifest.target, target);
    assert.equal(manifest.program, 'FirstLight');
    assert.equal(manifest.bytecodeSha256, report.bytecodeSha256);
    assert.equal(manifest.hardened, true);
    assert.equal(verifyRclPackage(dir).status, 'verified');
  }
  assert.equal(fs.existsSync(path.join(outRoot, 'node-cli', 'bin', 'run.mjs')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'web-static', 'index.html')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'android-shell', 'termux-run.sh')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'rclapp', 'rclapp.package.json')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'rclapp', 'install.sh')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'android-apk-seed', 'app', 'src', 'main', 'AndroidManifest.xml')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'android-debug-apk', 'app', 'src', 'main', 'AndroidManifest.xml')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'android-debug-apk', 'build', 'android-debug-build-report.json')), true);
  assert.equal(fs.existsSync(path.join(outRoot, 'rncs-module', 'rncs.module.json')), true);
});

test('packaged native-rbc and node-cli entrypoints execute bundled bytecode', async () => {
  const report = await packageRclSource(source, { target: 'all', outputDir: outRoot });
  const nativePackage = path.join(outRoot, 'native-rbc');
  const nativeOut = process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/s', '/c', path.join(nativePackage, 'runners', 'windows', 'run.cmd')], { encoding: 'utf8' })
    : execFileSync('sh', [path.join(nativePackage, 'run-native.sh')], { encoding: 'utf8' });
  const nativeJson = JSON.parse(nativeOut);
  assert.deepEqual(nativeJson.state, { 'founder.awareness': 1, 'world.greeting': 'Hello, reality.' });

  const nodeOut = execFileSync('node', [path.join(outRoot, 'node-cli', 'bin', 'run.mjs')], { encoding: 'utf8' });
  const nodeJson = JSON.parse(nodeOut);
  assert.deepEqual(nodeJson.state, nativeJson.state);
  assert.equal(report.packages.find(item => item.target === 'node-cli').entrypoints.includes('npm start'), true);
});

test('rcl package CLI creates and verifies a single target package', () => {
  const outDir = fileURLToPath(new URL('../output/test-packages/hello-node-cli', import.meta.url));
  fs.rmSync(outDir, { recursive: true, force: true });
  const out = execFileSync('node', ['src/cli.mjs', 'package', 'examples/hello-reality.rcl', 'node-cli', outDir], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  const report = JSON.parse(out);
  assert.equal(report.target, 'node-cli');
  assert.equal(report.packageCount, 1);
  assert.equal(report.verifiedPackageCount, 1);
  assert.equal(fs.existsSync(path.join(outDir, 'bin', 'run.mjs')), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'rcl-package.json'), 'utf8')).target, 'node-cli');

  const verifyOut = execFileSync('node', ['src/cli.mjs', 'package-verify', outDir], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  const verifyReport = JSON.parse(verifyOut);
  assert.equal(verifyReport.status, 'verified');
});

test('package verifier rejects secret-pattern files added after packaging', async () => {
  const outDir = fileURLToPath(new URL('../output/test-packages/hello-secret-check', import.meta.url));
  fs.rmSync(outDir, { recursive: true, force: true });
  await packageRclSource(source, { target: 'android-apk-seed', outputDir: outDir });
  assert.equal(verifyRclPackage(outDir).status, 'verified');
  fs.writeFileSync(path.join(outDir, '.env'), 'SECRET=bad\n');
  const rejected = verifyRclPackage(outDir);
  assert.equal(rejected.status, 'rejected');
  assert.ok(rejected.diagnostics.some(item => item.code === 'RCL_PACKAGE_SECRET_PATTERN'));
});


test('android-debug-apk target emits diagnostic build report and local environment probe', async () => {
  const outDir = fileURLToPath(new URL('../output/test-packages/hello-android-debug', import.meta.url));
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = await packageRclSource(source, { target: 'android-debug-apk', outputDir: outDir });
  assert.equal(report.target, 'android-debug-apk');
  assert.equal(report.packageCount, 1);
  const buildReportPath = path.join(outDir, 'build', 'android-debug-build-report.json');
  assert.equal(fs.existsSync(buildReportPath), true);
  const buildReport = JSON.parse(fs.readFileSync(buildReportPath, 'utf8'));
  assert.equal(buildReport.format, 'rcl.android-debug-build-report.v0.24');
  assert.equal(buildReport.status, 'diagnostic-only');
  assert.equal(buildReport.executeBuild, false);
  assert.ok(['buildable', 'diagnostic-only'].includes(buildReport.environment.status));
  assert.equal(fs.existsSync(path.join(outDir, '.github', 'workflows', 'build-android-debug.yml')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'REMOTE_BUILD.md')), true);
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'rcl-package.json'), 'utf8'));
  assert.equal(manifest.android.remoteBuild.builder, 'github-actions');
  assert.ok(manifest.entrypoints.includes('.github/workflows/build-android-debug.yml'));
  const workflow = fs.readFileSync(path.join(outDir, '.github', 'workflows', 'build-android-debug.yml'), 'utf8');
  assert.match(workflow, /upload-artifact@v4/);
  assert.match(workflow, /gradle assembleDebug/);
  const environment = detectAndroidBuildEnvironment(outDir);
  assert.equal(environment.projectDir, path.resolve(outDir));
  const rerun = buildAndroidDebugPackage(outDir, { executeBuild: false });
  assert.equal(rerun.status, 'diagnostic-only');
  assert.equal(verifyRclPackage(outDir).status, 'verified');
  assert.equal(manifest.files.some(item => item.path === 'build/android-debug-build-report.json'), false);
});
