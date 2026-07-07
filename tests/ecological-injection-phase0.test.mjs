import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RCL_ECOLOGICAL_INJECTION_PHASE0_VERSION,
  buildEcologicalInjectionPhase0Spec,
  runEcologicalInjectionPhase0,
  runEcologicalInjectionPhase0Demo,
  renderEcologicalInjectionPhase0Rcl,
  writeEcologicalInjectionPhase0Reports,
} from '../src/ecological-injection-phase0.mjs';

test('v0.54 exposes versioned ecological injection phase0 compiler', () => {
  assert.equal(RCL_ECOLOGICAL_INJECTION_PHASE0_VERSION, '0.54.0-alpha.1');
  const spec = buildEcologicalInjectionPhase0Spec();
  assert.equal(spec.experimentId, 'RCL-EI-001-Phase0');
  assert.equal(spec.groups.length, 3);
});

test('v0.54 phase0 establishes injected IMLO group over controls', () => {
  const result = runEcologicalInjectionPhase0Demo();
  assert.equal(result.phase0Established, true);
  assert.equal(result.mechanismOperational, true);
  assert.ok(result.comparison.advantageOverControls >= 0.25);
  assert.ok(result.comparison.experimentScore > result.comparison.maxControlScore);
});

test('v0.54 rejects false positives from blank and random complex controls', () => {
  const result = runEcologicalInjectionPhase0Demo();
  const controlScores = result.groups.filter((g) => g.group.id !== 'A').map((g) => g.score.groupScore);
  assert.ok(Math.max(...controlScores) <= 0.55);
});

test('v0.54 extracts unknown knowledge candidate from phase0 result', () => {
  const result = runEcologicalInjectionPhase0Demo();
  assert.equal(result.extractedCandidate.id, 'silicate_anchored_passive_memory_cell');
  assert.equal(result.unknownKnowledgeResult.promoted, true);
  assert.ok(result.unknownKnowledgeResult.scores.candidateKnowledgeScore > 0.7);
});

test('v0.54 closes extracted mechanism with directed wisher', () => {
  const result = runEcologicalInjectionPhase0Demo();
  assert.ok(result.directedClosure.established || result.directedClosure.pressureScore >= 0.82);
  assert.ok(result.directedClosure.pressureScore >= 0.82);
});

test('v0.54 renders RCL spec and technical document bundle', () => {
  const spec = buildEcologicalInjectionPhase0Spec();
  const rcl = renderEcologicalInjectionPhase0Rcl(spec);
  assert.match(rcl, /RCL Ecological Injection Phase0/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-phase0-'));
  const bundle = writeEcologicalInjectionPhase0Reports(dir, spec);
  assert.equal(bundle.format, 'rcl.ecological-injection-phase0-bundle.v0.54');
  assert.ok(fs.existsSync(path.join(dir, 'phase0-result.json')));
  assert.ok(fs.existsSync(path.join(dir, 'technical-docs', 'silicate_anchored_passive_memory_cell.md')));
});

test('v0.54 custom weak anchor fails or loses control advantage', () => {
  const result = runEcologicalInjectionPhase0({
    anchor: {
      anchorEntropyDeficit: 0.01,
      anchorPersistenceBias: 0.05,
      anchorReadabilityBias: 0.02,
      leakSignalStrength: 0.01,
      replayBias: 0.01,
      phaseMemoryBias: 0.01,
    },
    successCriteria: {
      minExperimentScore: 0.72,
      minAdvantageOverControls: 0.25,
      maxFalsePositiveControlScore: 0.55,
      minExtractableMechanismScore: 0.72,
      requireUnknownKnowledgePromotion: true,
      requireDirectedClosure: true,
    },
  });
  assert.equal(result.phase0Established, false);
});
