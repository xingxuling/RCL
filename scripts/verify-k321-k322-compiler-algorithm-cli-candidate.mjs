#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { readCanonicalCompilerArtifact } from '../src/canonical-source-archive.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k321-k322-compiler-algorithm-cli.rcl');
const RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k321-k322-compiler-algorithm-cli-runtime-contract.v0.1.json');
const COMPILER_RBC_PATH = readCanonicalCompilerArtifact(JSON.parse(fs.readFileSync(RUNTIME_CONTRACT_PATH, 'utf8'))).path;

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition, detail = null) {
  checks[name] = { pass: Boolean(condition), ...(detail === null ? {} : { detail }) };
}

export function verifyK321K322CompilerAlgorithmCliCandidate(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const checks = {};
  let artifactSha256 = null;
  let semanticStateRoot = null;
  let errorCode = null;
  try {
    check(checks, 'rcl-owns-profile', /facet contract\.owner : Text = "RCL"/u.test(source)
      && /facet contract\.execution : Text = "NATIVE_RCLC_TO_RCLVM_CLI"/u.test(source));
    check(checks, 'gcd-euclidean-step', /choose\(b == 0, absolute\(a\), gcd\(b, a % b\)\)/u.test(source));
    check(checks, 'fibonacci-recurrence', /fibonacci\(n - 1\) \+ fibonacci\(n - 2\)/u.test(source));
    check(checks, 'sum-squares-recurrence', /n \* n \+ sum_squares\(n - 1\)/u.test(source));
    check(checks, 'no-opaque-provider', !/provider_call\(|python|node\.js|powershell|cmd\.exe/iu.test(source));
    const bootstrap = Buffer.from(compileRealityToBytecode(source));
    artifactSha256 = sha256(bootstrap);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k321-k322-candidate-'));
    try {
      const nativePath = path.join(directory, 'candidate.rbc');
      const compilation = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, nativePath, { timeout: 30_000 });
      check(checks, 'native-compiler-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrap));
      const runtime = runNativeBytecode(nativePath, { timeout: 10_000, requireNativeStateRoot: true });
      semanticStateRoot = runtime.semanticStateRoot;
      check(checks, 'native-cli-algorithm-results', runtime.state?.['result.gcd'] === 21
        && runtime.state?.['result.fibonacci'] === 144
        && runtime.state?.['result.sum_squares'] === 4900
        && runtime.state?.['result.correct'] === true);
      check(checks, 'native-cli-boundary-results', runtime.state?.['result.boundary_gcd_zero'] === 42
        && runtime.state?.['result.boundary_fibonacci_zero'] === 0
        && runtime.state?.['result.boundary_fibonacci_one'] === 1
        && runtime.state?.['result.boundary_sum_zero'] === 0);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  } catch (error) {
    errorCode = String(error?.code ?? error?.message ?? error).split(':')[0];
  }
  const passed = errorCode === null && Object.keys(checks).length === 8 && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k321-k322.compiler-algorithm-cli-candidate-verification.v0.1',
    status: passed ? 'PASS' : 'FAIL',
    sourceSha256: sha256(source),
    artifactSha256,
    semanticStateRoot,
    checks,
    errorCode,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK321K322CompilerAlgorithmCliCandidate({ sourcePath: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
