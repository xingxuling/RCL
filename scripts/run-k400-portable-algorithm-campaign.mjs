import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { compileReality } from '../src/compiler.mjs';
import { compileSourceFileSelfHosted } from '../src/selfhost-compiler.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { verifyNativeSemanticStateRoot } from '../src/semantic-state-root.mjs';
import { evidenceRoot, UNIVERSAL_STRESS_GATES } from '../src/universal-program-stress.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(ROOT, 'examples/universal-stress/expansion-wave1');
const sourcePath = path.join(directory, 'algorithm.rcl'), source = fs.readFileSync(sourcePath, 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(directory, 'algorithm-contract.json'), 'utf8'));
const proposals = JSON.parse(fs.readFileSync(path.join(directory, 'algorithm-independent-proposals.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(source), contract.sourceHash);
assert.equal(evidenceRoot({ ...contract, contractRoot: undefined }), contract.contractRoot);
assert.equal(proposals.contractRoot, contract.contractRoot);
assert.equal(sha(fs.readFileSync(path.join(ROOT, contract.compilerPath))), contract.compilerHash);
assert.equal(new Set(proposals.trials.map(trial => trial.generatorContext)).size, 3);
assert.equal(process.platform, 'win32', 'The Windows row requires an actual Windows host');
const wasiManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'native/wasi/build-manifest.json'), 'utf8'));
const wasmPath = path.join(ROOT, wasiManifest.wasm.path);
assert.equal(sha(fs.readFileSync(wasmPath)), wasiManifest.wasm.sha256);
for (const file of wasiManifest.sources) assert.equal(sha(fs.readFileSync(path.join(ROOT, file.path))), file.sha256);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k400-algorithm-'));
const rounds = [], windowsTimes = [], wasiTimes = [], compileTimes = [];
const mutations = {
  gcd: ['gcd(b, a % b)', 'gcd(b, b % a)'],
  fibonacci: ['fibonacci(n - 1) + fibonacci(n - 2)', 'fibonacci(n - 1) + fibonacci(n - 3)'],
  'sum-squares': ['n * n + sum_squares(n - 1)', 'n + n + sum_squares(n - 1)'],
};
const exactEdit = (text, old, replacement) => {
  assert.equal(text.split(old).length, 2, 'An edit must identify exactly one fragment');
  return text.replace(old, replacement);
};
function compile(text, prefix) {
  const file = path.join(temporary, prefix + '.rcl'), output = path.join(temporary, prefix + '.rbc');
  fs.writeFileSync(file, text);
  const start = performance.now(), compiled = compileSourceFileSelfHosted(file, output);
  const ms = performance.now() - start;
  assert.ok(compiled.bytecode.equals(compileRealityToBytecode(text)));
  return { path: output, bytes: compiled.bytecode, sha256: sha(compiled.bytecode), ms, programRoot: compileReality(text).programRoot };
}
function executeWindows(artifact) {
  const start = performance.now();
  const result = runNativeBytecode(artifact.path, { timeout: 10_000, stateRootAlgorithm: 'rcl.semantic-state-root.v2', requireNativeStateRoot: true });
  assert.equal(result.sourceRoot, artifact.programRoot);
  return { result, ms: performance.now() - start };
}
function executeWasi(artifact, success = true) {
  const start = performance.now();
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/run-native-wasi.mjs'), wasmPath, artifact.path],
    { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  if (!success) return { rejected: run.status !== 0, stdout: run.stdout, stderr: run.stderr };
  assert.equal(run.status, 0, run.stderr || run.stdout || run.error?.message);
  const result = verifyNativeSemanticStateRoot(JSON.parse(run.stdout), { requireNativeRoot: true, expectedAlgorithm: 'rcl.semantic-state-root.v2' });
  assert.equal(result.sourceRoot, artifact.programRoot);
  return { result, ms: performance.now() - start };
}
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const fibonacci = n => { let a = 0, b = 1; for (let index = 0; index < n; index++) [a, b] = [b, a + b]; return a; };
function oracle(a, b, n, sum) {
  let squares = 0; for (let index = 1; index <= sum; index++) squares += index ** 2;
  return { 'result.gcd': gcd(a, b), 'result.fibonacci': fibonacci(n), 'result.sum_squares': squares,
    'result.boundary_gcd_zero': 42, 'result.boundary_fibonacci_zero': 0, 'result.boundary_fibonacci_one': 1, 'result.boundary_sum_zero': 0 };
}
function checkResults(result, expected) {
  for (const [name, value] of Object.entries(expected)) assert.equal(result.state[name], value, name);
}
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
try {
  const expected = oracle(1071, 462, 12, 24);
  for (let index = 0; index < contract.rounds; index++) {
    const artifact = compile(source, 'canonical-' + index);
    const native = executeWindows(artifact), wasi = executeWasi(artifact);
    checkResults(native.result, expected); checkResults(wasi.result, expected);
    assert.equal(native.result.stateRoot, wasi.result.stateRoot);
    compileTimes.push(artifact.ms); windowsTimes.push(native.ms); wasiTimes.push(wasi.ms);
    rounds.push({ index, artifactHash: artifact.sha256, stateRoot: native.result.stateRoot, wasiStateRoot: wasi.result.stateRoot,
      state: native.result.state, compileMs: artifact.ms, windowsMs: native.ms, wasiMs: wasi.ms });
  }
  assert.equal(new Set(rounds.map(round => round.artifactHash)).size, 1);
  assert.equal(new Set(rounds.map(round => round.stateRoot)).size, 1);
  const variations = [[0, 0, 0, 0], [-42, 0, 1, -2], [0, 15, 2, 1], [-18, 24, 3, 2], [270, -192, 5, 7],
    [17, 19, 8, 12], [48, 180, 10, 18], [-111, -37, 13, 23], [12345, 54321, 16, 30], [999, 81, 18, 32]];
  const inputResults = [];
  for (const [index, values] of variations.entries()) {
    let variant = source;
    for (const [offset, name] of ['gcd_a', 'gcd_b', 'fibonacci_n', 'sum_squares_n'].entries()) {
      variant = variant.replace(new RegExp(`(facet input\\.${name} : Number = )-?[0-9]+`, 'u'), (_, prefix) => prefix + values[offset]);
    }
    const artifact = compile(variant, 'variation-' + index), expectedInput = oracle(...values);
    const native = executeWindows(artifact), wasi = executeWasi(artifact);
    checkResults(native.result, expectedInput); checkResults(wasi.result, expectedInput);
    assert.equal(native.result.stateRoot, wasi.result.stateRoot);
    inputResults.push({ values, sourceHash: sha(variant), artifactHash: artifact.sha256, stateRoot: native.result.stateRoot,
      wasiStateRoot: wasi.result.stateRoot, state: native.result.state, expected: expectedInput });
  }
  const trialResults = [];
  for (const trial of proposals.trials) {
    const [good, bad] = mutations[trial.id], mutated = exactEdit(source, good, bad);
    assert.equal(sha(mutated), contract.trials.find(item => item.id === trial.id).mutatedSourceHash);
    const brokenArtifact = compile(mutated, 'broken-' + trial.id);
    const broken = executeWindows(brokenArtifact);
    assert.ok(Object.entries(expected).some(([name, value]) => broken.result.state[name] !== value));
    const repaired = exactEdit(mutated, trial.proposal.old, trial.proposal.new);
    assert.equal(repaired, source, 'The evaluator must apply the independent proposal unchanged');
    const artifact = compile(repaired, 'repaired-' + trial.id);
    const native = executeWindows(artifact), wasi = executeWasi(artifact);
    checkResults(native.result, expected); checkResults(wasi.result, expected);
    assert.equal(native.result.stateRoot, wasi.result.stateRoot);
    trialResults.push({ id: trial.id, generatorContext: trial.generatorContext, mutatedSourceHash: sha(mutated), candidateSourceHash: sha(repaired),
      mutatedState: broken.result.state, repairedState: native.result.state,
      proposal: trial.proposal, exactCanonicalRestoration: true, windowsReplay: true, wasiReplay: true, stateRoot: native.result.stateRoot });
  }
  let malformedRejected = false;
  try { compile(source.replace('reality PortableAlgorithms', 'realty Broken'), 'malformed'); } catch { malformedRejected = true; }
  assert.equal(malformedRejected, true);
  const corruptPath = path.join(temporary, 'truncated.rbc'); fs.writeFileSync(corruptPath, Buffer.from('RCLB'));
  let nativeCorruptRejected = false;
  try { executeWindows({ path: corruptPath }); } catch { nativeCorruptRejected = true; }
  const wasiCorruptRejected = executeWasi({ path: corruptPath }, false).rejected;
  assert.equal(nativeCorruptRejected && wasiCorruptRejected, true);
  const performanceResult = { compileP95Ms: p95(compileTimes), windowsP95Ms: p95(windowsTimes), wasiP95Ms: p95(wasiTimes) };
  assert.ok(performanceResult.compileP95Ms <= contract.performanceBudget.compileP95Ms);
  assert.ok(performanceResult.windowsP95Ms <= contract.performanceBudget.executeP95Ms);
  assert.ok(performanceResult.wasiP95Ms <= contract.performanceBudget.executeP95Ms);
  const report = {
    format: 'rcl.k400-portable-algorithm-runtime.v1', status: 'PASS_LOCAL_WINDOWS_AND_WASM_WASI', generatedAt: new Date().toISOString(),
    contractRoot: contract.contractRoot, sourceHash: contract.sourceHash, compilerHash: contract.compilerHash,
    eligibleCells: contract.eligibleCells, runtimeBindings: { windows: { platform: process.platform, arch: process.arch, vmHash: sha(fs.readFileSync(path.join(ROOT, 'native/rclvm.exe'))) },
      wasi: { target: 'wasm32-wasi', wasmHash: wasiManifest.wasm.sha256, host: process.version, securitySandboxClaimed: false } },
    rounds, inputResults, independentGeneration: { successfulTrials: trialResults.length, uniqueContexts: new Set(trialResults.map(trial => trial.generatorContext)).size,
      requestedToolPolicy: proposals.requestedToolPolicy, canonicalSourceProvided: false, oracleEditsProvided: false, osIsolationClaimed: false, trials: trialResults },
    negativeControls: { malformedRejected, nativeCorruptRejected, wasiCorruptRejected, semanticMutationsDetected: 3 },
    performance: performanceResult, gates: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, 'PASS'])),
    sourceBindings: ['scripts/run-k400-portable-algorithm-campaign.mjs', 'scripts/run-native-wasi.mjs', 'scripts/build-native-wasi.mjs',
      'native/rclvm.c', 'native/wasi-sha256.zig', 'native/wasi-compat/stdio-capture.c', 'native/wasi-compat/openssl/sha.h'].map(name => ({ path: name, sha256: sha(fs.readFileSync(path.join(ROOT, name))) })),
    evidenceBoundary: 'Only the frozen bounded algorithm/CLI profile on actual Windows native processes and wasm32 WASI execution. Ten parametric cases were selected after generation and withheld from proposals, not pre-sealed holdouts. No browser, Linux, Android, or unrelated family credit.',
    hostedCi: 'NOT_RUN_USER_INSTRUCTION', reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  fs.writeFileSync(path.join(directory, 'algorithm-runtime.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, eligibleCells: report.eligibleCells, rounds: rounds.length, parametricCases: inputResults.length,
    independentTrials: trialResults.length, performance: performanceResult, reportRoot: report.reportRoot }));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
