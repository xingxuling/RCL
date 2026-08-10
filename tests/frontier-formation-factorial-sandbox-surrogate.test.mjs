import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMATION_FACTORIAL_GRAMMAR,
  buildFormationFactorialSandboxPayload,
  runFormationFactorialSandboxScenario,
  runFormationFactorialSandboxPressureSuite,
} from '../src/frontier-formation-factorial-sandbox-surrogate.mjs';
import { validateGenericFullFactorialPayload } from '../src/frontier-generic-factorial-scorer.mjs';

test('formation 2^3 surrogate builds a complete balanced generic factorial payload', () => {
  const built = buildFormationFactorialSandboxPayload('pure_null', { replicatesPerCell: 16 });
  const validation = validateGenericFullFactorialPayload(built.payload, FORMATION_FACTORIAL_GRAMMAR);
  assert.equal(validation.ok, true);
  assert.equal(validation.uniqueDesignCells, 8);
  assert.equal(validation.replicatesPerCell, 16);
  assert.equal(validation.observationCount, 128);
});

test('formation surrogate distinguishes topology main effect from interaction terms', () => {
  const run = runFormationFactorialSandboxScenario('layout_topology_main_only').result;
  assert.equal(run.classificationPass, true);
  assert.deepEqual(run.detectedTargetTerms, ['layout_topology']);
  assert.equal(run.route, 'generic_orthogonal_full_factorial_2powk');
});

test('formation surrogate rejects false interactions for additive-only main effects', () => {
  const run = runFormationFactorialSandboxScenario('additive_all_main').result;
  assert.equal(run.classificationPass, true);
  assert.deepEqual(run.detectedTargetTerms, ['layout_topology']);
});

test('formation surrogate detects both preregistered pair interactions when injected', () => {
  const run = runFormationFactorialSandboxScenario('dual_target_interaction').result;
  assert.equal(run.classificationPass, true);
  assert.deepEqual(run.detectedTargetTerms, ['layout_topology:boundary_mask', 'layout_topology:orientation']);
});

test('formation sandbox pressure suite classifies all seven surrogate worlds and preserves evidence boundary', () => {
  const suite = runFormationFactorialSandboxPressureSuite();
  assert.equal(suite.scenarioCount, 7);
  assert.equal(suite.passed, 7);
  assert.equal(suite.allPayloadsValid, true);
  assert.equal(suite.allRoutesGenericFactorial, true);
  assert.equal(suite.allClassificationsCorrect, true);
  assert.equal(suite.externalRealityVerified, false);
  assert.equal(suite.newNaturalLawVerified, false);
  assert.equal(suite.magicVerified, false);
});

test('generic factorial payload root rejects post-build response mutation', () => {
  const built = buildFormationFactorialSandboxPayload('pure_null');
  const tampered = structuredClone(built.payload);
  tampered.rows[0].response += 1;
  const validation = validateGenericFullFactorialPayload(tampered, FORMATION_FACTORIAL_GRAMMAR);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('generic_factorial_payload_root_mismatch'), true);
});
