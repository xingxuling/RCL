import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_NATIVE_BATCH_C,
  FOUNDATION_NATIVE_BATCH_C_PROVIDER_ID,
  FoundationNativeBridgeError,
  compileFoundationNativeBatchC,
  runFoundationNativeBatchC,
  runFoundationNativeHost,
} from '../src/foundation-native-batch-c.mjs';

function assertBridgeError(expectedCode, callback) {
  assert.throws(
    callback,
    error => error instanceof FoundationNativeBridgeError && error.code === expectedCode,
  );
}

test('Batch C self-hosts byte-identical RBC 1.2 with physical and embodiment calls', { timeout: 300_000 }, () => {
  const compilation = compileFoundationNativeBatchC();
  assert.equal(compilation.selfhostByteIdentical, true);
  assert.equal(compilation.bytecodeVersion, '1.2');
  assert.equal(compilation.providerInstructionCount, 2);
  assert.match(compilation.source, /physical\.simulate-step/);
  assert.match(compilation.source, /embodiment\.integrate/);
});

test('Batch C native provider returns a causal physical-to-embodiment chain', { timeout: 300_000 }, () => {
  const execution = runFoundationNativeBatchC();
  assert.equal(execution.status, 'pass');
  assert.equal(execution.mode, 'bridge');
  assert.equal(execution.providerHost.providerId, FOUNDATION_NATIVE_BATCH_C_PROVIDER_ID);
  assert.deepEqual(execution.results.map(result => result.domain), FOUNDATION_NATIVE_BATCH_C.map(entry => entry.domain));
  assert.equal(execution.results[0].proposal.parameters.physical.tickAfter, 1);
  assert.equal(execution.results[1].proposal.parameters.embodiment.physicalParentRoot, execution.results[1].stateDelta.beforeRoot);
  assert.equal(execution.results[1].stateDelta.beforeRoot, execution.results[0].stateDelta.afterRoot);
  assert.equal(execution.replayVerified, true);
});

test('Batch C speech-act counterfactual changes mutation actions and roots', { timeout: 300_000 }, () => {
  const create = runFoundationNativeBatchC();
  const inspect = runFoundationNativeBatchC({
    input: {
      speechAct: 'inspect',
      physical: { tick: 0, dtMicros: 16667, bodyCount: 2, contactBudget: 8 },
      embodiment: { subjectId: 'body:avatar', command: 'observe' },
    },
  });
  assert.equal(create.results[0].proposal.selectedAction, 'simulate-constrained-step');
  assert.equal(inspect.results[0].proposal.selectedAction, 'inspect-physical-state');
  assert.equal(create.results[1].proposal.selectedAction, 'integrate-embodied-state');
  assert.equal(inspect.results[1].proposal.selectedAction, 'inspect-embodied-state');
  assert.notEqual(create.finalStateRoot, inspect.finalStateRoot);
  assert.notEqual(create.deterministicReceiptRoot, inspect.deterministicReceiptRoot);
});

test('Batch C rejects invalid input and missing provider', { timeout: 300_000 }, () => {
  assertBridgeError(
    'RCL_FOUNDATION_PHYSICAL_INVALID',
    () => runFoundationNativeBatchC({
      input: {
        physical: { tick: 0, dtMicros: 0, bodyCount: 2, contactBudget: 8 },
        embodiment: { subjectId: 'body:avatar', command: 'walk' },
      },
      authorized: true,
      aifDecision: 'stable',
      evidence: [{ type: 'test' }],
    }, { verifyReplay: false }),
  );
  const compilation = compileFoundationNativeBatchC();
  assertBridgeError(
    'RCL_NATIVE_PROVIDER_MISSING',
    () => runFoundationNativeHost(compilation.bytecode, { disableProvider: true }),
  );
});
