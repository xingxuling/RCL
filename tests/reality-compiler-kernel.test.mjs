import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_REALITY_COMPILER_VERSION,
  RCL_REALITY_COMPILER_KERNEL_FORMAT,
  RCL_REALITY_COMPILER_SANDBOX_FORMAT,
  buildRealityCompilerSpec,
  renderRealityCompilerRcl,
  runRealityCompilerModel,
  runSelfHostingDepthTest,
  runIrreducibilityPressureTests,
  runRealityCompilerSandbox,
  runRealityCompilerDemo,
  writeRealityCompilerReports,
} from '../src/index.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.43 exposes reality compiler kernel constants and RCL source projection', () => {
  assert.equal(RCL_REALITY_COMPILER_VERSION, '0.43.0-alpha.1');
  const spec = buildRealityCompilerSpec();
  assert.equal(spec.format, 'rcl.reality-compiler-spec.v0.43');
  assert.match(spec.root, /^[0-9a-f]{64}$/);
  assert.ok(spec.compilerPasses.includes('adaptive invariant field synthesis'));
  const rcl = renderRealityCompilerRcl(spec);
  assert.match(rcl, /reality RealityCompilerKernel/);
  assert.match(rcl, /preserve state\.I <= 1/);
});

test('v0.43 runs deterministic model traces with non-zero FoF stability under low noise', () => {
  const first = runRealityCompilerModel({ model: 'FoF', noise: 'low', steps: 90, seed: 4301 });
  const second = runRealityCompilerModel({ model: 'FoF', noise: 'low', steps: 90, seed: 4301 });
  assert.equal(first.format, RCL_REALITY_COMPILER_KERNEL_FORMAT);
  assert.equal(first.root, second.root);
  assert.equal(first.result.trace.length, 90);
  assert.ok(first.summary.avgStability > 0.05);
});

test('v0.43 sandbox ranks augmented field/control models above baseline', () => {
  const report = runRealityCompilerSandbox({ trials: 8, steps: 80 });
  assert.equal(report.format, RCL_REALITY_COMPILER_SANDBOX_FORMAT);
  assert.match(report.root, /^[0-9a-f]{64}$/);
  const baseline = report.ranking.find(row => row.model === 'baseline');
  const top = report.ranking[0];
  assert.ok(baseline);
  assert.ok(top.meanScore > baseline.meanScore);
  assert.ok(['AIF', 'FoF', 'low_visibility', 'delayed_feedback', 'multi_agent', 'meta', 'evo_free', 'static_invariant'].includes(top.model));
});

test('v0.43 self-hosting depth remains a non-zero recursive compilation platform', () => {
  const depth = runSelfHostingDepthTest({ depths: [1, 3, 8, 21], trials: 20, seed: 4302 });
  assert.equal(depth.format, 'rcl.reality-compiler-depth-report.v0.43');
  assert.deepEqual(depth.rows.map(row => row.depth), [1, 3, 8, 21]);
  assert.ok(depth.rows.every(row => row.meanCompiledValue > 0));
  assert.ok(depth.nonZeroDepths.includes(1));
});

test('v0.43 irreducibility pressure tests require explicit memory or regime declarations', () => {
  const report = runIrreducibilityPressureTests({ seed: 4303 });
  assert.equal(report.format, 'rcl.irreducibility-pressure-report.v0.43');
  const parity = report.rows.find(row => row.behavior === 'history_parity');
  const delayed = report.rows.find(row => row.behavior === 'delayed_hidden');
  const regime = report.rows.find(row => row.behavior === 'regime_switch');
  assert.equal(parity.requiresExplicitMemoryOrRegime, true);
  assert.equal(delayed.requiresExplicitMemoryOrRegime, true);
  assert.equal(regime.requiresExplicitMemoryOrRegime, true);
  assert.ok(parity.stateAugmentedMse < 1e-8);
});

test('v0.43 writes reality compiler reports and compilable RCL kernel source', () => {
  const dir = tempDir('reality-compiler-reports');
  const result = writeRealityCompilerReports(dir, { trials: 5, steps: 60 });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'reality-compiler-report.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'reality-compiler-kernel.rcl')), true);
  const compileOut = execFileSync('node', ['src/cli.mjs', 'compile', path.join(dir, 'reality-compiler-kernel.rcl')], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(compileOut).programRoot.length, 64);
});

test('v0.43 CLI exposes reality compiler demo, sandbox and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'reality-compiler-demo'], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(demoOut).ok, true);
  const dir = tempDir('reality-compiler-cli');
  const sandboxOut = execFileSync('node', ['src/cli.mjs', 'reality-compiler-sandbox', dir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(sandboxOut).ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'model-ranking.json')), true);
  const specDir = tempDir('reality-compiler-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'reality-compiler-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'reality-compiler-spec.json')), true);
});
