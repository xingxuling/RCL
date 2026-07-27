import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_NATIVE_BATCH_E,
  FOUNDATION_NATIVE_BATCH_E_PROVIDER_ID,
  FoundationNativeBridgeError,
  compileFoundationNativeBatchE,
  runFoundationNativeBatchE,
  runFoundationNativeHost,
} from '../src/foundation-native-batch-e.mjs';

function assertBridgeError(expectedCode, callback) {
  assert.throws(
    callback,
    error => error instanceof FoundationNativeBridgeError && error.code === expectedCode,
  );
}

test('Batch E self-hosts byte-identical RBC 1.2 with metacomputation and computation calls', { timeout: 300_000 }, () => {
  const compilation = compileFoundationNativeBatchE();
  assert.equal(compilation.selfhostByteIdentical, true);
  assert.equal(compilation.bytecodeVersion, '1.2');
  assert.equal(compilation.providerInstructionCount, 2);
  assert.match(compilation.source, /metacomputation\.plan/);
  assert.match(compilation.source, /computation\.execute/);
});

test('Batch E native provider returns a causal metacomputation-to-computation chain', { timeout: 300_000 }, () => {
  const execution = runFoundationNativeBatchE();
  assert.equal(execution.status, 'pass');
  assert.equal(execution.mode, 'bridge');
  assert.equal(execution.providerHost.providerId, FOUNDATION_NATIVE_BATCH_E_PROVIDER_ID);
  assert.deepEqual(execution.results.map(result => result.domain), FOUNDATION_NATIVE_BATCH_E.map(entry => entry.domain));
  assert.equal(execution.results[0].proposal.parameters.metacomputation.effectiveSteps, 8);
  assert.equal(execution.results[1].proposal.parameters.computation.result, 42);
  assert.equal(execution.results[1].proposal.parameters.computation.metacomputationParentRoot, execution.results[1].stateDelta.beforeRoot);
  assert.equal(execution.results[1].stateDelta.beforeRoot, execution.results[0].stateDelta.afterRoot);
  assert.equal(execution.replayVerified, true);
});

test('Batch E speech-act counterfactual changes mutation actions and roots', { timeout: 300_000 }, () => {
  const create = runFoundationNativeBatchE();
  const inspect = runFoundationNativeBatchE({
    input: {
      speechAct: 'inspect',
      metacomputation: {
        planId: 'plan:sum-v1',
        strategy: 'bounded-step',
        requestedSteps: 12,
        maximumSteps: 8,
        tick: 3,
      },
      computation: {
        programId: 'program:sum-v1',
        operation: 'sum',
        leftOperand: 21,
        rightOperand: 21,
        instructionBudget: 64,
      },
    },
  });
  assert.equal(create.results[0].proposal.selectedAction, 'transform-bounded-computation-plan');
  assert.equal(inspect.results[0].proposal.selectedAction, 'inspect-computation-plan');
  assert.equal(create.results[1].proposal.selectedAction, 'execute-bounded-computation');
  assert.equal(inspect.results[1].proposal.selectedAction, 'inspect-computation-state');
  assert.notEqual(create.finalStateRoot, inspect.finalStateRoot);
  assert.notEqual(create.deterministicReceiptRoot, inspect.deterministicReceiptRoot);
});

test('Batch E rejects invalid domain parameters and missing provider', { timeout: 300_000 }, () => {
  assertBridgeError(
    'RCL_FOUNDATION_METACOMPUTATION_INVALID',
    () => runFoundationNativeBatchE({
      input: {
        metacomputation: {
          planId: 'plan:sum-v1',
          strategy: 'bounded-step',
          requestedSteps: 12,
          maximumSteps: 0,
          tick: 3,
        },
        computation: {
          programId: 'program:sum-v1',
          operation: 'sum',
          leftOperand: 21,
          rightOperand: 21,
          instructionBudget: 64,
        },
      },
    }, { verifyReplay: false }),
  );
  assertBridgeError(
    'RCL_FOUNDATION_COMPUTATION_INVALID',
    () => runFoundationNativeBatchE({
      input: {
        metacomputation: {
          planId: 'plan:sum-v1',
          strategy: 'bounded-step',
          requestedSteps: 12,
          maximumSteps: 8,
          tick: 3,
        },
        computation: {
          programId: 'program:sum-v1',
          operation: 'divide',
          leftOperand: 21,
          rightOperand: 21,
          instructionBudget: 64,
        },
      },
    }, { verifyReplay: false }),
  );
  const compilation = compileFoundationNativeBatchE();
  assertBridgeError(
    'RCL_NATIVE_PROVIDER_MISSING',
    () => runFoundationNativeHost(compilation.bytecode, { disableProvider: true }),
  );
});
