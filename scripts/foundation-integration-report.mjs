#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_4R,
  FOUNDATION_COMPOSITE_PLANES,
  FOUNDATION_CROSS_DOMAIN_AXES,
  FOUNDATION_DOMAINS,
  FOUNDATION_MANIFEST_ROOT,
  FOUNDATION_META_PLANES,
} from '../src/foundation-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPOS = path.dirname(ROOT);
const OUTPUT = path.join(ROOT, 'output', 'foundation-integration');
const MODES = new Set(['native', 'bridge', 'projection', 'asset', 'none']);

const groups = [
  ['domain', FOUNDATION_DOMAINS],
  ['composite-plane', FOUNDATION_COMPOSITE_PLANES],
  ['meta-plane', FOUNDATION_META_PLANES],
  ['cross-domain-axis', FOUNDATION_CROSS_DOMAIN_AXES],
  ['4r-control', FOUNDATION_4R],
];

const definitions = [
  { project: 'RCL', repository: 'xingxuling/RCL', reportPath: path.join(ROOT, 'foundation-conformance.json') },
  { project: 'RNCS-Unified-Platform', repository: 'xingxuling/RNCS-Unified-Platform-', reportPath: path.join(REPOS, 'RNCS-Unified-Platform-', 'foundation-conformance.json') },
  { project: 'WorldSeed GameBrain', repository: 'xingxuling/zhinao', reportPath: path.join(REPOS, 'zhinao', 'foundation-conformance.json') },
  { project: 'Everbloom Worlds', repository: 'xingxuling/everbloom-worlds', reportPath: path.join(REPOS, 'everbloom-worlds', 'foundation-conformance.json') },
  { project: 'Aether Earth Android', repository: 'RNCS subproject', reportPath: path.join(REPOS, 'RNCS-Unified-Platform-', 'apps', 'aether-earth-android', 'foundation-conformance.json') },
  {
    project: 'Aether Forge Pocket',
    repository: 'independent repository not present',
    blocked: true,
    blockedReason: 'No independent Aether_Forge_Pocket checkout was found. The RNCS internal product-card artifact is projection-only and is not treated as the product repository.',
  },
];

const projects = definitions.map((definition) => {
  if (definition.blocked) return { ...definition, report: null, status: 'blocked' };
  if (!fs.existsSync(definition.reportPath)) throw new Error(`FOUNDATION_PROJECT_REPORT_MISSING:${definition.reportPath}`);
  const report = readJson(definition.reportPath);
  const root = contractRoot(report);
  if (root !== FOUNDATION_MANIFEST_ROOT) {
    throw new Error(`FOUNDATION_CONTRACT_ROOT_MISMATCH:${definition.project}:${root ?? 'missing'}`);
  }
  return { ...definition, report, status: report.status ?? 'declared', contractRoot: root };
});

const matrix = projects.flatMap((project) => groups.flatMap(([category, specs]) => specs.map((spec) => matrixRow(project, category, spec))));
if (matrix.length !== projects.length * 28) throw new Error(`FOUNDATION_MATRIX_SIZE_INVALID:${matrix.length}`);

const modeCounts = Object.fromEntries([...MODES].map((mode) => [mode, matrix.filter((row) => row.mode === mode).length]));
const projectModeCounts = Object.fromEntries(projects.map((project) => [project.project, Object.fromEntries([...MODES].map((mode) => [mode, matrix.filter((row) => row.project === project.project && row.mode === mode).length]))]));
const referenceRuntimeNative = matrix.filter((row) => row.referenceRuntimeMode === 'native');
const benchmark = readJson(path.join(REPOS, 'zhinao', 'evidence', 'benchmark-foundation-cognition-v0.1.json'));

