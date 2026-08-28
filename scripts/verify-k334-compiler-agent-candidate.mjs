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
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k334-compiler-agent.rcl');
const COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition) { checks[name] = { pass: Boolean(condition) }; }

export function verifyK334CompilerAgentCandidate(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const checks = {};
  let artifactSha256 = null;
  let semanticStateRoot = null;
  let observed = null;
  let errorCode = null;
  try {
    check(checks, 'rcl-owns-agent-semantics', /facet contract\.owner : Text = "RCL"/u.test(source)
      && /facet contract\.execution : Text = "NATIVE_RCLC_TO_RCLVM"/u.test(source));
    check(checks, 'deliberation-and-memory-expressed', /reckon deliberate/u.test(source)
      && /action_score/u.test(source) && /deliberation_memory/u.test(source));
    check(checks, 'capability-budget-risk-authority-expressed', /granted_capability/u.test(source)
      && /budget/u.test(source) && /max_risk/u.test(source) && /human_approval/u.test(source));
    check(checks, 'commit-observe-kill-boundaries-expressed', /observe_only/u.test(source)
      && /kill_switch/u.test(source) && /result_committed/u.test(source));
    check(checks, 'no-external-tool-provider', !/provider_call\(|child_process|powershell|cmd\.exe|python|kubectl|terraform|ollama|openai/iu.test(source));
    const bootstrap = Buffer.from(compileRealityToBytecode(source));
    artifactSha256 = sha256(bootstrap);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k334-candidate-'));
    try {
      const nativePath = path.join(directory, 'candidate.rbc');
      const compilation = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, nativePath, { timeout: 90_000 });
      check(checks, 'native-compiler-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrap));
      const runtime = runNativeBytecode(nativePath, { timeout: 90_000, requireNativeStateRoot: true });
      semanticStateRoot = runtime.semanticStateRoot;
      observed = {
        success: runtime.state?.['result.success'],
        observeOnly: runtime.state?.['result.observe_only'],
        capabilityDenied: runtime.state?.['result.capability_denied'],
        budgetDenied: runtime.state?.['result.budget_denied'],
        unapproved: runtime.state?.['result.unapproved'],
        riskDenied: runtime.state?.['result.risk_denied'],
        killSwitch: runtime.state?.['result.kill_switch'],
      };
      check(checks, 'native-goal-directed-selection', runtime.state?.['evaluation.pass'] === true
        && JSON.stringify(observed.success) === JSON.stringify([1, 20, 11, 3, [10, 20], 1]));
      check(checks, 'native-observe-only-no-commit', JSON.stringify(observed.observeOnly) === JSON.stringify([2, 20, 11, 0, [10, 20], 0]));
      check(checks, 'native-constraints-fail-closed', JSON.stringify(observed.capabilityDenied) === JSON.stringify([-1, 0, 0, 0, [-30], 0])
        && JSON.stringify(observed.budgetDenied) === JSON.stringify([-2, 0, 0, 0, [-40], 0])
        && JSON.stringify(observed.unapproved) === JSON.stringify([-3, 0, 0, 0, [-20], 0])
        && JSON.stringify(observed.riskDenied) === JSON.stringify([-5, 0, 0, 0, [-50], 0])
        && JSON.stringify(observed.killSwitch) === JSON.stringify([-4, 0, 0, 0, [-4], 0]));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  } catch (error) {
    errorCode = String(error?.code ?? error?.message ?? error).split(':')[0];
  }
  const passed = errorCode === null && Object.keys(checks).length === 9
    && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k334.compiler-agent-candidate-verification.v0.1',
    status: passed ? 'PASS' : 'FAIL', sourceSha256: sha256(source), artifactSha256,
    semanticStateRoot, observed, checks, errorCode,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK334CompilerAgentCandidate({ sourcePath: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
