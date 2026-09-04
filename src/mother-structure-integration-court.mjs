import { createHash } from 'node:crypto';

import { realityRoot } from './canonical.mjs';
import {
  buildMotherStructureIRFromSource,
  MOTHER_STRUCTURE_CLASSIFICATIONS,
  MOTHER_STRUCTURE_STATUS,
  verifyMotherStructureCorpus,
} from './mother-structure-ir.mjs';
import {
  auditK400Completion,
  buildUniversalStressMatrix,
  COVERAGE_MODE,
  evaluateStressCell,
  STRESS_STATUS,
  UNIVERSAL_STRESS_GATES,
  validateUniversalStressEvidence,
} from './universal-program-stress.mjs';

export const MOTHER_STRUCTURE_INTEGRATION_COURT_VERSION = '0.1.0-alpha.1';
export const MOTHER_STRUCTURE_INTEGRATION_COURT_FORMAT = 'rcl.mother-structure.integration-court.v0.1';
export const MOTHER_STRUCTURE_INTEGRATION_COURT_STATUS = 'CANDIDATE_ONLY';
export const MOTHER_STRUCTURE_INTEGRATION_COURT_EVIDENCE_LEVEL = 'LOCAL_STRUCTURAL_ONLY';

export const MOTHER_STRUCTURE_INTEGRATION_COURT_TARGETS = Object.freeze([
  'rcl.rule.authorized_transition',
  'rcl.facet.declaration',
  'rcl.authority.subject_warrant',
  'rcl.rule.foresee_realize',
]);

const POSITIVE_SOURCE = `reality CourtPositive {
  facet world.ready : Truth = true
  facet world.score : Number = 4

  subject founder {
    facet score : Number = 1
    warrant world.raise on world
  }

  emergence promote {
    cause founder
    when world.ready == true and world.score >= 4
    needs world.raise on world
    alter world.score <- world.score + 2
    preserve world.score >= 4
    witness "candidate transition"
  }

  foresee promote
  realize promote
}`;

const RENAMED_SOURCE = `reality CourtRenamed {
  facet domain.active : Truth = true
  facet domain.total : Number = 4

  subject steward {
    facet points : Number = 1
    warrant domain.modify on domain
  }

  emergence advance {
    cause steward
    when domain.active == true and domain.total >= 4
    needs domain.modify on domain
    alter domain.total <- domain.total + 2
    preserve domain.total >= 4
    witness "renamed transition"
  }

  foresee advance
  realize advance
}`;

const NEGATIVE_SOURCES = Object.freeze({
  'rcl.rule.authorized_transition': `reality CourtMissingWitness {
    emergence draft {
      cause actor
      when true
      needs world.raise on world
      alter world.score <- world.score + 1
      preserve world.score >= 0
    }
  }`,
  'rcl.facet.declaration': 'reality CourtNoFacet { }',
  'rcl.authority.subject_warrant': `reality CourtNoWarrant {
    subject actor { }
  }`,
  'rcl.rule.foresee_realize': 'reality CourtSinglePhase { foresee missing_rule }',
});

const NEGATIVE_FALLBACKS = Object.freeze({
  'rcl.rule.authorized_transition': 'rcl.rule.transition',
  'rcl.facet.declaration': null,
  'rcl.authority.subject_warrant': null,
  'rcl.rule.foresee_realize': null,
});

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(message);
  return value;
}

