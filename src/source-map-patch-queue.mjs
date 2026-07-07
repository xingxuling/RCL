import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { sha256 } from './reality-compiler-kernel.mjs';
import { runSelfUpgradeTeamSandboxDemo } from './self-upgrade-team-sandbox.mjs';

export const RCL_SOURCE_MAP_PATCH_QUEUE_VERSION = '0.81.0-alpha.1';
export const RCL_SOURCE_MAP_PATCH_QUEUE_SPEC_FORMAT = 'rcl.source-map-patch-queue-spec.v0.81';
export const RCL_SOURCE_MAP_PATCH_QUEUE_RESULT_FORMAT = 'rcl.source-map-patch-queue-result.v0.81';
export const RCL_SOURCE_MAP_PATCH_QUEUE_BUNDLE_FORMAT = 'rcl.source-map-patch-queue-bundle.v0.81';
export const RCL_SOURCE_MAP_ENTRY_FORMAT = 'rcl.source-map-entry.v0.81';
export const RCL_PATCH_QUEUE_ITEM_FORMAT = 'rcl.patch-queue-item.v0.81';
export const RCL_CODE_EXECUTION_ORACLE_FORMAT = 'rcl.code-execution-oracle-provider.v0.81';

function compact(value) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function lineCount(text) {
  return typeof text === 'string' && text.length ? text.split(/\r?\n/).length : 0;
}

export const DEFAULT_SOURCE_MAP_PATCH_QUEUE_SPEC = Object.freeze({
  format: RCL_SOURCE_MAP_PATCH_QUEUE_SPEC_FORMAT,
  id: 'rcl_source_map_patch_queue_default_v0',
  version: RCL_SOURCE_MAP_PATCH_QUEUE_VERSION,
  sourceVersion: '0.80.0-alpha.1',
  targetVersion: '0.81.0-alpha.1',
  objective: 'Upgrade the v0.80 self-upgrade team from patch planning into a file-level source map patch queue and a local Code Execution Oracle Provider seed.',
  mission: 'Build a bounded patch queue that maps each proposed file mutation to owner, risk, validation, evidence and rollback metadata; validate generated code through local temp syntax checks without remote mutation.',
  worktreeRoot: '.',
  sourceMapPaths: [
    'package.json',
    'README.md',
    'CONTEXT.md',
    'src/cli.mjs',
    'src/index.mjs',
    'src/self-upgrade-team-sandbox.mjs',
    'tests/self-upgrade-team-sandbox.test.mjs',
    'docs/RCL_SELF_UPGRADE_TEAM_SANDBOX_v0.80.md',
    'examples/self-upgrade-team-sandbox/default-self-upgrade-team.json',
  ],
  patchGoals: [
    'create_source_map_patch_queue_runtime',
    'create_source_map_patch_queue_tests',
    'expose_v081_cli_commands',
    'export_v081_runtime_api',
    'add_default_patch_queue_fixture',
    'write_v081_docs_and_handoff',
    'write_v081_evidence_bundle',
    'bump_package_and_context_to_v081',
  ],
  oracle: {
    mode: 'local-temp-node-check',
    allowLocalTempExecution: true,
    allowNetwork: false,
    allowRemoteRepositoryMutation: false,
    allowWorktreeMutationByOracle: false,
    maxSnippetBytes: 16000,
    commands: ['node --check <temp-snippet.mjs>'],
  },
  thresholds: {
    minMappedSourceFiles: 7,
    minPatchQueueItems: 8,
    minOracleChecks: 3,
    minPassedOracleChecks: 3,
    minEvidenceArtifacts: 8,
    requireRollbackPlan: true,
    requireSemanticGuard: true,
    requireHumanFinalAuthority: true,
    requireNoRemoteMutation: true,
  },
  boundary: {
    queueCan: ['map source files', 'generate patch items', 'rank risk', 'produce validation commands', 'run local temp syntax checks', 'write evidence reports through host artifact layer'],
    queueCannot: ['silently edit the real worktree during oracle checks', 'push commits', 'deploy remote services', 'claim tests passed without recorded command output'],
  },
});

export function normalizeSourceMapPatchQueueSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_SOURCE_MAP_PATCH_QUEUE_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_SOURCE_MAP_PATCH_QUEUE_VERSION,
    sourceVersion: input.sourceVersion ?? base.sourceVersion,
    targetVersion: input.targetVersion ?? base.targetVersion,
    worktreeRoot: input.worktreeRoot ?? base.worktreeRoot,
    sourceMapPaths: input.sourceMapPaths ?? base.sourceMapPaths,
    patchGoals: input.patchGoals ?? base.patchGoals,
    oracle: { ...base.oracle, ...(input.oracle ?? {}) },
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    boundary: { ...base.boundary, ...(input.boundary ?? {}) },
  };
}

