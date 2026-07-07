import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  bootstrapCompilerComplete,
  DEFAULT_SELFHOST_OUTPUT_PATH,
  DEFAULT_SELFHOST_COMPILER_ARTIFACT_PATH,
} from '../src/index.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

test('complete self-hosting compiler emits deterministic compiler artifact and target RBC', () => {
  const result = bootstrapCompilerComplete();
  assert.equal(result.stage, 'complete-self-hosting-compiler-v0.15');
  assert.equal(result.referenceParity, true);
  assert.equal(result.deterministicCompilerArtifact, true);
  assert.equal(result.deterministicTarget, true);
  assert.equal(fs.existsSync(DEFAULT_SELFHOST_COMPILER_ARTIFACT_PATH), true);
  assert.equal(fs.existsSync(DEFAULT_SELFHOST_OUTPUT_PATH), true);
  assert.equal(fs.readFileSync(DEFAULT_SELFHOST_COMPILER_ARTIFACT_PATH).length, result.compilerArtifactBytes);
  assert.equal(fs.readFileSync(DEFAULT_SELFHOST_OUTPUT_PATH).length, result.targetBytes);
  assert.deepEqual(result.targetState, {
    'app::app.ready': true,
    'core::world.name': 'Aster',
    'core::world.value': 7,
  });
  assert.match(result.compilerArtifactRoot, /^[0-9a-f]{64}$/);
  assert.match(result.targetBytecodeRoot, /^[0-9a-f]{64}$/);
});

test('self-hosted target RBC runs independently after compiler emission', () => {
  const result = bootstrapCompilerComplete();
  const rerun = runNativeBytecode(DEFAULT_SELFHOST_OUTPUT_PATH);
  assert.deepEqual(rerun.state, result.targetState);
  assert.equal(rerun.metrics.instructions > 0, true);
});

test('rcl selfhost CLI writes target bytecode and reports compiler closure', () => {
  const target = fileURLToPath(new URL('../build/cli-selfhost-target.rbc', import.meta.url));
  const out = execFileSync('node', ['src/cli.mjs', 'selfhost', 'examples/stage4-modules/core.rcl', 'examples/stage4-modules/app.rcl', target], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);
  assert.equal(report.stage, 'complete-self-hosting-compiler-v0.15');
  assert.equal(report.referenceParity, true);
  assert.equal(report.deterministicTarget, true);
  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.readFileSync(target).length, report.targetBytes);
  assert.deepEqual(report.targetState, {
    'app::app.ready': true,
    'core::world.name': 'Aster',
    'core::world.value': 7,
  });
});
