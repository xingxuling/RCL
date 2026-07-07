import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  runEvidenceProductShellRuntime,
  runEvidenceProductShellRuntimeDemo,
  buildEvidenceProductShellRuntimeSpec,
  renderEvidenceProductShellRuntimeRcl,
  writeEvidenceProductShellRuntimeReports,
} from '../src/evidence-product-shell-runtime.mjs';

const cwd = path.resolve(new URL('..', import.meta.url).pathname);

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

test('v0.67 compiles future release plans into evidence product shells', () => {
  const bundle = runEvidenceProductShellRuntime();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.evidenceProductShellRuntimeEstablished, true);
  assert.equal(bundle.result.shellCount, 8);
  assert.equal(bundle.result.reviewCardCount, 8);
  assert.equal(bundle.result.evidenceDossierCount, 8);
  assert.equal(bundle.result.demoSurfaceCount, 8);
  assert.equal(bundle.result.humanReviewGateCount, 8);
  assert.equal(bundle.result.shareableSurfaceCount, 8);
  assert.equal(bundle.result.negativeClaimGuardReady, true);
  assert.equal(bundle.result.aetherForgeBridgeReady, true);
  assert.equal(bundle.result.scores.averageShellScore, 1);
  assert.equal(bundle.shells.every(s => s.humanReviewGate.required), true);
});

test('v0.67 renders spec, RCL and stable reports', () => {
  const spec = buildEvidenceProductShellRuntimeSpec({ id: 'test-evidence-product-shell-runtime' });
  const rcl = renderEvidenceProductShellRuntimeRcl(spec);
  assert.match(rcl, /evidence_product_shell_runtime/);
  assert.match(rcl, /v0\.66 Recursive Future Release Planner/);
  const dir = tempDir('evidence-product-shell-runtime');
  const reports = writeEvidenceProductShellRuntimeReports(dir, spec);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'evidence-product-shell-runtime-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'evidence-product-shells.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'evidence-product-shell-runtime.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'evidence-product-shell-docs')).length >= 9);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'evidence-product-shell-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.evidenceProductShellRuntimeEstablished, true);
});
