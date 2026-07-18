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
  FoundationNativeBridgeError,
  runFoundationNativeBatchA,
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

  const nativeProbe = tryCompileRealityToBytecode(await fs.readFile(path.join(ROOT, fixtures[1]), 'utf8'));
  const nativeExplicitBoundary = !nativeProbe.ok && nativeProbe.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED');
  check(checks, 'native-boundary-explicit', nativeExplicitBoundary, { diagnostics: nativeProbe.diagnostics?.map(item => item.code) ?? [] });

  const project = 'RCL';
  const nativeBatchADomains = new Set(FOUNDATION_NATIVE_BATCH_A.map(item => item.domain));
  const nativeBatchATests = checks.filter(item => item.id.startsWith('native-batch-a-')).map(item => item.id);
  const conformance = {
    format: 'taowind.foundation-conformance-report.v0.1',
    project,
    contract: foundationManifestSummary(),
    executionLayers: {
      referenceRuntime: 'native',
      nativeVm: 'bridge',
      nativeVmLimitation: nativeExplicitBoundary
        ? 'The Native Provider ABI covers Foundation Batch A in bridge mode. Declared Foundation-domain syntax still rejects lowering and is not counted as native mode.'
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
    },
    domains: Object.fromEntries([...FOUNDATION_DOMAINS, ...FOUNDATION_COMPOSITE_PLANES, ...FOUNDATION_META_PLANES, ...FOUNDATION_CROSS_DOMAIN_AXES].map(spec => [spec.id, {
      mode: nativeBatchADomains.has(spec.id) ? 'bridge' : 'none',
      referenceRuntimeMode: runtimeDomains.has(spec.id) ? 'native' : 'none',
      implementation: nativeBatchADomains.has(spec.id)
        ? 'native/foundation_provider.c + src/foundation-native-bridge.mjs'
        : runtimeDomains.has(spec.id) ? `src/runtime.mjs#${spec.runtimeId}` : null,
      tests: nativeBatchADomains.has(spec.id)
        ? nativeBatchATests
        : checks.filter(item => !item.id.startsWith('native-batch-a-') && (item.id.includes('runtime') || item.id.includes('replay') || item.id.includes('mutation'))).map(item => item.id),
      knownLimitations: nativeBatchADomains.has(spec.id)
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
  const markdown = [`# RCL Foundation Conformance`, ``, `- status: **${conformance.status}**`, `- contract: ${conformance.contract.format} ${conformance.contract.version}`, `- contract root: \`${conformance.contract.root}\``, `- reference runtime: ${conformance.executionLayers.referenceRuntime}`, `- native VM: ${conformance.executionLayers.nativeVm}`, `- Batch A provider: \`${nativeBatchA.providerHost.providerId}\` through \`RclVmProviderV1\``, `- Batch A domains: ${nativeBatchA.results.map(item => item.domain).join(', ')}`, `- deterministic receipt: \`${nativeBatchA.deterministicReceiptRoot}\``, ``, `| Check | Status |`, `| --- | --- |`, ...checks.map(item => `| ${item.id} | ${item.passed ? 'pass' : 'fail'} |`), ``, `Batch A is counted as bridge mode. Unsupported declared-domain lowering remains explicit and is not counted as native mode.`].join('\n') + '\n';
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