function sortedUnique(values) {
  return [...new Set(values.filter(value => value !== null && value !== undefined).map(String))].sort();
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sourceSha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

function check(id, passed, details = {}) {
  return {
    id,
    status: passed ? 'PASS' : 'FAIL',
    passed: passed === true,
    ...details,
  };
}

function fixtureIr(source, id) {
  return buildMotherStructureIRFromSource(source, {
    sourcePath: `integration-court/${id}.rcl`,
    sourceSha256: sourceSha256(source),
    scope: 'integration-court',
    lineage: 'court-fixture',
  });
}

function structuresFor(ir, structureId) {
  return ir.structures.filter(row => row.structureId === structureId);
}

function shapeRootsFor(ir, structureId) {
  return sortedUnique(structuresFor(ir, structureId).map(row => row.shapeRoot));
}

function runStructuralSuite(structureId, corpusRow) {
  const positive = fixtureIr(POSITIVE_SOURCE, 'positive');
  const renamed = fixtureIr(RENAMED_SOURCE, 'renamed');
  const negativeSource = NEGATIVE_SOURCES[structureId];
  const negative = fixtureIr(negativeSource, 'negative');
  const positiveRoots = shapeRootsFor(positive, structureId);
  const renamedRoots = shapeRootsFor(renamed, structureId);
  const negativeRoots = shapeRootsFor(negative, structureId);
  const fallbackId = NEGATIVE_FALLBACKS[structureId];
  const fallbackPresent = fallbackId === null ? true : structuresFor(negative, fallbackId).length > 0;
  const positivePresent = positiveRoots.length > 0;
  const negativeDetected = negativeRoots.length === 0;
  const renameInvariant = sameArray(positiveRoots, renamedRoots);
  const mutationDetected = !sameArray(positiveRoots, negativeRoots);
  const recurrence = corpusRow?.recurrence ?? null;
  const recurrencePass = Boolean(
    recurrence
    && recurrence.occurrenceCount >= 3
    && recurrence.independentSourceCount >= 2
    && recurrence.scopeCount >= 2
    && recurrence.meetsCandidateThreshold === true,
  );

  return {
    fixtureRoots: {
      positive: realityRoot(POSITIVE_SOURCE),
      renamed: realityRoot(RENAMED_SOURCE),
      negative: realityRoot(negativeSource),
    },
    positive: check('positive-structure-present', positivePresent, {
      observedCount: structuresFor(positive, structureId).length,
      shapeRoots: positiveRoots,
      execution: 'PARSER_AND_MOTHER_IR_ONLY',
    }),
    negative: check('negative-control-rejected', negativeDetected, {
      observedCount: structuresFor(negative, structureId).length,
      fallbackStructureId: fallbackId,
      fallbackPresent,
      expected: 'target structure must be absent after required semantic material is removed',
    }),
    regression: check('structural-mutation-detected', mutationDetected, {
      baselineShapeRoots: positiveRoots,
      mutatedShapeRoots: negativeRoots,
      mutation: 'required structure material removed from a source fixture',
    }),
    renameInvariance: check('identifier-rename-preserves-shape', renameInvariant, {
      baselineShapeRoots: positiveRoots,
      renamedShapeRoots: renamedRoots,
      comparedField: 'shapeRoot',
      excludedFromComparison: ['instanceId', 'sourcePath', 'sourceSha256', 'declaration identifiers', 'literal text'],
    }),
    recurrence: check('independent-recurrence-threshold', recurrencePass, {
      occurrenceCount: recurrence?.occurrenceCount ?? 0,
      independentSourceCount: recurrence?.independentSourceCount ?? 0,
      scopeCount: recurrence?.scopeCount ?? 0,
      meetsCandidateThreshold: recurrence?.meetsCandidateThreshold ?? false,
    }),
    evidenceLevel: MOTHER_STRUCTURE_INTEGRATION_COURT_EVIDENCE_LEVEL,
  };
}

function boundarySuite(corpus, row) {
  const classificationValid = MOTHER_STRUCTURE_CLASSIFICATIONS.includes(row.classification);
  const candidateOnly = corpus.status === MOTHER_STRUCTURE_STATUS && row.status === MOTHER_STRUCTURE_STATUS;
  const noAutomaticPromotion = row.promotion === 'NOT_AUTOMATIC' || row.promotion === 'NOT_ELIGIBLE';
  const noFormalGapClaim = row.formalRclGap?.eligible === false;
  const noRegistryWrites = corpus.authorityBoundary?.noAutomaticRegistryWrites === true;
  const noAuthorityTransfer = row.promotion !== 'ADMITTED' && row.promotion !== 'PROMOTED';
  return {
    classification: check('classification-is-known', classificationValid, { value: row.classification }),
    candidateOnly: check('candidate-only-envelope', candidateOnly, {
      corpusStatus: corpus.status,
      rowStatus: row.status,
    }),
    promotionBoundary: check('promotion-is-not-automatic', noAutomaticPromotion, {
      promotion: row.promotion,
    }),
    formalGapBoundary: check('formal-gap-not-inferred', noFormalGapClaim, {
      eligible: row.formalRclGap?.eligible ?? null,
    }),
    registryBoundary: check('registry-writes-forbidden', noRegistryWrites, {
      noAutomaticRegistryWrites: corpus.authorityBoundary?.noAutomaticRegistryWrites ?? null,
    }),
    authorityBoundary: check('no-authority-transfer', noAuthorityTransfer, {
      promotion: row.promotion,
    }),
  };
}

function decisionForClassification(classification, localPass) {
  if (!localPass) return 'HOLD_FAIL_CLOSED';
  switch (classification) {
    case 'FRAMEWORK_CANDIDATE': return 'RETAIN_AS_FRAMEWORK_CANDIDATE';
    case 'STD_CANDIDATE': return 'RETAIN_AS_STD_CANDIDATE';
    case 'PACK': return 'RETAIN_AS_PACK';
    case 'EXAMPLE': return 'RETAIN_AS_EXAMPLE';
    case 'AUXILIARY_LANGUAGE_PROVIDER': return 'RETAIN_AS_AUXILIARY_LANGUAGE_PROVIDER';
    case 'RCL_GAP_CANDIDATE': return 'HOLD_AS_RCL_GAP_CANDIDATE';
    default: return 'HOLD_UNKNOWN_CLASSIFICATION';
  }
}

function nextActionForClassification(classification) {
  switch (classification) {
    case 'FRAMEWORK_CANDIDATE':
    case 'STD_CANDIDATE':
      return 'independent differential proof, compiler/runtime lowering proof, K400 gate coverage, then human owner decision';
    case 'RCL_GAP_CANDIDATE':
      return 'signed hash-bound PRIMITIVE/IR/RUNTIME/PROFILE comparison with at least one real missing capability';
    case 'AUXILIARY_LANGUAGE_PROVIDER':
      return 'retain provider/runtime ownership and bind only the semantic contract back to RCL';
    default:
      return 'retain as bounded evidence and rerun when independent scope or semantic generality changes';
  }
}

function allGateStatuses(status) {
  return Object.fromEntries(
    UNIVERSAL_STRESS_GATES.map(gate => [gate, { status, evidence: [] }]),
  );
}

function buildK400Audit(k400Evidence) {
  if (k400Evidence === undefined || k400Evidence === null) {
    return {
      status: 'NOT_SUPPLIED',
      schemaValid: false,
      validation: null,
      completion: null,
      claimedCellCount: 0,
      totalCells: 400,
      gatePassCounts: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, 0])),
      evidenceRoot: null,
    };
  }

  const validation = validateUniversalStressEvidence(k400Evidence);
  if (!validation.ok) {
    return {
      status: 'INVALID',
      schemaValid: false,
      validation,
      completion: null,
      claimedCellCount: Array.isArray(k400Evidence.claims) ? k400Evidence.claims.length : 0,
      totalCells: 400,
      gatePassCounts: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, 0])),
      evidenceRoot: realityRoot(k400Evidence),
    };
  }

  const matrix = buildUniversalStressMatrix();
  const claimById = new Map(k400Evidence.claims.map(claim => [claim.id, claim]));
  const reports = matrix.map(cell => {
    const claim = claimById.get(cell.id);
    if (!claim) {
      return evaluateStressCell({
        ...cell,
        status: STRESS_STATUS.UNTESTED,
        untested: true,
        coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
        gates: allGateStatuses(STRESS_STATUS.UNVERIFIED),
        changes: [],
      });
    }
    return evaluateStressCell({
      ...cell,
      ...claim,
      id: cell.id,
      environment: cell.environment,
      programFamily: cell.programFamily,
    });
  });
  const completion = auditK400Completion(reports);
  const gatePassCounts = Object.fromEntries(
    UNIVERSAL_STRESS_GATES.map(gate => [gate, reports.filter(report => report.gates[gate].status === STRESS_STATUS.PASS).length]),
  );
  const statusCounts = Object.fromEntries(
    Object.values(STRESS_STATUS).map(status => [status, reports.filter(report => report.status === status).length]),
  );
  return {
    status: completion.universalGrowthComplete ? 'PASS' : 'INCOMPLETE',
    schemaValid: true,
    validation,
    completion,
    claimedCellCount: k400Evidence.claims.length,
    totalCells: matrix.length,
    statusCounts,
    gatePassCounts,
    evidenceRoot: realityRoot({
      schema: k400Evidence.schema,
      generation: k400Evidence.generation,
      claims: k400Evidence.claims,
    }),
  };
}

