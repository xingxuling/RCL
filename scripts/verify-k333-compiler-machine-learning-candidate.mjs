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
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k333-compiler-machine-learning.rcl');
const COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition, detail = null) {
  checks[name] = { pass: Boolean(condition), ...(detail === null ? {} : { detail }) };
}

export function verifyK333CompilerMachineLearningCandidate(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const checks = {};
  let artifactSha256 = null;
  let semanticStateRoot = null;
  let observed = null;
  let errorCode = null;
  try {
    check(checks, 'rcl-owns-ml-profile', /facet contract\.owner : Text = "RCL"/u.test(source)
      && /facet contract\.execution : Text = "NATIVE_RCLC_TO_RCLVM"/u.test(source));
    check(checks, 'model-is-advisory-only', /ADVISORY_ONLY_DETERMINISTIC_COMPILER_POLICY_RETAINS_COMMIT/u.test(source)
      && /facet authority\.model_commit_granted : Truth = false/u.test(source));
    check(checks, 'perceptron-training-is-expressed', /update_for_row/u.test(source)
      && /train_rows/u.test(source)
      && /train\(train_rows\(/u.test(source));
    check(checks, 'no-opaque-provider', !/provider_call\(|python|node\.js|powershell|cmd\.exe/iu.test(source));
    const bootstrap = Buffer.from(compileRealityToBytecode(source));
    artifactSha256 = sha256(bootstrap);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k333-candidate-'));
    try {
      const nativePath = path.join(directory, 'candidate.rbc');
      const compilation = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, nativePath, { timeout: 60_000 });
      check(checks, 'native-compiler-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrap));
      const runtime = runNativeBytecode(nativePath, { timeout: 60_000, requireNativeStateRoot: true });
      semanticStateRoot = runtime.semanticStateRoot;
      const parameters = runtime.state?.['training.final_parameters'];
      observed = {
        parameters,
        accuracy: runtime.state?.['evaluation.accuracy'],
        score: runtime.state?.['inference.score'],
        classification: runtime.state?.['inference.classification'],
        smallColdClassification: runtime.state?.['boundary.small_cold_classification'],
        recommendation: runtime.state?.['inference.recommendation'],
        modelCommitGranted: runtime.state?.['authority.model_commit_granted'],
      };
      check(checks, 'native-training-converges', runtime.state?.['evaluation.pass'] === true
        && observed.accuracy === 1);
      check(checks, 'native-model-oracle', Array.isArray(parameters)
        && parameters[0] === 3
        && parameters[1] === 1
        && parameters[2] === -5
        && observed.score === 9
        && observed.classification === 1
        && observed.smallColdClassification === 0);
      check(checks, 'native-authority-boundary', observed.recommendation === 'EXPENSIVE_OPTIMIZATION_CANDIDATE'
        && observed.modelCommitGranted === false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  } catch (error) {
    errorCode = String(error?.code ?? error?.message ?? error).split(':')[0];
  }
  const passed = errorCode === null && Object.keys(checks).length === 8 && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k333.compiler-machine-learning-candidate-verification.v0.1',
    status: passed ? 'PASS' : 'FAIL',
    sourceSha256: sha256(source),
    artifactSha256,
    semanticStateRoot,
    observed,
    checks,
    errorCode,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK333CompilerMachineLearningCandidate({ sourcePath: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
