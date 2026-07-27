import {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  createFoundationNativeBatchRuntime,
  runFoundationNativeHost,
} from './foundation-native-batch-runtime.mjs';

export const FOUNDATION_NATIVE_BATCH_E_FORMAT =
  'taowind.rcl-foundation-native-batch-e.v0.1';
export const FOUNDATION_NATIVE_BATCH_E_REQUEST_FORMAT =
  'taowind.rcl-foundation-native-batch-e.request.v0.1';
export const FOUNDATION_NATIVE_BATCH_E_PROVIDER_ID =
  'rcl.foundation.batch-e';

export const FOUNDATION_NATIVE_BATCH_E = Object.freeze([
  Object.freeze({
    domain: 'metacomputation',
    capability: 'metacomputation.plan',
    statePath: 'bridge.metacomputation',
  }),
  Object.freeze({
    domain: 'computation',
    capability: 'computation.execute',
    statePath: 'bridge.computation',
  }),
]);

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new TypeError(
      `${label} must be ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function isCreateMode(speechAct) {
  return ['create', 'generate', 'build'].includes(speechAct);
}

function validateBatchEResult({ request, result }) {
  const createMode = isCreateMode(request.input.speechAct);

  if (result.domain === 'metacomputation') {
    const meta = result.proposal.parameters?.metacomputation;
    const input = request.input.metacomputation;
    const effectiveSteps = createMode
      ? Math.min(input.requestedSteps, input.maximumSteps)
      : 0;
    assertEqual(meta?.planId, input.planId, 'metacomputation.planId');
    assertEqual(meta?.strategy, input.strategy, 'metacomputation.strategy');
    assertEqual(meta?.requestedSteps, input.requestedSteps, 'metacomputation.requestedSteps');
    assertEqual(meta?.maximumSteps, input.maximumSteps, 'metacomputation.maximumSteps');
    assertEqual(meta?.effectiveSteps, effectiveSteps, 'metacomputation.effectiveSteps');
    assertEqual(meta?.tickBefore, input.tick, 'metacomputation.tickBefore');
    assertEqual(meta?.tickAfter, createMode ? input.tick + 1 : input.tick, 'metacomputation.tickAfter');
    assertEqual(meta?.clamped, input.requestedSteps > input.maximumSteps, 'metacomputation.clamped');
    assertEqual(meta?.mutationApplied, createMode, 'metacomputation.mutationApplied');
    assertEqual(
      result.proposal.selectedAction,
      createMode ? 'transform-bounded-computation-plan' : 'inspect-computation-plan',
      'metacomputation selectedAction',
    );
    return;
  }

  if (result.domain === 'computation') {
    const computation = result.proposal.parameters?.computation;
    const input = request.input.computation;
    const computedValue = input.operation === 'sum'
      ? input.leftOperand + input.rightOperand
      : input.operation === 'difference'
        ? input.leftOperand - input.rightOperand
        : input.leftOperand * input.rightOperand;
    const stepsUsed = input.operation === 'product' ? 3 : 1;
    assertEqual(computation?.programId, input.programId, 'computation.programId');
    assertEqual(computation?.operation, input.operation, 'computation.operation');
    assertEqual(computation?.leftOperand, input.leftOperand, 'computation.leftOperand');
    assertEqual(computation?.rightOperand, input.rightOperand, 'computation.rightOperand');
    assertEqual(computation?.result, createMode ? computedValue : 0, 'computation.result');
    assertEqual(computation?.instructionBudget, input.instructionBudget, 'computation.instructionBudget');
    assertEqual(computation?.stepsUsed, createMode ? stepsUsed : 0, 'computation.stepsUsed');
    assertEqual(computation?.budgetSatisfied, input.instructionBudget >= stepsUsed, 'computation.budgetSatisfied');
    assertEqual(computation?.metacomputationParentRoot, result.stateDelta.beforeRoot, 'computation.metacomputationParentRoot');
    assertEqual(computation?.mutationApplied, createMode, 'computation.mutationApplied');
    assertEqual(
      result.proposal.selectedAction,
      createMode ? 'execute-bounded-computation' : 'inspect-computation-state',
      'computation selectedAction',
    );
  }
}

const runtime = createFoundationNativeBatchRuntime({
  label: 'Batch E',
  format: FOUNDATION_NATIVE_BATCH_E_FORMAT,
  requestFormat: FOUNDATION_NATIVE_BATCH_E_REQUEST_FORMAT,
  providerId: FOUNDATION_NATIVE_BATCH_E_PROVIDER_ID,
  realityName: 'FoundationNativeBatchEBridge',
  entries: FOUNDATION_NATIVE_BATCH_E,
  defaultInput: {
    speechAct: 'create',
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
  defaultSeed: 'foundation-native-batch-e-v1',
  bytecodeFilename: 'foundation-batch-e.rbc',
  validateResult: validateBatchEResult,
});

export {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  runFoundationNativeHost,
};

export const normalizeFoundationNativeBatchERequest = runtime.normalizeRequest;
export const renderFoundationNativeBatchESource = runtime.renderSource;
export const compileFoundationNativeBatchE = runtime.compile;
export const verifyFoundationNativeBatchEExecution = runtime.verifyExecution;
export const runFoundationNativeBatchE = runtime.run;
