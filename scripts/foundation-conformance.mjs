#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_MANIFEST,
  FOUNDATION_DOMAINS,
  FOUNDATION_COMPOSITE_PLANES,
  FOUNDATION_META_PLANES,
  FOUNDATION_CROSS_DOMAIN_AXES,
  FOUNDATION_4R,
  foundationManifestSummary,
  runReality,
  compileReality,
  tryCompileRealityToBytecode,
  FOUNDATION_NATIVE_BATCH_A,
  FOUNDATION_NATIVE_META_BATCH_B,
  FOUNDATION_NATIVE_BATCH_C,
  FOUNDATION_NATIVE_BATCH_D,
  FoundationNativeBridgeError,
  runFoundationNativeBatchA,
  runFoundationNativeMetaBatchB,
  runFoundationNativeBatchC,
  runFoundationNativeBatchD,
} from '../src/index.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_OUT = path.join(ROOT, 'output', 'foundation-conformance');
const fixtures = [
  'examples/eight-domain-foundation.rcl',
  'examples/foundation-closure.rcl',
  'examples/cognitive-creation-agent.rcl',
  'examples/meta-runtime-foundation.rcl',
];

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function check(checks, id, passed, details = {}) {
  checks.push({ id, passed: Boolean(passed), details });
}

function csvCell(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${String(text ?? '').replaceAll('"', '""')}"`;
}

function tap(checks) {
  return [...checks.map((item, index) => `${item.passed ? 'ok' : 'not ok'} ${index + 1} - ${item.id}`), `1..${checks.length}`, `# ${checks.filter(item => item.passed).length} passed, ${checks.filter(item => !item.passed).length} failed`].join('\n') + '\n';
}

function xml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function junit(checks) {
  const failures = checks.filter(item => !item.passed).length;
  const cases = checks.map(item => item.passed
    ? `    <testcase name="${xml(item.id)}"/>`
    : `    <testcase name="${xml(item.id)}"><failure message="conformance check failed">${xml(item.details)}</failure></testcase>`).join('\n');
  return `<testsuite name="RCL Foundation Conformance" tests="${checks.length}" failures="${failures}">\n${cases}\n</testsuite>\n`;
}

