import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-13 RCL-owned runtime interpreter covers arithmetic and control flow subset', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage13.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_CONTROL_FLOW_ARITHMETIC_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.targetActuallyUsesArithmeticAndControlFlow, true);
  assert.equal(report.checks.rclInterpreterStateMatchesNativeRuntime, true);
  assert.equal(report.checks.rclInterpreterStateMatchesJsRuntime, true);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateKeys, ['world.count', 'world.status', 'world.flag']);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateValues, [3, 'blocked', true]);
  assert.equal(report.runtimeComparison.rclInterpreter.stackCount, 0);
  assert.deepEqual(report.runtimeComparison.nativeDirect.state, {
    'world.count': 3,
    'world.flag': true,
    'world.status': 'blocked',
  });
  assert.equal(report.targetBytecode.numbers.length, 2);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'ADD'), true);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'JUMP_IF_FALSE'), true);
  assert.equal(report.boundaries.notYetImplemented.includes('transactions'), true);
});
