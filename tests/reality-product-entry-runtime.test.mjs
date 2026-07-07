import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  runRealityProductEntryRuntime,
  runRealityProductEntryRuntimeDemo,
  buildRealityProductEntryRuntimeSpec,
  renderRealityProductEntryRuntimeRcl,
  writeRealityProductEntryRuntimeReports,
} from '../src/reality-product-entry-runtime.mjs';

const cwd = path.resolve(new URL('..', import.meta.url).pathname);

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

test('v0.65 compiles human capability feedback into product entry runtime', () => {
  const bundle = runRealityProductEntryRuntime();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.realityProductEntryRuntimeEstablished, true);
  assert.equal(bundle.result.entryCount, 8);
  assert.equal(bundle.result.planCardCount, 8);
  assert.equal(bundle.result.sessionCount, 8);
  assert.equal(bundle.result.evidencePanelCount, 8);
  assert.equal(bundle.result.capabilityFeedbackWidgetCount, 8);
  assert.equal(bundle.result.humanConfirmationGateCount, 8);
  assert.equal(bundle.result.rncsHandoffReady, true);
  assert.equal(bundle.result.ordinaryUserEntryReady, true);
  assert.equal(bundle.result.scores.averageEntryScore, 1);
  assert.equal(bundle.entries.every(e => e.authorityPolicy.humanConfirmationRequired), true);
});

test('v0.65 renders spec, RCL and stable reports', () => {
  const spec = buildRealityProductEntryRuntimeSpec({ id: 'test-product-entry-runtime' });
  const rcl = renderRealityProductEntryRuntimeRcl(spec);
  assert.match(rcl, /ProductEntryRuntime/);
  assert.match(rcl, /v0\.66 Recursive Future Release Planner/);
  const dir = tempDir('reality-product-entry-runtime');
  const reports = writeRealityProductEntryRuntimeReports(dir, spec);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'reality-product-entry-runtime-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'product-entries.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'plan-cards.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'product-sessions.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'reality-product-entry-docs')).length >= 9);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'reality-product-entry-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.realityProductEntryRuntimeEstablished, true);
});
