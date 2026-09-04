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
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k340-compiler-mixed-paradigm-runtime-contract.v0.1.json');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k340-compiler-mixed-paradigm-runtime-v0.1.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function percentile95(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
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
  catch { throw new Error(`${code}:${String(text).slice(0, 500)}`); }
}
function assert(condition, code) { if (!condition) throw new Error(code); }
function compileNative(rclcPath, compilerRbcPath, sourcePath, outputPath) {
  return run(rclcPath, [compilerRbcPath, sourcePath, outputPath]);
}
function executeNative(rclvmPath, rbcPath) { return run(rclvmPath, [rbcPath]); }
function historyMatches(payload, contract) {
  const history = payload.history ?? [];
  if (!equal(history.map((item) => item.rule), contract.required.transactionRuleOrder)) return false;
  if (!history.every((item) => item.status === 'realized' && item.mode === 'realize')) return false;
  if (contract.required.rootContinuity && history[0]?.afterRoot !== history[1]?.beforeRoot) return false;
  return history.every((item) => equal(item.authority?.needs, contract.expectedAuthority[item.rule])
    && equal(item.witnesses, contract.expectedWitnesses[item.rule]));
}
function writeMutation(directory, name, source, oldText, newText) {
  assert(source.includes(oldText), `RCL_K340_MUTATION_SITE_MISSING:${name}`);
  const sourcePath = path.join(directory, `${name}.rcl`);
  fs.writeFileSync(sourcePath, source.replace(oldText, newText), 'utf8');
  return { sourcePath, rbcPath: path.join(directory, `${name}.rbc`) };
}