function decisionRow(corpus, row, targetSet) {
  const structural = targetSet.has(row.structureId) ? runStructuralSuite(row.structureId, row) : null;
  const boundary = boundarySuite(corpus, row);
  const structuralChecks = structural
    ? Object.values(structural).filter(value => value && typeof value === 'object' && typeof value.passed === 'boolean')
    : [];
  const boundaryChecks = Object.values(boundary);
  const localPass = [...structuralChecks, ...boundaryChecks].every(item => item.passed === true);
  return {
    structureId: row.structureId,
    sourceClassification: row.classification,
    courtStatus: localPass ? 'PASS_LOCAL' : 'FAIL_LOCAL',
    decision: decisionForClassification(row.classification, localPass),
    promotion: 'NOT_AUTOMATIC',
    recurrence: row.recurrence,
    structuralSuite: structural,
    boundarySuite: boundary,
    formalRclGap: {
      eligible: false,
      source: 'clustering_and_local_court_do_not establish a formal RCL_GAP',
    },
    nextAction: nextActionForClassification(row.classification),
  };
}

function missingTargetRow(corpus, structureId) {
  const boundary = {
    missingTarget: check('target-present-in-corpus', false, { structureId }),
    candidateOnly: check('candidate-only-envelope', corpus.status === MOTHER_STRUCTURE_STATUS, { corpusStatus: corpus.status }),
    registryBoundary: check('registry-writes-forbidden', corpus.authorityBoundary?.noAutomaticRegistryWrites === true),
  };
  return {
    structureId,
    sourceClassification: 'MISSING',
    courtStatus: 'FAIL_LOCAL',
    decision: 'HOLD_FAIL_CLOSED',
    promotion: 'NOT_AUTOMATIC',
    recurrence: null,
    structuralSuite: null,
    boundarySuite: boundary,
    formalRclGap: { eligible: false, source: 'missing candidate is not a gap claim' },
    nextAction: 'restore or explain the missing candidate input before any court decision',
  };
}

