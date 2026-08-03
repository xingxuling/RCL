import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'src', 'reality-hub-cli.mjs');

function invoke(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('public CLI exposes a stable version command', () => {
  const result = invoke(['--version']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /@taowind\/rcl-reality-forge 0\.94\.0-alpha\.1/);
});

test('public CLI exposes canonical version metadata as JSON', () => {
  const result = invoke(['version', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.version, '0.94.0-alpha.1');
  assert.equal(payload.canonical, true);
  assert.equal(payload.canonicalRepository, 'xingxuling/RCL');
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
