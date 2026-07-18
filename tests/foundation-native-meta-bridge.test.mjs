import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_META_BATCH_B,
  FOUNDATION_NATIVE_META_PROVIDER_ID,
  FoundationNativeBridgeError,
  compileFoundationNativeMetaBatchB,
  runFoundationNativeHost,
  runFoundationNativeMetaBatchB,
  verifyFoundationNativeMetaBatchBExecution,
} from '../src/foundation-native-meta-bridge.mjs';

const BASELINE = JSON.parse(fs.readFileSync(
  new URL(
    '../benchmarks/foundation-native-meta-batch-b-baseline.json',
    import.meta.url,
  ),
  'utf8',
));

let defaultCompilation;
let defaultExecution;

function getDefaultCompilation() {
  defaultCompilation ??= compileFoundationNativeMetaBatchB();
  return defaultCompilation;
}

function getDefaultExecution() {
  defaultExecution ??= runFoundationNativeMetaBatchB();
  return defaultExecution;
}

function createInput(speechAct = 'create', overrides = {}) {
  return {
    speechAct,
    timeline: {
      tick: 0,
      observerFrame: 'subjective-bounded',
      eventCount: 1,
      ...overrides.timeline,
    },
    acceleration: {
      requestedFactor: 2,
      fidelityFloor: 1,
      ...overrides.acceleration,
    },
    compression: {
      codec: 'content-addressed',
      restoreRequired: true,
      ...overrides.compression,
    },
  };
}

function assertBridgeError(expectedCode, callback) {
  assert.throws(
    callback,
    error => (
      error instanceof FoundationNativeBridgeError
      && error.code === expectedCode
    ),
  );
}