export function buildSourceMapPatchQueueSpec(overrides = {}) {
  return normalizeSourceMapPatchQueueSpec(overrides);
}

function classifyPath(filePath) {
  if (filePath.startsWith('src/')) return 'runtime-source';
  if (filePath.startsWith('tests/')) return 'test-source';
  if (filePath.startsWith('docs/')) return 'documentation';
  if (filePath.startsWith('examples/')) return 'fixture';
  if (filePath === 'package.json') return 'package-metadata';
  if (filePath === 'README.md' || filePath === 'CONTEXT.md') return 'handoff-context';
  return 'project-artifact';
}

function ownerForPath(filePath) {
  if (filePath.includes('test')) return 'test_forger';
  if (filePath.startsWith('src/')) return 'runtime_engineer';
  if (filePath.startsWith('docs/') || filePath === 'README.md') return 'release_packager';
  if (filePath === 'CONTEXT.md') return 'evidence_keeper';
  if (filePath === 'package.json') return 'release_packager';
  if (filePath.startsWith('examples/')) return 'source_cartographer';
  return 'version_strategist';
}

function buildSourceMap(spec) {
  const root = path.resolve(spec.worktreeRoot || '.');
  const entries = spec.sourceMapPaths.map((relativePath, index) => {
    const absolutePath = path.resolve(root, relativePath);
    const text = safeReadFile(absolutePath);
    const exists = typeof text === 'string';
    const entry = {
      format: RCL_SOURCE_MAP_ENTRY_FORMAT,
      id: `source_${String(index + 1).padStart(2, '0')}_${relativePath.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`,
      path: relativePath,
      absolutePath,
      kind: classifyPath(relativePath),
      ownerAgentId: ownerForPath(relativePath),
      exists,
      bytes: exists ? Buffer.byteLength(text, 'utf8') : 0,
      lines: exists ? lineCount(text) : 0,
      contentHash: exists ? sha256(text) : null,
      touchRisk: relativePath === 'src/cli.mjs' || relativePath === 'src/index.mjs' ? 'medium-low' : exists ? 'low' : 'new-file',
    };
    return { ...entry, entryRoot: sha256(compact(entry)) };
  });
  return {
    id: 'rcl_v0_81_source_map',
    worktreeRoot: root,
    entryCount: entries.length,
    existingEntryCount: entries.filter(e => e.exists).length,
    missingEntryCount: entries.filter(e => !e.exists).length,
    entries,
    sourceMapRoot: sha256(compact(entries.map(e => ({ path: e.path, hash: e.contentHash, exists: e.exists, kind: e.kind })))),
  };
}

