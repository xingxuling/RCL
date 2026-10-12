import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'src', 'reality-hub-cli.mjs');
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const EVIDENCE = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/universal-stress/k400-current-evidence.json'), 'utf8'));

function invoke(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('public CLI exposes a stable version command', () => {
  const result = invoke(['--version']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), PACKAGE.name + ' ' + PACKAGE.version);
});

test('public CLI exposes canonical version metadata as JSON', () => {
  const result = invoke(['version', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.version, PACKAGE.version);
  assert.equal(payload.canonical, true);
  assert.equal(payload.canonicalRepository, 'xingxuling/RCL');
  assert.equal(payload.researchReadiness.status, 'RESEARCH_PREVIEW');
  assert.equal(payload.researchReadiness.k400.passedCells, EVIDENCE.claims.filter(claim =>
    Object.keys(claim.gates).length === 9 && Object.values(claim.gates).every(gate => gate.status === 'PASS')).length);
  assert.equal(payload.researchReadiness.formalLanguageRelease, false);
});

test('doctor reports runtime and explicit compiler boundaries', () => {
  const result = invoke(['doctor']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.compilerBoundary.nativeCoreCompilerSelfHosting, true);
  assert.equal(payload.compilerBoundary.fullSelfHosting, false);
  assert.equal(payload.compilerBoundary.jsReferenceRuntimeStillRequired, true);
  assert.equal(payload.summary.fail, 0);
  assert.equal(payload.researchReadiness.versionPromotionFrozen, true);
  assert.equal(payload.checks.find(check => check.id === 'research-maturity').status, 'warn');
});

test('check accepts the canonical hello-reality example without execution', () => {
  const result = invoke(['check', 'examples/hello-reality.rcl']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.command, 'check');
  assert.equal(payload.authenticity, 'canonical-source-reference-check');
});

test('check rejects invalid source and returns structured diagnostics', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cli-contract-'));
  const file = path.join(dir, 'invalid.rcl');
  fs.writeFileSync(file, 'reality Broken { this is not valid RCL }');
  const result = invoke(['check', file]);
  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.ok(payload.diagnostics.length > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('unhandled advanced commands delegate to the existing CLI', () => {
  const result = invoke(['run', 'examples/hello-reality.rcl']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.trim().length > 0);
});

test('portable-run exposes real WASI native-core execution through the public CLI', () => {
  const result = invoke(['portable-run', 'wasm-vm', 'examples/universal-stress/expansion-wave1/algorithm.rcl']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.target, 'wasm-vm');
  assert.equal(payload.result.state['result.gcd'], 21);
  assert.equal(payload.result.stateRootVerified, true);
  assert.equal(payload.targetBinding.binary.path, 'native/wasi/rclvm.wasm');
});

test('portable-run rejects unknown targets, surplus flags and invalid source with structured failures', () => {
  for (const args of [
    ['portable-run', 'invented', 'examples/hello-reality.rcl'],
    ['portable-run', 'windows', 'examples/hello-reality.rcl', '--anything'],
  ]) {
    const result = invoke(args);
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).ok, false);
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-portable-cli-invalid-'));
  try {
    const file = path.join(directory, 'invalid.rcl'); fs.writeFileSync(file, 'not a reality');
    const result = invoke(['portable-run', 'wasm-vm', file]);
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).ok, false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
