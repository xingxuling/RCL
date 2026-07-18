import {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  createFoundationNativeBatchRuntime,
  runFoundationNativeHost,
} from './foundation-native-batch-runtime.mjs';

export const FOUNDATION_NATIVE_BATCH_A_FORMAT =
  'taowind.rcl-foundation-native-batch-a.v0.1';
export const FOUNDATION_NATIVE_BATCH_A_REQUEST_FORMAT =
  'taowind.rcl-foundation-native-batch-a.request.v0.1';
export const FOUNDATION_NATIVE_PROVIDER_ID = 'rcl.foundation.batch-a';

export const FOUNDATION_NATIVE_BATCH_A = Object.freeze([
  Object.freeze({
    domain: 'quantitative',
    capability: 'quantitative.evaluate',
    statePath: 'bridge.quantitative',
  }),
  Object.freeze({
    domain: 'knowledge',
    capability: 'knowledge.resolve',
    statePath: 'bridge.knowledge',
  }),
  Object.freeze({
    domain: 'perception',
    capability: 'perception.observe',
    statePath: 'bridge.perception',
  }),
  Object.freeze({
    domain: 'natural-language-reality',
    capability: 'natural-language.interpret',
    statePath: 'bridge.natural_language',
  }),
  Object.freeze({
    domain: 'understanding-reality',
    capability: 'understanding.model',
    statePath: 'bridge.understanding',
  }),
  Object.freeze({
    domain: 'creative-reality',
    capability: 'creative.generate',
    statePath: 'bridge.creative',
  }),
]);

const runtime = createFoundationNativeBatchRuntime({
  label: 'Batch A',
  format: FOUNDATION_NATIVE_BATCH_A_FORMAT,
  requestFormat: FOUNDATION_NATIVE_BATCH_A_REQUEST_FORMAT,
  providerId: FOUNDATION_NATIVE_PROVIDER_ID,
  realityName: 'FoundationNativeBatchABridge',
  entries: FOUNDATION_NATIVE_BATCH_A,
  defaultInput: {
    speechAct: 'create',
    utterance: 'Create one bounded, evidenced reality candidate.',
  },
  defaultSeed: 'foundation-native-batch-a-v1',
  bytecodeFilename: 'foundation-batch-a.rbc',
});

export {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_HOST_FORMAT,
  FoundationNativeBridgeError,
  runFoundationNativeHost,
};

export const normalizeFoundationNativeBatchARequest =
  runtime.normalizeRequest;
export const renderFoundationNativeBatchASource = runtime.renderSource;
export const compileFoundationNativeBatchA = runtime.compile;
export const verifyFoundationNativeBatchAExecution =
  runtime.verifyExecution;
export const runFoundationNativeBatchA = runtime.run;
