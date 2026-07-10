import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-14 RCL-owned runtime interpreter covers state dependencies and logic subset', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage14.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_STATE_LOGIC_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.targetActuallyUsesStateDependenciesAndLogic, true);
  assert.equal(report.checks.rclInterpreterStateMatchesNativeRuntime, true);
  assert.equal(report.checks.rclInterpreterStateMatchesJsRuntime, true);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateKeys, [
    'world.base',
    'world.next',
    'world.same',
    'world.ready',
    'world.alternate',
    'world.status',
  ]);
  assert.deepEqual(report.runtimeComparison.rclInterpreter.stateValues, [4, 6, true, true, true, 'ready']);
  assert.equal(report.runtimeComparison.rclInterpreter.stackCount, 0);
  assert.deepEqual(report.runtimeComparison.nativeDirect.state, {
    'world.alternate': true,
    'world.base': 4,
    'world.next': 6,
    'world.ready': true,
    'world.same': true,
    'world.status': 'ready',
  });
  assert.equal(report.targetBytecode.numbers.length, 3);
  assert.equal(report.targetBytecode.bytes, 939);
  assert.equal(report.targetBytecode.sha256, '25af84bf277379e7059812d1378a110c4c095db350a110365a697cd5c1e38059');
  assert.equal(report.targetBytecode.exactJsReferenceMatch, true);
  assert.equal(report.targetBytecode.instructions.length, 42);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'LOAD_STATE'), true);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'JUMP'), true);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'JUMP_IF_FALSE'), true);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'AND'), false);
  assert.equal(report.targetBytecode.instructions.some(instruction => instruction.name === 'OR'), false);
  assert.equal(report.boundaries.notYetImplemented.includes('transactions'), true);
});
