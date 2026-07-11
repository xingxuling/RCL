import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  RCL_HUMAN_CAPABILITY_FEEDBACK_OS_RESULT_FORMAT,
  RCL_HUMAN_CAPABILITY_PROFILE_FORMAT,
  RCL_CAPABILITY_FEEDBACK_LOOP_FORMAT,
  evaluateHumanCapabilityFeedbackOs,
  runHumanCapabilityFeedbackOs,
  renderHumanCapabilityFeedbackOsRcl,
  writeHumanCapabilityFeedbackOsReports,
} from '../src/human-capability-feedback-os.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.64 converts RNCS execution plans into human capability profiles', () => {
  const evaluation = evaluateHumanCapabilityFeedbackOs();
  assert.equal(evaluation.result.format, RCL_HUMAN_CAPABILITY_FEEDBACK_OS_RESULT_FORMAT);
  assert.equal(evaluation.result.humanCapabilityFeedbackOsEstablished, true);
  assert.ok(evaluation.profiles.length >= 8);
  assert.ok(evaluation.profiles.every(profile => profile.format === RCL_HUMAN_CAPABILITY_PROFILE_FORMAT));
  assert.ok(evaluation.feedbackLoops.every(loop => loop.format === RCL_CAPABILITY_FEEDBACK_LOOP_FORMAT));
});

test('v0.64 builds agency contracts, growth ledgers and failure learning maps', () => {
  const bundle = runHumanCapabilityFeedbackOs();
  assert.equal(bundle.humanCapabilityFeedbackOsEstablished, true);
  assert.ok(bundle.profiles.every(profile => profile.agencyContract.humanFinalAuthority));
  assert.ok(bundle.feedbackLoops.every(loop => loop.growthLedger.length >= 4));
  assert.ok(bundle.feedbackLoops.every(loop => loop.failureToLearningMap.length >= 3));
  assert.equal(bundle.result.scores.averageFeedbackScore, 1);
});

test('v0.64 renders RCL surface and technical documents', () => {
  const bundle = runHumanCapabilityFeedbackOs();
  assert.ok(bundle.documents.length >= 9);
  assert.match(bundle.documents[0].markdown, /Human Capability Feedback OS/);
  assert.match(bundle.documents[0].markdown, /人类能力反馈操作系统/);
  const rcl = renderHumanCapabilityFeedbackOsRcl();
  assert.match(rcl, /reality HumanCapabilityFeedbackOS/);
  assert.match(rcl, /validation.established : Truth = true/);
});

test('v0.64 CLI writes human capability feedback OS reports', () => {
  const dir = tempDir('human-capability-feedback');
  const reports = writeHumanCapabilityFeedbackOsReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'human-capability-feedback-os-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'human-capability-profiles.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'capability-feedback-loops.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'human-capability-docs')).length >= 9);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'human-capability-feedback-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.humanCapabilityFeedbackOsEstablished, true);
});
