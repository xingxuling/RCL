import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runner = path.join(root, 'scripts', 'run-dominance-arena-microbench.mjs');
const workload = path.join(root, 'examples', 'dominance-arena', 'compiler-microbench', 'workload.v0.1.json');
const rclSource = path.join(root, 'examples', 'dominance-arena', 'compiler-microbench', 'program.rcl');
const rustSource = path.join(root, 'examples', 'dominance-arena', 'compiler-microbench', 'program.rs');
const pythonSource = path.join(root, 'examples', 'dominance-arena', 'compiler-microbench', 'program.py');

function run(mode, source, directory) {
  const output = path.join(directory, `${mode}.json`);
  const result = spawnSync(process.execPath, [runner, mode, workload, source, output], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.ok(fs.existsSync(output), `${mode} evidence was not written`);
  return { result, output: JSON.parse(fs.readFileSync(output, 'utf8')) };
}

test('RCL microbenchmark runner emits native execution evidence', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-dominance-rcl-'));
  try {
    const runResult = run('rcl', rclSource, directory);
    assert.equal(runResult.result.status, 0, runResult.result.stderr);
    assert.equal(runResult.output.status, 'PASS');
    assert.equal(runResult.output.correctness.passed, true);
    assert.equal(runResult.output.metrics.correctness, 1);
    assert.ok(runResult.output.metrics.compileBuildSpeed >= 0);
    assert.ok(runResult.output.metrics.runtimeMs >= 0);
    assert.ok(runResult.output.metrics.artifactFootprintBytes > 0);
    assert.match(runResult.output.inputRoot, /^[0-9a-f]{64}$/);
    assert.match(runResult.output.evidenceRoot, /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reference microbenchmark is PASS with rustc or BLOCKED without it', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-dominance-rust-'));
  try {
    const runResult = run('rust', rustSource, directory);
    assert.equal(runResult.result.status, 0, runResult.result.stderr);
    assert.ok(['PASS', 'BLOCKED'].includes(runResult.output.status));
    if (runResult.output.status === 'PASS') {
      assert.equal(runResult.output.correctness.passed, true);
      assert.equal(runResult.output.metrics.correctness, 1);
      assert.ok(runResult.output.metrics.compileBuildSpeed >= 0);
      assert.ok(runResult.output.metrics.runtimeMs >= 0);
      assert.ok(runResult.output.metrics.artifactFootprintBytes > 0);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Python reference microbenchmark is PASS with CPython or BLOCKED without it', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-dominance-python-'));
  try {
    const runResult = run('python', pythonSource, directory);
    assert.equal(runResult.result.status, 0, runResult.result.stderr);
    assert.ok(['PASS', 'BLOCKED'].includes(runResult.output.status));
    if (runResult.output.status === 'PASS') {
      assert.equal(runResult.output.correctness.passed, true);
      assert.equal(runResult.output.metrics.correctness, 1);
      assert.ok(runResult.output.metrics.compileBuildSpeed >= 0);
      assert.ok(runResult.output.metrics.runtimeMs >= 0);
      assert.ok(runResult.output.metrics.artifactFootprintBytes > 0);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
