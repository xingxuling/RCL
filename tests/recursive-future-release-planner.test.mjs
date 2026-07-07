import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  runRecursiveFutureReleasePlanner,
  runRecursiveFutureReleasePlannerDemo,
  buildRecursiveFutureReleasePlannerSpec,
  renderRecursiveFutureReleasePlannerRcl,
  writeRecursiveFutureReleasePlannerReports,
} from '../src/recursive-future-release-planner.mjs';

const cwd = path.resolve(new URL('..', import.meta.url).pathname);

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

test('v0.66 compiles product entries into recursive future release plans', () => {
  const bundle = runRecursiveFutureReleasePlanner();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.recursiveFutureReleasePlannerEstablished, true);
  assert.equal(bundle.result.futureReleasePlanCount, 8);
  assert.equal(bundle.result.roadmapPhaseCount, 6);
  assert.equal(bundle.result.recursivePlanningLedgerEntryCount, 8);
  assert.equal(bundle.result.governanceReady, true);
  assert.equal(bundle.result.evidenceCarryForwardReady, true);
  assert.equal(bundle.result.humanConfirmationGateCarryForwardReady, true);
  assert.equal(bundle.result.rncsHandoffCarryForwardReady, true);
  assert.equal(bundle.result.scores.averagePlanningScore, 1);
  assert.equal(bundle.futureReleasePlans.every(p => p.humanConfirmationRequired), true);
});

test('v0.66 renders spec, RCL and stable reports', () => {
  const spec = buildRecursiveFutureReleasePlannerSpec({ id: 'test-recursive-future-release' });
  const rcl = renderRecursiveFutureReleasePlannerRcl(spec);
  assert.match(rcl, /recursive_future_release_planner/);
  assert.match(rcl, /v0\.65 Reality Product Entry Runtime/);
  const dir = tempDir('recursive-future-release-planner');
  const reports = writeRecursiveFutureReleasePlannerReports(dir, spec);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'recursive-future-release-planner-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'future-release-plans.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'recursive-release-roadmap.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'recursive-planning-ledger.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'future-release-docs')).length >= 9);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'recursive-future-release-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.recursiveFutureReleasePlannerEstablished, true);
});
