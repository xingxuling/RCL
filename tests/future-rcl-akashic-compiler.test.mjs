import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_FUTURE_RCL_AKASHIC_SPEC,
  normalizeFutureRclAkashicSpec,
  evaluateFutureRclAkashic,
  runFutureRclAkashicCompiler,
  renderFutureRclTechnicalDocument,
  renderFutureRclAkashicRcl,
  writeFutureRclAkashicReports,
  RCL_FUTURE_AKASHIC_SPEC_FORMAT,
  RCL_FUTURE_AKASHIC_RESULT_FORMAT,
} from '../src/future-rcl-akashic-compiler.mjs';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.58 normalizes future RCL Akashic spec with bounded projection contract', () => {
  const spec = normalizeFutureRclAkashicSpec(DEFAULT_FUTURE_RCL_AKASHIC_SPEC);
  assert.equal(spec.format, RCL_FUTURE_AKASHIC_SPEC_FORMAT);
  assert.equal(spec.thresholds.requireNoUnboundedOracle, true);
  assert.ok(spec.documentTargets.includes('future-risk-ledger'));
  assert.ok(spec.futureDirections.includes('prediction_to_experiment_closure'));
});

test('v0.58 evaluates current self-record into a future roadmap', () => {
  const evaluation = evaluateFutureRclAkashic({ repositoryRoot: cwd });
  assert.equal(evaluation.futureAkashicEstablished, true);
  assert.equal(evaluation.futureRclCompiled, true);
  assert.ok(evaluation.roadmap.length >= 8);
  assert.equal(evaluation.scores.futureClosureScore >= 0.9, true);
  assert.equal(evaluation.scores.roadmapCoherenceScore >= 0.9, true);
});

test('v0.58 compiles future RCL and generates future technical documents', () => {
  const bundle = runFutureRclAkashicCompiler({ repositoryRoot: cwd });
  assert.equal(bundle.result.format, RCL_FUTURE_AKASHIC_RESULT_FORMAT);
  assert.equal(bundle.result.futureAkashicEstablished, true);
  assert.equal(bundle.result.futureRclCompiled, true);
  assert.equal(bundle.result.generatedFutureTechnicalDocuments, true);
  assert.ok(bundle.result.roadmap.some(row => row.moduleId === 'experiment_design_synthesizer'));
  assert.ok(bundle.documents.length >= 6);
});

test('v0.58 renders docs, RCL spec and CLI reports', () => {
  const evaluation = evaluateFutureRclAkashic({ repositoryRoot: cwd });
  const doc = renderFutureRclTechnicalDocument('future-rcl-technical-record', evaluation, { repositoryRoot: cwd });
  assert.match(doc.markdown, /Future RCL Technical Record/);
  assert.match(doc.markdown, /未来 RCL 技术记录/);
  assert.match(doc.markdown, /Future Roadmap/);
  const rcl = renderFutureRclAkashicRcl({ repositoryRoot: cwd });
  assert.match(rcl, /reality FutureRclAkashicCompiler/);
  assert.match(rcl, /validation.established : Truth = true/);
  const dir = tempDir('future-rcl-akashic');
  const reports = writeFutureRclAkashicReports(dir, { repositoryRoot: cwd });
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'future-rcl-akashic-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'future-rcl-akashic-roadmap.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'technical-docs')).length >= 6);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'future-rcl-akashic-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.futureRclCompiled, true);
});