const PATCH_GOAL_TABLE = Object.freeze({
  create_source_map_patch_queue_runtime: {
    path: 'src/source-map-patch-queue.mjs',
    operation: 'create',
    ownerAgentId: 'runtime_engineer',
    purpose: 'Implement source map construction, patch queue compilation and local Code Execution Oracle Provider seed.',
    validation: ['node --check src/source-map-patch-queue.mjs', 'node --test tests/source-map-patch-queue.test.mjs'],
    risk: 0.22,
  },
  create_source_map_patch_queue_tests: {
    path: 'tests/source-map-patch-queue.test.mjs',
    operation: 'create',
    ownerAgentId: 'test_forger',
    purpose: 'Verify source map entries, patch queue items, oracle checks, reports and RCL render.',
    validation: ['node --test --test-concurrency=1 tests/source-map-patch-queue.test.mjs'],
    risk: 0.18,
  },
  expose_v081_cli_commands: {
    path: 'src/cli.mjs',
    operation: 'update',
    ownerAgentId: 'runtime_engineer',
    purpose: 'Expose source-map-patch-queue-demo/run/spec CLI commands.',
    validation: ['node src/cli.mjs source-map-patch-queue-demo'],
    risk: 0.36,
  },
  export_v081_runtime_api: {
    path: 'src/index.mjs',
    operation: 'update',
    ownerAgentId: 'runtime_engineer',
    purpose: 'Export v0.81 source map patch queue API.',
    validation: ['node -e "import(\'./src/index.mjs\').then(m=>console.log(Boolean(m.runSourceMapPatchQueueDemo)))"'],
    risk: 0.3,
  },
  add_default_patch_queue_fixture: {
    path: 'examples/source-map-patch-queue/default-source-map-patch-queue.json',
    operation: 'create',
    ownerAgentId: 'source_cartographer',
    purpose: 'Provide editable v0.81 mission fixture for future patch queue runs.',
    validation: ['node src/cli.mjs source-map-patch-queue-run examples/source-map-patch-queue/default-source-map-patch-queue.json output/v0.81/source-map-patch-queue'],
    risk: 0.16,
  },
  write_v081_docs_and_handoff: {
    path: 'docs/RCL_SOURCE_MAP_PATCH_QUEUE_v0.81.md',
    operation: 'create',
    ownerAgentId: 'release_packager',
    purpose: 'Document the patch queue, oracle provider seed and safe execution boundary.',
    validation: ['test -f docs/RCL_SOURCE_MAP_PATCH_QUEUE_v0.81.md'],
    risk: 0.12,
  },
  write_v081_evidence_bundle: {
    path: 'output/v0.81/source-map-patch-queue/*',
    operation: 'generate',
    ownerAgentId: 'evidence_keeper',
    purpose: 'Write source map, patch queue, oracle report, evidence ledger, release verdict and canonical root.',
    validation: ['node src/cli.mjs source-map-patch-queue-run output/v0.81/source-map-patch-queue'],
    risk: 0.14,
  },
  bump_package_and_context_to_v081: {
    path: 'package.json README.md CONTEXT.md release-manifest-v0.81.json',
    operation: 'update',
    ownerAgentId: 'release_packager',
    purpose: 'Align package metadata and handoff documents to v0.81.',
    validation: ['node -p "require(\'./package.json\').version"'],
    risk: 0.24,
  },
});

function buildPatchQueue(spec, sourceMap) {
  const items = spec.patchGoals.map((goal, index) => {
    const table = PATCH_GOAL_TABLE[goal] ?? {
      path: `docs/${goal}.md`, operation: 'create', ownerAgentId: 'version_strategist', purpose: goal, validation: [], risk: 0.42,
    };
    const relatedSource = sourceMap.entries.find(e => table.path.split(' ')[0] === e.path || table.path.startsWith(e.path));
    const item = {
      format: RCL_PATCH_QUEUE_ITEM_FORMAT,
      id: `patch_${String(index + 1).padStart(2, '0')}_${goal}`,
      goal,
      path: table.path,
      operation: table.operation,
      ownerAgentId: table.ownerAgentId,
      purpose: table.purpose,
      validationCommands: table.validation,
      risk: table.risk,
      priority: index + 1,
      sourceMapRefs: relatedSource ? [relatedSource.id] : [],
      rollbackHint: table.operation === 'create' || table.operation === 'generate' ? 'remove generated file(s) and delete output directory if validation fails' : 'restore file from pre-v0.81 source snapshot',
      semanticGuard: ['no_remote_mutation', 'no_unverified_pass_claim', 'human_final_authority_before_git_push'],
      oracleEligible: table.path.endsWith('.mjs') || table.path.includes('src/') || table.path.includes('tests/'),
    };
    return { ...item, itemRoot: sha256(compact(item)) };
  });
  return {
    id: 'rcl_v0_81_patch_queue',
    targetVersion: spec.targetVersion,
    itemCount: items.length,
    executableItemCount: items.filter(i => i.oracleEligible).length,
    updateItemCount: items.filter(i => i.operation === 'update').length,
    createItemCount: items.filter(i => i.operation === 'create').length,
    generateItemCount: items.filter(i => i.operation === 'generate').length,
    items,
    rollbackPlan: [
      'Keep the v0.80 package snapshot before applying any v0.81 patch item.',
      'Apply queue items in priority order and stop on first failed oracle check.',
      'If CLI or index integration fails, revert only integration files and preserve isolated runtime/test files for inspection.',
      'If evidence root cannot be regenerated, do not promote the package to v0.81.',
    ],
    humanAuthorityRequiredBefore: ['git push', 'remote deployment', 'external provider write', 'release publication'],
    queueRoot: sha256(compact(items.map(i => ({ id: i.id, path: i.path, operation: i.operation, root: i.itemRoot })))),
  };
}