function metaBatchBInput(speechAct = 'create', overrides = {}) {
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

function batchCInput(speechAct = 'create', overrides = {}) {
  return {
    speechAct,
    physical: {
      tick: 0,
      dtMicros: 16667,
      bodyCount: 2,
      contactBudget: 8,
      ...overrides.physical,
    },
    embodiment: {
      subjectId: 'body:avatar',
      command: 'walk',
      ...overrides.embodiment,
    },
  };
}

function batchDInput(speechAct = 'create', overrides = {}) {
  return {
    speechAct,
    energy: {
      availableMilliJoules: 120_000,
      requestedMilliJoules: 75_000,
      lossPpm: 10_000,
      tick: 4,
      ...overrides.energy,
    },
    elemental: {
      materialId: 'material:steel',
      massMg: 250_000,
      purityPpm: 950_000,
      temperatureMilliK: 300_000,
      energyUseMilliJoules: 50_000,
      ...overrides.elemental,
    },
    neural: {
      signalId: 'signal:operator',
      amplitudePpm: 850_000,
      memoryBudgetBytes: 4_096,
      attentionWindow: 32,
      inhibitionPpm: 100_000,
      ...overrides.neural,
    },
  };
}

async function main() {
  const out = path.resolve(option('out', DEFAULT_OUT));
  await fs.mkdir(out, { recursive: true });
  const checks = [];
  const runs = [];
  const runtimeDomains = new Set();

  const counts = foundationManifestSummary().counts;
  check(checks, 'manifest-completeness', counts.domains === 14 && counts.compositePlanes === 5 && counts.metaRealityPlanes === 3 && counts.crossDomainAxes === 2 && counts.realityRobustness === 4, { counts });
  const manifestGroups = [FOUNDATION_DOMAINS, FOUNDATION_COMPOSITE_PLANES, FOUNDATION_META_PLANES, FOUNDATION_CROSS_DOMAIN_AXES, FOUNDATION_4R];
  const contractSpecs = manifestGroups.slice(0, 4).flat();
  const completeSpecs = contractSpecs.every(spec => spec.id && spec.chineseName && spec.englishName && spec.category && spec.inputSchema && spec.outputSchema && spec.stateSchema && spec.proposalSchema && spec.constraintSchema && spec.evidenceSchema && spec.deterministicRequirements && spec.supportedExecutionModes?.length && spec.minimumConformanceTests?.length) && FOUNDATION_4R.every(spec => spec.id && spec.chineseName && spec.englishName && spec.category && spec.requiredArtifacts?.length && spec.minimumConformanceTests?.length);
  check(checks, 'manifest-schema-fields', completeSpecs);
  check(checks, 'version-compatibility', FOUNDATION_MANIFEST.format === 'taowind.rcl-foundation-contract.v0.1' && FOUNDATION_MANIFEST.version === '0.1.0');

  for (const fixture of fixtures) {
    const source = await fs.readFile(path.join(ROOT, fixture), 'utf8');
    const result = await runReality(source);
    const domains = [...new Set(result.foundationRuntime.map(item => item.domain))];
    domains.forEach(domain => runtimeDomains.add(domain));
    runs.push({ fixture, stateRoot: result.stateRoot, runtimeRecords: result.foundationRuntime.length, domains });
    check(checks, `runtime-invocation:${fixture}`, result.foundationRuntime.length > 0, { records: result.foundationRuntime.length, domains });
    check(checks, `runtime-result-shape:${fixture}`, result.foundationRuntime.every(item => item.domain && item.proposal && item.stateDelta && Array.isArray(item.constraints) && Array.isArray(item.evidence) && Array.isArray(item.authorityRequired) && typeof item.replayMetadata.deterministic === 'boolean'));
  }
  check(checks, 'module-existence', FOUNDATION_DOMAINS.every(spec => typeof spec.runtimeId === 'string') && FOUNDATION_COMPOSITE_PLANES.every(spec => typeof spec.runtimeId === 'string') && FOUNDATION_META_PLANES.every(spec => typeof spec.runtimeId === 'string'));
  check(checks, 'runtime-coverage', ['metacomputation', 'physical', 'energy', 'elemental', 'perception', 'neural', 'embodiment', 'life', 'genetic', 'quantitative', 'knowledge', 'scientific', 'spiritual', 'natural-language-reality', 'understanding-reality', 'creative-reality', 'execution-reality', 'meta-spacetime', 'meta-acceleration', 'meta-compression'].every(domain => runtimeDomains.has(domain) || domain === 'embodiment'));

  const mutationSource = (await fs.readFile(path.join(ROOT, fixtures[0]), 'utf8')).replace('dt seconds(1)', 'dt seconds(2)');
  const original = await runReality(await fs.readFile(path.join(ROOT, fixtures[0]), 'utf8'));
  const mutated = await runReality(mutationSource);
  check(checks, 'behavior-mutation', original.stateRoot !== mutated.stateRoot, { original: original.stateRoot, mutated: mutated.stateRoot });
  const replay = await runReality(await fs.readFile(path.join(ROOT, fixtures[2]), 'utf8'));
  const replayAgain = await runReality(await fs.readFile(path.join(ROOT, fixtures[2]), 'utf8'));
  check(checks, 'deterministic-replay', replay.stateRoot === replayAgain.stateRoot && JSON.stringify(replay.foundationRuntime) === JSON.stringify(replayAgain.foundationRuntime), { stateRoot: replay.stateRoot });
  check(checks, 'evidence-production', replay.foundationRuntime.some(item => item.evidence.length > 0));

  const deniedSource = `reality DeniedFoundation { facet world.value : Number = 0 subject actor { facet count : Number = 0 } emergence change { cause actor when true needs world.write on world alter world.value <- 1 } realize change }`;
  let authorityRejected = false;
  try { compileReality(deniedSource); } catch (error) { authorityRejected = /warrant|authority|RCL_RULE/.test(`${error.code ?? ''} ${error.message}`); }
  check(checks, 'negative-authority', authorityRejected);
  const invariantSource = `reality BrokenFoundation { embodiment vessel { facet vitality : Number = 0.2 organ core { facet integrity : Number = 1 } maintain vessel.vitality >= 0.8 } embody vessel }`;
  let invariantRejected = false;
  try { await runReality(invariantSource); } catch (error) { invariantRejected = error.code === 'RCL_BODY_HOMEOSTASIS'; }
  check(checks, 'invariant-rejection', invariantRejected);
  check(checks, 'root-consistency', replay.stateRoot === replayAgain.stateRoot && replay.foundationRuntime.every(item => item.stateDelta.beforeRoot && item.stateDelta.afterRoot));

  const nativeBatchA = runFoundationNativeBatchA();
  const nativeCounterfactual = runFoundationNativeBatchA({
    input: {
      speechAct: 'inspect',
      utterance: 'Inspect the bounded reality without creating it.',
    },
  });
  check(checks, 'native-batch-a-runtime-invocation', nativeBatchA.results.length === 6 && nativeBatchA.providerHost.providerCallCount === 6, {
    domains: nativeBatchA.results.map(item => item.domain),
    providerHost: nativeBatchA.providerHost,
  });
  check(checks, 'native-batch-a-result-shape', nativeBatchA.results.every(item => (
    item.format === 'taowind.rcl-foundation-runtime-result.v0.1'
    && item.proposal?.mode === 'bridge'
    && item.evidence.length > 0
    && item.authorityRequired.length > 0
  )));
  check(checks, 'native-batch-a-selfhost', nativeBatchA.selfhostByteIdentical && nativeBatchA.bytecodeVersion === '1.2', {
    bytecodeRoot: nativeBatchA.bytecodeRoot,
    bytecodeVersion: nativeBatchA.bytecodeVersion,
  });
  check(checks, 'native-batch-a-deterministic-replay', nativeBatchA.replayVerified, {
    receiptRoot: nativeBatchA.deterministicReceiptRoot,
  });
  check(checks, 'native-batch-a-behavior-mutation', (
    nativeBatchA.finalCandidate.selectedAction !== nativeCounterfactual.finalCandidate.selectedAction
    && nativeBatchA.finalStateRoot !== nativeCounterfactual.finalStateRoot
  ), {
    originalAction: nativeBatchA.finalCandidate.selectedAction,
    counterfactualAction: nativeCounterfactual.finalCandidate.selectedAction,
    originalRoot: nativeBatchA.finalStateRoot,
    counterfactualRoot: nativeCounterfactual.finalStateRoot,
  });
  check(checks, 'native-batch-a-causal-chain', nativeBatchA.results.every((item, index) => (
    index === 0
      ? item.stateDelta.beforeRoot === nativeBatchA.request.causalParents[0]
      : item.stateDelta.beforeRoot === nativeBatchA.results[index - 1].stateDelta.afterRoot
  )));
  const rejectsNativeBatchA = (request, expectedCode, options = {}) => {
    try {
      runFoundationNativeBatchA(request, { ...options, verifyReplay: false });
      return false;
    } catch (error) {
      return error instanceof FoundationNativeBridgeError && error.code === expectedCode;
    }
  };
  check(checks, 'native-batch-a-negative-authority', rejectsNativeBatchA(
    { authorized: false },
    'RCL_FOUNDATION_AUTHORITY_DENIED',
  ));
  check(checks, 'native-batch-a-invariant-rejection', rejectsNativeBatchA(
    { aifDecision: 'unstable' },
    'RCL_FOUNDATION_AIF_REJECTED',
  ));
  check(checks, 'native-batch-a-evidence-rejection', rejectsNativeBatchA(
    { evidence: [] },
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
  ));
  check(checks, 'native-batch-a-provider-degradation', rejectsNativeBatchA(
    {},
    'RCL_NATIVE_PROVIDER_MISSING',
    { disableProvider: true },
  ));
  const performanceBaseline = JSON.parse(await fs.readFile(path.join(ROOT, 'benchmarks', 'foundation-native-batch-a-baseline.json'), 'utf8'));
  const maximumResourceRatio = 1 + performanceBaseline.maximumRegressionRatio;
  const resourceGatePassed = Object.entries(performanceBaseline.deterministicResourceBaseline).every(
    ([metric, baseline]) => nativeBatchA.metrics[metric] <= Math.ceil(baseline * maximumResourceRatio),
  );
  const wallClockGatePassed = Object.entries(performanceBaseline.wallClockBudgetsMs).every(
    ([metric, budget]) => nativeBatchA.metrics[metric] <= budget,
  );
  check(checks, 'native-batch-a-performance', resourceGatePassed && wallClockGatePassed, {
    metrics: nativeBatchA.metrics,
    baseline: performanceBaseline,
  });

  const nativeMetaBatchB = runFoundationNativeMetaBatchB();
  const nativeMetaCounterfactual = runFoundationNativeMetaBatchB({
    input: metaBatchBInput('inspect'),
  });
  const nativeMetaClamped = runFoundationNativeMetaBatchB({
    input: metaBatchBInput('create', {
      acceleration: { requestedFactor: 64 },
    }),
  });
  check(checks, 'native-meta-batch-b-runtime-invocation', (
    nativeMetaBatchB.results.length === 3
    && nativeMetaBatchB.providerHost.providerCallCount === 3
  ), {
    domains: nativeMetaBatchB.results.map(item => item.domain),
    providerHost: nativeMetaBatchB.providerHost,
  });
  check(checks, 'native-meta-batch-b-result-shape', nativeMetaBatchB.results.every(item => (
    item.format === 'taowind.rcl-foundation-runtime-result.v0.1'
    && item.proposal?.mode === 'bridge'
    && item.evidence.length > 0
    && item.authorityRequired.length > 0
  )));
  check(checks, 'native-meta-batch-b-selfhost', (
    nativeMetaBatchB.selfhostByteIdentical
    && nativeMetaBatchB.bytecodeVersion === '1.2'
  ), {
    bytecodeRoot: nativeMetaBatchB.bytecodeRoot,
    bytecodeVersion: nativeMetaBatchB.bytecodeVersion,
  });
  check(checks, 'native-meta-batch-b-deterministic-replay', nativeMetaBatchB.replayVerified, {
    receiptRoot: nativeMetaBatchB.deterministicReceiptRoot,
  });
  check(checks, 'native-meta-batch-b-behavior-mutation', (
    nativeMetaBatchB.results.every((item, index) => (
      item.proposal.selectedAction
      !== nativeMetaCounterfactual.results[index].proposal.selectedAction
    ))
    && nativeMetaBatchB.finalStateRoot !== nativeMetaCounterfactual.finalStateRoot
  ), {
    originalActions: nativeMetaBatchB.results.map(item => item.proposal.selectedAction),
    counterfactualActions: nativeMetaCounterfactual.results.map(item => item.proposal.selectedAction),
    originalRoot: nativeMetaBatchB.finalStateRoot,
    counterfactualRoot: nativeMetaCounterfactual.finalStateRoot,
  });
  check(checks, 'native-meta-batch-b-causal-chain', nativeMetaBatchB.results.every((item, index) => (
    index === 0
      ? item.stateDelta.beforeRoot === nativeMetaBatchB.request.causalParents[0]
      : item.stateDelta.beforeRoot === nativeMetaBatchB.results[index - 1].stateDelta.afterRoot
  )));
  const [metaSpacetime, metaAcceleration, metaCompression] = nativeMetaBatchB.results;
  check(checks, 'native-meta-batch-b-spacetime-semantics', (
    metaSpacetime.proposal.parameters?.timeline?.ordering === 'causal'
    && metaSpacetime.proposal.parameters.timeline.tickBefore === 0
    && metaSpacetime.proposal.parameters.timeline.tickAfter === 1
    && nativeMetaCounterfactual.results[0].proposal.parameters.timeline.tickAfter === 0
  ), {
    create: metaSpacetime.proposal.parameters,
    inspect: nativeMetaCounterfactual.results[0].proposal.parameters,
  });
  check(checks, 'native-meta-batch-b-acceleration-semantics', (
    metaAcceleration.proposal.parameters?.acceleration?.effectiveFactor === 2
    && metaAcceleration.proposal.parameters.acceleration.maximumFactor === 8
    && metaAcceleration.proposal.parameters.acceleration.fidelityPreserved === true
    && nativeMetaClamped.results[1].proposal.parameters.acceleration.effectiveFactor === 8
    && nativeMetaClamped.results[1].proposal.parameters.acceleration.clamped === true
  ), {
    default: metaAcceleration.proposal.parameters,
    clamped: nativeMetaClamped.results[1].proposal.parameters,
  });
  check(checks, 'native-meta-batch-b-compression-semantics', (
    metaCompression.proposal.parameters?.compression?.sourceTextBytes === 64
    && metaCompression.proposal.parameters.compression.compressedBytes === 32
    && metaCompression.proposal.parameters.compression.reversible === true
    && metaCompression.proposal.parameters.compression.restoreVerified === true
    && metaCompression.proposal.parameters.compression.sourceRoot
      === metaCompression.proposal.parameters.compression.restoreRoot
    && metaCompression.proposal.parameters.compression.sourceRoot
      === metaCompression.stateDelta.beforeRoot
  ), metaCompression.proposal.parameters);
  const rejectsNativeMetaBatchB = (request, expectedCode, options = {}) => {
    try {
      runFoundationNativeMetaBatchB(request, {
        ...options,
        verifyReplay: false,
      });
      return false;
    } catch (error) {
      return (
        error instanceof FoundationNativeBridgeError
        && error.code === expectedCode
      );
    }
  };
  check(checks, 'native-meta-batch-b-negative-authority', rejectsNativeMetaBatchB(
    { authorized: false },
    'RCL_FOUNDATION_AUTHORITY_DENIED',
  ));
  check(checks, 'native-meta-batch-b-invariant-rejection', rejectsNativeMetaBatchB(
    { aifDecision: 'unstable' },
    'RCL_FOUNDATION_AIF_REJECTED',
  ));
  check(checks, 'native-meta-batch-b-evidence-rejection', rejectsNativeMetaBatchB(
    { evidence: [] },
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
  ));
  check(checks, 'native-meta-batch-b-provider-degradation', rejectsNativeMetaBatchB(
    {},
    'RCL_NATIVE_PROVIDER_MISSING',
    { disableProvider: true },
  ));
  check(checks, 'native-meta-batch-b-semantic-rejection', rejectsNativeMetaBatchB(
    {
      input: metaBatchBInput('create', {
        compression: { restoreRequired: false },
      }),
    },
    'RCL_FOUNDATION_META_COMPRESSION_INVALID',
  ));
  const metaPerformanceBaseline = JSON.parse(await fs.readFile(
    path.join(ROOT, 'benchmarks', 'foundation-native-meta-batch-b-baseline.json'),
    'utf8',
  ));
  const metaMaximumResourceRatio = 1 + metaPerformanceBaseline.maximumRegressionRatio;
  const metaResourceGatePassed = Object.entries(
    metaPerformanceBaseline.deterministicResourceBaseline,
  ).every(
    ([metric, baseline]) => (
      nativeMetaBatchB.metrics[metric]
      <= Math.ceil(baseline * metaMaximumResourceRatio)
    ),
  );
  const metaWallClockGatePassed = Object.entries(
    metaPerformanceBaseline.wallClockBudgetsMs,
  ).every(
    ([metric, budget]) => nativeMetaBatchB.metrics[metric] <= budget,
  );
  check(checks, 'native-meta-batch-b-performance', (
    metaResourceGatePassed
    && metaWallClockGatePassed
  ), {
    metrics: nativeMetaBatchB.metrics,
    baseline: metaPerformanceBaseline,
  });

  const nativeBatchC = runFoundationNativeBatchC();
  const nativeBatchCCounterfactual = runFoundationNativeBatchC({
    input: batchCInput('inspect', {
      embodiment: { command: 'observe' },
    }),
  });
  check(checks, 'native-batch-c-runtime-invocation', (
    nativeBatchC.results.length === 2
    && nativeBatchC.providerHost.providerCallCount === 2
  ), {
    domains: nativeBatchC.results.map(item => item.domain),
    providerHost: nativeBatchC.providerHost,
  });
  check(checks, 'native-batch-c-result-shape', nativeBatchC.results.every(item => (
    item.format === 'taowind.rcl-foundation-runtime-result.v0.1'
    && item.proposal?.mode === 'bridge'
    && item.evidence.length > 0
    && item.authorityRequired.length > 0
  )));
  check(checks, 'native-batch-c-selfhost', (
    nativeBatchC.selfhostByteIdentical
    && nativeBatchC.bytecodeVersion === '1.2'
  ), {
    bytecodeRoot: nativeBatchC.bytecodeRoot,
    bytecodeVersion: nativeBatchC.bytecodeVersion,
  });
  check(checks, 'native-batch-c-deterministic-replay', nativeBatchC.replayVerified, {
    receiptRoot: nativeBatchC.deterministicReceiptRoot,
  });
  check(checks, 'native-batch-c-behavior-mutation', (
    nativeBatchC.results.every((item, index) => (
      item.proposal.selectedAction
      !== nativeBatchCCounterfactual.results[index].proposal.selectedAction
    ))
    && nativeBatchC.finalStateRoot !== nativeBatchCCounterfactual.finalStateRoot
  ), {
    originalActions: nativeBatchC.results.map(item => item.proposal.selectedAction),
    counterfactualActions: nativeBatchCCounterfactual.results.map(item => item.proposal.selectedAction),
    originalRoot: nativeBatchC.finalStateRoot,
    counterfactualRoot: nativeBatchCCounterfactual.finalStateRoot,
  });
  check(checks, 'native-batch-c-causal-chain', nativeBatchC.results.every((item, index) => (
    index === 0
      ? item.stateDelta.beforeRoot === nativeBatchC.request.causalParents[0]
      : item.stateDelta.beforeRoot === nativeBatchC.results[index - 1].stateDelta.afterRoot
  )));
  const [physicalResult, embodimentResult] = nativeBatchC.results;
  check(checks, 'native-batch-c-physical-semantics', (
    physicalResult.proposal.parameters?.physical?.solver === 'deterministic-semi-implicit'
    && physicalResult.proposal.parameters.physical.tickBefore === 0
    && physicalResult.proposal.parameters.physical.tickAfter === 1
    && physicalResult.proposal.parameters.physical.mutationApplied === true
  ), physicalResult.proposal.parameters);
  check(checks, 'native-batch-c-embodiment-semantics', (
    embodimentResult.proposal.parameters?.embodiment?.subjectId === 'body:avatar'
    && embodimentResult.proposal.parameters.embodiment.command === 'walk'
    && embodimentResult.proposal.parameters.embodiment.controlMode === 'authority-bounded'
    && embodimentResult.proposal.parameters.embodiment.physicalParentRoot
      === embodimentResult.stateDelta.beforeRoot
  ), embodimentResult.proposal.parameters);
  const rejectsNativeBatchC = (request, expectedCode, options = {}) => {
    try {
      runFoundationNativeBatchC(request, {
        ...options,
        verifyReplay: false,
      });
      return false;
    } catch (error) {
      return error instanceof FoundationNativeBridgeError && error.code === expectedCode;
    }
  };
  check(checks, 'native-batch-c-negative-authority', rejectsNativeBatchC(
    { authorized: false },
    'RCL_FOUNDATION_AUTHORITY_DENIED',
  ));
  check(checks, 'native-batch-c-invariant-rejection', rejectsNativeBatchC(
    { aifDecision: 'unstable' },
    'RCL_FOUNDATION_AIF_REJECTED',
  ));
  check(checks, 'native-batch-c-evidence-rejection', rejectsNativeBatchC(
    { evidence: [] },
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
  ));
  check(checks, 'native-batch-c-provider-degradation', rejectsNativeBatchC(
    {},
    'RCL_NATIVE_PROVIDER_MISSING',
    { disableProvider: true },
  ));
  check(checks, 'native-batch-c-physical-rejection', rejectsNativeBatchC(
    { input: batchCInput('create', { physical: { dtMicros: 0 } }) },
    'RCL_FOUNDATION_PHYSICAL_INVALID',
  ));
  check(checks, 'native-batch-c-embodiment-rejection', rejectsNativeBatchC(
    { input: batchCInput('create', { embodiment: { command: 'fly' } }) },
    'RCL_FOUNDATION_EMBODIMENT_INVALID',
  ));
  const batchCPerformanceBaseline = JSON.parse(await fs.readFile(
    path.join(ROOT, 'benchmarks', 'foundation-native-batch-c-baseline.json'),
    'utf8',
  ));
  const batchCMaximumResourceRatio = 1 + batchCPerformanceBaseline.maximumRegressionRatio;
  const batchCResourceGatePassed = Object.entries(
    batchCPerformanceBaseline.deterministicResourceBaseline,
  ).every(([metric, baseline]) => (
    nativeBatchC.metrics[metric] <= Math.ceil(baseline * batchCMaximumResourceRatio)
  ));
  const batchCWallClockGatePassed = Object.entries(
    batchCPerformanceBaseline.wallClockBudgetsMs,
  ).every(([metric, budget]) => nativeBatchC.metrics[metric] <= budget);
  check(checks, 'native-batch-c-performance', (
    batchCResourceGatePassed
    && batchCWallClockGatePassed
    && Object.entries(batchCPerformanceBaseline.exactContractCounts)
      .every(([metric, expected]) => nativeBatchC.metrics[metric] === expected)
  ), {
    metrics: nativeBatchC.metrics,
    baseline: batchCPerformanceBaseline,
  });

  const nativeBatchD = runFoundationNativeBatchD();
  const nativeBatchDCounterfactual = runFoundationNativeBatchD({
    input: batchDInput('inspect'),
  });
  check(checks, 'native-batch-d-runtime-invocation', (
    nativeBatchD.results.length === 3
    && nativeBatchD.providerHost.providerCallCount === 3
  ), {
    domains: nativeBatchD.results.map(item => item.domain),
    providerHost: nativeBatchD.providerHost,
  });
  check(checks, 'native-batch-d-result-shape', nativeBatchD.results.every(item => (
    item.format === 'taowind.rcl-foundation-runtime-result.v0.1'
    && item.proposal?.mode === 'bridge'
    && item.evidence.length > 0
    && item.authorityRequired.length > 0
  )));
  check(checks, 'native-batch-d-selfhost', (
    nativeBatchD.selfhostByteIdentical
    && nativeBatchD.bytecodeVersion === '1.2'
  ), {
    bytecodeRoot: nativeBatchD.bytecodeRoot,
    bytecodeVersion: nativeBatchD.bytecodeVersion,
  });
  check(checks, 'native-batch-d-deterministic-replay', nativeBatchD.replayVerified, {
    receiptRoot: nativeBatchD.deterministicReceiptRoot,
  });
  check(checks, 'native-batch-d-behavior-mutation', (
    nativeBatchD.results.every((item, index) => (
      item.proposal.selectedAction
      !== nativeBatchDCounterfactual.results[index].proposal.selectedAction
    ))
    && nativeBatchD.finalStateRoot !== nativeBatchDCounterfactual.finalStateRoot
  ), {
    originalActions: nativeBatchD.results.map(item => item.proposal.selectedAction),
    counterfactualActions: nativeBatchDCounterfactual.results.map(item => item.proposal.selectedAction),
    originalRoot: nativeBatchD.finalStateRoot,
    counterfactualRoot: nativeBatchDCounterfactual.finalStateRoot,
  });
  check(checks, 'native-batch-d-causal-chain', nativeBatchD.results.every((item, index) => (
    index === 0
      ? item.stateDelta.beforeRoot === nativeBatchD.request.causalParents[0]
      : item.stateDelta.beforeRoot === nativeBatchD.results[index - 1].stateDelta.afterRoot
  )));
  const [energyResult, elementalResult, neuralResult] = nativeBatchD.results;
  check(checks, 'native-batch-d-energy-semantics', (
    energyResult.proposal.parameters?.energy?.model === 'bounded-transfer-v1'
    && energyResult.proposal.parameters.energy.effectiveMilliJoules === 75_000
    && energyResult.proposal.parameters.energy.deliveredMilliJoules === 74_250
    && energyResult.proposal.parameters.energy.remainingMilliJoules === 45_000
    && energyResult.proposal.parameters.energy.mutationApplied === true
  ), energyResult.proposal.parameters);
  check(checks, 'native-batch-d-elemental-semantics', (
    elementalResult.proposal.parameters?.elemental?.materialId === 'material:steel'
    && elementalResult.proposal.parameters.elemental.compositionState === 'composed'
    && elementalResult.proposal.parameters.elemental.stable === true
    && elementalResult.proposal.parameters.elemental.energyParentRoot
      === elementalResult.stateDelta.beforeRoot
  ), elementalResult.proposal.parameters);
  check(checks, 'native-batch-d-neural-semantics', (
    neuralResult.proposal.parameters?.neural?.signalId === 'signal:operator'
    && neuralResult.proposal.parameters.neural.effectiveAmplitudePpm === 850_000
    && neuralResult.proposal.parameters.neural.retainedMemoryBytes === 2_048
    && neuralResult.proposal.parameters.neural.controlScorePpm === 765_000
    && neuralResult.proposal.parameters.neural.elementalParentRoot
      === neuralResult.stateDelta.beforeRoot
  ), neuralResult.proposal.parameters);
  const rejectsNativeBatchD = (request, expectedCode, options = {}) => {
    try {
      runFoundationNativeBatchD(request, {
        ...options,
        verifyReplay: false,
      });
      return false;
    } catch (error) {
      return error instanceof FoundationNativeBridgeError && error.code === expectedCode;
    }
  };
  check(checks, 'native-batch-d-negative-authority', rejectsNativeBatchD(
    { authorized: false },
    'RCL_FOUNDATION_AUTHORITY_DENIED',
  ));
  check(checks, 'native-batch-d-invariant-rejection', rejectsNativeBatchD(
    { aifDecision: 'unstable' },
    'RCL_FOUNDATION_AIF_REJECTED',
  ));
  check(checks, 'native-batch-d-evidence-rejection', rejectsNativeBatchD(
    { evidence: [] },
    'RCL_FOUNDATION_EVIDENCE_REQUIRED',
  ));
  check(checks, 'native-batch-d-provider-degradation', rejectsNativeBatchD(
    {},
    'RCL_NATIVE_PROVIDER_MISSING',
    { disableProvider: true },
  ));
  check(checks, 'native-batch-d-energy-rejection', rejectsNativeBatchD(
    { input: batchDInput('create', { energy: { lossPpm: 600_000 } }) },
    'RCL_FOUNDATION_ENERGY_INVALID',
  ));
  check(checks, 'native-batch-d-elemental-rejection', rejectsNativeBatchD(
    { input: batchDInput('create', { elemental: { materialId: 'material:glass' } }) },
    'RCL_FOUNDATION_ELEMENTAL_INVALID',
  ));
  check(checks, 'native-batch-d-neural-rejection', rejectsNativeBatchD(
    { input: batchDInput('create', { neural: { signalId: 'signal:unknown' } }) },
    'RCL_FOUNDATION_NEURAL_INVALID',
  ));
  const batchDPerformanceBaseline = JSON.parse(await fs.readFile(
    path.join(ROOT, 'benchmarks', 'foundation-native-batch-d-baseline.json'),
    'utf8',
  ));
  const batchDMaximumResourceRatio = 1 + batchDPerformanceBaseline.maximumRegressionRatio;
  const batchDResourceGatePassed = Object.entries(
    batchDPerformanceBaseline.deterministicResourceBaseline,
  ).every(([metric, baseline]) => (
    nativeBatchD.metrics[metric] <= Math.ceil(baseline * batchDMaximumResourceRatio)
  ));
  const batchDWallClockGatePassed = Object.entries(
    batchDPerformanceBaseline.wallClockBudgetsMs,
  ).every(([metric, budget]) => nativeBatchD.metrics[metric] <= budget);
  check(checks, 'native-batch-d-performance', (
    batchDResourceGatePassed
    && batchDWallClockGatePassed
    && Object.entries(batchDPerformanceBaseline.exactContractCounts)
      .every(([metric, expected]) => nativeBatchD.metrics[metric] === expected)
  ), {
    metrics: nativeBatchD.metrics,
    baseline: batchDPerformanceBaseline,
  });

  const nativeProbe = tryCompileRealityToBytecode(await fs.readFile(path.join(ROOT, fixtures[1]), 'utf8'));
  const nativeExplicitBoundary = !nativeProbe.ok && nativeProbe.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED');
  check(checks, 'native-boundary-explicit', nativeExplicitBoundary, { diagnostics: nativeProbe.diagnostics?.map(item => item.code) ?? [] });

  const project = 'RCL';
  const nativeBatchADomains = new Set(FOUNDATION_NATIVE_BATCH_A.map(item => item.domain));
  const nativeMetaBatchBDomains = new Set(
    FOUNDATION_NATIVE_META_BATCH_B.map(item => item.domain),
  );
  const nativeBatchCDomains = new Set(
    FOUNDATION_NATIVE_BATCH_C.map(item => item.domain),
  );
  const nativeBatchDDomains = new Set(
    FOUNDATION_NATIVE_BATCH_D.map(item => item.domain),
  );
  const nativeBridgeDomains = new Set([
    ...nativeBatchADomains,
    ...nativeMetaBatchBDomains,
    ...nativeBatchCDomains,
    ...nativeBatchDDomains,
  ]);
  const nativeBatchATests = checks.filter(item => item.id.startsWith('native-batch-a-')).map(item => item.id);
  const nativeMetaBatchBTests = checks
    .filter(item => item.id.startsWith('native-meta-batch-b-'))
    .map(item => item.id);
  const nativeBatchCTests = checks
    .filter(item => item.id.startsWith('native-batch-c-'))
    .map(item => item.id);
  const nativeBatchDTests = checks
    .filter(item => item.id.startsWith('native-batch-d-'))
    .map(item => item.id);
  const conformance = {
    format: 'taowind.foundation-conformance-report.v0.1',
    project,
    contract: foundationManifestSummary(),
    executionLayers: {
      referenceRuntime: 'native',
      nativeVm: 'bridge',
      nativeVmLimitation: nativeExplicitBoundary
        ? 'The Native Provider ABI covers Foundation Batch A, Meta Batch B, Batch C and Batch D in bridge mode. Declared Foundation-domain syntax still rejects lowering and is not counted as native mode.'
        : null,
      nativeProviderBridge: {
        mode: 'bridge',
        providerId: nativeBatchA.providerHost.providerId,
        providerAbi: nativeBatchA.providerHost.providerAbi,
        host: 'native/rclfoundation.exe',
        domains: nativeBatchA.results.map(item => item.domain),
        bytecodeVersion: nativeBatchA.bytecodeVersion,
        bytecodeRoot: nativeBatchA.bytecodeRoot,
        deterministicReceiptRoot: nativeBatchA.deterministicReceiptRoot,
        finalStateRoot: nativeBatchA.finalStateRoot,
        metrics: nativeBatchA.metrics,
      },
      nativeMetaProviderBridge: {
        mode: 'bridge',
        providerId: nativeMetaBatchB.providerHost.providerId,
        providerAbi: nativeMetaBatchB.providerHost.providerAbi,
        host: 'native/rclfoundation.exe',
        domains: nativeMetaBatchB.results.map(item => item.domain),
        bytecodeVersion: nativeMetaBatchB.bytecodeVersion,
        bytecodeRoot: nativeMetaBatchB.bytecodeRoot,
        deterministicReceiptRoot: nativeMetaBatchB.deterministicReceiptRoot,
        finalStateRoot: nativeMetaBatchB.finalStateRoot,
        metrics: nativeMetaBatchB.metrics,
      },
      nativeBatchCProviderBridge: {
        mode: 'bridge',
        providerId: nativeBatchC.providerHost.providerId,
        providerAbi: nativeBatchC.providerHost.providerAbi,
        host: 'native/rclfoundation.exe',
        domains: nativeBatchC.results.map(item => item.domain),
        bytecodeVersion: nativeBatchC.bytecodeVersion,
        bytecodeRoot: nativeBatchC.bytecodeRoot,
        deterministicReceiptRoot: nativeBatchC.deterministicReceiptRoot,
        finalStateRoot: nativeBatchC.finalStateRoot,
        metrics: nativeBatchC.metrics,
      },
      nativeBatchDProviderBridge: {
        mode: 'bridge',
        providerId: nativeBatchD.providerHost.providerId,
        providerAbi: nativeBatchD.providerHost.providerAbi,
        host: 'native/rclfoundation.exe',
        domains: nativeBatchD.results.map(item => item.domain),
        bytecodeVersion: nativeBatchD.bytecodeVersion,
        bytecodeRoot: nativeBatchD.bytecodeRoot,
        deterministicReceiptRoot: nativeBatchD.deterministicReceiptRoot,
        finalStateRoot: nativeBatchD.finalStateRoot,
        metrics: nativeBatchD.metrics,
      },
    },
    domains: Object.fromEntries([...FOUNDATION_DOMAINS, ...FOUNDATION_COMPOSITE_PLANES, ...FOUNDATION_META_PLANES, ...FOUNDATION_CROSS_DOMAIN_AXES].map(spec => [spec.id, {
      mode: nativeBridgeDomains.has(spec.id) ? 'bridge' : 'none',
      referenceRuntimeMode: runtimeDomains.has(spec.id) ? 'native' : 'none',
      implementation: nativeBatchADomains.has(spec.id)
        ? 'native/foundation_provider.c + src/foundation-native-bridge.mjs'
        : nativeMetaBatchBDomains.has(spec.id)
        ? 'native/foundation_provider.c + src/foundation-native-meta-bridge.mjs'
        : nativeBatchCDomains.has(spec.id)
          ? 'native/foundation_provider.c + src/foundation-native-batch-c.mjs'
        : nativeBatchDDomains.has(spec.id)
          ? 'native/foundation_provider.c + src/foundation-native-batch-d.mjs'
        : runtimeDomains.has(spec.id) ? `src/runtime.mjs#${spec.runtimeId}` : null,
      tests: nativeBatchADomains.has(spec.id)
        ? nativeBatchATests
        : nativeMetaBatchBDomains.has(spec.id)
          ? nativeMetaBatchBTests
        : nativeBatchCDomains.has(spec.id)
          ? nativeBatchCTests
        : nativeBatchDDomains.has(spec.id)
          ? nativeBatchDTests
        : checks.filter(item => (
          !item.id.startsWith('native-batch-a-')
          && !item.id.startsWith('native-meta-batch-b-')
          && !item.id.startsWith('native-batch-c-')
          && !item.id.startsWith('native-batch-d-')
          && (
            item.id.includes('runtime')
            || item.id.includes('replay')
            || item.id.includes('mutation')
          )
        )).map(item => item.id),
      knownLimitations: nativeBridgeDomains.has(spec.id)
        ? ['Verified through RclVmProviderV1 in bridge mode; declared domain syntax is still not Native VM syntax.']
        : runtimeDomains.has(spec.id)
          ? ['Reference Runtime is covered; Native VM integration is not yet implemented for this domain.']
          : ['No runtime fixture covered this module.'],
    }])),
    realityRobustness: Object.fromEntries(FOUNDATION_4R.map(item => [item.id, { status: checks.some(checkItem => checkItem.passed && item.minimumConformanceTests.every(testId => checks.some(candidate => candidate.id === testId))) ? 'partial' : 'declared', tests: item.minimumConformanceTests }])) ,
    fixtures: runs,
    checks,
    status: checks.every(item => item.passed) ? 'pass' : 'fail',
  };
  const rows = ['project,domain,category,mode,referenceRuntimeMode,implementation,knownLimitations'];
  for (const [id, item] of Object.entries(conformance.domains)) rows.push([project, id, FOUNDATION_MANIFEST.domains.find(spec => spec.id === id)?.category ?? FOUNDATION_MANIFEST.compositePlanes.find(spec => spec.id === id)?.category ?? FOUNDATION_MANIFEST.metaRealityPlanes.find(spec => spec.id === id)?.category ?? FOUNDATION_MANIFEST.crossDomainAxes.find(spec => spec.id === id)?.category ?? '', item.mode, item.referenceRuntimeMode, item.implementation ?? '', item.knownLimitations.join('; ')].map(csvCell).join(','));
  const markdown = [
    '# RCL Foundation Conformance',
    '',
    `- status: **${conformance.status}**`,
    `- contract: ${conformance.contract.format} ${conformance.contract.version}`,
    `- contract root: \`${conformance.contract.root}\``,
    `- reference runtime: ${conformance.executionLayers.referenceRuntime}`,
    `- native VM: ${conformance.executionLayers.nativeVm}`,
    `- Batch A provider: \`${nativeBatchA.providerHost.providerId}\` through \`RclVmProviderV1\``,
    `- Batch A domains: ${nativeBatchA.results.map(item => item.domain).join(', ')}`,
    `- Batch A receipt: \`${nativeBatchA.deterministicReceiptRoot}\``,
    `- Meta Batch B provider: \`${nativeMetaBatchB.providerHost.providerId}\` through \`RclVmProviderV1\``,
    `- Meta Batch B domains: ${nativeMetaBatchB.results.map(item => item.domain).join(', ')}`,
    `- Meta Batch B receipt: \`${nativeMetaBatchB.deterministicReceiptRoot}\``,
    `- Batch C provider: \`${nativeBatchC.providerHost.providerId}\` through \`RclVmProviderV1\``,
    `- Batch C domains: ${nativeBatchC.results.map(item => item.domain).join(', ')}`,
    `- Batch C receipt: \`${nativeBatchC.deterministicReceiptRoot}\``,
    `- Batch D provider: \`${nativeBatchD.providerHost.providerId}\` through \`RclVmProviderV1\``,
    `- Batch D domains: ${nativeBatchD.results.map(item => item.domain).join(', ')}`,
    `- Batch D receipt: \`${nativeBatchD.deterministicReceiptRoot}\``,
    '',
    '| Check | Status |',
    '| --- | --- |',
    ...checks.map(
      item => `| ${item.id} | ${item.passed ? 'pass' : 'fail'} |`,
    ),
    '',
    'Batch A, Meta Batch B, Batch C and Batch D are counted as bridge mode. Unsupported declared-domain lowering remains explicit and is not counted as native mode.',
  ].join('\n') + '\n';
  const json = `${JSON.stringify(conformance, null, 2)}\n`;
  await fs.writeFile(path.join(out, 'foundation-conformance.json'), json);
  await fs.writeFile(path.join(ROOT, 'foundation-conformance.json'), json);
  await fs.writeFile(path.join(out, 'foundation-conformance.csv'), `${rows.join('\n')}\n`);
  await fs.writeFile(path.join(out, 'foundation-conformance.md'), markdown);
  await fs.writeFile(path.join(out, 'foundation-conformance.tap'), tap(checks));
  await fs.writeFile(path.join(out, 'foundation-conformance.junit.xml'), junit(checks));
  console.log(JSON.stringify({ status: conformance.status, out, contractRoot: conformance.contract.root, checkCount: checks.length, failed: checks.filter(item => !item.passed).map(item => item.id) }, null, 2));
  if (conformance.status !== 'pass') process.exitCode = 1;
}

await main();
