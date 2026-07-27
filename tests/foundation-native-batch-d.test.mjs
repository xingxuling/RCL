import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_NATIVE_BATCH_D,
  FOUNDATION_NATIVE_BATCH_D_PROVIDER_ID,
  FoundationNativeBridgeError,
  compileFoundationNativeBatchD,
  runFoundationNativeBatchD,
  runFoundationNativeHost,
} from '../src/foundation-native-batch-d.mjs';

function assertBridgeError(expectedCode, callback) {
  assert.throws(
    callback,
    error => error instanceof FoundationNativeBridgeError && error.code === expectedCode,
  );
}

test('Batch D self-hosts byte-identical RBC 1.2 with energy, elemental, and neural calls', { timeout: 300_000 }, () => {
  const compilation = compileFoundationNativeBatchD();
  assert.equal(compilation.selfhostByteIdentical, true);
  assert.equal(compilation.bytecodeVersion, '1.2');
  assert.equal(compilation.providerInstructionCount, 3);
  assert.match(compilation.source, /energy\.balance/);
  assert.match(compilation.source, /elemental\.compose/);
  assert.match(compilation.source, /neural\.integrate/);
});

test('Batch D native provider returns a causal energy-to-elemental-to-neural chain', { timeout: 300_000 }, () => {
  const execution = runFoundationNativeBatchD();
  assert.equal(execution.status, 'pass');
  assert.equal(execution.mode, 'bridge');
  assert.equal(execution.providerHost.providerId, FOUNDATION_NATIVE_BATCH_D_PROVIDER_ID);
  assert.deepEqual(execution.results.map(result => result.domain), FOUNDATION_NATIVE_BATCH_D.map(entry => entry.domain));
  assert.equal(execution.results[0].proposal.parameters.energy.effectiveMilliJoules, 75_000);
  assert.equal(execution.results[1].proposal.parameters.elemental.energyParentRoot, execution.results[1].stateDelta.beforeRoot);
  assert.equal(execution.results[2].proposal.parameters.neural.elementalParentRoot, execution.results[2].stateDelta.beforeRoot);
  assert.equal(execution.results[2].stateDelta.beforeRoot, execution.results[1].stateDelta.afterRoot);
  assert.equal(execution.replayVerified, true);
});

test('Batch D speech-act counterfactual changes mutation actions and roots', { timeout: 300_000 }, () => {
  const create = runFoundationNativeBatchD();
  const inspect = runFoundationNativeBatchD({
    input: {
      speechAct: 'inspect',
      energy: {
        availableMilliJoules: 120_000,
        requestedMilliJoules: 75_000,
        lossPpm: 10_000,
        tick: 4,
      },
      elemental: {
        materialId: 'material:steel',
        massMg: 250_000,
        purityPpm: 950_000,
        temperatureMilliK: 300_000,
        energyUseMilliJoules: 50_000,
      },
      neural: {
        signalId: 'signal:operator',
        amplitudePpm: 850_000,
        memoryBudgetBytes: 4_096,
        attentionWindow: 32,
        inhibitionPpm: 100_000,
      },
    },
  });
  assert.equal(create.results[0].proposal.selectedAction, 'transfer-bounded-energy');
  assert.equal(inspect.results[0].proposal.selectedAction, 'inspect-energy-budget');
  assert.equal(create.results[1].proposal.selectedAction, 'compose-bounded-material');
  assert.equal(inspect.results[1].proposal.selectedAction, 'inspect-material-composition');
  assert.equal(create.results[2].proposal.selectedAction, 'integrate-signal-control');
  assert.equal(inspect.results[2].proposal.selectedAction, 'inspect-neural-state');
  assert.notEqual(create.finalStateRoot, inspect.finalStateRoot);
  assert.notEqual(create.deterministicReceiptRoot, inspect.deterministicReceiptRoot);
});

test('Batch D rejects invalid domain parameters and missing provider', { timeout: 300_000 }, () => {
  assertBridgeError(
    'RCL_FOUNDATION_ENERGY_INVALID',
    () => runFoundationNativeBatchD({
      input: { energy: { availableMilliJoules: 120_000, requestedMilliJoules: 75_000, lossPpm: 600_000, tick: 4 } },
      authorized: true,
      aifDecision: 'stable',
      evidence: [{ type: 'test' }],
    }, { verifyReplay: false }),
  );
  assertBridgeError(
    'RCL_FOUNDATION_ELEMENTAL_INVALID',
    () => runFoundationNativeBatchD({
      input: {
        speechAct: 'create',
        energy: { availableMilliJoules: 120_000, requestedMilliJoules: 75_000, lossPpm: 10_000, tick: 4 },
        elemental: { materialId: 'material:glass', massMg: 250_000, purityPpm: 950_000, temperatureMilliK: 300_000, energyUseMilliJoules: 50_000 },
        neural: { signalId: 'signal:operator', amplitudePpm: 850_000, memoryBudgetBytes: 4_096, attentionWindow: 32, inhibitionPpm: 100_000 },
      },
      authorized: true,
      aifDecision: 'stable',
      evidence: [{ type: 'test' }],
    }, { verifyReplay: false }),
  );
  const compilation = compileFoundationNativeBatchD();
  assertBridgeError(
    'RCL_NATIVE_PROVIDER_MISSING',
    () => runFoundationNativeHost(compilation.bytecode, { disableProvider: true }),
  );
});
