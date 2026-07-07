import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  RCL_EMPIRICAL_LAB_NOTEBOOK_RESULT_FORMAT,
  RCL_LAB_NOTEBOOK_FORMAT,
  RCL_NOTEBOOK_RUN_FORMAT,
  evaluateEmpiricalLabNotebookRuntime,
  runEmpiricalLabNotebookRuntime,
  renderEmpiricalLabNotebookRcl,
  writeEmpiricalLabNotebookReports,
  renderLabNotebookTechnicalDocument,
} from '../src/empirical-lab-notebook-runtime.mjs';

const cwd = path.resolve(new URL('..', import.meta.url).pathname);
function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.61 turns v0.60 prototypes into empirical lab notebooks', () => {
  const evaluation = evaluateEmpiricalLabNotebookRuntime();
  assert.equal(evaluation.result.format, RCL_EMPIRICAL_LAB_NOTEBOOK_RESULT_FORMAT);
  assert.equal(evaluation.result.empiricalLabNotebookEstablished, true);
  assert.equal(evaluation.result.notebookRuntimeEstablished, true);
  assert.ok(evaluation.result.notebookCount >= 8);
  assert.ok(evaluation.notebooks.every(n => n.format === RCL_LAB_NOTEBOOK_FORMAT));
  assert.ok(evaluation.notebooks.every(n => n.callable && n.replayable && n.appendOnly));
});

test('v0.61 notebook runs preserve evidence, audit, failure and derived-candidate handoff', () => {
  const bundle = runEmpiricalLabNotebookRuntime();
  assert.equal(bundle.empiricalLabNotebookEstablished, true);
  assert.ok(bundle.runs.every(run => run.format === RCL_NOTEBOOK_RUN_FORMAT));
  assert.ok(bundle.runs.every(run => run.replayStable && run.replayHash));
  assert.ok(bundle.runs.every(run => run.metricSummary.failed === 0));
  assert.ok(bundle.runs.every(run => run.derivedCandidatePackage.enabled));
  assert.ok(bundle.notebooks.every(n => n.auditLedger.length >= 5));
  assert.ok(bundle.notebooks.every(n => n.failureLedger.length >= 3));
  assert.ok(bundle.notebooks.every(n => n.evidenceFrameSchema.requiredFields.length >= 12));
});

test('v0.61 renders lab notebook documents and RCL spec', () => {
  const bundle = runEmpiricalLabNotebookRuntime();
  const doc = renderLabNotebookTechnicalDocument(bundle.notebooks[0], bundle.runs[0], bundle.notebookScores[0]);
  assert.match(doc.markdown, /Phase Ledger/);
  assert.match(doc.markdown, /Metric Observations/);
  assert.match(doc.markdown, /Derived Candidate Handoff/);
  const rcl = renderEmpiricalLabNotebookRcl();
  assert.match(rcl, /reality EmpiricalLabNotebookRuntime/);
  assert.match(rcl, /validation.established : Truth = true/);
});

test('v0.61 CLI writes lab notebooks, runs, scores and docs', () => {
  const dir = tempDir('empirical-lab-notebook');
  const reports = writeEmpiricalLabNotebookReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(reports.empiricalLabNotebookEstablished, true);
  assert.equal(fs.existsSync(path.join(dir, 'empirical-lab-notebook-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'lab-notebooks.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'notebook-runs.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'notebook-scores.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'lab-notebook-docs')).length >= 8);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'empirical-lab-notebook-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.empiricalLabNotebookEstablished, true);
});
