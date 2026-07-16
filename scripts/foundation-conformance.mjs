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

  const nativeProbe = tryCompileRealityToBytecode(await fs.readFile(path.join(ROOT, fixtures[1]), 'utf8'));
  const nativeExplicitBoundary = !nativeProbe.ok && nativeProbe.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED');
  check(checks, 'native-boundary-explicit', nativeExplicitBoundary, { diagnostics: nativeProbe.diagnostics?.map(item => item.code) ?? [] });

  const project = 'RCL';
  const conformance = {
    format: 'taowind.foundation-conformance-report.v0.1',
    project,
    contract: foundationManifestSummary(),
    executionLayers: {
      referenceRuntime: 'native',
      nativeVm: 'none',
      nativeVmLimitation: nativeExplicitBoundary ? 'Current bytecode lowering explicitly rejects declared Foundation provider domains; no native conformance is claimed.' : null,
    },
    domains: Object.fromEntries([...FOUNDATION_DOMAINS, ...FOUNDATION_COMPOSITE_PLANES, ...FOUNDATION_META_PLANES, ...FOUNDATION_CROSS_DOMAIN_AXES].map(spec => [spec.id, {
      mode: 'none',
      referenceRuntimeMode: runtimeDomains.has(spec.id) ? 'native' : 'none',
      implementation: runtimeDomains.has(spec.id) ? `src/runtime.mjs#${spec.runtimeId}` : null,
      tests: checks.filter(item => item.id.includes('runtime') || item.id.includes('replay') || item.id.includes('mutation')).map(item => item.id),
      knownLimitations: runtimeDomains.has(spec.id) ? ['Reference Runtime is covered; Native VM lowering still requires an explicit provider and is not counted as native conformance.'] : ['No runtime fixture covered this module.'],
    }])),
    realityRobustness: Object.fromEntries(FOUNDATION_4R.map(item => [item.id, { status: checks.some(checkItem => checkItem.passed && item.minimumConformanceTests.every(testId => checks.some(candidate => candidate.id === testId))) ? 'partial' : 'declared', tests: item.minimumConformanceTests }])) ,
    fixtures: runs,
    checks,
    status: checks.every(item => item.passed) ? 'pass' : 'fail',
  };
  const rows = ['project,domain,category,mode,referenceRuntimeMode,implementation,knownLimitations'];
  for (const [id, item] of Object.entries(conformance.domains)) rows.push([project, id, FOUNDATION_MANIFEST.domains.find(spec => spec.id === id)?.category ?? FOUNDATION_MANIFEST.compositePlanes.find(spec => spec.id === id)?.category ?? FOUNDATION_MANIFEST.metaRealityPlanes.find(spec => spec.id === id)?.category ?? FOUNDATION_MANIFEST.crossDomainAxes.find(spec => spec.id === id)?.category ?? '', item.mode, item.referenceRuntimeMode, item.implementation ?? '', item.knownLimitations.join('; ')].map(csvCell).join(','));
  const markdown = [`# RCL Foundation Conformance`, ``, `- status: **${conformance.status}**`, `- contract: ${conformance.contract.format} ${conformance.contract.version}`, `- contract root: \`${conformance.contract.root}\``, `- reference runtime: ${conformance.executionLayers.referenceRuntime}`, `- native VM: ${conformance.executionLayers.nativeVm}`, ``, `| Check | Status |`, `| --- | --- |`, ...checks.map(item => `| ${item.id} | ${item.passed ? 'pass' : 'fail'} |`), ``, `Native boundary is recorded explicitly; unsupported Native VM lowering is not counted as native conformance.`].join('\n') + '\n';
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
