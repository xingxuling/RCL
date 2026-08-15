#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot, STRESS_STATUS } from '../src/universal-program-stress.mjs';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [, , mode, workloadArg, sourceArg, outputArg] = process.argv;

function fail(message) {
  throw new Error(`RCL_MICROBENCH_ARGUMENT:${message}`);
}

if (!['rcl', 'rust', 'python'].includes(mode)) fail('mode must be rcl, rust or python');
if (!workloadArg || !sourceArg || !outputArg) fail('workload, source and output are required');

const workloadPath = path.resolve(root, workloadArg);
const sourcePath = path.resolve(root, sourceArg);
const outputPath = path.resolve(root, outputArg);
const artifactPath = mode === 'rcl'
  ? outputPath.replace(/\.json$/i, '.rbc')
  : mode === 'rust'
    ? path.join(path.dirname(outputPath), 'rust-microbench.exe')
    : path.join(path.dirname(outputPath), 'python-microbench.pyc');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return fs.existsSync(filePath) ? sha256(fs.readFileSync(filePath)) : null;
}

function elapsedMs(started) {
  return Number((Number(process.hrtime.bigint() - started) / 1e6).toFixed(3));
}

function closeEnough(actual, expected) {
  return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= 1e-9;
}

function readInputs() {
  const workloadBytes = fs.readFileSync(workloadPath);
  const workload = JSON.parse(workloadBytes.toString('utf8'));
  const source = fs.readFileSync(sourcePath, 'utf8');
  const compileIterations = Number(workload.benchmark?.compileIterations ?? 1);
  const runtimeIterations = Number(workload.benchmark?.runtimeIterations ?? 1);
  if (!Number.isInteger(compileIterations) || compileIterations < 1) fail('compileIterations must be a positive integer');
  if (!Number.isInteger(runtimeIterations) || runtimeIterations < 1) fail('runtimeIterations must be a positive integer');
  if (!Number.isFinite(workload.expected?.resultOutput)) fail('expected.resultOutput must be numeric');
  return {
    workload,
    source,
    inputRoot: sha256(workloadBytes),
    sourceRoot: sha256(Buffer.from(source, 'utf8')),
    compileIterations,
    runtimeIterations,
    expectedOutput: Number(workload.expected.resultOutput),
  };
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function finish(report, exitCode = 0) {
  const reportWithoutRoot = { ...report };
  delete reportWithoutRoot.evidenceRoot;
  const finalReport = { ...reportWithoutRoot, evidenceRoot: evidenceRoot(reportWithoutRoot) };
  writeReport(finalReport);
  console.log(JSON.stringify({
    status: finalReport.status,
    mode,
    inputRoot: finalReport.inputRoot,
    evidenceRoot: finalReport.evidenceRoot,
    outputPath,
  }, null, 2));
  if (exitCode !== 0) process.exitCode = exitCode;
}

function commonEvidence(inputs) {
  return {
    schema: 'rcl.compiler-microbench.evidence.v0.1',
    mode,
    workloadId: inputs.workload.id,
    inputRoot: inputs.inputRoot,
    sourceRoot: inputs.sourceRoot,
    benchmark: {
      compileIterations: inputs.compileIterations,
      runtimeIterations: inputs.runtimeIterations,
    },
    contract: inputs.workload.contract ?? null,
  };
}

function runRcl(inputs) {
  let bytecode = null;
  let compileTotalMs = 0;
  let compileRuns = [];
  let runtimeTotalMs = 0;
  let runtimeRuns = [];
  let nativeRun = null;
  try {
    if (fs.existsSync(artifactPath)) fs.rmSync(artifactPath, { force: true });
    for (let index = 0; index < inputs.compileIterations; index += 1) {
      const started = process.hrtime.bigint();
      bytecode = Buffer.from(compileRealityToBytecode(inputs.source));
      const duration = elapsedMs(started);
      compileTotalMs += duration;
      compileRuns.push(duration);
    }
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, bytecode);
    for (let index = 0; index < inputs.runtimeIterations; index += 1) {
      const started = process.hrtime.bigint();
      nativeRun = runNativeBytecode(bytecode, { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
      const duration = elapsedMs(started);
      runtimeTotalMs += duration;
      runtimeRuns.push(duration);
    }
  } catch (error) {
    finish({
      ...commonEvidence(inputs),
      status: STRESS_STATUS.FAIL,
      failure: { code: error.code ?? 'RCL_MICROBENCH_EXECUTION', message: error.message },
      metrics: {},
      artifacts: [{ path: artifactPath, exists: fs.existsSync(artifactPath), sha256: sha256File(artifactPath) }],
    }, 1);
    return;
  }

  const actualOutput = Number(nativeRun?.state?.['result.output']);
  const correct = closeEnough(actualOutput, inputs.expectedOutput);
  const compileBuildSpeed = Number((compileTotalMs / inputs.compileIterations).toFixed(3));
  const runtimeMs = Number((runtimeTotalMs / inputs.runtimeIterations).toFixed(3));
  finish({
    ...commonEvidence(inputs),
    status: correct ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
    provider: {
      id: 'rcl-native-vm',
      compiler: 'RCL compileRealityToBytecode',
      executor: 'RCL native VM',
      sourcePath,
      artifactPath,
    },
    correctness: {
      expected: inputs.expectedOutput,
      actual: actualOutput,
      tolerance: 1e-9,
      passed: correct,
      stateRoot: nativeRun.semanticStateRoot ?? nativeRun.stateRoot ?? null,
    },
    metrics: {
      correctness: correct ? 1 : 0,
      compileBuildSpeed,
      runtimeMs,
      artifactFootprintBytes: bytecode.length,
    },
    timings: {
      compileRuns,
      runtimeRuns,
    },
    artifacts: [{
      path: artifactPath,
      exists: true,
      bytes: bytecode.length,
      sha256: sha256(bytecode),
    }],
  }, correct ? 0 : 1);
}

function rustCommand(executable, args, timeout = 120_000) {
  return spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
}

function runRust(inputs) {
  const rustc = process.platform === 'win32' ? 'rustc.exe' : 'rustc';
  let compileRuns = [];
  let runtimeRuns = [];
  let compileTotalMs = 0;
  let runtimeTotalMs = 0;
  let output = null;
  let rustVersion = null;
  try {
    if (fs.existsSync(artifactPath)) fs.rmSync(artifactPath, { force: true });
    const version = rustCommand(rustc, ['--version'], 10_000);
    if (version.error?.code === 'ENOENT') {
      finish({
        ...commonEvidence(inputs),
        status: STRESS_STATUS.BLOCKED,
        failure: { code: 'RUSTC_NOT_FOUND', message: 'rustc is not installed or not on PATH' },
        metrics: {},
        artifacts: [],
      });
      return;
    }
    if (version.status !== 0) throw new Error(version.stderr || `rustc --version exited with ${version.status}`);
    rustVersion = version.stdout.trim();
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    for (let index = 0; index < inputs.compileIterations; index += 1) {
      const started = process.hrtime.bigint();
      const result = rustCommand(rustc, ['--edition=2021', '-O', sourcePath, '-o', artifactPath]);
      const duration = elapsedMs(started);
      compileTotalMs += duration;
      compileRuns.push(duration);
      if (result.error) throw new Error(result.error.message);
      if (result.status !== 0) throw new Error(result.stderr || `rustc exited with ${result.status}`);
    }
    for (let index = 0; index < inputs.runtimeIterations; index += 1) {
      const started = process.hrtime.bigint();
      const result = spawnSync(artifactPath, [], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      const duration = elapsedMs(started);
      runtimeTotalMs += duration;
      runtimeRuns.push(duration);
      if (result.error) throw new Error(result.error.message);
      if (result.status !== 0) throw new Error(result.stderr || `reference executable exited with ${result.status}`);
      output = Number(String(result.stdout ?? '').trim());
      if (!Number.isFinite(output)) throw new Error(`reference executable returned non-numeric output: ${result.stdout}`);
    }
  } catch (error) {
    finish({
      ...commonEvidence(inputs),
      status: STRESS_STATUS.FAIL,
      provider: { id: 'rustc-reference', compiler: 'rustc', executor: artifactPath, sourcePath, artifactPath, rustVersion },
      failure: { code: error.code ?? 'RCL_MICROBENCH_REFERENCE_FAILURE', message: error.message },
      metrics: {},
      artifacts: [{ path: artifactPath, exists: fs.existsSync(artifactPath), sha256: sha256File(artifactPath) }],
    }, 1);
    return;
  }
  const correct = closeEnough(output, inputs.expectedOutput);
  const artifactBytes = fs.statSync(artifactPath).size;
  finish({
    ...commonEvidence(inputs),
    status: correct ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
    provider: { id: 'rustc-reference', compiler: 'rustc', executor: artifactPath, sourcePath, artifactPath, rustVersion },
    correctness: { expected: inputs.expectedOutput, actual: output, tolerance: 1e-9, passed: correct },
    metrics: {
      correctness: correct ? 1 : 0,
      compileBuildSpeed: Number((compileTotalMs / inputs.compileIterations).toFixed(3)),
      runtimeMs: Number((runtimeTotalMs / inputs.runtimeIterations).toFixed(3)),
      artifactFootprintBytes: artifactBytes,
    },
    timings: { compileRuns, runtimeRuns },
    artifacts: [{ path: artifactPath, exists: true, bytes: artifactBytes, sha256: sha256File(artifactPath) }],
  }, correct ? 0 : 1);
}

function runPythonCommand(executable, args, timeout = 120_000) {
  return spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
}

function findPython() {
  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const executable of candidates) {
    const result = runPythonCommand(executable, ['--version'], 10_000);
    if (!result.error && result.status === 0) {
      return {
        executable,
        version: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
      };
    }
  }
  return null;
}

function runPython(inputs) {
  let compileRuns = [];
  let runtimeRuns = [];
  let compileTotalMs = 0;
  let runtimeTotalMs = 0;
  let output = null;
  let python = null;
  try {
    if (fs.existsSync(artifactPath)) fs.rmSync(artifactPath, { force: true });
    python = findPython();
    if (!python) {
      finish({
        ...commonEvidence(inputs),
        status: STRESS_STATUS.BLOCKED,
        provider: { id: 'python-reference', compiler: 'CPython py_compile', executor: 'python' },
        failure: { code: 'PYTHON_NOT_FOUND', message: 'Python is not installed or not on PATH' },
        metrics: {},
        artifacts: [],
      });
      return;
    }
    const compileScript = 'import py_compile, sys; py_compile.compile(sys.argv[1], cfile=sys.argv[2], doraise=True)';
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    for (let index = 0; index < inputs.compileIterations; index += 1) {
      const started = process.hrtime.bigint();
      const result = runPythonCommand(python.executable, ['-c', compileScript, sourcePath, artifactPath]);
      const duration = elapsedMs(started);
      compileTotalMs += duration;
      compileRuns.push(duration);
      if (result.error) throw new Error(result.error.message);
      if (result.status !== 0) throw new Error(result.stderr || `Python py_compile exited with ${result.status}`);
    }
    for (let index = 0; index < inputs.runtimeIterations; index += 1) {
      const started = process.hrtime.bigint();
      const result = runPythonCommand(python.executable, [sourcePath], 30_000);
      const duration = elapsedMs(started);
      runtimeTotalMs += duration;
      runtimeRuns.push(duration);
      if (result.error) throw new Error(result.error.message);
      if (result.status !== 0) throw new Error(result.stderr || `Python executable exited with ${result.status}`);
      output = Number(String(result.stdout ?? '').trim());
      if (!Number.isFinite(output)) throw new Error(`Python executable returned non-numeric output: ${result.stdout}`);
    }
  } catch (error) {
    finish({
      ...commonEvidence(inputs),
      status: STRESS_STATUS.FAIL,
      provider: { id: 'python-reference', compiler: 'CPython py_compile', executor: python?.executable ?? 'python', sourcePath, artifactPath, pythonVersion: python?.version ?? null },
      failure: { code: error.code ?? 'RCL_MICROBENCH_PYTHON_FAILURE', message: error.message },
      metrics: {},
      artifacts: [{ path: artifactPath, exists: fs.existsSync(artifactPath), sha256: sha256File(artifactPath) }],
    }, 1);
    return;
  }
  const correct = closeEnough(output, inputs.expectedOutput);
  const artifactBytes = fs.statSync(artifactPath).size;
  finish({
    ...commonEvidence(inputs),
    status: correct ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
    provider: {
      id: 'python-reference',
      compiler: 'CPython py_compile',
      executor: python.executable,
      pythonVersion: python.version,
      sourcePath,
      artifactPath,
      executionModel: 'interpreted',
      compileMetricBoundary: 'compileBuildSpeed measures py_compile preparation, not machine-code build time',
    },
    correctness: { expected: inputs.expectedOutput, actual: output, tolerance: 1e-9, passed: correct },
    metrics: {
      correctness: correct ? 1 : 0,
      compileBuildSpeed: Number((compileTotalMs / inputs.compileIterations).toFixed(3)),
      runtimeMs: Number((runtimeTotalMs / inputs.runtimeIterations).toFixed(3)),
      artifactFootprintBytes: artifactBytes,
    },
    timings: { compileRuns, runtimeRuns },
    artifacts: [{ path: artifactPath, exists: true, bytes: artifactBytes, sha256: sha256File(artifactPath) }],
  }, correct ? 0 : 1);
}

try {
  const inputs = readInputs();
  if (mode === 'rcl') runRcl(inputs);
  else if (mode === 'rust') runRust(inputs);
  else runPython(inputs);
} catch (error) {
  console.error(error.stack ?? String(error));
  process.exitCode = 1;
}
