#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { compileReality } from '../src/compiler.mjs';
import {
  DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH,
  compileSourceSelfHosted,
  readSelfHostedCompilerSource,
} from '../src/selfhost-compiler.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const examplesRoot = path.join(root, 'examples');
const selected = [], seenOptions = new Set();
let timeoutMs = 60000, compilerArtifactPath = DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH, reportPath = null;
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index], value = process.argv[index + 1];
  if (!['--source', '--report', '--compiler-timeout-ms', '--compiler-artifact'].includes(flag) || !value || value.startsWith('--') || (flag !== '--source' && seenOptions.has(flag))) throw new Error('RCL_PARITY_ARGUMENT_INVALID');
  seenOptions.add(flag);
  if (flag === '--source') selected.push(path.resolve(root, value));
  if (flag === '--report') reportPath = path.resolve(root, value);
  if (flag === '--compiler-artifact') compilerArtifactPath = path.resolve(root, value);
  if (flag === '--compiler-timeout-ms') {
    if (!/^[1-9][0-9]*$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 3600000) throw new Error('RCL_PARITY_ARGUMENT_INVALID');
    timeoutMs = Number(value);
  }
}
const outputPath = reportPath ?? path.join(outputDir, selected.length || seenOptions.has('--compiler-artifact') || timeoutMs !== 60000 ? 'example-parity-selected.json' : 'example-parity.json');
if (path.extname(outputPath) !== '.json') throw new Error('RCL_PARITY_REPORT_PATH_INVALID');
const sha = value => createHash('sha256').update(value).digest('hex');

function collectRclFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collectRclFiles(target, output);
    else if (entry.isFile() && entry.name.endsWith('.rcl')) output.push(target);
  }
  return output;
}

const eligible = [];
const unsupported = [];
const failures = [];
const bootstrapArtifact = Buffer.from(compileRealityToBytecode(readSelfHostedCompilerSource()));
const checkedArtifact = fs.existsSync(compilerArtifactPath)
  ? fs.readFileSync(compilerArtifactPath)
  : null;
const artifactParity = Boolean(checkedArtifact?.equals(bootstrapArtifact));
if (!artifactParity) {
  failures.push({
    file: path.relative(root, compilerArtifactPath).replaceAll(path.sep, '/'),
    code: 'RCL_SELFHOST_ARTIFACT_PARITY_REQUIRED',
    referenceBytes: bootstrapArtifact.length,
    selfHostedBytes: checkedArtifact?.length ?? 0,
  });
}

const files = [...new Set(selected.length ? selected : collectRclFiles(examplesRoot))].sort();
for (const file of files) if (file === outputPath || path.extname(file) !== '.rcl' || !fs.statSync(file).isFile()) throw new Error('RCL_PARITY_SOURCE_INVALID');
const uniqueJobs = new Map();
let nativeCompileAttempts = 0;
const snapshotDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-parity-compiler-'));
const snapshotArtifact = path.join(snapshotDirectory, 'compiler.rbc');
try {
if (checkedArtifact) fs.writeFileSync(snapshotArtifact, checkedArtifact, { flag: 'wx' });
for (const filePath of artifactParity ? files : []) {
  const relative = path.relative(root, filePath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(filePath, 'utf8');
  let reference;
  let program;
  try {
    program = compileReality(source);
    reference = Buffer.from(compileRealityToBytecode(program));
  } catch (error) {
    unsupported.push({ file: relative, code: error.code ?? 'RCL_REFERENCE_REJECTED', message: error.message });
    continue;
  }

  const ruleHostCallCount = program.rules.reduce((count, rule) => count + (rule.calls?.length ?? 0), 0);
  if (ruleHostCallCount > 0) {
    unsupported.push({
      file: relative,
      code: 'RCL_SELFHOST_RULE_HOST_CALL_UNSUPPORTED',
      message: 'The checked-in self-host compiler does not yet parse or lower rule-level host calls.',
      ruleHostCallCount,
    });
    continue;
  }

  const key = sha(source) + ':' + sha(reference);
  const reused = uniqueJobs.has(key);
  if (!reused) {
    const started = performance.now(); nativeCompileAttempts++;
    try {
      const selfHosted = Buffer.from(compileSourceSelfHosted(source, { compilerArtifactPath: snapshotArtifact, timeout: timeoutMs }));
      uniqueJobs.set(key, { file: relative, sourceSha256: sha(source), bytes: selfHosted.length,
        nativeBytecodeSha256: sha(selfHosted), byteMatch: selfHosted.equals(reference), elapsedMs: performance.now() - started });
    } catch (error) {
      uniqueJobs.set(key, { file: relative, sourceSha256: sha(source), code: error.code ?? 'RCL_SELFHOST_COMPILE_FAILED', message: error.message, elapsedMs: performance.now() - started });
    }
  }
  const job = uniqueJobs.get(key);
  const evidence = { file: relative, compiledSource: job.file, sourceSha256: job.sourceSha256,
    referenceBytecodeSha256: sha(reference), ...(job.nativeBytecodeSha256 ? { nativeBytecodeSha256: job.nativeBytecodeSha256 } : {}), evidenceReused: reused, elapsedMs: job.elapsedMs };
  if (job.code) failures.push({ ...evidence, code: job.code, message: job.message });
  else if (!job.byteMatch) failures.push({ ...evidence, code: 'RCL_SELFHOST_BYTE_MISMATCH', referenceBytes: reference.length, selfHostedBytes: job.bytes });
  else eligible.push({ ...evidence, bytes: job.bytes, withinOriginalTargetBudget: job.elapsedMs <= 60000 });
}
} finally { fs.rmSync(snapshotDirectory, { recursive: true, force: true }); }

const report = {
  ok: failures.length === 0,
  format: 'rcl.selfhost.example-parity.v1',
  artifactParity,
  compilerArtifact: path.relative(root, compilerArtifactPath).replaceAll(path.sep, '/'),
  compilerArtifactSha256: checkedArtifact ? sha(checkedArtifact) : null,
  requestedSourceCount: files.length,
  scope: selected.length ? 'explicit-selected-sources' : 'all-checked-in-example-sources',
  compilerTimeoutMs: timeoutMs,
  budgetProfile: timeoutMs === 60000 ? 'original-60-second-target-budget' : 'explicit-override-not-original-target-budget',
  originalBudgetSatisfied: eligible.length > 0 && failures.length === 0 && eligible.every(item => item.withinOriginalTargetBudget),
  nativeCompileAttempts,
  avoidedDuplicateCompiles: eligible.filter(item => item.evidenceReused).length + failures.filter(item => item.evidenceReused).length,
  evidenceBoundary: 'Identical source plus bootstrap byte hashes reuse one actual native compile result within this run. This does not establish independent repeated process execution, K400 admission or publisher authenticity.',
  eligibleCount: eligible.length,
  unsupportedCount: unsupported.length,
  failureCount: failures.length,
  eligible,
  unsupported,
  failures,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