export function runK340CompilerMixedParadigmEvidence(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert(contract.format === 'rcl.k340.compiler-mixed-paradigm-runtime-contract.v0.1'
    && contract.frozenBeforeAcquisition === true, 'RCL_K340_RUNTIME_CONTRACT_INVALID');

  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const compilerRbcPath = readCanonicalCompilerArtifact(contract).path;
  const rclcPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclc.exe' : 'rclc');
  const rclvmPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
  for (const requiredPath of [sourcePath, compilerRbcPath, rclcPath, rclvmPath]) {
    assert(fs.existsSync(requiredPath), `RCL_K340_REQUIRED_ARTIFACT_MISSING:${requiredPath}`);
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert(sha256(source) === contract.canonical.sourceSha256, 'RCL_K340_CANONICAL_SOURCE_DRIFT');
  assert(sha256(fs.readFileSync(compilerRbcPath)) === contract.canonical.compilerRbcSha256, 'RCL_K340_COMPILER_RBC_DRIFT');

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k340-runtime-'));
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
      assert(!compilation.error && compilation.status === 0, `RCL_K340_NATIVE_COMPILE_FAILED:${index}:${compilation.stderr}`);
      const nativeBytecode = fs.readFileSync(rbcPath);
      assert(!contract.required.bootstrapByteParity || nativeBytecode.equals(bootstrapBytecode), `RCL_K340_BOOTSTRAP_PARITY_FAILED:${index}`);
      const execution = executeNative(rclvmPath, rbcPath);
      assert(!execution.error && execution.status === 0, `RCL_K340_NATIVE_EXECUTE_FAILED:${index}:${execution.stderr}`);
      const payload = verifyNativeSemanticStateRoot(parseJson(execution.stdout, 'RCL_K340_NATIVE_JSON_INVALID'), {
        requireNativeRoot: contract.required.nativeStateRootRequired,
      });
      assert(equal(payload.state, contract.expectedState), `RCL_K340_EXPECTED_STATE_MISMATCH:${index}`);
      assert(historyMatches(payload, contract), `RCL_K340_HISTORY_MISMATCH:${index}`);
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
        transactionRoots: payload.history.map((item) => ({ rule: item.rule, beforeRoot: item.beforeRoot, afterRoot: item.afterRoot })),
        instructionCount: payload.metrics?.instructions ?? null,
        peakCallFrames: payload.metrics?.peakCallFrames ?? null,
      });
    }

    const recursive = writeMutation(directory, 'recursive-mutation', source,
      'n * n + sum_squares(n - 1)', 'n + n + sum_squares(n - 1)');
    const recursiveCompile = compileNative(rclcPath, compilerRbcPath, recursive.sourcePath, recursive.rbcPath);
    assert(recursiveCompile.status === 0, 'RCL_K340_RECURSIVE_MUTATION_COMPILE_FAILED');
    const recursiveRun = executeNative(rclvmPath, recursive.rbcPath);
    const recursiveError = parseJson(recursiveRun.stderr, 'RCL_K340_RECURSIVE_ERROR_INVALID');
    controls.recursiveMutationRejected = recursiveRun.status !== 0 && recursiveError.code === 'RCL_REALITY_BOUND_BROKEN';
    controlDetails.recursiveMutation = { compileExitCode: recursiveCompile.status, executeExitCode: recursiveRun.status, errorCode: recursiveError.code };

    const phase = writeMutation(directory, 'phase-mutation', source,
      'compiler.phase == 1 and compiler.digest == 204', 'compiler.phase == 2 and compiler.digest == 204');
    const phaseCompile = compileNative(rclcPath, compilerRbcPath, phase.sourcePath, phase.rbcPath);
    assert(phaseCompile.status === 0, 'RCL_K340_PHASE_MUTATION_COMPILE_FAILED');
    const phaseRun = executeNative(rclvmPath, phase.rbcPath);
    assert(phaseRun.status === 0, 'RCL_K340_PHASE_MUTATION_EXECUTE_FAILED');
    const phasePayload = verifyNativeSemanticStateRoot(parseJson(phaseRun.stdout, 'RCL_K340_PHASE_JSON_INVALID'), { requireNativeRoot: true });
    controls.phaseMutationNoCommit = phasePayload.history.length === 1
      && phasePayload.history[0].rule === 'analyze_batch'
      && phasePayload.state['compiler.phase'] === 1
      && phasePayload.state['compiler.emitted'] === false;
    controlDetails.phaseMutation = { compileExitCode: phaseCompile.status, executeExitCode: phaseRun.status, committedRules: phasePayload.history.map((item) => item.rule) };

    const missing = writeMutation(directory, 'missing-warrant', source,
      '    warrant compiler.analyze on source\n', '');
    const missingCompile = compileNative(rclcPath, compilerRbcPath, missing.sourcePath, missing.rbcPath);
    let missingRun = null;
    let missingError = null;
    if (missingCompile.status === 0) {
      missingRun = executeNative(rclvmPath, missing.rbcPath);
      missingError = parseJson(missingRun.stderr, 'RCL_K340_MISSING_WARRANT_ERROR_INVALID');
      controls.missingWarrantRejected = missingRun.status !== 0 && missingError.code === 'RCL_AUTHORITY_DENIED';
    } else {
      controls.missingWarrantRejected = !fs.existsSync(missing.rbcPath) && /lacks warrant|RCL_COMPILE_ERROR/u.test(missingCompile.stderr);
    }
    controlDetails.missingWarrant = {
      rejectionStage: missingCompile.status === 0 ? 'NATIVE_VM_BEFORE_COMMIT' : 'NATIVE_SELFHOST_COMPILER',
      compileExitCode: missingCompile.status,
      executeExitCode: missingRun?.status ?? null,
      errorCode: missingError?.code ?? 'RCL_COMPILE_ERROR',
    };

    const zero = writeMutation(directory, 'zero-batch', source,
      'facet input.batch_size : Number = 8', 'facet input.batch_size : Number = 0');
    const zeroCompile = compileNative(rclcPath, compilerRbcPath, zero.sourcePath, zero.rbcPath);
    assert(zeroCompile.status === 0, 'RCL_K340_ZERO_BATCH_COMPILE_FAILED');
    const zeroRun = executeNative(rclvmPath, zero.rbcPath);
    assert(zeroRun.status === 0, 'RCL_K340_ZERO_BATCH_EXECUTE_FAILED');
    const zeroPayload = verifyNativeSemanticStateRoot(parseJson(zeroRun.stdout, 'RCL_K340_ZERO_BATCH_JSON_INVALID'), { requireNativeRoot: true });
    controls.zeroBatchNoMutation = zeroPayload.history.length === 0 && equal(zeroPayload.state, {
      'compiler.accepted': false,
      'compiler.digest': 0,
      'compiler.emitted': false,
      'compiler.phase': 0,
      'input.batch_size': 0,
    });
    controlDetails.zeroBatch = { compileExitCode: zeroCompile.status, executeExitCode: zeroRun.status, historyLength: zeroPayload.history.length };

    const corruptPath = path.join(directory, 'corrupt.rbc');
    const corrupt = Buffer.from(bootstrapBytecode);
    corrupt[0] ^= 0xff;
    fs.writeFileSync(corruptPath, corrupt);
    const corruptRun = executeNative(rclvmPath, corruptPath);
    controls.corruptRbcRejected = corruptRun.status !== 0;
    controlDetails.corruptRbc = { executeExitCode: corruptRun.status };
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
    format: 'rcl.k340.compiler-mixed-paradigm-runtime-evidence.v0.1',
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
    summary: {
      requiredRounds: contract.required.rounds,
      successfulRounds: rounds.length,
      uniqueStateRoots,
      uniqueArtifactHashes,
      controlsPassed,
      performancePassed,
    },
    performance: performanceEvidence,
    rclGaps: controlDetails.missingWarrant.rejectionStage === 'NATIVE_VM_BEFORE_COMMIT' ? [{
      id: 'RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION',
      task: 'K340 compiler-runtime mixed-paradigm static authority validation',
      missingCapability: 'The self-host compiler emits RBC for a source whose cause subject lacks a needed warrant; the JS reference compiler rejects it statically.',
      workaround: 'No bypass is used. Native rclvm rejects RCL_AUTHORITY_DENIED before commit and the receipt records the actual rejection stage.',
      donor: 'src/compiler.mjs reference compiler warrant validation',
      gapType: 'COMPILER_SEMANTIC_VALIDATION',
      generality: 'CROSS_PROJECT_GENERAL',
      candidateAbsorption: 'Port cause-subject warrant validation into the RCL self-host compiler under a new fixed-point authority gate.',
      affectedK400Cells: ['K337', 'K339', 'K340'],
    }] : [],
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
  const result = runK340CompilerMixedParadigmEvidence();
  console.log(JSON.stringify({
    status: result.status,
    reportRoot: result.reportRoot,
    summary: result.summary,
    negativeControls: result.negativeControls,
    performance: result.performance,
  }, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
