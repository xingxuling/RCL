#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.resolve(process.argv[2] ?? path.join(root, 'output', 'k08-tensor-cpu-v0.1'));
const manifestPath = path.join(root, 'native', 'tensor-engine', 'Cargo.toml');
const enginePath = path.join(root, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-tensor-engine.exe' : 'rcl-tensor-engine');
const size = Number(process.env.RCL_TENSOR_EVIDENCE_SIZE ?? 24);
const repeats = Number(process.env.RCL_TENSOR_EVIDENCE_REPEATS ?? 7);

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
}

function artifactHash(relativePaths) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of relativePaths) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function contractHash() {
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'tensor-genome-contract.v0.1.json'), 'utf8'));
  if (contract.evidence) delete contract.evidence.reportRoot;
  return sha256(contract);
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function matrixData(multiplier, offset, modulus) {
  return Array.from({ length: size * size }, (_, index) => ((index * multiplier + offset) % modulus) - Math.floor(modulus / 2));
}

function scalarSource() {
  return `reality TensorScalarMatmulEvidence {
  reckon integer_quotient(value : Number, divisor : Number, quotient : Number) -> Number =
    choose(value < divisor, quotient, integer_quotient(value - divisor, divisor, quotient + 1))
  reckon integer_remainder(value : Number, divisor : Number) -> Number = value - integer_quotient(value, divisor, 0) * divisor
  reckon generated_data(count : Number, multiplier : Number, offset : Number, modulus : Number, center : Number, index : Number, output : Sequence) -> Sequence =
    choose(index >= count, output, generated_data(count, multiplier, offset, modulus, center, index + 1,
      sequence_append(output, integer_remainder(index * multiplier + offset, modulus) - center)))
  reckon matmul_cell(left : Sequence, right : Sequence, row : Number, column : Number, inner : Number, width : Number, accumulated : Number) -> Number =
    choose(inner >= width, accumulated, matmul_cell(left, right, row, column, inner + 1, width,
      accumulated + sequence_get(left, row * width + inner) * sequence_get(right, inner * width + column)))
  reckon matmul_data(left : Sequence, right : Sequence, width : Number, index : Number, output : Sequence) -> Sequence =
    choose(index >= width * width, output, matmul_data(left, right, width, index + 1,
      sequence_append(output, matmul_cell(left, right, integer_quotient(index, width, 0), integer_remainder(index, width), 0, width, 0))))
  facet benchmark.size : Number = ${size}
  facet benchmark.left : Sequence = generated_data(${size * size}, 17, 3, 7, 3, 0, empty_sequence())
  facet benchmark.right : Sequence = generated_data(${size * size}, 29, 7, 11, 5, 0, empty_sequence())
  facet benchmark.result : Sequence = matmul_data(benchmark.left, benchmark.right, benchmark.size, 0, empty_sequence())
}`;
}

function providerRequest() {
  return {
    format: 'rcl.tensor-execution-request.v0.1',
    operation: 'matmul',
    tensors: [
      { id: 'a', shape: [size, size], dtype: 'f64', layout: 'row-major', device: 'cpu', gradientIdentity: 'constant:a', storageIdentity: 'storage:a' },
      { id: 'b', shape: [size, size], dtype: 'f64', layout: 'row-major', device: 'cpu', gradientIdentity: 'constant:b', storageIdentity: 'storage:b' },
    ],
    storages: [
      { identity: 'storage:a', kind: 'cpu-dense', data: matrixData(17, 3, 7) },
      { identity: 'storage:b', kind: 'cpu-dense', data: matrixData(29, 7, 11) },
    ],
    attributes: {},
  };
}

function providerSource(request) {
  return `reality TensorProviderMatmulEvidence {
  facet benchmark.request : Text = ${JSON.stringify(JSON.stringify(request))}
  facet benchmark.result : Text = provider_call("rcl.tensor.cpu", "tensor.execute", benchmark.request)
}`;
}

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--manifest-path', manifestPath, '--offline'], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'Cargo build failed');
}