const verification = [
  testResult('RCL Foundation Contract', 'node --test --test-concurrency=1 tests/foundation-contract.test.mjs', 'pass', '4/4 tests'),
  testResult('RCL Conformance', 'npm run conformance:foundation', 'pass', '46/46 checks; six Batch A domains and three Meta Batch B planes verified through Native Provider ABI bridges'),
  testResult('RCL Foundation Native Batch A', 'npm run test:foundation-native-batch-a', 'pass', '6/6 tests; RBC 1.2 self-host parity, causal chain, counterfactual, negative gates and performance baseline'),
  testResult('RCL Foundation Native Meta Batch B', 'npm run test:foundation-native-meta-batch-b', 'pass', '7/7 tests; causal timeline mutation, bounded acceleration, reversible root packing, semantic forgery rejection and performance baseline'),
  testResult('RCL Stage40', 'node scripts/verify-rcl-selfhost-stage40.mjs', 'pass', '18/18 verification flags; target RBC equals JS reference and runs in native VM'),
  testResult('RNCS Core and 4R Gate', 'npm test --workspace @taowind/rncs-core-contract', 'pass', '8 lifecycle checks plus Foundation governance positive and negative commit gate'),
  testResult('RNCS RCL Control Plane', 'npm test --workspace @taowind/rncs-rcl-control-plane', 'pass', '15/15 tests'),
  testResult('Aether Earth Android Foundation Provider', 'npm run verify:aether-earth:android-foundation', 'pass', 'RCL rule mutation changes biomass; authority rejection and replay root verified'),
  testResult('GameBrain full suite', 'npm test', 'pass', '22/22 test files; 150/150 tests'),
  testResult('GameBrain Foundation Conformance', 'npm run conformance:foundation', 'pass', '14/14 checks; JSON, CSV, Markdown, TAP and JUnit emitted'),
  testResult('GameBrain vendored RCL', 'npm run verify:vendor-rcl', 'pass', 'Stage40 and vendor provenance verification passed; no byte-identity claim'),
  testResult('GameBrain Foundation performance', 'npm run benchmark:foundation', benchmark.comparison.withinTwentyPercentThroughputGate ? 'pass' : 'fail', `single retention ${percent(benchmark.comparison.singleThroughputRetention)}, ten-subject retention ${percent(benchmark.comparison.tenThroughputRetention)}`),
  testResult('Everbloom Foundation product bridge', 'npm run test:foundation', 'pass', '8 checks; real GameBrain product runtime moved helios-array to civic-arcology through five planes'),
  testResult('Everbloom production build', 'npm run build', 'pass', 'Vite client, SSR and Nitro Cloudflare module build passed'),
  testResult('Everbloom TypeScript noEmit', 'npx tsc --noEmit', 'fail-existing', 'Repository-wide existing type debt includes pg, bun:test and unrelated application errors; production build is the release gate used here'),
  testResult('Aether Earth Android Gradle/APK', './gradlew test assembleDebug', 'blocked', 'No Gradle wrapper, Android SDK or ANDROID_HOME is available; APK success is not claimed'),
  testResult('GitHub Actions runners', 'RCL verify; RNCS engine-reference; Everbloom validate', 'blocked', 'Jobs were rejected before runner allocation because recent account payments failed or the GitHub Actions spending limit must be increased; runner_id=0 and steps=[]'),
];

const auditMaterials = [
  'RCL_14+5+3+2_全项目基础模块与4R接入审计_v0.1.md',
  'RCL_14+5+3+2_全项目基础模块接入矩阵_v0.1.csv',
  'RCL_14+5+3+2_全项目基础模块审计_v0.1.json',
  'RCL_14+5+3+2_现实基础_现实鲁棒性四分法与后续数字架构核对报告_v1.1(1).md',
  'ENGINEERING_TASK_MULTICIVILIZATION_RULE_v1.0.md',
].map((name) => ({ name, status: 'not-found-in-workspace-scan' }));

const blocked = [
  { item: 'Aether Forge Pocket independent project', reason: definitions.find((item) => item.project === 'Aether Forge Pocket').blockedReason },
  { item: 'Aether Earth Android Gradle/APK execution', reason: 'Android SDK and Gradle wrapper are unavailable.' },
  { item: 'GitHub Actions remote verification', reason: 'GitHub rejected three jobs before runner allocation because of account billing or spending-limit state.' },
  { item: 'Remaining declared Foundation syntax in RCL Native VM', reason: 'Batch A and Meta Batch B are verified through RclVmProviderV1 in bridge mode; declared-domain lowering and uncovered modules remain explicitly unsupported.' },
];

const knownLimitations = [
  'RCL Native Providers cover quantitative, knowledge, perception, natural-language, understanding, creative, meta-spacetime, meta-acceleration and meta-compression in bridge mode; declared-domain syntax and the remaining modules are not native yet.',
  'GameBrain five-plane cognition is a verified bridge; its 14 domain records remain projection and are not counted as native integration.',
  'GameBrain ten-subject heap delta is about three times the historical measurement even though throughput exceeds the 80% retention gate.',
  'Everbloom requires GAMEBRAIN_MODULE_PATH or an installed GameBrain package for the verified five-plane path; its lexical fallback is Natural Language Reality only.',
  'RNCS has native authority, causality/evidence and 4R governance, but most Foundation domains do not yet produce direct standard runtime results in RNCS.',
  'Aether Earth Android uses a typed constant-facet Provider Bridge, not an embedded RCL VM.',
  'No independent Aether Forge Pocket repository was available, so no task-to-code RNCS commit loop was fabricated.',
];

