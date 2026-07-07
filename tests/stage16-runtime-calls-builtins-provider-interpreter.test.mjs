import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-16 RCL-owned runtime interpreter covers calls, builtins and provider subset', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage16.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_CALLS_BUILTINS_PROVIDER_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.targetActuallyUsesCallsBuiltinsAndProvider, true);
  assert.equal(report.checks.rclInterpreterStateMatchesJsRuntimeWithProvider, true);
  assert.equal(report.checks.defaultNativeVmRejectsUnregisteredProvider, true);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateKeys, [
    'text.raw',
    'text.normalized',
    'text.length',
    'provider.reply',
    'provider.ok',
  ]);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateValues, [
    '  hello-provider  ',
    'HELLO-PROVIDER',
    14,
    '{"provider":"echo","request":{"message":"hello-provider"}}',
    true,
  ]);
  assert.deepEqual(report.runtimeComparison.jsReference.state, {
    'provider.ok': true,
    'provider.reply': '{"provider":"echo","request":{"message":"hello-provider"}}',
    'text.length': 14,
    'text.normalized': 'HELLO-PROVIDER',
    'text.raw': '  hello-provider  ',
  });
  assert.equal(report.runtimeComparison.nativeDefaultProviderBoundary.code, 'RCL_NATIVE_PROVIDER_MISSING');
  assert.equal(report.targetBytecode.bytes, 618);
  assert.equal(report.targetBytecode.instructions.length, 19);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'CALL'), true);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'CALL_PROVIDER'), true);
  assert.equal(report.targetBytecode.instructions.filter(instruction => instruction.name === 'CALL_BUILTIN').length, 4);
  assert.equal(report.boundaries.notYetImplemented.includes('not a complete RCL-owned runtime'), true);
});