export function runMotherStructureIntegrationCourt(options = {}) {
  assertObject(options, 'Mother Structure Integration Court options must be an object');
  const corpus = options.corpus;
  const corpusVerification = verifyMotherStructureCorpus(corpus);
  if (!corpusVerification.ok) {
    throw new TypeError(`Invalid Mother Structure corpus: ${corpusVerification.errors.join('; ')}`);
  }
  const targetIds = sortedUnique(options.targetStructureIds ?? MOTHER_STRUCTURE_INTEGRATION_COURT_TARGETS);
  const targetSet = new Set(targetIds);
  const rowsById = new Map(corpus.structures.map(row => [row.structureId, row]));
  const decisions = corpus.structures
    .slice()
    .sort((left, right) => left.structureId.localeCompare(right.structureId))
    .map(row => decisionRow(corpus, row, targetSet));
  for (const targetId of targetIds) {
    if (!rowsById.has(targetId)) decisions.push(missingTargetRow(corpus, targetId));
  }
  decisions.sort((left, right) => left.structureId.localeCompare(right.structureId));

  const k400 = buildK400Audit(options.k400Evidence);
  const localChecksPass = decisions.every(row => row.courtStatus === 'PASS_LOCAL');
  const targetDecisions = decisions.filter(row => targetSet.has(row.structureId));
  const targetChecksPass = targetDecisions.length === targetIds.length
    && targetDecisions.every(row => row.courtStatus === 'PASS_LOCAL');
  const reportWithoutRoot = {
    format: MOTHER_STRUCTURE_INTEGRATION_COURT_FORMAT,
    version: MOTHER_STRUCTURE_INTEGRATION_COURT_VERSION,
    status: MOTHER_STRUCTURE_INTEGRATION_COURT_STATUS,
    evidenceLevel: MOTHER_STRUCTURE_INTEGRATION_COURT_EVIDENCE_LEVEL,
    corpus: {
      format: corpus.format,
      version: corpus.version,
      status: corpus.status,
      root: corpus.root,
      structureCount: corpus.summary?.structureCount ?? corpus.structures.length,
      observationCount: corpus.summary?.observationCount ?? corpus.observations.length,
    },
    corpusVerification,
    k400,
    targetStructureIds: targetIds,
    decisions,
    summary: {
      localChecksPass,
      targetChecksPass,
      decisionCount: decisions.length,
      candidateTargetCount: targetDecisions.length,
      classificationCounts: decisions.reduce((counts, row) => {
        counts[row.sourceClassification] = (counts[row.sourceClassification] ?? 0) + 1;
        return counts;
      }, {}),
      retainedFrameworkCandidates: decisions.filter(row => row.decision === 'RETAIN_AS_FRAMEWORK_CANDIDATE').map(row => row.structureId),
      retainedStdCandidates: decisions.filter(row => row.decision === 'RETAIN_AS_STD_CANDIDATE').map(row => row.structureId),
      retainedPacks: decisions.filter(row => row.decision === 'RETAIN_AS_PACK').map(row => row.structureId),
      retainedExamples: decisions.filter(row => row.decision === 'RETAIN_AS_EXAMPLE').map(row => row.structureId),
      retainedAuxiliary: decisions.filter(row => row.decision === 'RETAIN_AS_AUXILIARY_LANGUAGE_PROVIDER').map(row => row.structureId),
      heldGapCandidates: decisions.filter(row => row.decision === 'HOLD_AS_RCL_GAP_CANDIDATE').map(row => row.structureId),
    },
    authorityBoundary: {
      canonicalOwner: 'RCL candidate extraction only',
      finalDecision: 'NOT_DECIDED',
      promotion: 'NOT_AUTOMATIC',
      noRegistryWrites: true,
      noAuthorityTransfer: true,
      formalRclGap: 'NOT_ASSERTED',
      humanAuthorizationRequired: true,
      k400IncompleteDoesNotBecomePass: true,
    },
    verdict: localChecksPass ? 'CANDIDATE_ONLY_HOLD' : 'HOLD_FAIL_CLOSED',
  };
  return {
    ...reportWithoutRoot,
    root: realityRoot(reportWithoutRoot),
  };
}

