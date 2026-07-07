import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_INTERNAL_CLOSURE_VERSION,
  RCL_INTERNAL_CLOSURE_SPEC_FORMAT,
  RCL_INTERNAL_CLOSURE_REPORT_FORMAT,
  RCL_INTERNAL_CLOSURE_TRACE_FORMAT,
  computeClosureScore,
  evaluateClosurePaths,
  runInternalClosureCompile,
  buildInternalClosureSpec,
  renderInternalClosureRcl,
  writeInternalClosureReports,
  compileReality,
} from '../src/index.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.44 exposes internal closure constants and compilable RCL projection', () => {
  assert.equal(RCL_INTERNAL_CLOSURE_VERSION, '0.44.0-alpha.1');
  const spec = buildInternalClosureSpec();
  assert.equal(spec.format, RCL_INTERNAL_CLOSURE_SPEC_FORMAT);
  assert.match(spec.root, /^[0-9a-f]{64}$/);
  assert.ok(spec.stateVariables.includes('systemOverbranching'));
  const rcl = renderInternalClosureRcl(spec);
  assert.match(rcl, /reality InternalClosureController/);
  assert.match(rcl, /selected\.primary : Text = "RCL_RNCS"/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
});

test('v0.44 computes closure scores and selects RCL/RNCS as primary loop', () => {
  const evaluation = evaluateClosurePaths();
  assert.equal(evaluation.format, RCL_INTERNAL_CLOSURE_REPORT_FORMAT);
  assert.equal(evaluation.primary.id, 'RCL_RNCS');
  assert.equal(evaluation.secondary.id, 'AETHER_FORGE_POCKET');
  assert.equal(evaluation.rows.find(row => row.id === 'CITYU').status, 'constraint-watch');
  const primaryScore = computeClosureScore(evaluation.primary, evaluation.internalState);
  const cityuScore = computeClosureScore(evaluation.rows.find(row => row.id === 'CITYU'), evaluation.internalState);
  assert.ok(primaryScore > cityuScore);
});

test('v0.44 internal closure compile moves generation-dominant state toward closure dominance', () => {
  const report = runInternalClosureCompile({ ticks: 8 });
  assert.equal(report.format, RCL_INTERNAL_CLOSURE_TRACE_FORMAT);
  assert.equal(report.trace[0].mode, 'generation-dominant');
  assert.equal(report.finalEvaluation.mode, 'closure-dominant');
  assert.equal(report.controlLaw.primaryLoop, 'RCL_RNCS');
  assert.equal(report.controlLaw.secondaryLoop, 'AETHER_FORGE_POCKET');
  assert.ok(report.finalState.closureRate > report.input.internalState.closureRate);
  assert.ok(report.finalState.systemOverbranching < report.input.internalState.systemOverbranching);
});

test('v0.44 writes closure reports and CLI commands', () => {
  const dir = tempDir('internal-closure');
  const bundle = writeInternalClosureReports(dir, { ticks: 4 });
  assert.equal(bundle.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'internal-closure-trace.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'internal-closure-controller.rcl')), true);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'internal-closure-demo'], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(demoOut).ok, true);
  const runDir = tempDir('internal-closure-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'internal-closure-run', runDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(runOut).ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'internal-closure-bundle.json')), true);
  const specDir = tempDir('internal-closure-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'internal-closure-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'internal-closure-spec.json')), true);
});
