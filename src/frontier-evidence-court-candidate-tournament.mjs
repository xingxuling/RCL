import { sha256 } from './reality-compiler-kernel.mjs';
import { buildDefaultUnknownLawExperimentPortfolio } from './frontier-unknown-law-experiment-spec.mjs';
import { runSandboxSurrogatePressureSuite } from './frontier-sandbox-instrument-surrogate.mjs';
import { runFormationFactorialSandboxPressureSuite } from './frontier-formation-factorial-sandbox-surrogate.mjs';
import { runAetherContinuousFieldSandboxPressureSuite } from './frontier-aether-continuous-field-sandbox-surrogate.mjs';

export const RCL_FRONTIER_EVIDENCE_COURT_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_EVIDENCE_COURT_FORMAT = 'rcl.frontier-evidence-court-candidate-tournament.v0.1';
export const RCL_FRONTIER_EVIDENCE_JUDGMENT_FORMAT = 'rcl.frontier-evidence-candidate-judgment.v0.1';

export const FRONTIER_EVIDENCE_RUNGS = Object.freeze({
  SPECIFIED: 0,
  SANDBOX_PROTOCOL_SURVIVED: 1,
  EXTERNAL_SINGLE_ACQUISITION_CANDIDATE: 2,
  EXTERNAL_REPRODUCED_CANDIDATE: 3,
  INDEPENDENT_THIRD_PARTY_REPLICATED_CANDIDATE: 4,
});

const CANDIDATE_CONFIG = Object.freeze({
  spell_symbolic_control_protocol: Object.freeze({
    label: 'Spell Symbolic Control × Spatial Context',
    designFamily: 'simple_2x2',
    engineeringStage: 3,
    engineeringStatus: 'ACQUISITION_PACKAGE_AND_INSTRUMENT_BINDING_READY_REAL_INSTRUMENT_PENDING',
  }),
  formation_spatial_constraint_array: Object.freeze({
    label: 'Formation Spatial Constraint Array',
    designFamily: 'full_factorial_2powk',
    engineeringStage: 2,
    engineeringStatus: 'GENERIC_FULL_FACTORIAL_SCORER_AND_SANDBOX_SURROGATE_READY_REAL_INSTRUMENT_PENDING',
  }),
  aether_substrate_information_medium: Object.freeze({
    label: 'Aether Substrate Information Medium',
    designFamily: 'continuous_field',
    engineeringStage: 2,
    engineeringStatus: 'CONTINUOUS_FIELD_SCORER_AND_SANDBOX_SURROGATE_READY_REAL_INSTRUMENT_PENDING',
  }),
});

function normalizeExternalEvidence(input = {}) {
  return {
    present: input.present === true,
    independentAcquisition: input.independentAcquisition === true,
    provenanceValid: input.provenanceValid === true,
    calibrationValid: input.calibrationValid === true,
    rawRootBound: input.rawRootBound === true,
    ordinaryModelsCleared: input.ordinaryModelsCleared === true,
    residualDetected: input.residualDetected === true,
    directionalReplicationCount: Math.max(0, Math.trunc(Number(input.directionalReplicationCount ?? 0))),
    thirdPartyReplication: input.thirdPartyReplication === true,
    decisiveFalsifier: input.decisiveFalsifier === true,
    decisiveFalsifierReason: input.decisiveFalsifierReason ? String(input.decisiveFalsifierReason) : null,
    evidenceRoots: Array.isArray(input.evidenceRoots) ? [...new Set(input.evidenceRoots.map(String).filter(Boolean))].sort() : [],
  };
}

function sandboxOutcomeFor(laneId, suites) {
  if (laneId === 'spell_symbolic_control_protocol') {
    const suite = suites.spell;
    const pass = Boolean(suite)
      && Number(suite.passed) === Number(suite.scenarioCount)
      && suite.allRawValid === true
      && suite.allPipelinesOk === true
      && suite.allClassificationsCorrect === true;
    return {
      available: Boolean(suite),
      pass,
      scenarioCount: Number(suite?.scenarioCount ?? 0),
      passed: Number(suite?.passed ?? 0),
      routeInvariant: suite?.allPipelinesOk === true,
      antiAdaptiveSearchInvariant: true,
      evidenceClass: suite?.evidenceClass ?? null,
      root: suite?.root ?? null,
    };
  }
  if (laneId === 'formation_spatial_constraint_array') {
    const suite = suites.formation;
    const pass = Boolean(suite)
      && Number(suite.passed) === Number(suite.scenarioCount)
      && suite.allPayloadsValid === true
      && suite.allRoutesGenericFactorial === true
      && suite.allClassificationsCorrect === true;
    return {
      available: Boolean(suite),
      pass,
      scenarioCount: Number(suite?.scenarioCount ?? 0),
      passed: Number(suite?.passed ?? 0),
      routeInvariant: suite?.allRoutesGenericFactorial === true,
      antiAdaptiveSearchInvariant: true,
      evidenceClass: suite?.evidenceClass ?? null,
      root: suite?.root ?? null,
    };
  }
  if (laneId === 'aether_substrate_information_medium') {
    const suite = suites.aether;
    const pass = Boolean(suite)
      && Number(suite.passed) === Number(suite.scenarioCount)
      && suite.allPayloadsValid === true
      && suite.allRoutesContinuousField === true
      && suite.allClassificationsCorrect === true
      && suite.noAdaptiveSearch === true;
    return {
      available: Boolean(suite),
      pass,
      scenarioCount: Number(suite?.scenarioCount ?? 0),
      passed: Number(suite?.passed ?? 0),
      routeInvariant: suite?.allRoutesContinuousField === true,
      antiAdaptiveSearchInvariant: suite?.noAdaptiveSearch === true,
      evidenceClass: suite?.evidenceClass ?? null,
      root: suite?.root ?? null,
    };
  }
  return { available: false, pass: false, scenarioCount: 0, passed: 0, routeInvariant: false, antiAdaptiveSearchInvariant: false, evidenceClass: null, root: null };
}

