import {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  createFoundationNativeBatchRuntime,
  runFoundationNativeHost,
} from './foundation-native-batch-runtime.mjs';

export const FOUNDATION_NATIVE_BATCH_C_FORMAT =
  'taowind.rcl-foundation-native-batch-c.v0.1';
export const FOUNDATION_NATIVE_BATCH_C_REQUEST_FORMAT =
  'taowind.rcl-foundation-native-batch-c.request.v0.1';
export const FOUNDATION_NATIVE_BATCH_C_PROVIDER_ID =
  'rcl.foundation.batch-c';

export const FOUNDATION_NATIVE_BATCH_C = Object.freeze([
  Object.freeze({
    domain: 'physical',
    capability: 'physical.simulate-step',
    statePath: 'bridge.physical',
  }),
  Object.freeze({
    domain: 'embodiment',
    capability: 'embodiment.integrate',
    statePath: 'bridge.embodiment',
  }),
]);

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new TypeError(
      `${label} must be ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function validateBatchCResult({ request, result }) {
  const createMode = ['create', 'generate', 'build'].includes(
    request.input.speechAct,
  );
  if (result.domain === 'physical') {
    const physical = result.proposal.parameters?.physical;
    assertEqual(physical?.solver, 'deterministic-semi-implicit', 'physical.solver');
    assertEqual(physical?.tickBefore, request.input.physical.tick, 'physical.tickBefore');
    assertEqual(
      physical?.tickAfter,
      createMode ? request.input.physical.tick + 1 : request.input.physical.tick,
      'physical.tickAfter',
    );
    assertEqual(physical?.dtMicros, request.input.physical.dtMicros, 'physical.dtMicros');
    assertEqual(physical?.bodyCount, request.input.physical.bodyCount, 'physical.bodyCount');
    assertEqual(physical?.contactBudget, request.input.physical.contactBudget, 'physical.contactBudget');
    assertEqual(physical?.mutationApplied, createMode, 'physical.mutationApplied');
    assertEqual(
      result.proposal.selectedAction,
      createMode ? 'simulate-constrained-step' : 'inspect-physical-state',
      'physical selectedAction',
    );
    return;
  }
  if (result.domain === 'embodiment') {
    const embodiment = result.proposal.parameters?.embodiment;
    assertEqual(embodiment?.subjectId, request.input.embodiment.subjectId, 'embodiment.subjectId');
    assertEqual(embodiment?.command, request.input.embodiment.command, 'embodiment.command');
    assertEqual(embodiment?.controlMode, 'authority-bounded', 'embodiment.controlMode');
    assertEqual(embodiment?.physicalParentRoot, result.stateDelta.beforeRoot, 'embodiment.physicalParentRoot');
    assertEqual(embodiment?.mutationApplied, createMode, 'embodiment.mutationApplied');
    assertEqual(
      result.proposal.selectedAction,
      createMode ? 'integrate-embodied-state' : 'inspect-embodied-state',
      'embodiment selectedAction',
    );
  }
}

const runtime = createFoundationNativeBatchRuntime({
  label: 'Batch C',
  format: FOUNDATION_NATIVE_BATCH_C_FORMAT,
  requestFormat: FOUNDATION_NATIVE_BATCH_C_REQUEST_FORMAT,
  providerId: FOUNDATION_NATIVE_BATCH_C_PROVIDER_ID,
  realityName: 'FoundationNativeBatchCBridge',
  entries: FOUNDATION_NATIVE_BATCH_C,
  defaultInput: {
    speechAct: 'create',
    physical: {
      tick: 0,
      dtMicros: 16667,
      bodyCount: 2,
      contactBudget: 8,
    },
    embodiment: {
      subjectId: 'body:avatar',
      command: 'walk',
    },
  },
  defaultSeed: 'foundation-native-batch-c-v1',
  bytecodeFilename: 'foundation-batch-c.rbc',
  validateResult: validateBatchCResult,
});

export {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  runFoundationNativeHost,
};

export const normalizeFoundationNativeBatchCRequest = runtime.normalizeRequest;
export const renderFoundationNativeBatchCSource = runtime.renderSource;
export const compileFoundationNativeBatchC = runtime.compile;
export const verifyFoundationNativeBatchCExecution = runtime.verifyExecution;
export const runFoundationNativeBatchC = runtime.run;