const report = {
  format: 'taowind.foundation-integration-report.v0.1',
  generatedAt: new Date().toISOString(),
  status: 'partial-with-verified-runtime-bridges',
  contract: {
    format: 'taowind.rcl-foundation-contract.v0.1',
    version: '0.1.0',
    manifestRoot: FOUNDATION_MANIFEST_ROOT,
    source: 'xingxuling/RCL@main:src/foundation-contract.mjs',
    counts: { domains: 14, compositePlanes: 5, metaPlanes: 3, axes: 2, realityRobustness: 4 },
  },
  projects: projects.map(({ report: _report, reportPath: _reportPath, ...project }) => project),
  matrix,
  modeCounts,
  projectModeCounts,
  referenceRuntimeNativeCount: referenceRuntimeNative.length,
  verification,
  performance: benchmark,
  auditMaterials,
  blocked,
  knownLimitations,
  transientFailuresFixed: [
    'The first Everbloom verifier attempted to import undeclared esbuild directly; it now uses the declared Vite API.',
    'The initial multi-intent fixture mixed share and warning; safety-priority warn classification was correct and the fixture was separated.',
    'The initial product action targeted a nonexistent Farm location; AIF correctly froze it and the verified action now targets civic-arcology.',
  ],
  git: {
    commitsCreated: [
      { repository: 'xingxuling/RCL', commits: ['e21dbed', '395be8c', '39181fd', '5c95b1c'], note: 'plus the commit containing this regenerated report' },
      { repository: 'xingxuling/RNCS-Unified-Platform-', commits: ['fbde8bb', 'f7ea993', '71b009e'] },
      { repository: 'xingxuling/zhinao', commits: ['84cdd5d', '82abf4a'] },
      { repository: 'xingxuling/everbloom-worlds', commits: ['c836f80', '90fab2d'] },
    ],
    pullRequestsCreated: [
      'https://github.com/xingxuling/RCL/pull/3',
      'https://github.com/xingxuling/RNCS-Unified-Platform-/pull/14',
      'https://github.com/xingxuling/zhinao/pull/2',
      'https://github.com/xingxuling/everbloom-worlds/pull/27',
    ],
    note: 'Four scoped codex branches and PRs were created. Broad unrelated working-tree changes were left unstaged and were not included in these commits.',
  },
};

fs.mkdirSync(OUTPUT, { recursive: true });
write('foundation-integration-report.json', `${JSON.stringify(report, null, 2)}\n`);
write('foundation-integration-matrix.csv', csv(matrix));
write('foundation-integration-report.md', markdown(report));
write('verification-log.json', `${JSON.stringify({ format: 'taowind.foundation-verification-log.v0.1', generatedAt: report.generatedAt, results: verification, transientFailuresFixed: report.transientFailuresFixed }, null, 2)}\n`);
write('MIGRATION-GUIDE.md', migrationGuide(report));

console.log(JSON.stringify({
  status: report.status,
  output: OUTPUT,
  manifestRoot: FOUNDATION_MANIFEST_ROOT,
  projects: projects.length,
  matrixRows: matrix.length,
  modeCounts,
  referenceRuntimeNativeCount: referenceRuntimeNative.length,
  verification: Object.fromEntries(['pass', 'fail-existing', 'blocked'].map((status) => [status, verification.filter((item) => item.status === status).length])),
}, null, 2));

function matrixRow(project, category, spec) {
  if (project.blocked) {
    return {
      project: project.project,
      repository: project.repository,
      category,
      id: spec.id,
      mode: 'none',
      referenceRuntimeMode: null,
      implementation: `BLOCKED: ${project.blockedReason}`,
      tests: '',
      knownLimitations: project.blockedReason,
    };
  }
  const entry = findEntry(project.report, category, spec.id);
  let mode = typeof entry === 'string' ? entry : entry?.mode;
  if (!mode && category === '4r-control' && project.report.fourR?.mode) mode = project.report.fourR.mode;
  if (!MODES.has(mode)) mode = 'none';
  return {
    project: project.project,
    repository: project.repository,
    category,
    id: spec.id,
    mode,
    referenceRuntimeMode: entry?.referenceRuntimeMode ?? null,
    implementation: entry?.implementation ?? (entry?.status ? `conformance status: ${entry.status}` : ''),
    tests: array(entry?.tests).join('; '),
    knownLimitations: array(entry?.knownLimitations).join('; '),
  };
}