test('Meta Batch B self-hosts byte-identical RBC 1.2 with three dynamic provider calls', { timeout: 300_000 }, () => {
  const compilation = getDefaultCompilation();
  assert.equal(compilation.selfhostByteIdentical, true);
  assert.equal(compilation.bytecodeVersion, '1.2');
  assert.equal(compilation.providerInstructionCount, 3);
  assert.match(compilation.source, /provider_call\(bridge\.provider/);
  assert.match(
    compilation.source,
    /bridge\.request_3.*bridge\.meta_acceleration/,
  );
  assert.equal(fs.existsSync(DEFAULT_FOUNDATION_NATIVE_HOST_PATH), true);
  if (process.platform === 'win32') {
    assert.equal(
      fs.readFileSync(DEFAULT_FOUNDATION_NATIVE_HOST_PATH)
        .subarray(0, 2)
        .toString('ascii'),
      'MZ',
    );
  }
});

test('native ABI returns three semantic bridge results as one causal chain', { timeout: 300_000 }, () => {
  const execution = getDefaultExecution();
  assert.equal(execution.status, 'pass');
  assert.equal(execution.mode, 'bridge');
  assert.equal(execution.nativeVm.startsWith('rcl-native-vm/'), true);
  assert.equal(
    execution.providerHost.providerId,
    FOUNDATION_NATIVE_META_PROVIDER_ID,
  );
  assert.equal(execution.providerHost.providerAbi, 1);
  assert.deepEqual(
    execution.results.map(item => item.domain),
    FOUNDATION_NATIVE_META_BATCH_B.map(item => item.domain),
  );
  assert.equal(execution.results.every(item => (
    item.format === 'taowind.rcl-foundation-runtime-result.v0.1'
    && item.proposal.mode === 'bridge'
    && item.constraints.length === 4
    && item.evidence.length > 0
    && item.authorityRequired.length > 0
    && item.replayMetadata.deterministic === true
  )), true);

  const [spacetime, acceleration, compression] = execution.results;
  assert.deepEqual(spacetime.proposal.parameters.timeline, {
    ordering: 'causal',
    tickBefore: 0,
    tickAfter: 1,
    eventCount: 1,
    observerFrame: 'subjective-bounded',
    mutationApplied: true,
  });
  assert.equal(acceleration.proposal.parameters.acceleration.effectiveFactor, 2);
  assert.equal(acceleration.proposal.parameters.acceleration.maximumFactor, 8);
  assert.equal(acceleration.proposal.parameters.acceleration.fidelityPreserved, true);
  assert.equal(compression.proposal.parameters.compression.sourceTextBytes, 64);
  assert.equal(compression.proposal.parameters.compression.compressedBytes, 32);
  assert.equal(compression.proposal.parameters.compression.restoreVerified, true);
  assert.equal(
    compression.proposal.parameters.compression.restoreRoot,
    compression.stateDelta.beforeRoot,
  );
  for (let index = 1; index < execution.results.length; index++) {
    assert.equal(
      execution.results[index].stateDelta.beforeRoot,
      execution.results[index - 1].stateDelta.afterRoot,
    );
  }
  assert.equal(
    execution.finalStateRoot,
    execution.results.at(-1).stateDelta.afterRoot,
  );
});

test('replay is deterministic while inspect and clamped acceleration change behavior', { timeout: 300_000 }, () => {
  const first = getDefaultExecution();
  const repeated = runFoundationNativeMetaBatchB();
  assert.equal(first.replayVerified, true);
  assert.equal(repeated.replayVerified, true);
  assert.equal(
    first.deterministicReceiptRoot,
    repeated.deterministicReceiptRoot,
  );
  assert.equal(first.finalStateRoot, repeated.finalStateRoot);

  const inspected = runFoundationNativeMetaBatchB({
    input: createInput('inspect'),
  });
  assert.deepEqual(
    inspected.results.map(item => item.proposal.selectedAction),
    [
      'inspect-causal-timeline',
      'measure-safe-acceleration',
      'verify-lossless-restore',
    ],
  );
  assert.equal(
    inspected.results[0].proposal.parameters.timeline.tickAfter,
    inspected.results[0].proposal.parameters.timeline.tickBefore,
  );
  assert.equal(
    inspected.results[1].proposal.parameters.acceleration.effectiveFactor,
    1,
  );
  assert.equal(
    inspected.results.every(
      item => Object.values(item.proposal.parameters)[0].mutationApplied === false,
    ),
    true,
  );
  assert.notEqual(first.finalStateRoot, inspected.finalStateRoot);
  assert.notEqual(
    first.deterministicReceiptRoot,
    inspected.deterministicReceiptRoot,
  );

  const clamped = runFoundationNativeMetaBatchB({
    input: createInput('create', {
      acceleration: { requestedFactor: 64 },
    }),
  });
  assert.equal(
    clamped.results[1].proposal.parameters.acceleration.effectiveFactor,
    8,
  );
  assert.equal(
    clamped.results[1].proposal.parameters.acceleration.clamped,
    true,
  );
});

test('missing provider, out-of-order calls, and forged parents fail closed', { timeout: 300_000 }, () => {
  const compilation = getDefaultCompilation();
  assertBridgeError(
    'RCL_NATIVE_PROVIDER_MISSING',
    () => runFoundationNativeHost(compilation.bytecode, {
      disableProvider: true,
    }),
  );

  const outOfOrderSource = `reality FoundationMetaOutOfOrder {
    facet bridge.provider : Text = "${FOUNDATION_NATIVE_META_PROVIDER_ID}"
    facet bridge.request : Text = "{}"
    facet bridge.acceleration : Text = provider_call(bridge.provider, "meta.acceleration.bound", bridge.request)
  }`;
  assertBridgeError(
    'RCL_FOUNDATION_CAUSAL_ORDER',
    () => runFoundationNativeHost(compileRealityToBytecode(outOfOrderSource)),
  );

  const baseRequest = JSON.stringify({
    aifDecision: 'stable',
    authorized: true,
    causalParents: ['0'.repeat(64)],
    evidence: [{ type: 'test-evidence' }],
    input: createInput(),
  });
  const forgedParent = JSON.stringify({
    format: 'taowind.rcl-foundation-runtime-result.v0.1',
    domain: 'meta-spacetime',
    stateDelta: { afterRoot: 'f'.repeat(64) },
  });
  const forgedPrefix = `${baseRequest.slice(0, -1)},\"discarded\":`;
  const forgedSuffix = `,\"parent\":${forgedParent}}`;
  const forgedSource = `reality FoundationMetaForgedParent {
    facet bridge.provider : Text = "${FOUNDATION_NATIVE_META_PROVIDER_ID}"
    facet bridge.request : Text = ${JSON.stringify(baseRequest)}
    facet bridge.spacetime : Text = provider_call(bridge.provider, "meta.spacetime.sequence", bridge.request)
    facet bridge.forged_request : Text = ${JSON.stringify(forgedPrefix)} + bridge.spacetime + ${JSON.stringify(forgedSuffix)}
    facet bridge.acceleration : Text = provider_call(bridge.provider, "meta.acceleration.bound", bridge.forged_request)
  }`;
  assertBridgeError(
    'RCL_FOUNDATION_PARENT_INVALID',
    () => runFoundationNativeHost(compileRealityToBytecode(forgedSource)),
  );
});

test('authority, AIF, evidence, and semantic input gates reject invalid requests', { timeout: 300_000 }, () => {
  assertBridgeError(
    'RCL_FOUNDATION_AUTHORITY_DENIED',
    () => runFoundationNativeMetaBatchB(
      { authorized: false },
      { verifyReplay: false },
    ),
  );
  assertBridgeError(
    'RCL_FOUNDATION_AIF_REJECTED',
    () => runFoundationNativeMetaBatchB(
      { aifDecision: 'unstable' },
      { verifyReplay: false },
    ),
  );
  assertBridgeError(
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
    () => runFoundationNativeMetaBatchB(
      { evidence: [] },
      { verifyReplay: false },
    ),
  );
  assertBridgeError(
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
    () => runFoundationNativeMetaBatchB(
      { causalParents: [] },
      { verifyReplay: false },
    ),
  );
  assertBridgeError(
    'RCL_FOUNDATION_META_SPACETIME_INVALID',
    () => runFoundationNativeMetaBatchB({
      input: createInput('create', {
        timeline: { observerFrame: 'unbounded' },
      }),
    }, { verifyReplay: false }),
  );
  assertBridgeError(
    'RCL_FOUNDATION_META_ACCELERATION_INVALID',
    () => runFoundationNativeMetaBatchB({
      input: createInput('create', {
        acceleration: { requestedFactor: 65 },
      }),
    }, { verifyReplay: false }),
  );
  assertBridgeError(
    'RCL_FOUNDATION_META_COMPRESSION_INVALID',
    () => runFoundationNativeMetaBatchB({
      input: createInput('create', {
        compression: { restoreRequired: false },
      }),
    }, { verifyReplay: false }),
  );
});

test('JS semantic verifier rejects a format-valid but forged native receipt', { timeout: 300_000 }, () => {
  const compilation = getDefaultCompilation();
  const host = runFoundationNativeHost(compilation.bytecode);
  const forgedPayload = structuredClone(host.payload);
  const statePath = FOUNDATION_NATIVE_META_BATCH_B[0].statePath;
  const forgedResult = JSON.parse(forgedPayload.native.state[statePath]);
  forgedResult.proposal.parameters.timeline.tickAfter = 999;
  forgedPayload.native.state[statePath] = JSON.stringify(forgedResult);
  assertBridgeError(
    'RCL_FOUNDATION_RESULT_SEMANTICS',
    () => verifyFoundationNativeMetaBatchBExecution(
      forgedPayload,
      compilation.request,
    ),
  );
});

test('performance evidence stays within the committed 20 percent resource gate', { timeout: 300_000 }, () => {
  const metrics = getDefaultExecution().metrics;
  const ratio = 1 + BASELINE.maximumRegressionRatio;
  for (
    const [metric, baseline]
    of Object.entries(BASELINE.deterministicResourceBaseline)
  ) {
    assert.ok(
      metrics[metric] <= Math.ceil(baseline * ratio),
      `${metric} ${metrics[metric]} exceeded ${baseline} by more than 20 percent`,
    );
  }
  for (const [metric, expected] of Object.entries(BASELINE.exactContractCounts)) {
    assert.equal(metrics[metric], expected, metric);
  }
  for (const [metric, budget] of Object.entries(BASELINE.wallClockBudgetsMs)) {
    assert.ok(
      metrics[metric] <= budget,
      `${metric} ${metrics[metric]} exceeded ${budget}`,
    );
  }
  assert.equal(metrics.cacheHitRate, 0);
  assert.ok(metrics.compressionRatio > 1);
  assert.ok(metrics.processRssDeltaBytes >= 0);
});
