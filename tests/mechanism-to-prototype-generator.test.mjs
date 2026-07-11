import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  RCL_MECHANISM_TO_PROTOTYPE_RESULT_FORMAT,
  RCL_EXPERIMENT_OBJECT_FORMAT,
  RCL_PROTOTYPE_IR_FORMAT,
  evaluateMechanismToPrototypeGenerator,
  runMechanismToPrototypeGenerator,
  renderMechanismToPrototypeRcl,
  writeMechanismToPrototypeReports,
  renderPrototypeTechnicalDocument,
} from '../src/mechanism-to-prototype-generator.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.60 internalizes v0.59 protocols as callable experiment objects', () => {
  const evaluation = evaluateMechanismToPrototypeGenerator();
  assert.equal(evaluation.result.format, RCL_MECHANISM_TO_PROTOTYPE_RESULT_FORMAT);
  assert.equal(evaluation.result.mechanismToPrototypeEstablished, true);
  assert.equal(evaluation.result.experimentObjectsInternalized, true);
  assert.equal(evaluation.result.prototypeIrGenerated, true);
  assert.ok(evaluation.result.prototypeCount >= 8);
  assert.ok(evaluation.experimentObjects.every(o => o.format === RCL_EXPERIMENT_OBJECT_FORMAT));
  assert.ok(evaluation.experimentObjects.every(o => o.callable && o.replayable));
});

test('v0.60 emits prototype IR, control graphs, metrics, failures, evidence and replay notebooks', () => {
  const bundle = runMechanismToPrototypeGenerator();
  assert.equal(bundle.mechanismToPrototypeEstablished, true);
  assert.ok(bundle.prototypes.every(p => p.format === RCL_PROTOTYPE_IR_FORMAT));
  assert.ok(bundle.experimentObjects.every(o => o.controls.length >= 3));
  assert.ok(bundle.experimentObjects.every(o => o.metricContracts.length >= 4));
  assert.ok(bundle.experimentObjects.every(o => o.failureContracts.length >= 3));
  assert.ok(bundle.experimentObjects.every(o => o.evidenceSchema.requiredFields.length >= 10));
  assert.ok(bundle.experimentObjects.every(o => o.replayNotebook.phases.length >= 5));
});

test('v0.60 renders natural language prototype documents and RCL spec', () => {
  const bundle = runMechanismToPrototypeGenerator();
  const doc = renderPrototypeTechnicalDocument(bundle.experimentObjects[0], bundle.prototypes[0], bundle.prototypeScores[0]);
  assert.match(doc.markdown, /Experiment Object/);
  assert.match(doc.markdown, /Prototype IR/);
  assert.match(doc.markdown, /Replay Notebook/);
  const rcl = renderMechanismToPrototypeRcl();
  assert.match(rcl, /reality MechanismToPrototypeGenerator/);
  assert.match(rcl, /validation.established : Truth = true/);
});

test('v0.60 CLI writes reports, prototype IR and prototype docs', () => {
  const dir = tempDir('mechanism-prototype');
  const reports = writeMechanismToPrototypeReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(reports.mechanismToPrototypeEstablished, true);
  assert.equal(fs.existsSync(path.join(dir, 'mechanism-to-prototype-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'experiment-objects.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'prototype-ir.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'prototype-docs')).length >= 8);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'mechanism-prototype-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.mechanismToPrototypeEstablished, true);
});