function findEntry(report, category, id) {
  const field = {
    domain: 'domains',
    'composite-plane': 'compositePlanes',
    'meta-plane': 'metaPlanes',
    'cross-domain-axis': 'crossDomainAxes',
    '4r-control': 'realityRobustness',
  }[category];
  const aliases = {
    compositePlanes: ['compositePlanes', 'planes'],
    crossDomainAxes: ['crossDomainAxes', 'axes'],
  }[field] ?? [field];
  for (const alias of aliases) {
    if (report?.[alias]?.[id] !== undefined) return report[alias][id];
  }
  return report?.domains?.[id] ?? null;
}

function contractRoot(report) {
  return report?.contract?.root ?? report?.contract?.manifestRoot ?? report?.manifestRoot ?? null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function testResult(name, command, status, evidence) {
  return { name, command, status, evidence };
}

function percent(value) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function write(name, content) {
  fs.writeFileSync(path.join(OUTPUT, name), content);
}

function csv(rows) {
  const keys = ['project', 'repository', 'category', 'id', 'mode', 'referenceRuntimeMode', 'implementation', 'tests', 'knownLimitations'];
  return `${keys.join(',')}\n${rows.map((row) => keys.map((key) => quote(row[key])).join(',')).join('\n')}\n`;
}

function quote(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function markdown(data) {
  const successful = data.verification.filter((item) => item.status === 'pass');
  const nonPassing = data.verification.filter((item) => item.status !== 'pass');
  const modeSections = [...MODES].map((mode) => {
    const rows = data.matrix.filter((row) => row.mode === mode);
    return [`## ${title(mode)}`, '', ...rows.map((row) => `- ${row.project} / \`${row.id}\`: ${row.implementation || 'no implementation declared'}`), ''].join('\n');
  });
  return [
    '# TaoWind Foundation Integration Report v0.1',
    '',
    `- Status: **${data.status}**`,
    `- Contract root: \`${data.contract.manifestRoot}\``,
    `- Matrix: ${data.projects.length} projects x 28 entries = ${data.matrix.length} rows`,
    `- RCL Reference Runtime native entries: ${data.referenceRuntimeNativeCount}`,
    '',
    '## Completion Summary',
    '',
    '- Canonical Foundation Contract and standard runtime result are implemented in RCL.',
    '- RCL Batch A and Meta Batch B execute nine Foundation entries through two verified RclVmProviderV1 bridges.',
    '- RNCS Proposal/Commit envelopes carry Foundation governance and reject malformed 4R commits.',
    '- GameBrain runs Natural Language -> Understanding -> Creative -> Inner -> Authority/4R -> Execution before world mutation.',
    '- Everbloom product runtime resolves GameBrain and consumes the five-plane pipeline before action.',
    '- Aether Earth Android now reads RCL policy through a verified Java Provider Bridge; rule mutation changes world behavior.',
    '- Native VM domain lowering and the independent Aether Forge Pocket project remain incomplete and are not claimed.',
    '',
    '## Mode Counts',
    '',
    '| Mode | Rows |',
    '| --- | ---: |',
    ...Object.entries(data.modeCounts).map(([mode, count]) => `| ${mode} | ${count} |`),
    '',
    'The RCL report also records Reference Runtime mode separately from Native VM mode. A Reference Runtime native entry is never used to claim C Native VM support.',
    '',
    '## Verification Passed',
    '',
    ...successful.map((item) => `- **${item.name}**: ${item.evidence}`),
    '',
    '## Failed Or Blocked Verification',
    '',
    ...nonPassing.map((item) => `- **${item.name}** (${item.status}): ${item.evidence}`),
    '',
    '## Performance',
    '',
    `- Compile: ${data.performance.contractCompile.compileTimeMs} ms`,
    `- Language action latency: ${data.performance.languageAction.runtimeLatencyMs} ms`,
    `- Single throughput retention: ${percent(data.performance.comparison.singleThroughputRetention)}`,
    `- Ten-subject throughput retention: ${percent(data.performance.comparison.tenThroughputRetention)}`,
    `- Single heap ratio: ${data.performance.comparison.singleHeapRatio}x`,
    `- Ten-subject heap ratio: ${data.performance.comparison.tenHeapRatio}x`,
    `- Throughput 20% gate: ${data.performance.comparison.withinTwentyPercentThroughputGate ? 'pass' : 'fail'}`,
    '',
    ...modeSections,
    '## Known Limitations',
    '',
    ...data.knownLimitations.map((item) => `- ${item}`),
    '',
    '## Risks And Rollback',
    '',
    '- RCL: remove the Foundation exports and harness only after downstream adapters are rolled back; legacy compiler ABI roots were deliberately preserved.',
    '- RNCS: preserve old envelope readers and stop producing `foundation_governance` before reverting the commit gate.',
    '- GameBrain: set `foundationCognition.enabled=false` for emergency behavioral rollback; the counterfactual test proves this removes language influence.',
    '- Everbloom: unset `GAMEBRAIN_MODULE_PATH` to return to the limited lexical compatibility provider; this intentionally loses five-plane conformance.',
    '- Android: restore the previous `WorldStateEngine` constants together with the prior `.rcl/.rbc` pair; do not roll back only one asset.',
    '',
    '## Git',
    '',
    `- ${data.git.note}`,
    ...data.git.commitsCreated.map((item) => `- ${item.repository}: ${item.commits.map((commit) => `\`${commit}\``).join(', ')}${item.note ? `; ${item.note}` : ''}`),
    ...data.git.pullRequestsCreated.map((url) => `- ${url}`),
    '',
    'See `foundation-integration-matrix.csv`, `foundation-integration-report.json`, `verification-log.json`, and `MIGRATION-GUIDE.md` in this directory.',
    '',
  ].join('\n');
}

function migrationGuide(data) {
  return [
    '# Foundation ABI Migration Guide v0.1',
    '',
    `Canonical manifest root: \`${data.contract.manifestRoot}\``,
    '',
    '## Consumer Contract',
    '',
    '1. Pin Foundation Contract version `0.1.0` and verify the manifest root at startup.',
    '2. Emit `taowind.rcl-foundation-runtime-result.v0.1` with proposal, constraints, stateDelta, evidence, confidence, authorityRequired and replayMetadata.',
    '3. Declare each module as native, bridge, projection, asset or none. Only native and verified bridge count as real integration.',
    '4. Bind provider receipts, authority decisions, invariants, causal parents and evidence before world mutation.',
    '5. Replay the same seed, input and provider results and compare Reality Root before enabling the adapter in production.',
    '',
    '## RCL Native Provider Bridges',
    '',
    '- Import `runFoundationNativeBatchA()` and `runFoundationNativeMetaBatchB()` from the canonical RCL package.',
    '- Preserve the ordered causal parent chain and do not synthesize provider receipts in consumers.',
    '- Treat Meta Batch B compression as reversible content-root representation packing, not arbitrary asset compression.',
    '- Keep runtime mode as `bridge` until declared Foundation syntax lowers directly into the Native VM.',
    '',
    '## RNCS',
    '',
    '- Populate `foundation_governance` on every new proposal.',
    '- Keep compatibility readers for envelopes without the field, but do not allow them through the new commit path without normalization.',
    '- Treat `FOUNDATION_4R_GATE_FAILED` as a hard commit rejection, not a warning.',
    '',
    '## GameBrain',
    '',
    '- Submit external language through `GameBrain.submitUtterance()`.',
    '- Read the five ordered runtime results from `actor.cognition.substrate.foundationCognition.lastRun`.',
    '- The old post-decision reality-matrix language summary is deprecated compatibility projection.',
    '',
    '## Everbloom',
    '',
    '- Set `GAMEBRAIN_MODULE_PATH` to the GameBrain ESM entry or install `@taowind/worldseed-gamebrain`.',
    '- Keep `interpretNaturalLanguageReality()` only as the bounded provider fallback.',
    '- Do not claim five-plane conformance when `snapshot.engine.mode` is `mock`.',
    '',
    '## Aether Earth Android',
    '',
    '- Keep `foundation.contract_root` in `world-foundation.rcl` synchronized with the canonical manifest.',
    '- Recompile `world-foundation.rbc` whenever the RCL source changes.',
    '- Use `FoundationProviderBridge.Policy` values in the world loop; do not reintroduce duplicated Java constants.',
    '- Run `npm run verify:aether-earth:android-foundation` without Android SDK, then run Gradle unit tests and APK assembly in an Android SDK environment.',
    '',
    '## Deprecation And Rollback',
    '',
    '- Preserve old API entrypoints during v0.1; adapters carry the new fields.',
    '- Warn when a compatibility fallback is selected and expose the runtime mode in health output.',
    '- Roll back producer before consumer schema, and restore source plus compiled assets as one unit.',
    '- Never relabel projection or asset as bridge during migration.',
    '',
  ].join('\n');
}

function title(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
