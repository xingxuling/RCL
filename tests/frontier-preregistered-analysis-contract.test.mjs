import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sealFrontierPreregisteredAnalysisContract,
  validateFrontierPreregisteredAnalysisContract,
  runFrontierPreregisteredAnalysis,
} from '../src/frontier-preregistered-analysis-contract.mjs';
import {
  buildNistCeramicDesignGrammar,
  buildSimple2x2DesignGrammar,
} from '../src/frontier-design-grammar-router.mjs';
import { buildKnownSoftwareInteractionControl } from '../src/frontier-external-observation-contract.mjs';
import {
  AETHER_CONTINUOUS_FIELD_GRAMMAR,
  buildAetherContinuousFieldSandboxPayload,
} from '../src/frontier-aether-continuous-field-sandbox-surrogate.mjs';

const nist = JSON.parse(fs.readFileSync('data/frontier-public-datasets/nist-ceramic-2pow5.json', 'utf8'));

test('simple 2x2 study is sealed before scoring and executes only registered route', () => {
  const contract = buildKnownSoftwareInteractionControl({ samplesPerCell: 24, interactionEffect: 1.2 });
  const sealed = sealFrontierPreregisteredAnalysisContract({
    studyId: 'known_2x2_interaction',
    designGrammar: buildSimple2x2DesignGrammar(),
    payload: contract,
    analysisPlan: { randomizationSeed: 17, primaryTargets: ['symbol_x_geometry_interaction'] },
  });
  assert.equal(sealed.ok, true);
  assert.equal(validateFrontierPreregisteredAnalysisContract(sealed).ok, true);
  const result = runFrontierPreregisteredAnalysis(sealed);
  assert.equal(result.ok, true);
  assert.equal(result.routeMatches, true);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.routed.score.score.detected, true);
});

test('NIST 2^5 study seals factorial route and preserves speed×rate effect', () => {
  const sealed = sealFrontierPreregisteredAnalysisContract({
    studyId: 'nist_ceramic_factorial',
    designGrammar: buildNistCeramicDesignGrammar(),
    payload: nist,
    analysisPlan: { primaryTargets: ['speed_rate'] },
  });
  const result = runFrontierPreregisteredAnalysis(sealed);
  assert.equal(result.ok, true);
  assert.equal(result.executedRoute, 'orthogonal_full_factorial_2powk');
  assert.ok(Math.abs(result.routed.score.terms.speed_rate.sumSquares - 4872.57) <= 0.01);
});

test('design grammar mutation after seal is rejected before scoring', () => {
  const sealed = sealFrontierPreregisteredAnalysisContract({ designGrammar: buildNistCeramicDesignGrammar(), payload: nist });
  const tampered = structuredClone(sealed);
  tampered.designGrammar.targetTerms = ['direction'];
  const result = runFrontierPreregisteredAnalysis(tampered);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'REJECTED_BEFORE_SCORE');
  assert.equal(result.scoreExecuted, false);
  assert.ok(result.validation.failures.includes('design_root_mismatch'));
});

test('payload mutation after seal is rejected before scoring', () => {
  const sealed = sealFrontierPreregisteredAnalysisContract({ designGrammar: buildNistCeramicDesignGrammar(), payload: nist });
  const tampered = structuredClone(sealed);
  tampered.payload.rows[0][6] += 10;
  const result = runFrontierPreregisteredAnalysis(tampered);
  assert.equal(result.ok, false);
  assert.equal(result.scoreExecuted, false);
  assert.ok(result.validation.failures.includes('payload_root_mismatch'));
});

test('continuous-field study seals and executes only its preregistered scorer route', () => {
  const built = buildAetherContinuousFieldSandboxPayload('injected_preregistered_kernel');
  const sealed = sealFrontierPreregisteredAnalysisContract({
    studyId: 'aether_continuous_field_preregistered_kernel',
    designGrammar: AETHER_CONTINUOUS_FIELD_GRAMMAR,
    payload: built.payload,
    analysisPlan: { primaryTargets: ['preregistered_transfer_kernel'] },
  });
  assert.equal(sealed.ok, true);
  assert.equal(sealed.registeredRoute, 'preregistered_continuous_field_kernel_v0_1');
  const result = runFrontierPreregisteredAnalysis(sealed);
  assert.equal(result.ok, true);
  assert.equal(result.routeMatches, true);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.executedRoute, 'preregistered_continuous_field_kernel_v0_1');
  assert.equal(result.routed.score.detected, true);
});
