#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { verifyNativeSemanticStateRoot } from '../src/native-vm.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { readCanonicalCompilerArtifact } from '../src/canonical-source-archive.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k337-k338-compiler-governance-reactive-runtime-contract.v0.1.json');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k337-k338-compiler-governance-reactive-runtime-v0.1.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function percentile95(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function equal(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function run(command, args, options = {}) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: options.timeout ?? 30_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { ...result, elapsedMs: performance.now() - started };
}
function parseJson(text, code) {
  try { return JSON.parse(text); }
  catch { throw new Error(`${code}:${text.slice(0, 500)}`); }
}
function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function historyMatches(payload, contract) {
  const history = payload.history ?? [];
  const rules = history.map((item) => item.rule);
  if (!equal(rules, contract.required.transactionRuleOrder)) return false;
  if (!history.every((item) => item.status === 'realized' && item.mode === 'realize')) return false;
  if (contract.required.rootContinuity && history[0]?.afterRoot !== history[1]?.beforeRoot) return false;
  for (const item of history) {
    if (!equal(item.authority?.needs, contract.expectedAuthority[item.rule])) return false;
    if (!equal(item.witnesses, contract.expectedWitnesses[item.rule])) return false;
  }
  return true;
}
function compileNative(rclcPath, compilerRbcPath, sourcePath, outputPath) {
  return run(rclcPath, [compilerRbcPath, sourcePath, outputPath]);
}
function executeNative(rclvmPath, rbcPath) {
  return run(rclvmPath, [rbcPath]);
}