function compileNative(sourcePath, outputPath) {
  const compilation = runNativeCompiler(path.join(root, 'selfhost', 'compiler.rbc'), sourcePath, outputPath, { timeout: 180_000, maxBuffer: 128 * 1024 * 1024 });
  const nativeBytes = fs.readFileSync(outputPath);
  const referenceBytes = Buffer.from(compileRealityToBytecode(fs.readFileSync(sourcePath, 'utf8')));
  if (!nativeBytes.equals(referenceBytes)) throw new Error(`Native/reference compiler parity failed for ${sourcePath}`);
  return { bytes: nativeBytes.length, sha256: sha256(nativeBytes), selfhostInstructions: compilation.executedInstructions };
}

function timedScalar(rbcPath) {
  const start = performance.now();
  const result = runNativeBytecode(rbcPath, { timeout: 180_000, maxBuffer: 128 * 1024 * 1024, requireNativeStateRoot: true });
  return { elapsedMs: performance.now() - start, result };
}

function timedProvider(rbcPath) {
  if (process.platform !== 'win32') throw new Error('This v0.1 evidence runner currently requires the checked Windows rclvm.dll provider host');
  const start = performance.now();
  const run = spawnSync(enginePath, ['run-rbc', rbcPath, path.join(root, 'native', 'rclvm.dll')], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 128 * 1024 * 1024 });
  const elapsedMs = performance.now() - start;
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'Provider host failed');
  const native = JSON.parse(run.stdout);
  return { elapsedMs, native, result: JSON.parse(native.state['benchmark.result']) };
}

fs.mkdirSync(outputDir, { recursive: true });
buildEngine();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-tensor-evidence-'));
const scalarSourcePath = path.join(temporary, 'scalar.rcl');
const providerSourcePath = path.join(temporary, 'provider.rcl');
const scalarRbcPath = path.join(temporary, 'scalar.rbc');
const providerRbcPath = path.join(temporary, 'provider.rbc');
const request = providerRequest();
fs.writeFileSync(scalarSourcePath, scalarSource());
fs.writeFileSync(providerSourcePath, providerSource(request));
const scalarCompilation = compileNative(scalarSourcePath, scalarRbcPath);
const providerCompilation = compileNative(providerSourcePath, providerRbcPath);

timedScalar(scalarRbcPath);
timedProvider(providerRbcPath);
const scalarRuns = Array.from({ length: repeats }, () => timedScalar(scalarRbcPath));
const providerRuns = Array.from({ length: repeats }, () => timedProvider(providerRbcPath));
const scalarResult = scalarRuns[0].result.state['benchmark.result'];
const optimizedResult = providerRuns[0].result.storage.data;
const maximumDrift = scalarResult.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - optimizedResult[index])), 0);
if (maximumDrift > 1e-12) throw new Error(`Scalar/provider maximum drift ${maximumDrift} exceeded 1e-12`);
if (new Set(scalarRuns.map(run => run.result.semanticStateRoot)).size !== 1) throw new Error('Scalar semantic state root is not deterministic');
if (new Set(providerRuns.map(run => run.result.storage.identity)).size !== 1) throw new Error('Provider storage identity is not deterministic');