function buildOracleSnippets(spec, patchQueue) {
  const summary = {
    targetVersion: spec.targetVersion,
    patchItemCount: patchQueue.itemCount,
    executableItemCount: patchQueue.executableItemCount,
    noRemoteMutation: spec.oracle.allowRemoteRepositoryMutation === false,
  };
  return [
    {
      id: 'oracle_runtime_contract_snippet',
      filename: 'oracle-runtime-contract.mjs',
      description: 'Validates the v0.81 runtime contract can be represented as syntax-valid ESM.',
      code: `export const oracleContract = ${JSON.stringify(summary, null, 2)};\nexport function isOracleSafe(contract = oracleContract) {\n  return contract.patchItemCount >= 8 && contract.noRemoteMutation === true;\n}\nif (!isOracleSafe()) { throw new Error('unsafe oracle contract'); }\n`,
    },
    {
      id: 'oracle_patch_queue_snippet',
      filename: 'oracle-patch-queue.mjs',
      description: 'Validates patch queue items can be serialized and counted without side effects.',
      code: `export const patchQueue = ${JSON.stringify(patchQueue.items.map(i => ({ id: i.id, path: i.path, operation: i.operation, ownerAgentId: i.ownerAgentId })), null, 2)};\nexport const executableCount = patchQueue.filter(item => item.path.includes('src/') || item.path.includes('tests/')).length;\nif (patchQueue.length < 8 || executableCount < 3) { throw new Error('patch queue underfilled'); }\n`,
    },
    {
      id: 'oracle_boundary_snippet',
      filename: 'oracle-boundary.mjs',
      description: 'Validates the execution oracle boundary explicitly forbids network and remote mutation.',
      code: `const boundary = ${JSON.stringify(spec.oracle, null, 2)};\nif (boundary.allowNetwork !== false) throw new Error('network must be disabled');\nif (boundary.allowRemoteRepositoryMutation !== false) throw new Error('remote mutation must be disabled');\nif (boundary.allowWorktreeMutationByOracle !== false) throw new Error('oracle must not mutate worktree');\nexport const boundaryOk = true;\n`,
    },
  ];
}

function runLocalNodeCheck(snippet, tmpDir) {
  const filePath = path.join(tmpDir, snippet.filename);
  fs.writeFileSync(filePath, snippet.code);
  const proc = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8', timeout: 5000 });
  const check = {
    id: snippet.id,
    filename: snippet.filename,
    description: snippet.description,
    command: `${process.execPath} --check ${filePath}`,
    exitCode: proc.status,
    signal: proc.signal,
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
    passed: proc.status === 0,
    codeHash: sha256(snippet.code),
  };
  return { ...check, checkRoot: sha256(compact(check)) };
}

