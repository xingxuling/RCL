import {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  createFoundationNativeBatchRuntime,
  runFoundationNativeHost,
} from './foundation-native-batch-runtime.mjs';

export const FOUNDATION_NATIVE_BATCH_D_FORMAT =
  'taowind.rcl-foundation-native-batch-d.v0.1';
export const FOUNDATION_NATIVE_BATCH_D_REQUEST_FORMAT =
  'taowind.rcl-foundation-native-batch-d.request.v0.1';
export const FOUNDATION_NATIVE_BATCH_D_PROVIDER_ID =
  'rcl.foundation.batch-d';

export const FOUNDATION_NATIVE_BATCH_D = Object.freeze([
  Object.freeze({
    domain: 'energy',
    capability: 'energy.balance',
    statePath: 'bridge.energy',
  }),
  Object.freeze({
    domain: 'elemental',
    capability: 'elemental.compose',
    statePath: 'bridge.elemental',
  }),
  Object.freeze({
    domain: 'neural',
    capability: 'neural.integrate',
    statePath: 'bridge.neural',
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

function validateBatchDResult({ request, result }) {
  const createMode = isCreateMode(request.input.speechAct);

  if (result.domain === 'energy') {
    const energy = result.proposal.parameters?.energy;
    const input = request.input.energy;
    const effective = createMode
      ? Math.min(input.requestedMilliJoules, input.availableMilliJoules)
      : 0;
    const loss = Math.floor(effective * input.lossPpm / 1_000_000);
    assertEqual(energy?.model, 'bounded-transfer-v1', 'energy.model');
    assertEqual(energy?.availableMilliJoules, input.availableMilliJoules, 'energy.availableMilliJoules');
    assertEqual(energy?.requestedMilliJoules, input.requestedMilliJoules, 'energy.requestedMilliJoules');
    assertEqual(energy?.effectiveMilliJoules, effective, 'energy.effectiveMilliJoules');
    assertEqual(energy?.lossPpm, input.lossPpm, 'energy.lossPpm');
    assertEqual(energy?.lossMilliJoules, loss, 'energy.lossMilliJoules');
    assertEqual(energy?.deliveredMilliJoules, effective - loss, 'energy.deliveredMilliJoules');
    assertEqual(energy?.remainingMilliJoules, input.availableMilliJoules - effective, 'energy.remainingMilliJoules');
    assertEqual(energy?.tickBefore, input.tick, 'energy.tickBefore');
    assertEqual(energy?.tickAfter, createMode ? input.tick + 1 : input.tick, 'energy.tickAfter');
    assertEqual(energy?.clamped, input.requestedMilliJoules > input.availableMilliJoules, 'energy.clamped');
    assertEqual(energy?.mutationApplied, createMode, 'energy.mutationApplied');
    assertEqual(
      result.proposal.selectedAction,
      createMode ? 'transfer-bounded-energy' : 'inspect-energy-budget',
      'energy selectedAction',
    );
    return;
  }

  if (result.domain === 'elemental') {
    const elemental = result.proposal.parameters?.elemental;
    const input = request.input.elemental;
    assertEqual(elemental?.materialId, input.materialId, 'elemental.materialId');
    assertEqual(elemental?.massMg, input.massMg, 'elemental.massMg');
    assertEqual(elemental?.purityPpm, input.purityPpm, 'elemental.purityPpm');
    assertEqual(elemental?.temperatureMilliK, input.temperatureMilliK, 'elemental.temperatureMilliK');
    assertEqual(elemental?.energyUseMilliJoules, input.energyUseMilliJoules, 'elemental.energyUseMilliJoules');
    assertEqual(elemental?.energyParentRoot, result.stateDelta.beforeRoot, 'elemental.energyParentRoot');
    assertEqual(elemental?.compositionState, createMode ? 'composed' : 'observed', 'elemental.compositionState');
    assertEqual(elemental?.stable, input.purityPpm >= 900_000, 'elemental.stable');
    assertEqual(elemental?.mutationApplied, createMode, 'elemental.mutationApplied');
    assertEqual(
      result.proposal.selectedAction,
      createMode ? 'compose-bounded-material' : 'inspect-material-composition',
      'elemental selectedAction',
    );
    return;
  }

  if (result.domain === 'neural') {
    const neural = result.proposal.parameters?.neural;
    const input = request.input.neural;
    const effectiveAmplitude = createMode ? input.amplitudePpm : 0;
    const attentionCapacity = input.attentionWindow * 64;
    const retainedMemory = createMode
      ? Math.min(input.memoryBudgetBytes, attentionCapacity)
      : 0;
    const controlScore = Math.floor(
      effectiveAmplitude * (1_000_000 - input.inhibitionPpm) / 1_000_000,
    );
    assertEqual(neural?.signalId, input.signalId, 'neural.signalId');
    assertEqual(neural?.amplitudePpm, input.amplitudePpm, 'neural.amplitudePpm');
    assertEqual(neural?.effectiveAmplitudePpm, effectiveAmplitude, 'neural.effectiveAmplitudePpm');
    assertEqual(neural?.memoryBudgetBytes, input.memoryBudgetBytes, 'neural.memoryBudgetBytes');
    assertEqual(neural?.retainedMemoryBytes, retainedMemory, 'neural.retainedMemoryBytes');
    assertEqual(neural?.attentionWindow, input.attentionWindow, 'neural.attentionWindow');
    assertEqual(neural?.inhibitionPpm, input.inhibitionPpm, 'neural.inhibitionPpm');
    assertEqual(neural?.controlScorePpm, controlScore, 'neural.controlScorePpm');
    assertEqual(neural?.elementalParentRoot, result.stateDelta.beforeRoot, 'neural.elementalParentRoot');
    assertEqual(neural?.mutationApplied, createMode, 'neural.mutationApplied');
    assertEqual(
      result.proposal.selectedAction,
      createMode ? 'integrate-signal-control' : 'inspect-neural-state',
      'neural selectedAction',
    );
  }
}

const runtime = createFoundationNativeBatchRuntime({
  label: 'Batch D',
  format: FOUNDATION_NATIVE_BATCH_D_FORMAT,
  requestFormat: FOUNDATION_NATIVE_BATCH_D_REQUEST_FORMAT,
  providerId: FOUNDATION_NATIVE_BATCH_D_PROVIDER_ID,
  realityName: 'FoundationNativeBatchDBridge',
  entries: FOUNDATION_NATIVE_BATCH_D,
  defaultInput: {
    speechAct: 'create',
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
  defaultSeed: 'foundation-native-batch-d-v1',
  bytecodeFilename: 'foundation-batch-d.rbc',
  validateResult: validateBatchDResult,
});

export {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  runFoundationNativeHost,
};

export const normalizeFoundationNativeBatchDRequest = runtime.normalizeRequest;
export const renderFoundationNativeBatchDSource = runtime.renderSource;
export const compileFoundationNativeBatchD = runtime.compile;
export const verifyFoundationNativeBatchDExecution = runtime.verifyExecution;
export const runFoundationNativeBatchD = runtime.run;