const kernelBenchmarkRun = spawnSync(enginePath, ['benchmark', '192', '9'], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
if (kernelBenchmarkRun.status !== 0) throw new Error(kernelBenchmarkRun.stderr || 'Kernel benchmark failed');
const kernelBenchmark = JSON.parse(kernelBenchmarkRun.stdout);
const scalarMedianMs = median(scalarRuns.map(run => run.elapsedMs));
const providerMedianMs = median(providerRuns.map(run => run.elapsedMs));
const evidence = {
  format: 'rcl.k08-c.tensor-cpu-evidence.v0.1',
  status: 'ENGINE_E1_CANDIDATE_LOCAL_WINDOWS',
  canonicalOwner: 'RCL',
  backendOwner: 'rcl-tensor-cpu-rust-v0.1',
  implementationDecision: 'GENERAL_TENSOR_PROVIDER_BACKEND_NO_MODEL_SPECIAL_OPCODE',
  artifactHashes: {
    tensorSemantics: artifactHash(['examples/native-ai/tensor-genome.rcl', 'examples/native-ai/tensor-object.rcl', 'examples/native-ai/types/tensor.rcltype']),
    tensorContract: contractHash(),
    providerBoundary: artifactHash(['examples/native-ai/tensor-cpu-provider.rcl', 'examples/native-ai/tensor-cpu-request.v0.1.json']),
    rustBackend: artifactHash(['native/tensor-engine/Cargo.toml', 'native/tensor-engine/Cargo.lock', 'native/tensor-engine/src/lib.rs', 'native/tensor-engine/src/main.rs', 'native/tensor-engine/src/rclvm_provider.rs']),
    releaseBinary: sha256(fs.readFileSync(enginePath)),
    selfhostCompilerRbc: sha256(fs.readFileSync(path.join(root, 'selfhost', 'compiler.rbc'))),
  },
  matrix: [size, size, size],
  repeats,
  compilerParity: true,
  scalarCompilation,
  providerCompilation,
  differential: {
    elementCount: scalarResult.length,
    tolerance: 1e-12,
    maximumDrift,
    exactParity: maximumDrift === 0,
    deterministicScalarRoots: new Set(scalarRuns.map(run => run.result.semanticStateRoot)).size,
    deterministicStorageIdentities: new Set(providerRuns.map(run => run.result.storage.identity)).size,
    storageIdentity: providerRuns[0].result.storage.identity,
  },
  endToEnd: {
    boundary: 'warm native process per run; includes VM startup, state serialization and provider dispatch; excludes compilation',
    scalarMedianMs,
    optimizedProviderMedianMs: providerMedianMs,
    speedup: scalarMedianMs / providerMedianMs,
    scalarSamplesMs: scalarRuns.map(run => run.elapsedMs),
    optimizedProviderSamplesMs: providerRuns.map(run => run.elapsedMs),
  },
  kernelBenchmark,
  inheritedGeneralMlpNativeToJsRatio: 118.3,
  generalMlpGapStatus: 'UNMEASURED_AFTER_BACKEND_NOT_YET_LOWERED',
  gaps: [
    { id: 'RCL_GAP_AI_005', type: 'BACKEND_GAP', disposition: 'PARTIALLY_ABSORBED_BY_CPU_TENSOR_ORGAN' },
    { id: 'RCL_GAP_AI_008', type: 'COMPILER_GAP', disposition: 'TYPED_TENSOR_SOURCE_STILL_USES_JS_TYPED_LINKER' },
    { id: 'RCL_GAP_AI_009', type: 'LOWERING_GAP', disposition: 'GENERAL_MLP_NOT_YET_LOWERED_TO_TENSOR_BACKEND' },
    { id: 'RCL_GAP_AI_010', type: 'EVIDENCE_GAP', disposition: 'SCIENTIFIC_NOTATION_NUMBER_ROOT_CANONICALIZATION_EXPOSED_AND_QUARANTINED_FROM_THIS_INTEGER_PERFORMANCE_CORPUS' },
  ],
  claimsNotGranted: ['K400_PASS', 'GENERAL_MLP_118X_GAP_CLOSED', 'AUTODIFF', 'GPU', 'DISTRIBUTED_TENSOR', 'PRODUCTION_BLAS_PARITY'],
};
evidence.reportRoot = sha256(evidence);
const evidencePath = path.join(outputDir, 'k08-c-tensor-cpu-evidence.json');
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, evidencePath, reportRoot: evidence.reportRoot, endToEnd: evidence.endToEnd, kernelBenchmark }, null, 2));
