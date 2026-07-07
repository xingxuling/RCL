import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-15 RCL-owned runtime interpreter covers transaction projection and history subset', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage15.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_TRANSACTION_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.targetActuallyUsesTransactionRuntimeSurface, true);
  assert.equal(report.checks.rclInterpreterStateMatchesNativeRuntime, true);
  assert.equal(report.checks.rclInterpreterStateMatchesJsRuntime, true);
  assert.equal(report.checks.nativeDirectTransactionRecordShapeMatches, true);
  assert.equal(report.checks.jsRuntimeTransactionRecordShapeMatches, true);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateKeys, ['world.ready', 'world.status']);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateValues, [true, 'published']);
  assert.equal(report.runtimeComparison.rclInterpreter.stackCount, 0);
  assert.deepEqual(report.runtimeComparison.nativeDirect.state, {
    'world.ready': true,
    'world.status': 'published',
  });
  assert.equal(report.runtimeComparison.nativeDirect.projections.length, 1);
  assert.equal(report.runtimeComparison.nativeDirect.history.length, 1);
  assert.equal(report.runtimeComparison.nativeDirect.projections[0].projectedState['world.status'], 'published');
  assert.equal(report.runtimeComparison.nativeDirect.history[0].changes[0].after, 'published');
  assert.equal(report.runtimeComparison.nativeDirect.history[0].authority.needs[0].capability, 'world.publish');
  assert.equal(report.runtimeComparison.nativeDirect.history[0].witnesses[0], 'rcl:stage15:published');
  assert.equal(report.targetBytecode.bytes, 802);
  assert.equal(report.targetBytecode.instructions.length, 34);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'BEGIN_TX'), true);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'COMMIT_TX'), true);
  assert.equal(report.boundaries.notYetImplemented.includes('single-rule transaction subset'), true);
});
