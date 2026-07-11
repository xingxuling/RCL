import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  RCL_EXPERIMENT_DESIGN_RESULT_FORMAT,
  RCL_EXPERIMENT_PROTOCOL_FORMAT,
  evaluateExperimentDesignSynthesizer,
  runExperimentDesignSynthesizer,
  renderExperimentDesignRcl,
  writeExperimentDesignReports,
  renderExperimentTechnicalDocument,
} from '../src/experiment-design-synthesizer.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.59 synthesizes bounded experiment protocols from candidate mechanisms', () => {
  const evaluation = evaluateExperimentDesignSynthesizer();
  assert.equal(evaluation.result.format, RCL_EXPERIMENT_DESIGN_RESULT_FORMAT);
  assert.equal(evaluation.result.experimentDesignSynthesizerEstablished, true);
  assert.equal(evaluation.result.generatedExperimentProtocols, true);
  assert.equal(evaluation.result.negativeControlsRejected, true);
  assert.ok(evaluation.result.promotedProtocolCount >= 6);
  assert.ok(evaluation.result.scores.averageDesignScore >= 0.88);
  assert.ok(evaluation.protocols.every(p => p.format === RCL_EXPERIMENT_PROTOCOL_FORMAT));
});

test('v0.59 emits blind holdouts, controls, falsifiers and evidence outputs', () => {
  const bundle = runExperimentDesignSynthesizer();
  assert.equal(bundle.result.experimentDesignSynthesizerEstablished, true);
  assert.ok(bundle.protocols.every(p => p.controlGroups.length >= 3));
  assert.ok(bundle.protocols.every(p => p.blindHoldouts.length >= 2));
  assert.ok(bundle.protocols.every(p => p.failureConditions.length >= 3));
  assert.ok(bundle.protocols.every(p => p.evidenceOutputs.length >= 5));
  assert.ok(bundle.documents.length >= 6);
});

test('v0.59 renders natural language technical documents and RCL spec', () => {
  const bundle = runExperimentDesignSynthesizer();
  const doc = renderExperimentTechnicalDocument(bundle.promotedProtocols?.[0] ?? bundle.protocols[0]);
  assert.match(doc.markdown, /实验假设/);
  assert.match(doc.markdown, /盲测项/);
  assert.match(doc.markdown, /失败条件/);
  const rcl = renderExperimentDesignRcl();
  assert.match(rcl, /reality ExperimentDesignSynthesizer/);
  assert.match(rcl, /validation.established : Truth = true/);
});

test('v0.59 CLI writes reports and technical docs', () => {
  const dir = tempDir('experiment-design');
  const reports = writeExperimentDesignReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(reports.experimentDesignSynthesizerEstablished, true);
  assert.equal(fs.existsSync(path.join(dir, 'experiment-design-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'experiment-protocols.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'technical-docs')).length >= 6);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'experiment-design-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.experimentDesignSynthesizerEstablished, true);
});
