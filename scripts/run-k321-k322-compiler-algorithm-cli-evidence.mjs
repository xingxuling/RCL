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

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k321-k322-compiler-algorithm-cli-runtime-contract.v0.1.json');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k321-k322-compiler-algorithm-cli-runtime-v0.1.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function percentile95(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}
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
function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
}
function fibonacci(n) {
  let left = 0;
  let right = 1;
  for (let index = 0; index < n; index += 1) [left, right] = [right, left + right];
  return left;
}
function sumSquares(n) {
  let sum = 0;
  for (let value = 1; value <= n; value += 1) sum += value * value;
  return sum;
}
function oracleState() {
  return {
    'result.gcd': gcd(1071, 462),
    'result.fibonacci': fibonacci(12),
    'result.sum_squares': sumSquares(24),
    'result.boundary_gcd_zero': gcd(-42, 0),
    'result.boundary_fibonacci_zero': fibonacci(0),
    'result.boundary_fibonacci_one': fibonacci(1),
    'result.boundary_sum_zero': sumSquares(0),
    'result.correct': true,
  };
}
function expectedMatches(state, expected) {
  return Object.entries(expected).every(([key, value]) => state?.[key] === value);
}

export function runK321K322CompilerAlgorithmCliEvidence(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  if (contract.format !== 'rcl.k321-k322.compiler-algorithm-cli-runtime-contract.v0.1'
    || contract.frozenBeforeAcquisition !== true) throw new Error('RCL_K321_K322_RUNTIME_CONTRACT_INVALID');

  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const compilerRbcPath = path.join(ROOT, contract.canonical.compilerRbcPath);
  const rclcPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclc.exe' : 'rclc');
  const rclvmPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
  for (const requiredPath of [sourcePath, compilerRbcPath, rclcPath, rclvmPath]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`RCL_K321_K322_REQUIRED_ARTIFACT_MISSING:${requiredPath}`);
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  if (sha256(source) !== contract.canonical.sourceSha256) throw new Error('RCL_K321_K322_CANONICAL_SOURCE_DRIFT');
  if (sha256(fs.readFileSync(compilerRbcPath)) !== contract.canonical.compilerRbcSha256) throw new Error('RCL_K321_K322_COMPILER_RBC_DRIFT');

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k321-k322-runtime-'));
  const compileDurations = [];
  const executeDurations = [];
  const combinedDurations = [];
  const rounds = [];
  let bootstrapArtifactSha256 = null;
  let malformedSourceRejected = false;
  let corruptRbcRejected = false;
  try {
    const bootstrapBytecode = Buffer.from(compileRealityToBytecode(source));
    bootstrapArtifactSha256 = sha256(bootstrapBytecode);
    for (let index = 0; index < contract.required.rounds; index += 1) {
      const rbcPath = path.join(directory, `round-${index}.rbc`);
      const compilation = run(rclcPath, [compilerRbcPath, sourcePath, rbcPath]);
      if (compilation.error || compilation.status !== 0) throw new Error(`RCL_K321_K322_NATIVE_COMPILE_FAILED:${index}:${compilation.stderr}`);
      const nativeBytecode = fs.readFileSync(rbcPath);
      if (contract.required.bootstrapByteParity && !nativeBytecode.equals(bootstrapBytecode)) throw new Error(`RCL_K321_K322_BOOTSTRAP_PARITY_FAILED:${index}`);
      const execution = run(rclvmPath, [rbcPath]);
      if (execution.error || execution.status !== 0) throw new Error(`RCL_K321_K322_NATIVE_EXECUTE_FAILED:${index}:${execution.stderr}`);
      const payload = verifyNativeSemanticStateRoot(parseJson(execution.stdout, 'RCL_K321_K322_NATIVE_JSON_INVALID'), {
        requireNativeRoot: contract.required.nativeStateRootRequired,
      });
      if (!expectedMatches(payload.state, contract.expectedState)) throw new Error(`RCL_K321_K322_EXPECTED_STATE_MISMATCH:${index}`);
      if (contract.required.independentJavascriptOracle && !expectedMatches(payload.state, oracleState())) throw new Error(`RCL_K321_K322_ORACLE_MISMATCH:${index}`);
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
        instructionCount: payload.metrics?.instructions ?? null,
      });
    }

    const malformedPath = path.join(directory, 'malformed.rcl');
    fs.writeFileSync(malformedPath, source.replace('gcd(b, a % b)', 'gcd(b, a %)'), 'utf8');
    const malformed = run(rclcPath, [compilerRbcPath, malformedPath, path.join(directory, 'malformed.rbc')]);
    malformedSourceRejected = malformed.status !== 0 && !fs.existsSync(path.join(directory, 'malformed.rbc'));

    const corruptPath = path.join(directory, 'corrupt.rbc');
    const corrupt = Buffer.from(compileRealityToBytecode(source));
    corrupt[0] ^= 0xff;
    fs.writeFileSync(corruptPath, corrupt);
    const corruptExecution = run(rclvmPath, [corruptPath]);
    corruptRbcRejected = corruptExecution.status !== 0;
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
  const passed = rounds.length === contract.required.rounds
    && uniqueStateRoots === contract.required.uniqueStateRoots
    && uniqueArtifactHashes === 1
    && malformedSourceRejected === contract.required.malformedSourceRejected
    && corruptRbcRejected === contract.required.corruptRbcRejected
    && performancePassed;
  const payloadWithoutRoot = {
    format: 'rcl.k321-k322.compiler-algorithm-cli-runtime-evidence.v0.1',
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
      bootstrapArtifactSha256,
    },
    oracle: { implementation: 'independent-iterative-javascript', expected: oracleState() },
    rounds,
    summary: {
      requiredRounds: contract.required.rounds,
      successfulRounds: rounds.length,
      uniqueStateRoots,
      uniqueArtifactHashes,
      malformedSourceRejected,
      corruptRbcRejected,
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
  const result = runK321K322CompilerAlgorithmCliEvidence();
  console.log(JSON.stringify({
    status: result.status,
    reportRoot: result.reportRoot,
    summary: result.summary,
    performance: result.performance,
  }, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
