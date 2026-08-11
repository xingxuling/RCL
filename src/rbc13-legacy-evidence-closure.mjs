import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeBytecode } from './bytecode.mjs';
import { bootstrapCompilerStage5 } from './bootstrap.mjs';
import { realityRoot } from './canonical.mjs';
import { runFoundationNativeBatchA } from './foundation-native-bridge.mjs';
import { runFoundationNativeMetaBatchB } from './foundation-native-meta-bridge.mjs';
import { runFoundationNativeBatchC } from './foundation-native-batch-c.mjs';
import { runFoundationNativeBatchD } from './foundation-native-batch-d.mjs';
import { runFoundationNativeBatchE } from './foundation-native-batch-e.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const INVENTORY_PATH = path.join(ROOT, 'examples', 'rbc13-legacy-evidence-expected-inventory.json');

export const RBC13_LEGACY_EVIDENCE_CLOSURE_FORMAT =
  'rcl.rbc13-legacy-evidence-closure.v0.1';
export const RBC13_LEGACY_EVIDENCE_RECEIPT_FORMAT =
  'rcl.rbc13-legacy-evidence-receipt.v0.1';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function root(value) {
  return realityRoot(value);
}

function gitValue(rootPath, args) {
  const result = spawnSync('git', ['-C', rootPath, ...args], { encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout).trim() : null;
}

function gitContext(rootPath) {
  return Object.freeze({
    branch: gitValue(rootPath, ['branch', '--show-current']) ?? 'UNKNOWN',
    commit: gitValue(rootPath, ['rev-parse', 'HEAD']) ?? 'UNKNOWN',
  });
}

function sourceEvidence(rootPath, sourcePaths) {
  const files = sourcePaths.map(relativePath => {
    const absolutePath = path.join(rootPath, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Legacy evidence source is missing: ${relativePath}`);
    }
    return Object.freeze({ path: relativePath, root: sha256File(absolutePath) });
  });
  return Object.freeze({ files, root: root(files) });
}

export function readRbc13LegacyExpectedInventory(rootPath = ROOT) {
  const inventoryPath = path.join(rootPath, path.relative(ROOT, INVENTORY_PATH));
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  if (inventory?.format !== 'rcl.rbc13-legacy-evidence-expected-inventory.v0.1') {
    throw new TypeError('Invalid RBC 1.3 legacy evidence expected inventory format');
  }
  if (!Array.isArray(inventory.cases) || inventory.cases.length === 0) {
    throw new TypeError('RBC 1.3 legacy evidence expected inventory is empty');
  }
  const ids = inventory.cases.map(item => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new TypeError('RBC 1.3 legacy evidence expected inventory contains duplicate IDs');
  }
  return Object.freeze({
    ...inventory,
    cases: Object.freeze(inventory.cases.map(item => Object.freeze({ ...item }))),
    root: root(inventory.cases),
  });
}

function makeReceipt({ expected, context, source, sourceEvidenceRoot, bytecodeRoot, resultRoot,
  artifactRoot, runtimeReceiptRoot, replayRoot, replayVerified, nativeSourceRoot, details }) {
  const receipt = {
    format: RBC13_LEGACY_EVIDENCE_RECEIPT_FORMAT,
    caseId: expected.id,
    family: expected.family,
    rbcVersion: expected.rbcVersion,
    runtimeVersion: context.runtimeVersion,
    sourceRoot: source,
    sourceEvidenceRoot,
    bytecodeRoot,
    resultRoot,
    artifactRoot,
    runtimeReceiptRoot,
    replayRoot,
    replayVerified,
    nativeSourceRoot: nativeSourceRoot ?? null,
    sourceCommit: context.commit,
    branch: context.branch,
    details,
  };
  const receiptRoot = root(receipt);
  const caseRoot = root({
    caseId: expected.id,
    receiptRoot,
    artifactRoot,
    replayRoot,
  });
  return Object.freeze({
    id: expected.id,
    family: expected.family,
    rbcVersion: expected.rbcVersion,
    runtimeVersion: context.runtimeVersion,
    status: replayVerified ? 'VERIFIED' : 'BLOCKED',
    sourceRoot: source,
    sourceEvidenceRoot,
    bytecodeRoot,
    resultRoot,
    artifactRoot,
    runtimeReceiptRoot,
    replayRoot,
    replayVerified,
    receipt,
    receiptRoot,
    caseRoot,
  });
}

function runStage5(expected, rootPath, context) {
  const first = bootstrapCompilerStage5({ write: false });
  const replay = bootstrapCompilerStage5({ write: false });
  const runContext = { ...context, runtimeVersion: first.targetRun.vm };
  const source = sourceEvidence(rootPath, expected.sourcePaths);
  const decoded = decodeBytecode(first.targetBytecode);
  const replayBytecodeRoot = sha256(replay.targetBytecode);
  const bytecodeRoot = sha256(first.targetBytecode);
  const resultRoot = first.targetRun.semanticStateRoot ?? first.targetRun.stateRoot;
  const runtimeReceipt = {
    stage: first.stage,
    sourceRoot: source.root,
    declaredSourceRoot: first.sourceRoot,
    compilerBytecodeRoot: sha256(first.compilerBytecode),
    bytecodeRoot,
    resultRoot,
    stateRootAlgorithm: first.targetRun.stateRootAlgorithm,
    rbcVersion: `${decoded.version.major}.${decoded.version.minor}`,
    runtimeVersion: first.targetRun.vm,
    deterministic: first.deterministic === true && first.referenceParity === true,
  };
  const runtimeReceiptRoot = root(runtimeReceipt);
  const replayReceiptRoot = root({
    ...runtimeReceipt,
    compilerBytecodeRoot: sha256(replay.compilerBytecode),
    bytecodeRoot: replayBytecodeRoot,
    resultRoot: replay.targetRun.semanticStateRoot ?? replay.targetRun.stateRoot,
  });
  const replayVerified = runtimeReceiptRoot === replayReceiptRoot
    && bytecodeRoot === replayBytecodeRoot
    && resultRoot === (replay.targetRun.semanticStateRoot ?? replay.targetRun.stateRoot);
  const artifactRoot = root({
    caseId: expected.id,
    sourceEvidenceRoot: source.root,
    compilerBytecodeRoot: sha256(first.compilerBytecode),
    bytecodeRoot,
    declaredSourceRoot: first.sourceRoot,
  });
  return makeReceipt({
    expected,
    context: runContext,
    source: source.root,
    sourceEvidenceRoot: source.root,
    bytecodeRoot,
    resultRoot,
    artifactRoot,
    runtimeReceiptRoot,
    replayRoot: replayReceiptRoot,
    replayVerified,
    nativeSourceRoot: null,
    details: {
      stage: first.stage,
      bytecodeVersion: `${decoded.version.major}.${decoded.version.minor}`,
      declaredSourceRoot: first.sourceRoot,
      compilerBytecodeRoot: sha256(first.compilerBytecode),
      targetStateRoot: first.targetRun.stateRoot,
      stateRootAlgorithm: first.targetRun.stateRootAlgorithm,
      referenceParity: first.referenceParity,
      targetBytecodeDeterministic: first.deterministic,
    },
  });
}

const FOUNDATION_RUNNERS = Object.freeze({
  'foundation-batch-a': runFoundationNativeBatchA,
  'foundation-meta-batch-b': runFoundationNativeMetaBatchB,
  'foundation-batch-c': runFoundationNativeBatchC,
  'foundation-batch-d': runFoundationNativeBatchD,
  'foundation-batch-e': runFoundationNativeBatchE,
});

function runFoundation(expected, rootPath, context) {
  const runner = FOUNDATION_RUNNERS[expected.runner];
  if (!runner) throw new TypeError(`No legacy runner registered for ${expected.runner}`);
  const first = runner({}, { verifyReplay: true });
  const replay = runner({}, { verifyReplay: true });
  const runContext = { ...context, runtimeVersion: first.nativeVm };
  const source = sourceEvidence(rootPath, expected.sourcePaths);
  const runtimeReceiptRoot = first.deterministicReceiptRoot;
  const replayRoot = replay.deterministicReceiptRoot;
  const replayVerified = first.status === 'pass'
    && replay.status === 'pass'
    && first.replayVerified === true
    && replay.replayVerified === true
    && runtimeReceiptRoot === replayRoot;
  const bytecodeRoot = first.bytecodeRoot;
  const resultRoot = first.finalStateRoot;
  const artifactRoot = root({
    caseId: expected.id,
    sourceEvidenceRoot: source.root,
    sourceRoot: first.sourceRoot,
    bytecodeRoot,
    nativeSourceRoot: first.nativeSourceRoot,
    contractRoot: first.contractRoot,
  });
  return makeReceipt({
    expected,
    context: runContext,
    source: first.sourceRoot,
    sourceEvidenceRoot: source.root,
    bytecodeRoot,
    resultRoot,
    artifactRoot,
    runtimeReceiptRoot,
    replayRoot,
    replayVerified,
    nativeSourceRoot: first.nativeSourceRoot,
    details: {
      format: first.format,
      bytecodeVersion: first.bytecodeVersion,
      contractRoot: first.contractRoot,
      finalStateRoot: first.finalStateRoot,
      providerId: first.providerHost?.providerId,
      providerCallCount: first.providerHost?.providerCallCount,
      nativeVm: first.nativeVm,
      replayVerified: first.replayVerified,
      metrics: first.metrics,
    },
  });
}

function runExpectedCase(expected, rootPath, context) {
  if (expected.runner === 'stage5') return runStage5(expected, rootPath, context);
  return runFoundation(expected, rootPath, context);
}

function emptyCheckMap() {
  return {
    expectedInventoryAuthoritative: false,
    stableIdsUnique: false,
    noUnexpectedCases: false,
    noMissingCases: false,
    noDuplicateReceiptRoots: false,
    noStaleReceipts: false,
    noAlteredReceipts: false,
    replayRootConsistency: false,
    rbc11Verified: false,
    rbc12Verified: false,
  };
}

export function verifyRbc13LegacyEvidenceClosure(report, options = {}) {
  const expectedInventory = options.expectedInventory ?? readRbc13LegacyExpectedInventory(options.root ?? ROOT);
  const expectedById = new Map(expectedInventory.cases.map(item => [item.id, item]));
  const records = Array.isArray(report?.records) ? report.records : [];
  const ids = records.map(item => item?.id);
  const receiptRoots = records.map(item => item?.receiptRoot).filter(Boolean);
  const expectedIds = [...expectedById.keys()];
  const actualIds = [...new Set(ids)];
  const missing = expectedIds.filter(id => !ids.includes(id));
  const unexpected = actualIds.filter(id => !expectedById.has(id));
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const duplicateReceiptRoots = receiptRoots.filter((value, index) => receiptRoots.indexOf(value) !== index);
  const staleReceipts = [];
  const alteredReceipts = [];
  const replayMismatches = [];
  for (const record of records) {
    const expected = expectedById.get(record?.id);
    if (!expected) continue;
    const receiptRootMatches = record.receipt && root(record.receipt) === record.receiptRoot;
    const caseRootMatches = record.caseRoot === root({
      caseId: record.id,
      receiptRoot: record.receiptRoot,
      artifactRoot: record.artifactRoot,
      replayRoot: record.replayRoot,
    });
    if (!receiptRootMatches || !caseRootMatches) alteredReceipts.push(record.id);
    if (record.receipt?.sourceCommit !== report.commit
      || record.receipt?.branch !== report.branch
      || record.rbcVersion !== expected.rbcVersion
      || record.runtimeVersion !== expected.runtimeVersion
      || record.receipt?.rbcVersion !== expected.rbcVersion
      || record.receipt?.runtimeVersion !== expected.runtimeVersion) {
      staleReceipts.push(record.id);
    }
    if (record.runtimeReceiptRoot !== record.replayRoot || record.replayVerified !== true) {
      replayMismatches.push(record.id);
    }
  }
  const rbc11Records = records.filter(item => item?.rbcVersion === '1.1');
  const rbc12Records = records.filter(item => item?.rbcVersion === '1.2');
  const checks = {
    expectedInventoryAuthoritative: report?.expectedInventoryRoot === expectedInventory.root
      && report?.inventoryAuthority === 'committed-stable-id-inventory',
    stableIdsUnique: duplicateIds.length === 0 && new Set(expectedIds).size === expectedIds.length,
    noUnexpectedCases: unexpected.length === 0,
    noMissingCases: missing.length === 0 && records.length === expectedIds.length,
    noDuplicateReceiptRoots: duplicateReceiptRoots.length === 0,
    noStaleReceipts: staleReceipts.length === 0,
    noAlteredReceipts: alteredReceipts.length === 0,
    replayRootConsistency: replayMismatches.length === 0,
    rbc11Verified: rbc11Records.length > 0 && rbc11Records.every(item => item.status === 'VERIFIED'),
    rbc12Verified: rbc12Records.length === 5 && rbc12Records.every(item => item.status === 'VERIFIED'),
  };
  const verified = Object.values(checks).every(Boolean);
  return Object.freeze({
    verified,
    checks: Object.freeze(checks),
    missing,
    unexpected,
    duplicateIds: [...new Set(duplicateIds)],
    duplicateReceiptRoots: [...new Set(duplicateReceiptRoots)],
    staleReceipts: [...new Set(staleReceipts)],
    alteredReceipts: [...new Set(alteredReceipts)],
    replayMismatches: [...new Set(replayMismatches)],
  });
}

export function buildRbc13LegacyEvidenceClosure(options = {}) {
  const rootPath = path.resolve(options.root ?? ROOT);
  const expectedInventory = options.expectedInventory ?? readRbc13LegacyExpectedInventory(rootPath);
  const context = gitContext(rootPath);
  const records = [];
  const executionErrors = [];
  for (const expected of expectedInventory.cases) {
    try {
      records.push(runExpectedCase(expected, rootPath, context));
    } catch (error) {
      executionErrors.push({ id: expected.id, message: error.message, code: error.code ?? null });
    }
  }
  const base = {
    format: RBC13_LEGACY_EVIDENCE_CLOSURE_FORMAT,
    version: '0.1.0',
    inventoryAuthority: 'committed-stable-id-inventory',
    expectedInventoryRoot: expectedInventory.root,
    expectedInventory: expectedInventory.cases,
    branch: context.branch,
    commit: context.commit,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      nativeVm: 'rcl-native-vm/0.6.0-alpha.1',
      generatedAt: new Date().toISOString(),
    },
    records,
    executionErrors,
  };
  const verification = verifyRbc13LegacyEvidenceClosure(base, { expectedInventory, root: rootPath });
  const report = {
    ...base,
    status: verification.verified ? 'VERIFIED' : 'BLOCKED',
    verdict: verification.verified ? 'VERIFIED' : 'BLOCKED',
    checks: verification.checks,
    summary: {
      expectedCaseCount: expectedInventory.cases.length,
      verifiedReceiptCount: records.filter(item => item.status === 'VERIFIED').length,
      missing: verification.missing,
      duplicate: [...new Set([...verification.duplicateIds, ...verification.duplicateReceiptRoots])],
      stale: verification.staleReceipts,
      altered: verification.alteredReceipts,
      replayMismatches: verification.replayMismatches,
      rbc11Verified: verification.checks.rbc11Verified,
      rbc12Verified: verification.checks.rbc12Verified,
    },
    blocker: verification.verified ? null : 'legacy-evidence-closure-check-failed',
    reproductionCommand: 'npm run verify:rbc13-legacy-evidence-closure',
    boundary: 'This closes only the committed RBC 1.1/RBC 1.2 legacy receipt inventory. It does not canonize RBC 1.3 or validate the experimental AI and Universal tracks.',
  };
  return Object.freeze({ ...report, root: root(report) });
}

export function renderRbc13LegacyEvidenceClosureMarkdown(report) {
  const rows = report.records.map(record => `| ${record.id} | ${record.rbcVersion} | ${record.runtimeVersion} | ${record.sourceRoot} | ${record.bytecodeRoot} | ${record.resultRoot} | ${record.receiptRoot} | ${record.replayVerified ? 'VERIFIED' : 'BLOCKED'} |`);
  const checks = Object.entries(report.checks).map(([key, value]) => `- ${key}: ${value ? 'PASS' : 'FAIL'}`).join('\n');
  return `# A3 Legacy Evidence Closure Report v0.1\n\n- Status: **${report.status}**\n- Branch: \`${report.branch}\`\n- Commit: \`${report.commit}\`\n- Expected inventory: ${report.expectedInventory.length} stable IDs\n- Inventory root: \`${report.expectedInventoryRoot}\`\n- Evidence root: \`${report.root}\`\n- Reproduction: \`${report.reproductionCommand}\`\n\n## Scope\n\nThe committed expected inventory is authoritative for this closure. It contains one current-source RBC 1.1 Stage-5 encoder case and five current-source RBC 1.2 Foundation Native bridge cases. RBC 1.3 experimental Domain Organ cases are intentionally excluded.\n\n## Receipt inventory\n\n| Case | RBC | Runtime | Source root | Bytecode root | Result root | Receipt root | Replay |\n|---|---:|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Closure checks\n\n${checks}\n\n## Integrity findings\n\n- Missing: ${report.summary.missing.length ? report.summary.missing.join(', ') : 'none'}\n- Duplicate: ${report.summary.duplicate.length ? report.summary.duplicate.join(', ') : 'none'}\n- Stale: ${report.summary.stale.length ? report.summary.stale.join(', ') : 'none'}\n- Altered: ${report.summary.altered.length ? report.summary.altered.join(', ') : 'none'}\n- Replay mismatch: ${report.summary.replayMismatches.length ? report.summary.replayMismatches.join(', ') : 'none'}\n\n## Boundary\n\n${report.boundary}\n`;
}