function externalRung(external) {
  if (external.decisiveFalsifier) return -1;
  const singleAcquisitionGate = external.present
    && external.independentAcquisition
    && external.provenanceValid
    && external.calibrationValid
    && external.rawRootBound
    && external.ordinaryModelsCleared
    && external.residualDetected;
  if (!singleAcquisitionGate) return FRONTIER_EVIDENCE_RUNGS.SPECIFIED;
  if (external.thirdPartyReplication && external.directionalReplicationCount >= 2) {
    return FRONTIER_EVIDENCE_RUNGS.INDEPENDENT_THIRD_PARTY_REPLICATED_CANDIDATE;
  }
  if (external.directionalReplicationCount >= 2) {
    return FRONTIER_EVIDENCE_RUNGS.EXTERNAL_REPRODUCED_CANDIDATE;
  }
  return FRONTIER_EVIDENCE_RUNGS.EXTERNAL_SINGLE_ACQUISITION_CANDIDATE;
}

export function judgeFrontierCandidate(spec, suiteOutcome, externalEvidenceInput = {}) {
  const external = normalizeExternalEvidence(externalEvidenceInput);
  const config = CANDIDATE_CONFIG[spec.laneId] ?? {
    label: spec.laneId,
    designFamily: spec.designGrammar?.family ?? 'unknown',
    engineeringStage: 0,
    engineeringStatus: 'UNCLASSIFIED',
  };
  const extRung = externalRung(external);
  let rung = FRONTIER_EVIDENCE_RUNGS.SPECIFIED;
  let status = 'SPECIFIED_PENDING_SANDBOX_EXECUTION';
  let researchDisposition = 'HOLD';
  let decisiveReason = null;

  if (external.decisiveFalsifier) {
    rung = -1;
    status = 'REJECTED_BY_DECISIVE_EXTERNAL_FALSIFIER';
    researchDisposition = 'REJECT';
    decisiveReason = external.decisiveFalsifierReason ?? 'decisive_external_falsifier';
  } else if (!suiteOutcome.available) {
    rung = FRONTIER_EVIDENCE_RUNGS.SPECIFIED;
    status = 'BLOCKED_SANDBOX_SUITE_UNAVAILABLE';
    researchDisposition = 'HOLD';
  } else if (!suiteOutcome.pass) {
    rung = FRONTIER_EVIDENCE_RUNGS.SPECIFIED;
    status = 'BLOCKED_PROTOCOL_DISCRIMINABILITY_FAILURE';
    researchDisposition = 'REPAIR_PROTOCOL';
    decisiveReason = 'sandbox_protocol_failed; this does not falsify the external mechanism';
  } else if (extRung >= FRONTIER_EVIDENCE_RUNGS.EXTERNAL_SINGLE_ACQUISITION_CANDIDATE) {
    rung = extRung;
    status = extRung === FRONTIER_EVIDENCE_RUNGS.INDEPENDENT_THIRD_PARTY_REPLICATED_CANDIDATE
      ? 'INDEPENDENTLY_REPLICATED_EXTERNAL_CANDIDATE'
      : extRung === FRONTIER_EVIDENCE_RUNGS.EXTERNAL_REPRODUCED_CANDIDATE
        ? 'REPRODUCED_EXTERNAL_CANDIDATE'
        : 'SINGLE_EXTERNAL_ACQUISITION_CANDIDATE';
    researchDisposition = 'CONTINUE_WITH_STRONGER_REPLICATION';
  } else {
    rung = FRONTIER_EVIDENCE_RUNGS.SANDBOX_PROTOCOL_SURVIVED;
    status = 'SURVIVES_SANDBOX_ONLY_PENDING_EXTERNAL_EVIDENCE';
    researchDisposition = 'CONTINUE_TO_EXTERNAL_ACQUISITION';
  }

  const judgment = {
    format: RCL_FRONTIER_EVIDENCE_JUDGMENT_FORMAT,
    version: RCL_FRONTIER_EVIDENCE_COURT_VERSION,
    laneId: spec.laneId,
    label: config.label,
    sourceCandidateRoot: spec.sourceCandidateRoot,
    experimentSpecRoot: spec.root,
    designFamily: config.designFamily,
    evidenceRung: rung,
    status,
    researchDisposition,
    decisiveReason,
    sandbox: suiteOutcome,
    externalEvidence: external,
    engineeringStage: config.engineeringStage,
    engineeringStatus: config.engineeringStatus,
    nonCompensatoryRules: {
      sandboxCannotCompensateForMissingExternalEvidence: true,
      engineeringReadinessCannotCompensateForFalsifier: true,
      onePositiveAcquisitionCannotCompensateForMissingReplication: true,
      failedProtocolDoesNotFalsifyExternalMechanism: true,
    },
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  judgment.root = sha256({ ...judgment, root: undefined });
  return judgment;
}

function rankLeaders(judgments, field) {
  const eligible = judgments.filter((row) => row.researchDisposition !== 'REJECT');
  if (!eligible.length) return [];
  const max = Math.max(...eligible.map((row) => Number(row[field] ?? -Infinity)));
  return eligible.filter((row) => Number(row[field] ?? -Infinity) === max).map((row) => row.laneId).sort();
}

export function runFrontierEvidenceCourt(options = {}) {
  const portfolio = options.portfolio ?? buildDefaultUnknownLawExperimentPortfolio();
  const suites = options.suites ?? {
    spell: runSandboxSurrogatePressureSuite(options.spellSandbox ?? {}),
    formation: runFormationFactorialSandboxPressureSuite(options.formationSandbox ?? {}),
    aether: runAetherContinuousFieldSandboxPressureSuite(options.aetherSandbox ?? {}),
  };
  const externalEvidence = options.externalEvidence ?? {};
  const judgments = portfolio.specs.map((spec) => judgeFrontierCandidate(
    spec,
    sandboxOutcomeFor(spec.laneId, suites),
    externalEvidence[spec.laneId] ?? {},
  ));

  const rejected = judgments.filter((row) => row.researchDisposition === 'REJECT').map((row) => row.laneId).sort();
  const protocolBlocked = judgments.filter((row) => row.researchDisposition === 'REPAIR_PROTOCOL' || row.status === 'BLOCKED_SANDBOX_SUITE_UNAVAILABLE').map((row) => row.laneId).sort();
  const survivors = judgments.filter((row) => row.researchDisposition !== 'REJECT' && row.evidenceRung >= FRONTIER_EVIDENCE_RUNGS.SANDBOX_PROTOCOL_SURVIVED).map((row) => row.laneId).sort();
  const evidenceLeaders = rankLeaders(judgments, 'evidenceRung');
  const engineeringLeaders = rankLeaders(judgments, 'engineeringStage');
  const maxEvidenceRung = evidenceLeaders.length
    ? Math.max(...judgments.filter((row) => evidenceLeaders.includes(row.laneId)).map((row) => row.evidenceRung))
    : FRONTIER_EVIDENCE_RUNGS.SPECIFIED;
  const truthWinner = maxEvidenceRung >= FRONTIER_EVIDENCE_RUNGS.INDEPENDENT_THIRD_PARTY_REPLICATED_CANDIDATE && evidenceLeaders.length === 1
    ? evidenceLeaders[0]
    : null;

  const court = {
    format: RCL_FRONTIER_EVIDENCE_COURT_FORMAT,
    version: RCL_FRONTIER_EVIDENCE_COURT_VERSION,
    phase: 'Frontier Evidence Court v0.1',
    objective: 'Make frontier mechanism candidates compete by non-compensatory evidence gates, not narrative coherence or weighted optimism.',
    candidateCount: judgments.length,
    judgments,
    survivors,
    rejected,
    protocolBlocked,
    evidenceLeaders,
    engineeringLeaders,
    truthWinner,
    truthWinnerRule: 'No truth winner is declared from sandbox-only evidence. A unique evidence leader must first reach independent third-party replication, and even then remains a candidate rather than automatic natural-law truth.',
    tournamentRules: {
      decisiveExternalFalsifierOverridesAllLowerEvidence: true,
      sandboxPassOnlyValidatesProtocolDiscriminability: true,
      differentDesignFamiliesAreNotComparedByRawEffectMagnitude: true,
      evidenceRungIsLexicographicNotAdditive: true,
      negativeResultsAreValid: true,
      storyBasedRescueForbidden: true,
    },
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  court.root = sha256({ ...court, root: undefined });
  return court;
}
