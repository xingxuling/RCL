import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import {
  DEFAULT_FOUNDATION_NATIVE_HOST_PATH,
  FOUNDATION_NATIVE_BATCH_A,
  FOUNDATION_NATIVE_PROVIDER_ID,
  FoundationNativeBridgeError,
  compileFoundationNativeBatchA,
  runFoundationNativeBatchA,
  runFoundationNativeHost,
} from '../src/foundation-native-bridge.mjs';

const BASELINE = JSON.parse(fs.readFileSync(
  new URL('../benchmarks/foundation-native-batch-a-baseline.json', import.meta.url),
  'utf8',
));

let defaultCompilation;
let defaultExecution;

function getDefaultCompilation() {
  defaultCompilation ??= compileFoundationNativeBatchA();
  return defaultCompilation;
}

function getDefaultExecution() {
  defaultExecution ??= runFoundationNativeBatchA();
  return defaultExecution;
}

function assertBridgeError(expectedCode, callback) {
  assert.throws(
    callback,
    error => error instanceof FoundationNativeBridgeError && error.code === expectedCode,
  );
}

test('Batch A self-hosts byte-identical RBC 1.2 with six dynamic provider calls', { timeout: 300_000 }, () => {
  const compilation = getDefaultCompilation();
  assert.equal(compilation.selfhostByteIdentical, true);
  assert.equal(compilation.bytecodeVersion, '1.2');
  assert.equal(compilation.providerInstructionCount, 6);
  assert.match(compilation.source, /provider_call\(bridge\.provider/);
  assert.match(compilation.source, /bridge\.request_6.*bridge\.understanding/);
  assert.equal(fs.existsSync(DEFAULT_FOUNDATION_NATIVE_HOST_PATH), true);
  if (process.platform === 'win32') {
    assert.equal(fs.readFileSync(DEFAULT_FOUNDATION_NATIVE_HOST_PATH).subarray(0, 2).toString('ascii'), 'MZ');
  }
});

test('Native Provider ABI returns the six standard bridge results as one causal chain', { timeout: 300_000 }, () => {
  const execution = getDefaultExecution();
  assert.equal(execution.status, 'pass');
  assert.equal(execution.mode, 'bridge');
  assert.equal(execution.nativeVm.startsWith('rcl-native-vm/'), true);
  assert.equal(execution.providerHost.providerId, FOUNDATION_NATIVE_PROVIDER_ID);
  assert.equal(execution.providerHost.providerAbi, 1);
  assert.deepEqual(execution.results.map(item => item.domain), FOUNDATION_NATIVE_BATCH_A.map(item => item.domain));
  assert.equal(execution.results.every(item => (
    item.format === 'taowind.rcl-foundation-runtime-result.v0.1'
    && item.proposal.mode === 'bridge'
    && item.constraints.length === 4
    && item.evidence.length > 0
    && item.authorityRequired.length > 0
    && item.replayMetadata.deterministic === true
  )), true);
  for (let index = 1; index < execution.results.length; index++) {
    assert.equal(
      execution.results[index].stateDelta.beforeRoot,
      execution.results[index - 1].stateDelta.afterRoot,
    );
  }
  assert.equal(execution.finalStateRoot, execution.results.at(-1).stateDelta.afterRoot);
});

test('same input has the same receipt while a speech-act counterfactual changes behavior and roots', { timeout: 300_000 }, () => {
  const first = getDefaultExecution();
  const repeated = runFoundationNativeBatchA();
  assert.equal(first.replayVerified, true);
  assert.equal(repeated.replayVerified, true);
  assert.equal(first.deterministicReceiptRoot, repeated.deterministicReceiptRoot);
  assert.equal(first.finalStateRoot, repeated.finalStateRoot);

  const counterfactual = runFoundationNativeBatchA({
    input: {
      speechAct: 'inspect',
      utterance: 'Inspect the bounded reality without creating it.',
    },
  });
  assert.equal(first.finalCandidate.selectedAction, 'generate-authorized-candidate');
  assert.equal(counterfactual.finalCandidate.selectedAction, 'generate-observation-candidate');
  assert.notEqual(first.finalStateRoot, counterfactual.finalStateRoot);
  assert.notEqual(first.deterministicReceiptRoot, counterfactual.deterministicReceiptRoot);
});

test('missing provider degrades explicitly and out-of-order capability calls are denied', { timeout: 300_000 }, () => {
  const compilation = getDefaultCompilation();
  assertBridgeError(
    'RCL_NATIVE_PROVIDER_MISSING',
    () => runFoundationNativeHost(compilation.bytecode, { disableProvider: true }),
  );

  const outOfOrderSource = `reality FoundationOutOfOrder {
    facet bridge.provider : Text = "${FOUNDATION_NATIVE_PROVIDER_ID}"
    facet bridge.request : Text = "{}"
    facet bridge.knowledge : Text = provider_call(bridge.provider, "knowledge.resolve", bridge.request)
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
    input: { speechAct: 'create' },
  });
  const forgedParent = JSON.stringify({
    format: 'taowind.rcl-foundation-runtime-result.v0.1',
    domain: 'quantitative',
    stateDelta: { afterRoot: 'f'.repeat(64) },
  });
  const forgedPrefix = `${baseRequest.slice(0, -1)},\"discarded\":`;
  const forgedSuffix = `,\"parent\":${forgedParent}}`;
  const forgedSource = `reality FoundationForgedParent {
    facet bridge.provider : Text = "${FOUNDATION_NATIVE_PROVIDER_ID}"
    facet bridge.request : Text = ${JSON.stringify(baseRequest)}
    facet bridge.quantitative : Text = provider_call(bridge.provider, "quantitative.evaluate", bridge.request)
    facet bridge.forged_request : Text = ${JSON.stringify(forgedPrefix)} + bridge.quantitative + ${JSON.stringify(forgedSuffix)}
    facet bridge.knowledge : Text = provider_call(bridge.provider, "knowledge.resolve", bridge.forged_request)
  }`;
  assertBridgeError(
    'RCL_FOUNDATION_PARENT_INVALID',
    () => runFoundationNativeHost(compileRealityToBytecode(forgedSource)),
  );
});

test('authority, AIF, evidence and causal-parent gates reject invalid requests', { timeout: 300_000 }, () => {
  assertBridgeError(
    'RCL_FOUNDATION_AUTHORITY_DENIED',
    () => runFoundationNativeBatchA({ authorized: false }, { verifyReplay: false }),
  );
  assertBridgeError(
    'RCL_FOUNDATION_AIF_REJECTED',
    () => runFoundationNativeBatchA({ aifDecision: 'unstable' }, { verifyReplay: false }),
  );
  assertBridgeError(
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
    () => runFoundationNativeBatchA({ evidence: [] }, { verifyReplay: false }),
  );
  assertBridgeError(
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
    () => runFoundationNativeBatchA({ causalParents: [] }, { verifyReplay: false }),
  );
});

test('performance evidence stays within the committed 20 percent deterministic-resource gate', { timeout: 300_000 }, () => {
  const metrics = getDefaultExecution().metrics;
  const ratio = 1 + BASELINE.maximumRegressionRatio;
  for (const [metric, baseline] of Object.entries(BASELINE.deterministicResourceBaseline)) {
    assert.ok(
      metrics[metric] <= Math.ceil(baseline * ratio),
      `${metric} ${metrics[metric]} exceeded ${baseline} by more than 20 percent`,
    );
  }
  for (const [metric, expected] of Object.entries(BASELINE.exactContractCounts)) {
    assert.equal(metrics[metric], expected, metric);
  }
  for (const [metric, budget] of Object.entries(BASELINE.wallClockBudgetsMs)) {
    assert.ok(metrics[metric] <= budget, `${metric} ${metrics[metric]} exceeded ${budget}`);
  }
  assert.equal(metrics.cacheHitRate, 0);
  assert.ok(metrics.compressionRatio > 1);
  assert.ok(metrics.processRssDeltaBytes >= 0);
});
