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
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k336-compiler-automation.rcl');
const COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition) { checks[name] = { pass: Boolean(condition) }; }

export function verifyK336CompilerAutomationCandidate(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const checks = {};
  let artifactSha256 = null;
  let semanticStateRoot = null;
  let observed = null;
  let errorCode = null;
  try {
    check(checks, 'rcl-owns-automation-semantics', /facet contract\.owner : Text = "RCL"/u.test(source)
      && /facet contract\.execution : Text = "NATIVE_RCLC_TO_RCLVM"/u.test(source));
    check(checks, 'workflow-control-expressed', /run_workflow/u.test(source)
      && /task_dependency/u.test(source)
      && /task_failures_before_success/u.test(source));
    check(checks, 'governance-and-compensation-expressed', /human_approval/u.test(source)
      && /kill_switch/u.test(source)
      && /count_compensatable/u.test(source)
      && /dry_run/u.test(source));
    check(checks, 'no-external-action-provider', !/provider_call\(|child_process|powershell|cmd\.exe|python|kubectl|terraform/iu.test(source));
    const bootstrap = Buffer.from(compileRealityToBytecode(source));
    artifactSha256 = sha256(bootstrap);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k336-candidate-'));
    try {
      const nativePath = path.join(directory, 'candidate.rbc');
      const compilation = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, nativePath, { timeout: 90_000 });
      check(checks, 'native-compiler-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrap));
      const runtime = runNativeBytecode(nativePath, { timeout: 90_000, requireNativeStateRoot: true });
      semanticStateRoot = runtime.semanticStateRoot;
      observed = {
        success: runtime.state?.['result.success'],
        retryFailure: runtime.state?.['result.retry_failure'],
        unapproved: runtime.state?.['result.unapproved'],
        killSwitch: runtime.state?.['result.kill_switch'],
        invalidDependency: runtime.state?.['result.invalid_dependency'],
        dryRun: runtime.state?.['result.dry_run'],
      };
      check(checks, 'native-success-and-retry', runtime.state?.['evaluation.pass'] === true
        && observed.success?.[0] === 1 && observed.success?.[1] === 5
        && observed.success?.[2] === 3 && observed.success?.[5] === 1
        && observed.retryFailure?.[0] === -1 && observed.retryFailure?.[1] === 5
        && observed.retryFailure?.[2] === 2 && observed.retryFailure?.[3] === 2);
      check(checks, 'native-governance-stops', observed.unapproved?.[0] === -2
        && observed.unapproved?.[2] === 2 && observed.unapproved?.[3] === 2
        && observed.killSwitch?.[0] === -4 && observed.killSwitch?.[1] === 0
        && observed.invalidDependency?.[0] === -3 && observed.invalidDependency?.[1] === 0);
      check(checks, 'native-dry-run', observed.dryRun?.[0] === 2
        && observed.dryRun?.[1] === 0 && observed.dryRun?.[2] === 3 && observed.dryRun?.[5] === 0);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  } catch (error) {
    errorCode = String(error?.code ?? error?.message ?? error).split(':')[0];
  }
  const passed = errorCode === null && Object.keys(checks).length === 8
    && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k336.compiler-automation-candidate-verification.v0.1',
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
  const result = verifyK336CompilerAutomationCandidate({ sourcePath: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