export function verifyMotherStructureIntegrationCourt(report) {
  const errors = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) return { ok: false, errors: ['report must be an object'] };
  if (report.format !== MOTHER_STRUCTURE_INTEGRATION_COURT_FORMAT) errors.push(`unexpected format: ${String(report.format)}`);
  if (report.version !== MOTHER_STRUCTURE_INTEGRATION_COURT_VERSION) errors.push(`unexpected version: ${String(report.version)}`);
  if (report.status !== MOTHER_STRUCTURE_INTEGRATION_COURT_STATUS) errors.push(`unexpected status: ${String(report.status)}`);
  if (!Array.isArray(report.decisions)) errors.push('decisions must be an array');
  if (report.authorityBoundary?.noRegistryWrites !== true) errors.push('registry writes are not forbidden');
  if (report.authorityBoundary?.promotion !== 'NOT_AUTOMATIC') errors.push('automatic promotion boundary is missing');
  for (const [index, decision] of (Array.isArray(report.decisions) ? report.decisions : []).entries()) {
    if (!decision?.structureId) errors.push(`decisions[${index}] missing structureId`);
    if (decision?.promotion !== 'NOT_AUTOMATIC') errors.push(`decisions[${index}] automatic promotion marker`);
    if (decision?.formalRclGap?.eligible !== false) errors.push(`decisions[${index}] formal gap boundary missing`);
  }
  if (typeof report.root === 'string') {
    const { root, ...withoutRoot } = report;
    if (realityRoot(withoutRoot) !== root) errors.push('root does not match the court payload');
  }
  return {
    ok: errors.length === 0,
    errors,
    decisionCount: Array.isArray(report.decisions) ? report.decisions.length : 0,
    verdict: report.verdict ?? null,
  };
}
