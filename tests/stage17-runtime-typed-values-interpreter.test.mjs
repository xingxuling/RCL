import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-17 RCL-owned runtime interpreter covers typed values and typed refs subset', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage17.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_TYPED_VALUES_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsTypedCompiler, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.targetActuallyUsesTypedValuesAndRefs, true);
  assert.equal(report.checks.nativeVmDirectlyRunsTypedTarget, true);
  assert.equal(report.checks.rclInterpreterStateMatchesNativeTypedRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateKeys, [
    'app.session',
    'app.login',
    'app.message',
    'app.sessionRef',
    'app.sessionRefId',
    'app.sessionAgain',
    'app.payloadViaRef',
  ]);
  assert.equal(report.runtimeComparison.rclInterpreter.message, 'denied');
  assert.equal(report.runtimeComparison.rclInterpreter.payloadViaRef, 'referenced');
  assert.equal(report.runtimeComparison.rclInterpreter.sessionRefId, 3);
  assert.equal(report.runtimeComparison.rclInterpreter.sessionObjectId, 3);
  assert.equal(report.runtimeComparison.rclInterpreter.sessionAgainObjectId, 3);
  assert.equal(report.runtimeComparison.rclInterpreter.sessionRefObjectId, 3);
  assert.equal(report.runtimeComparison.rclInterpreter.loginVariant, 'Err');
  assert.equal(report.runtimeComparison.rclInterpreter.typedObjectCount, 4);
  assert.equal(report.runtimeComparison.rclInterpreter.typedRefCount, 1);
  assert.equal(report.runtimeComparison.nativeDirect.typedHeap.allocated, 4);
  assert.equal(report.runtimeComparison.nativeDirect.typedHeap.references, 1);
  assert.equal(report.targetBytecode.bytes, 1038);
  assert.equal(report.targetBytecode.instructions.length, 38);
  for (const name of [
    'MAKE_TYPED_RECORD',
    'MAKE_TYPED_UNION',
    'GET_TYPED_FIELD',
    'IS_UNION_VARIANT',
    'GET_UNION_PAYLOAD',
    'MAKE_TYPED_REF',
    'DEREF_TYPED_REF',
    'GET_TYPED_REF_ID',
  ]) {
    assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === name), true);
  }
  assert.equal(report.boundaries.notYetImplemented.includes('not full RCL-owned runtime parity'), true);
});