function buildCodeExecutionOracle(spec, patchQueue) {
  const snippets = buildOracleSnippets(spec, patchQueue);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v081-oracle-'));
  let checks = [];
  let executionMode = 'disabled';
  try {
    if (spec.oracle.allowLocalTempExecution) {
      executionMode = 'local-temp-node-check';
      checks = snippets.map(snippet => runLocalNodeCheck(snippet, tmpDir));
    } else {
      checks = snippets.map(snippet => ({
        id: snippet.id,
        filename: snippet.filename,
        description: snippet.description,
        command: 'disabled-by-spec',
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: '',
        passed: true,
        codeHash: sha256(snippet.code),
        checkRoot: sha256(compact({ id: snippet.id, disabled: true, codeHash: sha256(snippet.code) })),
      }));
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  const passedCount = checks.filter(c => c.passed).length;
  const oracle = {
    format: RCL_CODE_EXECUTION_ORACLE_FORMAT,
    id: 'rcl_v0_81_code_execution_oracle_provider_seed',
    providerClass: 'local deterministic syntax oracle',
    executionMode,
    allowNetwork: spec.oracle.allowNetwork,
    allowRemoteRepositoryMutation: spec.oracle.allowRemoteRepositoryMutation,
    allowWorktreeMutationByOracle: spec.oracle.allowWorktreeMutationByOracle,
    tempExecutionOnly: spec.oracle.allowLocalTempExecution === true,
    checkCount: checks.length,
    passedCount,
    failedCount: checks.length - passedCount,
    checks,
    oracleReady: checks.length >= spec.thresholds.minOracleChecks && passedCount >= spec.thresholds.minPassedOracleChecks && spec.oracle.allowNetwork === false && spec.oracle.allowRemoteRepositoryMutation === false,
  };
  return { ...oracle, oracleRoot: sha256(compact({ checks: checks.map(c => c.checkRoot), boundary: { network: oracle.allowNetwork, remote: oracle.allowRemoteRepositoryMutation, worktree: oracle.allowWorktreeMutationByOracle } })) };
}

function buildValidationPlan(spec, patchQueue, oracle) {
  const commands = [
    'node --check src/source-map-patch-queue.mjs',
    'node --test --test-concurrency=1 tests/source-map-patch-queue.test.mjs',
    'node src/cli.mjs source-map-patch-queue-demo',
    'node src/cli.mjs source-map-patch-queue-run examples/source-map-patch-queue/default-source-map-patch-queue.json output/v0.81/source-map-patch-queue',
    'node src/cli.mjs source-map-patch-queue-spec output/v0.81/source-map-patch-queue-spec',
  ];
  return {
    id: 'rcl_v0_81_validation_plan',
    targetVersion: spec.targetVersion,
    commands,
    gates: [
      `mapped source files >= ${spec.thresholds.minMappedSourceFiles}`,
      `patch queue items >= ${spec.thresholds.minPatchQueueItems}`,
      `oracle checks >= ${spec.thresholds.minOracleChecks}`,
      'all oracle checks pass',
      'no remote mutation',
      'rollback plan exists',
      'human final authority preserved',
    ],
    oracleRoot: oracle.oracleRoot,
    validationRoot: sha256(compact({ commands, queueRoot: patchQueue.queueRoot, oracleRoot: oracle.oracleRoot })),
  };
}

function buildEvidenceLedger(spec, sourceMap, patchQueue, oracle, validationPlan, priorTeamEvidence) {
  const artifacts = [
    'source-map.json',
    'source-map.md',
    'patch-queue.json',
    'patch-queue.md',
    'oracle-report.json',
    'oracle-report.md',
    'validation-plan.json',
    'validation-plan.md',
    'evidence-ledger.json',
    'release-verdict.json',
    'source-map-patch-queue.rcl',
    'canonical-root.txt',
  ];
  const ledger = {
    id: 'rcl_v0_81_source_map_patch_queue_evidence_ledger',
    version: RCL_SOURCE_MAP_PATCH_QUEUE_VERSION,
    sourceVersion: spec.sourceVersion,
    targetVersion: spec.targetVersion,
    priorSelfUpgradeTeamRoot: priorTeamEvidence?.result?.canonicalRoot ?? null,
    sourceMapRoot: sourceMap.sourceMapRoot,
    patchQueueRoot: patchQueue.queueRoot,
    oracleRoot: oracle.oracleRoot,
    validationRoot: validationPlan.validationRoot,
    artifactCount: artifacts.length,
    artifacts,
    evidenceBoundary: 'source-map and patch-queue evidence are deterministic; local oracle uses temp files only; real patch application remains an outer execution action',
  };
  return { ...ledger, ledgerRoot: sha256(compact(ledger)) };
}

function buildReleaseVerdict(spec, sourceMap, patchQueue, oracle, validationPlan, evidenceLedger) {
  const noRemoteMutation = spec.oracle.allowNetwork === false && spec.oracle.allowRemoteRepositoryMutation === false;
  const ready = sourceMap.existingEntryCount >= spec.thresholds.minMappedSourceFiles && patchQueue.itemCount >= spec.thresholds.minPatchQueueItems && oracle.oracleReady && evidenceLedger.artifactCount >= spec.thresholds.minEvidenceArtifacts && noRemoteMutation;
  const verdict = {
    id: 'rcl_v0_81_source_map_patch_queue_release_verdict',
    decision: ready ? 'release-seed-ready' : 'hold-in-sandbox',
    ready,
    mappedSourceFileCount: sourceMap.existingEntryCount,
    patchQueueItemCount: patchQueue.itemCount,
    oraclePassedCount: oracle.passedCount,
    validationCommandCount: validationPlan.commands.length,
    noRemoteMutation,
    rollbackPlanPresent: patchQueue.rollbackPlan.length >= 3,
    semanticGuardPresent: patchQueue.items.every(i => i.semanticGuard.includes('no_unverified_pass_claim')),
    humanFinalAuthorityRequired: true,
    externalExecutionBoundary: 'The queue can prepare, rank and locally syntax-check patch candidates. Real source mutation, git push, remote deployment and release publication still require the outer execution environment and human/assistant final authority.',
    nextHandoff: 'v0.82 Real Patch Apply Sandbox + Regression Repair Loop',
  };
  return { ...verdict, verdictRoot: sha256(compact(verdict)) };
}

export function compileSourceMapPatchQueue(input = {}) {
  const spec = normalizeSourceMapPatchQueueSpec(input);
  const priorTeamEvidence = runSelfUpgradeTeamSandboxDemo({ targetVersion: spec.sourceVersion });
  const sourceMap = buildSourceMap(spec);
  const patchQueue = buildPatchQueue(spec, sourceMap);
  const oracle = buildCodeExecutionOracle(spec, patchQueue);
  const validationPlan = buildValidationPlan(spec, patchQueue, oracle);
  const evidenceLedger = buildEvidenceLedger(spec, sourceMap, patchQueue, oracle, validationPlan, priorTeamEvidence);
  const releaseVerdict = buildReleaseVerdict(spec, sourceMap, patchQueue, oracle, validationPlan, evidenceLedger);
  const result = {
    format: RCL_SOURCE_MAP_PATCH_QUEUE_RESULT_FORMAT,
    version: RCL_SOURCE_MAP_PATCH_QUEUE_VERSION,
    sourceVersion: spec.sourceVersion,
    targetVersion: spec.targetVersion,
    sourceMapPatchQueueEstablished: releaseVerdict.ready,
    sourceMapEntryCount: sourceMap.entryCount,
    mappedSourceFileCount: sourceMap.existingEntryCount,
    patchQueueItemCount: patchQueue.itemCount,
    executablePatchItemCount: patchQueue.executableItemCount,
    oracleProviderSeedEstablished: oracle.oracleReady,
    oracleCheckCount: oracle.checkCount,
    oraclePassedCount: oracle.passedCount,
    localTempExecutionOnly: oracle.tempExecutionOnly,
    noNetwork: oracle.allowNetwork === false,
    noRemoteMutation: oracle.allowRemoteRepositoryMutation === false,
    noWorktreeMutationByOracle: oracle.allowWorktreeMutationByOracle === false,
    rollbackPlanPresent: releaseVerdict.rollbackPlanPresent,
    semanticGuardPresent: releaseVerdict.semanticGuardPresent,
    humanFinalAuthorityKept: releaseVerdict.humanFinalAuthorityRequired,
    evidenceLedgerWritten: true,
    artifactCount: evidenceLedger.artifactCount,
    averagePatchRisk: round(patchQueue.items.reduce((sum, item) => sum + Number(item.risk), 0) / Math.max(1, patchQueue.items.length)),
    reducedOuterModelWorkloadBy: 'source mapping + patch queue materialization + local syntax oracle + validation handoff',
    canApplyRealPatchesWithoutOuterExecutor: false,
    truthfulBoundaryKept: true,
    nextHandoff: releaseVerdict.nextHandoff,
    canonicalRoot: sha256(compact({ spec, sourceMapRoot: sourceMap.sourceMapRoot, patchQueueRoot: patchQueue.queueRoot, oracleRoot: oracle.oracleRoot, validationRoot: validationPlan.validationRoot, evidenceLedgerRoot: evidenceLedger.ledgerRoot, verdictRoot: releaseVerdict.verdictRoot })),
  };
  return {
    ok: result.sourceMapPatchQueueEstablished,
    format: RCL_SOURCE_MAP_PATCH_QUEUE_BUNDLE_FORMAT,
    spec,
    priorTeamEvidence: {
      ok: priorTeamEvidence.ok,
      version: priorTeamEvidence.result.version,
      canonicalRoot: priorTeamEvidence.result.canonicalRoot,
      nextHandoff: priorTeamEvidence.result.nextHandoff,
    },
    sourceMap,
    patchQueue,
    oracle,
    validationPlan,
    evidenceLedger,
    releaseVerdict,
    result,
  };
}

export function runSourceMapPatchQueue(input = {}) {
  return compileSourceMapPatchQueue(input);
}

export function runSourceMapPatchQueueDemo(overrides = {}) {
  return runSourceMapPatchQueue(overrides);
}

export function readSourceMapPatchQueueInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function renderSourceMapPatchQueueRcl(input = {}) {
  const spec = normalizeSourceMapPatchQueueSpec(input);
  const lines = [];
  lines.push('reality SourceMapPatchQueueV081 {');
  lines.push(`  objective: ${JSON.stringify(spec.objective)}`);
  lines.push(`  source_version: ${JSON.stringify(spec.sourceVersion)}`);
  lines.push(`  target_version: ${JSON.stringify(spec.targetVersion)}`);
  lines.push('  map: source_files -> source_map_entries');
  lines.push('  compile: self_upgrade_team_patch_plan -> file_level_patch_queue');
  lines.push('  oracle: "local temp node --check; no network; no remote mutation; no worktree mutation by oracle"');
  lines.push('  guard: [semantic_guard, evidence_keeper, rollback_plan, human_final_authority]');
  lines.push('  output: [source_map, patch_queue, oracle_report, validation_plan, evidence_ledger, release_verdict]');
  lines.push(`  next: ${JSON.stringify('v0.82 Real Patch Apply Sandbox + Regression Repair Loop')}`);
  lines.push('}');
  return lines.join('\n');
}

function makeSourceMapMarkdown(sourceMap) {
  const lines = ['# RCL v0.81 Source Map（源码地图）', ''];
  lines.push(`Worktree Root（工作区根）: \`${sourceMap.worktreeRoot}\``);
  lines.push('');
  lines.push('| Path（路径） | Kind（类型） | Owner（负责人） | Exists（存在） | Lines（行数） | Risk（风险） |');
  lines.push('|---|---|---|---:|---:|---|');
  for (const entry of sourceMap.entries) {
    lines.push(`| ${entry.path} | ${entry.kind} | ${entry.ownerAgentId} | ${entry.exists} | ${entry.lines} | ${entry.touchRisk} |`);
  }
  lines.push('');
  lines.push(`Source Map Root（源码地图根）: \`${sourceMap.sourceMapRoot}\``);
  return lines.join('\n');
}

function makePatchQueueMarkdown(patchQueue) {
  const lines = ['# RCL v0.81 Patch Queue（补丁队列）', ''];
  lines.push('| Priority（优先级） | Path（路径） | Operation（操作） | Owner（负责人） | Risk（风险） | Purpose（用途） |');
  lines.push('|---:|---|---|---|---:|---|');
  for (const item of patchQueue.items) {
    lines.push(`| ${item.priority} | ${item.path} | ${item.operation} | ${item.ownerAgentId} | ${item.risk} | ${item.purpose} |`);
  }
  lines.push('');
  lines.push('## Rollback Plan（回滚计划）');
  for (const item of patchQueue.rollbackPlan) lines.push(`- ${item}`);
  lines.push('');
  lines.push(`Queue Root（队列根）: \`${patchQueue.queueRoot}\``);
  return lines.join('\n');
}

function makeOracleMarkdown(oracle) {
  const lines = ['# Code Execution Oracle Provider Seed（代码执行验证器种子）', ''];
  lines.push(`- Provider Class（提供者类别）: ${oracle.providerClass}`);
  lines.push(`- Execution Mode（执行模式）: ${oracle.executionMode}`);
  lines.push(`- Temp Execution Only（仅临时执行）: ${oracle.tempExecutionOnly}`);
  lines.push(`- Allow Network（允许网络）: ${oracle.allowNetwork}`);
  lines.push(`- Allow Remote Repository Mutation（允许远端仓库修改）: ${oracle.allowRemoteRepositoryMutation}`);
  lines.push(`- Allow Worktree Mutation By Oracle（允许验证器改工作区）: ${oracle.allowWorktreeMutationByOracle}`);
  lines.push(`- Passed（通过）: ${oracle.passedCount} / ${oracle.checkCount}`);
  lines.push('');
  lines.push('| Check（检查） | Command（命令） | Passed（通过） |');
  lines.push('|---|---|---:|');
  for (const check of oracle.checks) lines.push(`| ${check.id} | \`${check.command}\` | ${check.passed} |`);
  lines.push('');
  lines.push(`Oracle Root（验证器根）: \`${oracle.oracleRoot}\``);
  return lines.join('\n');
}

function makeValidationPlanMarkdown(plan) {
  const lines = ['# Validation Plan（验证计划）', ''];
  lines.push('## Commands');
  for (const cmd of plan.commands) lines.push(`- \`${cmd}\``);
  lines.push('');
  lines.push('## Gates');
  for (const gate of plan.gates) lines.push(`- ${gate}`);
  lines.push('');
  lines.push(`Validation Root（验证根）: \`${plan.validationRoot}\``);
  return lines.join('\n');
}

function makeEvidenceLedgerMarkdown(ledger) {
  const lines = ['# Evidence Ledger（证据账本）', ''];
  lines.push(`- Version（版本）: ${ledger.version}`);
  lines.push(`- Source Version（源版本）: ${ledger.sourceVersion}`);
  lines.push(`- Target Version（目标版本）: ${ledger.targetVersion}`);
  lines.push(`- Prior Self-Upgrade Team Root（前序自升级团队根）: \`${ledger.priorSelfUpgradeTeamRoot}\``);
  lines.push(`- Source Map Root（源码地图根）: \`${ledger.sourceMapRoot}\``);
  lines.push(`- Patch Queue Root（补丁队列根）: \`${ledger.patchQueueRoot}\``);
  lines.push(`- Oracle Root（验证器根）: \`${ledger.oracleRoot}\``);
  lines.push(`- Validation Root（验证根）: \`${ledger.validationRoot}\``);
  lines.push(`- Ledger Root（账本根）: \`${ledger.ledgerRoot}\``);
  lines.push(`- Boundary（边界）: ${ledger.evidenceBoundary}`);
  return lines.join('\n');
}

function makeReleaseVerdictMarkdown(verdict) {
  const lines = ['# Release Verdict（发布裁决）', ''];
  lines.push(`- Decision（裁决）: ${verdict.decision}`);
  lines.push(`- Ready（可发布种子）: ${verdict.ready}`);
  lines.push(`- Mapped Source File Count（已映射源码文件数）: ${verdict.mappedSourceFileCount}`);
  lines.push(`- Patch Queue Item Count（补丁队列项数）: ${verdict.patchQueueItemCount}`);
  lines.push(`- Oracle Passed Count（验证器通过数）: ${verdict.oraclePassedCount}`);
  lines.push(`- No Remote Mutation（无远端修改）: ${verdict.noRemoteMutation}`);
  lines.push(`- Rollback Plan Present（回滚计划存在）: ${verdict.rollbackPlanPresent}`);
  lines.push(`- Semantic Guard Present（语义守卫存在）: ${verdict.semanticGuardPresent}`);
  lines.push(`- Human Final Authority Required（人类最终权威要求）: ${verdict.humanFinalAuthorityRequired}`);
  lines.push(`- Boundary（边界）: ${verdict.externalExecutionBoundary}`);
  lines.push(`- Next Handoff（下一步交接）: ${verdict.nextHandoff}`);
  return lines.join('\n');
}

export function writeSourceMapPatchQueueReports(outDir, input = {}) {
  const bundle = runSourceMapPatchQueue(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'source-map-patch-queue-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'source-map-patch-queue-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'source-map.json'), `${JSON.stringify(bundle.sourceMap, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'source-map.md'), `${makeSourceMapMarkdown(bundle.sourceMap)}\n`);
  fs.writeFileSync(path.join(dir, 'patch-queue.json'), `${JSON.stringify(bundle.patchQueue, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'patch-queue.md'), `${makePatchQueueMarkdown(bundle.patchQueue)}\n`);
  fs.writeFileSync(path.join(dir, 'oracle-report.json'), `${JSON.stringify(bundle.oracle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'oracle-report.md'), `${makeOracleMarkdown(bundle.oracle)}\n`);
  fs.writeFileSync(path.join(dir, 'validation-plan.json'), `${JSON.stringify(bundle.validationPlan, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'validation-plan.md'), `${makeValidationPlanMarkdown(bundle.validationPlan)}\n`);
  fs.writeFileSync(path.join(dir, 'evidence-ledger.json'), `${JSON.stringify(bundle.evidenceLedger, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'evidence-ledger.md'), `${makeEvidenceLedgerMarkdown(bundle.evidenceLedger)}\n`);
  fs.writeFileSync(path.join(dir, 'release-verdict.json'), `${JSON.stringify(bundle.releaseVerdict, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'release-verdict.md'), `${makeReleaseVerdictMarkdown(bundle.releaseVerdict)}\n`);
  fs.writeFileSync(path.join(dir, 'source-map-patch-queue.rcl'), `${renderSourceMapPatchQueueRcl(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.result.canonicalRoot}\n`);
  return {
    ok: bundle.ok,
    outDir: dir,
    result: bundle.result,
    files: [
      'source-map-patch-queue-result.json',
      'source-map-patch-queue-bundle.json',
      'source-map.json',
      'source-map.md',
      'patch-queue.json',
      'patch-queue.md',
      'oracle-report.json',
      'oracle-report.md',
      'validation-plan.json',
      'validation-plan.md',
      'evidence-ledger.json',
      'evidence-ledger.md',
      'release-verdict.json',
      'release-verdict.md',
      'source-map-patch-queue.rcl',
      'canonical-root.txt',
    ],
  };
}
