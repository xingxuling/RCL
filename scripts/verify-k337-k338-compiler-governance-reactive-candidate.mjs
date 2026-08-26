#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k337-k338-compiler-governance-reactive-runtime-contract.v0.1.json');
const EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k337-k338-compiler-governance-reactive-runtime-v0.1.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(condition, code) {
  if (!condition) throw new Error(code);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function equal(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function record(checks, name, pass, details = {}) {
  checks[name] = { pass: Boolean(pass), ...details };
}

export function evaluateK337K338CompilerGovernanceReactiveSource(options = {}) {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const sourcePath = path.resolve(options.sourcePath ?? path.join(ROOT, contract.canonical.sourcePath));
  const source = fs.readFileSync(sourcePath, 'utf8');
  const compilerRbcPath = path.join(ROOT, contract.canonical.compilerRbcPath);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k337-k338-candidate-'));
  const outputPath = path.join(directory, 'candidate.rbc');
  const checks = {};
  let errorCode = null;
  let stateRoot = null;
  let artifactSha256 = null;
  try {
    const bootstrapBytecode = Buffer.from(compileRealityToBytecode(source));
    record(checks, 'reference-compile', true);
    const compilation = runNativeCompiler(compilerRbcPath, sourcePath, outputPath);
    artifactSha256 = sha256(compilation.bytecode);
    record(checks, 'native-selfhost-compile', true);
    record(checks, 'bootstrap-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrapBytecode));
    const payload = runNativeBytecode(outputPath, { requireNativeStateRoot: true });
    stateRoot = payload.semanticStateRoot;
    record(checks, 'expected-state', equal(payload.state, contract.expectedState), { actual: payload.state });
    record(checks, 'rule-order', equal(payload.history.map((item) => item.rule), contract.required.transactionRuleOrder));
    record(checks, 'root-continuity', payload.history[0]?.afterRoot === payload.history[1]?.beforeRoot);
    record(checks, 'authority-needs', payload.history.every((item) => equal(item.authority?.needs, contract.expectedAuthority[item.rule])));
    record(checks, 'witnesses', payload.history.every((item) => equal(item.witnesses, contract.expectedWitnesses[item.rule])));
  } catch (error) {
    errorCode = error.code ?? 'RCL_K337_K338_CANDIDATE_ERROR';
    if (!checks['reference-compile']) record(checks, 'reference-compile', false, { errorCode });
    else if (!checks['native-selfhost-compile']) record(checks, 'native-selfhost-compile', false, { errorCode });
    record(checks, 'native-execute', false, { errorCode });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  if (!checks['native-execute']) record(checks, 'native-execute', errorCode === null);
  const passed = Object.values(checks).every((item) => item.pass === true);
  const resultWithoutRoot = {
    status: passed ? 'PASS' : 'FAIL',
    sourceSha256: sha256(source),
    artifactSha256,
    stateRoot,
    checks,
    errorCode,
  };
  return { ...resultWithoutRoot, reportRoot: evidenceRoot(resultWithoutRoot) };
}

export function verifyK337K338CompilerGovernanceReactiveCandidate(options = {}) {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const candidate = evaluateK337K338CompilerGovernanceReactiveSource(options);
  if (options.sourcePath) return candidate;
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const compilerRbcPath = path.join(ROOT, contract.canonical.compilerRbcPath);
  const { reportRoot, ...evidenceWithoutRoot } = evidence;

  check(contract.format === 'rcl.k337-k338.compiler-governance-reactive-runtime-contract.v0.1', 'RCL_K337_K338_CONTRACT_FORMAT');
  check(contract.frozenBeforeAcquisition === true, 'RCL_K337_K338_CONTRACT_NOT_FROZEN');
  check(evidence.format === 'rcl.k337-k338.compiler-governance-reactive-runtime-evidence.v0.1', 'RCL_K337_K338_EVIDENCE_FORMAT');
  check(evidence.contractRoot === evidenceRoot(contract), 'RCL_K337_K338_CONTRACT_ROOT');
  check(reportRoot === evidenceRoot({ ...evidenceWithoutRoot, generatedAt: undefined }), 'RCL_K337_K338_REPORT_ROOT');
  check(sha256(fs.readFileSync(sourcePath)) === contract.canonical.sourceSha256, 'RCL_K337_K338_SOURCE_DRIFT');
  check(sha256(fs.readFileSync(compilerRbcPath)) === contract.canonical.compilerRbcSha256, 'RCL_K337_K338_COMPILER_DRIFT');
  check(evidence.status === 'PASS', 'RCL_K337_K338_RUNTIME_NOT_PASS');
  check(evidence.summary.successfulRounds === contract.required.rounds, 'RCL_K337_K338_ROUND_COUNT');
  check(evidence.summary.uniqueStateRoots === contract.required.uniqueStateRoots, 'RCL_K337_K338_STATE_ROOT_COUNT');
  check(evidence.summary.uniqueArtifactHashes === 1, 'RCL_K337_K338_ARTIFACT_HASH_COUNT');
  check(evidence.summary.controlsPassed === true, 'RCL_K337_K338_CONTROLS');
  check(evidence.summary.performancePassed === true, 'RCL_K337_K338_PERFORMANCE');
  check(Object.values(evidence.negativeControls).every(Boolean), 'RCL_K337_K338_NEGATIVE_CONTROL');
  check(evidence.negativeControlDetails.missingWarrant.rejectionStage === 'NATIVE_VM_BEFORE_COMMIT', 'RCL_K337_K338_WARRANT_STAGE_DISCLOSURE');
  check(evidence.negativeControlDetails.missingWarrant.errorCode === 'RCL_AUTHORITY_DENIED', 'RCL_K337_K338_WARRANT_ERROR');
  check(evidence.rclGaps.some((gap) => gap.id === 'RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION'), 'RCL_K337_K338_STATIC_VALIDATION_GAP');
  check(candidate.status === 'PASS', 'RCL_K337_K338_CANONICAL_CANDIDATE');

  return {
    status: candidate.status,
    checks: candidate.checks,
    localRuntimeAdmitted: true,
    eligibleCells: contract.eligibleCells,
    runtimeReportRoot: reportRoot,
    contractRoot: evidence.contractRoot,
    sourceSha256: contract.canonical.sourceSha256,
    artifactSha256: evidence.artifacts.bootstrapArtifactSha256,
    stateRoot: candidate.stateRoot,
    rclGap: evidence.rclGaps[0].id,
    aiGenerateAdmission: 'UNVERIFIED',
    githubHostedAdmission: 'UNVERIFIED',
    verdict: 'PASS_LOCAL_RUNTIME_CANDIDATE_AI_GENERATE_AND_GITHUB_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK337K338CompilerGovernanceReactiveCandidate();
  console.log(JSON.stringify(result, null, 2));
}
