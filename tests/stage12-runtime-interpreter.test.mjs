import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-12 RCL-owned runtime interpreter subset matches native and JS state', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage12.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_BYTECODE_INTERPRETER_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclInterpreterStateMatchesNativeRuntime, true);
  assert.equal(report.checks.rclInterpreterStateMatchesJsRuntime, true);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateKeys, ['world.ready', 'world.name']);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateValues, [true, 'RCL']);
  assert.deepEqual(report.runtimeComparison.nativeDirect.state, {
    'world.name': 'RCL',
    'world.ready': true,
  });
  assert.equal(report.boundaries.notYetImplemented.includes('control flow'), true);
});
