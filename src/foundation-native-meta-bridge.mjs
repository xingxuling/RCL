import {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  createFoundationNativeBatchRuntime,
  runFoundationNativeHost,
} from './foundation-native-batch-runtime.mjs';

export const FOUNDATION_NATIVE_META_BATCH_B_FORMAT =
  'taowind.rcl-foundation-native-meta-batch-b.v0.1';
export const FOUNDATION_NATIVE_META_BATCH_B_REQUEST_FORMAT =
  'taowind.rcl-foundation-native-meta-batch-b.request.v0.1';
export const FOUNDATION_NATIVE_META_PROVIDER_ID =
  'rcl.foundation.meta-batch-b';

export const FOUNDATION_NATIVE_META_BATCH_B = Object.freeze([
  Object.freeze({
    domain: 'meta-spacetime',
    capability: 'meta.spacetime.sequence',
    statePath: 'bridge.meta_spacetime',
  }),
  Object.freeze({
    domain: 'meta-acceleration',
    capability: 'meta.acceleration.bound',
    statePath: 'bridge.meta_acceleration',
  }),
  Object.freeze({
    domain: 'meta-compression',
    capability: 'meta.compression.restore',
    statePath: 'bridge.meta_compression',
  }),
]);

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new TypeError(`${label} must be ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function validateMetaBatchBResult({ request, result }) {
  const createMode = ['create', 'generate', 'build'].includes(
    request.input.speechAct,
  );
  if (result.domain === 'meta-spacetime') {
    const timeline = result.proposal.parameters?.timeline;
    assertEqual(timeline?.ordering, 'causal', 'timeline.ordering');
    assertEqual(timeline?.tickBefore, request.input.timeline.tick, 'timeline.tickBefore');
    assertEqual(
      timeline?.tickAfter,
      createMode
        ? request.input.timeline.tick + request.input.timeline.eventCount
        : request.input.timeline.tick,
      'timeline.tickAfter',
    );
    assertEqual(
      timeline?.eventCount,
      request.input.timeline.eventCount,
      'timeline.eventCount',
    );
    assertEqual(
      timeline?.observerFrame,
      request.input.timeline.observerFrame,
      'timeline.observerFrame',
    );
    assertEqual(
      timeline?.mutationApplied,
      createMode,
      'timeline.mutationApplied',
    );
    assertEqual(
      result.proposal.selectedAction,
      createMode
        ? 'schedule-causal-transition'
        : 'inspect-causal-timeline',
      'meta-spacetime selectedAction',
    );
    return;
  }

  if (result.domain === 'meta-acceleration') {
    const acceleration = result.proposal.parameters?.acceleration;
    const requestedFactor = request.input.acceleration.requestedFactor;
    assertEqual(acceleration?.mode, 'bounded', 'acceleration.mode');
    assertEqual(
      acceleration?.requestedFactor,
      requestedFactor,
      'acceleration.requestedFactor',
    );
    assertEqual(
      acceleration?.effectiveFactor,
      createMode ? Math.min(requestedFactor, 8) : 1,
      'acceleration.effectiveFactor',
    );
    assertEqual(acceleration?.maximumFactor, 8, 'acceleration.maximumFactor');
    assertEqual(
      acceleration?.fidelityFloor,
      request.input.acceleration.fidelityFloor,
      'acceleration.fidelityFloor',
    );
    assertEqual(
      acceleration?.fidelityPreserved,
      true,
      'acceleration.fidelityPreserved',
    );
    assertEqual(
      acceleration?.clamped,
      requestedFactor > 8,
      'acceleration.clamped',
    );
    assertEqual(
      acceleration?.mutationApplied,
      createMode,
      'acceleration.mutationApplied',
    );
    assertEqual(
      result.proposal.selectedAction,
      createMode
        ? 'accelerate-with-fidelity-budget'
        : 'measure-safe-acceleration',
      'meta-acceleration selectedAction',
    );
    return;
  }

  if (result.domain === 'meta-compression') {
    const compression = result.proposal.parameters?.compression;
    assertEqual(
      compression?.codec,
      'content-addressed-root-pack-v1',
      'compression.codec',
    );
    assertEqual(
      compression?.scope,
      'content-root-representation',
      'compression.scope',
    );
    assertEqual(compression?.sourceTextBytes, 64, 'compression.sourceTextBytes');
    assertEqual(compression?.compressedBytes, 32, 'compression.compressedBytes');
    assertEqual(compression?.reversible, true, 'compression.reversible');
    assertEqual(
      compression?.restoreRequired,
      true,
      'compression.restoreRequired',
    );
    assertEqual(
      compression?.sourceRoot,
      result.stateDelta.beforeRoot,
      'compression.sourceRoot',
    );
    assertEqual(
      compression?.restoreRoot,
      compression?.sourceRoot,
      'compression.restoreRoot',
    );
    assertEqual(
      compression?.restoreVerified,
      true,
      'compression.restoreVerified',
    );
    assertEqual(
      compression?.mutationApplied,
      createMode,
      'compression.mutationApplied',
    );
    assertEqual(
      result.proposal.selectedAction,
      createMode
        ? 'compress-with-restore-contract'
        : 'verify-lossless-restore',
      'meta-compression selectedAction',
    );
  }
}

const runtime = createFoundationNativeBatchRuntime({
  label: 'Meta Batch B',
  format: FOUNDATION_NATIVE_META_BATCH_B_FORMAT,
  requestFormat: FOUNDATION_NATIVE_META_BATCH_B_REQUEST_FORMAT,
  providerId: FOUNDATION_NATIVE_META_PROVIDER_ID,
  realityName: 'FoundationNativeMetaBatchBBridge',
  entries: FOUNDATION_NATIVE_META_BATCH_B,
  defaultInput: {
    speechAct: 'create',
    timeline: {
      tick: 0,
      observerFrame: 'subjective-bounded',
      eventCount: 1,
    },
    acceleration: {
      requestedFactor: 2,
      fidelityFloor: 1,
    },
    compression: {
      codec: 'content-addressed',
      restoreRequired: true,
    },
  },
  defaultSeed: 'foundation-native-meta-batch-b-v1',
  bytecodeFilename: 'foundation-meta-batch-b.rbc',
  validateResult: validateMetaBatchBResult,
});

export {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  runFoundationNativeHost,
};

export const normalizeFoundationNativeMetaBatchBRequest =
  runtime.normalizeRequest;
export const renderFoundationNativeMetaBatchBSource = runtime.renderSource;
export const compileFoundationNativeMetaBatchB = runtime.compile;
export const verifyFoundationNativeMetaBatchBExecution =
  runtime.verifyExecution;
export const runFoundationNativeMetaBatchB = runtime.run;