export function runK337K338CompilerGovernanceReactiveEvidence(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert(contract.format === 'rcl.k337-k338.compiler-governance-reactive-runtime-contract.v0.1'
    && contract.frozenBeforeAcquisition === true, 'RCL_K337_K338_RUNTIME_CONTRACT_INVALID');

  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const compilerRbcPath = readCanonicalCompilerArtifact(contract).path;
  const rclcPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclc.exe' : 'rclc');
  const rclvmPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
  for (const requiredPath of [sourcePath, compilerRbcPath, rclcPath, rclvmPath]) {
    assert(fs.existsSync(requiredPath), `RCL_K337_K338_REQUIRED_ARTIFACT_MISSING:${requiredPath}`);
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert(sha256(source) === contract.canonical.sourceSha256, 'RCL_K337_K338_CANONICAL_SOURCE_DRIFT');
  assert(sha256(fs.readFileSync(compilerRbcPath)) === contract.canonical.compilerRbcSha256, 'RCL_K337_K338_COMPILER_RBC_DRIFT');

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k337-k338-runtime-'));
  const bootstrapBytecode = Buffer.from(compileRealityToBytecode(source));
  const compileDurations = [];
  const executeDurations = [];
  const combinedDurations = [];
  const rounds = [];
  const controls = {};
  const controlDetails = {};
  try {
    for (let index = 0; index < contract.required.rounds; index += 1) {
      const rbcPath = path.join(directory, `round-${index}.rbc`);
      const compilation = compileNative(rclcPath, compilerRbcPath, sourcePath, rbcPath);
      assert(!compilation.error && compilation.status === 0, `RCL_K337_K338_NATIVE_COMPILE_FAILED:${index}:${compilation.stderr}`);
      const nativeBytecode = fs.readFileSync(rbcPath);
      assert(!contract.required.bootstrapByteParity || nativeBytecode.equals(bootstrapBytecode), `RCL_K337_K338_BOOTSTRAP_PARITY_FAILED:${index}`);
      const execution = executeNative(rclvmPath, rbcPath);
      assert(!execution.error && execution.status === 0, `RCL_K337_K338_NATIVE_EXECUTE_FAILED:${index}:${execution.stderr}`);
      const payload = verifyNativeSemanticStateRoot(parseJson(execution.stdout, 'RCL_K337_K338_NATIVE_JSON_INVALID'), {
        requireNativeRoot: contract.required.nativeStateRootRequired,
      });
      assert(equal(payload.state, contract.expectedState), `RCL_K337_K338_EXPECTED_STATE_MISMATCH:${index}`);
      assert(historyMatches(payload, contract), `RCL_K337_K338_HISTORY_MISMATCH:${index}`);
      const compileMs = compilation.elapsedMs;
      const executeMs = execution.elapsedMs;
      compileDurations.push(compileMs);
      executeDurations.push(executeMs);
      combinedDurations.push(compileMs + executeMs);
      rounds.push({
        index,
        compileExitCode: compilation.status,
        executeExitCode: execution.status,
        compileMs,
        executeMs,
        combinedMs: compileMs + executeMs,
        artifactSha256: sha256(nativeBytecode),
        stateRoot: payload.semanticStateRoot,
        transactionRoots: payload.history.map((item) => ({
          rule: item.rule,
          beforeRoot: item.beforeRoot,
          afterRoot: item.afterRoot,
        })),
        instructionCount: payload.metrics?.instructions ?? null,
      });
    }

    const missingWarrantPath = path.join(directory, 'missing-warrant.rcl');
    const missingWarrantRbc = path.join(directory, 'missing-warrant.rbc');
    fs.writeFileSync(missingWarrantPath, source.replace('    warrant compiler.inspect on source\n', ''), 'utf8');
    const missingWarrant = compileNative(rclcPath, compilerRbcPath, missingWarrantPath, missingWarrantRbc);
    if (missingWarrant.status !== 0) {
      controls.missingWarrantRejected = !fs.existsSync(missingWarrantRbc)
        && /lacks warrant|RCL_COMPILE_ERROR/u.test(missingWarrant.stderr);
      controlDetails.missingWarrant = {
        rejectionStage: 'NATIVE_SELFHOST_COMPILER',
        compileExitCode: missingWarrant.status,
        executeExitCode: null,
        errorCode: 'RCL_COMPILE_ERROR',
      };
    } else {
      const missingWarrantExecution = executeNative(rclvmPath, missingWarrantRbc);
      const missingWarrantError = parseJson(missingWarrantExecution.stderr, 'RCL_K337_K338_MISSING_WARRANT_ERROR_INVALID');
      controls.missingWarrantRejected = missingWarrantExecution.status !== 0
        && missingWarrantError.code === 'RCL_AUTHORITY_DENIED';
      controlDetails.missingWarrant = {
        rejectionStage: 'NATIVE_VM_BEFORE_COMMIT',
        compileExitCode: missingWarrant.status,
        executeExitCode: missingWarrantExecution.status,
        errorCode: missingWarrantError.code,
      };
    }

    const brokenPreservePath = path.join(directory, 'broken-preserve.rcl');
    const brokenPreserveRbc = path.join(directory, 'broken-preserve.rbc');
    fs.writeFileSync(brokenPreservePath, source.replace(
      'preserve compiler.audit_count == 2',
      'preserve compiler.audit_count == 3',
    ), 'utf8');
    const brokenPreserveCompile = compileNative(rclcPath, compilerRbcPath, brokenPreservePath, brokenPreserveRbc);
    assert(brokenPreserveCompile.status === 0, 'RCL_K337_K338_BROKEN_PRESERVE_COMPILE_FAILED');
    const brokenPreserve = executeNative(rclvmPath, brokenPreserveRbc);
    const brokenPreserveError = parseJson(brokenPreserve.stderr, 'RCL_K337_K338_BROKEN_PRESERVE_ERROR_INVALID');
    controls.brokenPreserveRejected = brokenPreserve.status !== 0
      && brokenPreserveError.code === 'RCL_REALITY_BOUND_BROKEN';

    const invalidRequestPath = path.join(directory, 'invalid-request.rcl');
    const invalidRequestRbc = path.join(directory, 'invalid-request.rbc');
    fs.writeFileSync(invalidRequestPath, source.replace(
      'facet request.valid : Truth = true',
      'facet request.valid : Truth = false',
    ), 'utf8');
    const invalidRequestCompile = compileNative(rclcPath, compilerRbcPath, invalidRequestPath, invalidRequestRbc);
    assert(invalidRequestCompile.status === 0, 'RCL_K337_K338_INVALID_REQUEST_COMPILE_FAILED');
    const invalidRequest = executeNative(rclvmPath, invalidRequestRbc);
    assert(invalidRequest.status === 0, 'RCL_K337_K338_INVALID_REQUEST_EXECUTE_FAILED');
    const invalidPayload = verifyNativeSemanticStateRoot(parseJson(invalidRequest.stdout, 'RCL_K337_K338_INVALID_REQUEST_JSON_INVALID'), {
      requireNativeRoot: contract.required.nativeStateRootRequired,
    });
    controls.invalidRequestNoMutation = invalidPayload.history.length === 0
      && equal(invalidPayload.state, {
        'compiler.accepted': false,
        'compiler.audit_count': 0,
        'compiler.emitted': false,
        'compiler.phase': 0,
        'request.valid': false,
      });

    const corruptRbcPath = path.join(directory, 'corrupt.rbc');
    const corrupt = Buffer.from(bootstrapBytecode);
    corrupt[0] ^= 0xff;
    fs.writeFileSync(corruptRbcPath, corrupt);
    controls.corruptRbcRejected = executeNative(rclvmPath, corruptRbcPath).status !== 0;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }

  const uniqueStateRoots = new Set(rounds.map((round) => round.stateRoot)).size;
  const uniqueArtifactHashes = new Set(rounds.map((round) => round.artifactSha256)).size;
  const performanceEvidence = {
    compileP95Ms: percentile95(compileDurations),
    executeP95Ms: percentile95(executeDurations),
    combinedP95Ms: percentile95(combinedDurations),
    budget: contract.performanceBudget,
  };
  const performancePassed = performanceEvidence.compileP95Ms <= contract.performanceBudget.compileP95MsMax
    && performanceEvidence.executeP95Ms <= contract.performanceBudget.executeP95MsMax
    && performanceEvidence.combinedP95Ms <= contract.performanceBudget.combinedP95MsMax;
  const controlsPassed = Object.entries(controls).every(([name, passed]) => passed === contract.required[name]);
  const passed = rounds.length === contract.required.rounds
    && uniqueStateRoots === contract.required.uniqueStateRoots
    && uniqueArtifactHashes === 1
    && controlsPassed
    && performancePassed;
  const payloadWithoutRoot = {
    format: 'rcl.k337-k338.compiler-governance-reactive-runtime-evidence.v0.1',
    generatedAt: new Date().toISOString(),
    contractRoot: evidenceRoot(contract),
    eligibleCells: contract.eligibleCells,
    profile: contract.profile,
    host: { platform: process.platform, arch: process.arch, release: os.release() },
    artifacts: {
      sourceSha256: sha256(source),
      compilerRbcSha256: sha256(fs.readFileSync(compilerRbcPath)),
      rclcSha256: sha256(fs.readFileSync(rclcPath)),
      rclvmSha256: sha256(fs.readFileSync(rclvmPath)),
      bootstrapArtifactSha256: sha256(bootstrapBytecode),
    },
    expectedState: contract.expectedState,
    rounds,
    negativeControls: controls,
    negativeControlDetails: controlDetails,
    rclGaps: [
      {
        id: 'RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION',
        task: 'K337 compiler-runtime security-sensitive static authority validation',
        missingCapability: 'The RCL self-hosted compiler emits RBC for a source whose cause subject lacks a required warrant, while the JS reference compiler rejects the same source statically.',
        workaround: 'No authority bypass is used. The native VM rejects the emitted RBC with RCL_AUTHORITY_DENIED before commit, and the evidence records the exact rejection stage.',
        donor: 'src/compiler.mjs reference compiler warrant validation',
        gapType: 'COMPILER_SEMANTIC_VALIDATION',
        generality: 'CROSS_PROJECT_GENERAL',
        candidateAbsorption: 'Port cause-subject warrant validation into the RCL-owned self-host compiler and add differential invalid-source regression coverage.',
        affectedK400Cells: ['K337', 'K339'],
      },
    ],
    summary: {
      requiredRounds: contract.required.rounds,
      successfulRounds: rounds.length,
      uniqueStateRoots,
      uniqueArtifactHashes,
      controlsPassed,
      performancePassed,
    },
    performance: performanceEvidence,
    status: passed ? 'PASS' : 'FAIL',
    evidenceBoundary: contract.evidenceBoundary,
  };
  const payload = { ...payloadWithoutRoot, reportRoot: evidenceRoot({ ...payloadWithoutRoot, generatedAt: undefined }) };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = runK337K338CompilerGovernanceReactiveEvidence();
  console.log(JSON.stringify({
    status: result.status,
    reportRoot: result.reportRoot,
    summary: result.summary,
    negativeControls: result.negativeControls,
    performance: result.performance,
  }, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
