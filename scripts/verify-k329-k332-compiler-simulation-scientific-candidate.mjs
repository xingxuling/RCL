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
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k329-k332-compiler-simulation-scientific.rcl');
const COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition) { checks[name] = { pass: Boolean(condition) }; }

export function verifyK329K332CompilerSimulationScientificCandidate(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const checks = {};
  let artifactSha256 = null;
  let semanticStateRoot = null;
  let observed = null;
  let errorCode = null;
  try {
    check(checks, 'rcl-owns-scientific-simulation', /facet contract\.owner : Text = "RCL"/u.test(source)
      && /facet contract\.execution : Text = "NATIVE_RCLC_TO_RCLVM"/u.test(source));
    check(checks, 'state-evolution-expressed', /simulate\(advance\(state, acceleration\)/u.test(source));
    check(checks, 'closed-form-oracle-expressed', /acceleration \* steps \* \(steps - 1\) \/ 2/u.test(source)
      && /discrete_work_invariant/u.test(source));
    check(checks, 'no-opaque-provider', !/provider_call\(|python|node\.js|powershell|cmd\.exe/iu.test(source));
    const bootstrap = Buffer.from(compileRealityToBytecode(source));
    artifactSha256 = sha256(bootstrap);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k329-k332-candidate-'));
    try {
      const nativePath = path.join(directory, 'candidate.rbc');
      const compilation = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, nativePath, { timeout: 60_000 });
      check(checks, 'native-compiler-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrap));
      const runtime = runNativeBytecode(nativePath, { timeout: 60_000, requireNativeStateRoot: true });
      semanticStateRoot = runtime.semanticStateRoot;
      observed = {
        position: runtime.state?.['result.position'],
        velocity: runtime.state?.['result.velocity'],
        trajectory: runtime.state?.['result.trajectory'],
        oraclePosition: runtime.state?.['oracle.position'],
        oracleVelocity: runtime.state?.['oracle.velocity'],
        zeroStepState: runtime.state?.['boundary.zero_step_state'],
        oneStepState: runtime.state?.['boundary.one_step_state'],
      };
      check(checks, 'native-simulation-result', runtime.state?.['evaluation.pass'] === true
        && observed.position === 120
        && observed.velocity === 23
        && Array.isArray(observed.trajectory)
        && observed.trajectory.length === 11
        && observed.trajectory[10] === 120);
      check(checks, 'native-scientific-oracle', observed.oraclePosition === observed.position
        && observed.oracleVelocity === observed.velocity);
      check(checks, 'native-boundary-states', Array.isArray(observed.zeroStepState)
        && observed.zeroStepState[0] === 0
        && observed.zeroStepState[1] === 3
        && Array.isArray(observed.oneStepState)
        && observed.oneStepState[0] === 3
        && observed.oneStepState[1] === 5);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  } catch (error) {
    errorCode = String(error?.code ?? error?.message ?? error).split(':')[0];
  }
  const passed = errorCode === null && Object.keys(checks).length === 8 && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k329-k332.compiler-simulation-scientific-candidate-verification.v0.1',
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
  const result = verifyK329K332CompilerSimulationScientificCandidate({ sourcePath: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
