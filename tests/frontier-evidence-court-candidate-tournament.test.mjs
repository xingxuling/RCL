import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRONTIER_EVIDENCE_RUNGS,
  judgeFrontierCandidate,
  runFrontierEvidenceCourt,
} from '../src/frontier-evidence-court-candidate-tournament.mjs';

const SPECS = [
  {
    laneId: 'spell_symbolic_control_protocol',
    sourceCandidateRoot: 'candidate_spell',
    root: 'spec_spell',
    designGrammar: { family: 'simple_2x2' },
  },
  {
    laneId: 'formation_spatial_constraint_array',
    sourceCandidateRoot: 'candidate_formation',
    root: 'spec_formation',
    designGrammar: { family: 'full_factorial_2powk' },
  },
  {
    laneId: 'aether_substrate_information_medium',
    sourceCandidateRoot: 'candidate_aether',
    root: 'spec_aether',
    designGrammar: { family: 'continuous_field' },
  },
];

const PORTFOLIO = { specs: SPECS };

function passingSuites() {
  return {
    spell: {
      scenarioCount: 6,
      passed: 6,
      allRawValid: true,
      allPipelinesOk: true,
      allClassificationsCorrect: true,
      evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
      root: 'suite_spell',
    },
    formation: {
      scenarioCount: 7,
      passed: 7,
      allPayloadsValid: true,
      allRoutesGenericFactorial: true,
      allClassificationsCorrect: true,
      evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
      root: 'suite_formation',
    },
    aether: {
      scenarioCount: 7,
      passed: 7,
      allPayloadsValid: true,
      allRoutesContinuousField: true,
      allClassificationsCorrect: true,
      noAdaptiveSearch: true,
      evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
      root: 'suite_aether',
    },
  };
}

test('sandbox-only court keeps all three candidates alive but declares no truth winner', () => {
  const court = runFrontierEvidenceCourt({ portfolio: PORTFOLIO, suites: passingSuites() });
  assert.deepEqual(court.survivors, [
    'aether_substrate_information_medium',
    'formation_spatial_constraint_array',
    'spell_symbolic_control_protocol',
  ]);
  assert.deepEqual(court.evidenceLeaders, [
    'aether_substrate_information_medium',
    'formation_spatial_constraint_array',
    'spell_symbolic_control_protocol',
  ]);
  assert.deepEqual(court.engineeringLeaders, ['spell_symbolic_control_protocol']);
  assert.equal(court.truthWinner, null);
  assert.equal(court.judgments.every((row) => row.evidenceRung === FRONTIER_EVIDENCE_RUNGS.SANDBOX_PROTOCOL_SURVIVED), true);
  assert.equal(court.magicVerified, false);
});

test('sandbox protocol failure blocks the research path without falsifying the external mechanism', () => {
  const spec = SPECS[0];
  const judgment = judgeFrontierCandidate(spec, {
    available: true,
    pass: false,
    scenarioCount: 6,
    passed: 5,
    routeInvariant: true,
    antiAdaptiveSearchInvariant: true,
    evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
    root: 'failed_suite',
  });
  assert.equal(judgment.status, 'BLOCKED_PROTOCOL_DISCRIMINABILITY_FAILURE');
  assert.equal(judgment.researchDisposition, 'REPAIR_PROTOCOL');
  assert.equal(judgment.evidenceRung, FRONTIER_EVIDENCE_RUNGS.SPECIFIED);
  assert.match(judgment.decisiveReason, /does not falsify/);
});

test('a decisive external falsifier overrides sandbox survival and engineering readiness', () => {
  const suiteOutcome = {
    available: true,
    pass: true,
    scenarioCount: 6,
    passed: 6,
    routeInvariant: true,
    antiAdaptiveSearchInvariant: true,
    evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
    root: 'suite_spell',
  };
  const judgment = judgeFrontierCandidate(SPECS[0], suiteOutcome, {
    present: true,
    decisiveFalsifier: true,
    decisiveFalsifierReason: 'preregistered decisive residual absent in two valid acquisitions',
  });
  assert.equal(judgment.status, 'REJECTED_BY_DECISIVE_EXTERNAL_FALSIFIER');
  assert.equal(judgment.researchDisposition, 'REJECT');
  assert.equal(judgment.evidenceRung, -1);
});

test('one valid independent external acquisition promotes only to single-acquisition candidate', () => {
  const suites = passingSuites();
  const court = runFrontierEvidenceCourt({
    portfolio: PORTFOLIO,
    suites,
    externalEvidence: {
      spell_symbolic_control_protocol: {
        present: true,
        independentAcquisition: true,
        provenanceValid: true,
        calibrationValid: true,
        rawRootBound: true,
        ordinaryModelsCleared: true,
        residualDetected: true,
        directionalReplicationCount: 1,
        evidenceRoots: ['raw_a'],
      },
    },
  });
  const spell = court.judgments.find((row) => row.laneId === 'spell_symbolic_control_protocol');
  assert.equal(spell.evidenceRung, FRONTIER_EVIDENCE_RUNGS.EXTERNAL_SINGLE_ACQUISITION_CANDIDATE);
  assert.equal(spell.status, 'SINGLE_EXTERNAL_ACQUISITION_CANDIDATE');
  assert.equal(court.truthWinner, null);
});

test('replication gates are non-compensatory and third-party replication is required for tournament truth-winner eligibility', () => {
  const suites = passingSuites();
  const common = {
    present: true,
    independentAcquisition: true,
    provenanceValid: true,
    calibrationValid: true,
    rawRootBound: true,
    ordinaryModelsCleared: true,
    residualDetected: true,
    directionalReplicationCount: 2,
  };
  const reproduced = runFrontierEvidenceCourt({
    portfolio: PORTFOLIO,
    suites,
    externalEvidence: { spell_symbolic_control_protocol: common },
  });
  const reproducedSpell = reproduced.judgments.find((row) => row.laneId === 'spell_symbolic_control_protocol');
  assert.equal(reproducedSpell.evidenceRung, FRONTIER_EVIDENCE_RUNGS.EXTERNAL_REPRODUCED_CANDIDATE);
  assert.equal(reproduced.truthWinner, null);

  const thirdParty = runFrontierEvidenceCourt({
    portfolio: PORTFOLIO,
    suites,
    externalEvidence: {
      spell_symbolic_control_protocol: { ...common, thirdPartyReplication: true },
    },
  });
  assert.equal(thirdParty.truthWinner, 'spell_symbolic_control_protocol');
  assert.equal(thirdParty.newNaturalLawVerified, false);
  assert.equal(thirdParty.magicVerified, false);
});

test('court result is deterministic for identical supplied evidence and changes when evidence changes', () => {
  const a = runFrontierEvidenceCourt({ portfolio: PORTFOLIO, suites: passingSuites() });
  const b = runFrontierEvidenceCourt({ portfolio: PORTFOLIO, suites: passingSuites() });
  assert.equal(a.root, b.root);
  const c = runFrontierEvidenceCourt({
    portfolio: PORTFOLIO,
    suites: passingSuites(),
    externalEvidence: {
      formation_spatial_constraint_array: {
        present: true,
        decisiveFalsifier: true,
        decisiveFalsifierReason: 'registered formation residual absent',
      },
    },
  });
  assert.notEqual(a.root, c.root);
  assert.deepEqual(c.rejected, ['formation_spatial_constraint_array']);
});
