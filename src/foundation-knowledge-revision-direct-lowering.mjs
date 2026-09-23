import { realityRoot } from './canonical.mjs';
import { knowledgeClaim, reviseKnowledge } from './knowledge.mjs';
import {
  FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS,
  FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS,
  lowerDeclaredKnowledgeToCore as lowerExistingKnowledgeToCore,
} from './foundation-knowledge-derived-direct-lowering.mjs';

export { FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS, FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS };
export const FOUNDATION_KNOWLEDGE_REVISION_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-knowledge-revision-direct-lowering.v0.1';
export const FOUNDATION_KNOWLEDGE_REVISION_DIRECT_LOWERING_VERSION = '0.1.0';

const KNOWLEDGE_RECORD_TYPE = 'taowind.rcl.native.Knowledge.v0.1';
const PRIMITIVE_TYPES = new Set(['Number', 'Text', 'Truth']);

function array(value) { return Array.isArray(value) ? value : []; }
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}
function literal(valueType, value) { return { kind: 'LiteralExpr', valueType, value }; }
function field(object, name) { return { kind: 'FieldAccessExpr', object, field: name }; }
function trueExpression() { return literal('Truth', true); }
function sanitizeName(value) { return String(value ?? 'unnamed').replace(/[^A-Za-z0-9_]+/g, '_'); }

function sequenceExpression(values) {
  let sequence = { kind: 'CallExpr', name: 'empty_sequence', args: [] };
  for (const value of values) {
    sequence = { kind: 'CallExpr', name: 'sequence_append', args: [sequence, literal('Text', String(value))] };
  }
  return sequence;
}

function initialLiteralState(program) {
  const state = {};
  for (const facet of array(program?.facets)) {
    if (facet?.deferred === true) continue;
    if (facet?.value?.kind !== 'LiteralExpr') return null;
    state[facet.path] = facet.value.value;
  }
  return state;
}

function staticPrimitive(expression, initialState) {
  if (expression?.kind === 'LiteralExpr') return { ok: true, value: expression.value };
  if (
    expression?.kind === 'PathExpr'
    && typeof expression.path === 'string'
    && Object.prototype.hasOwnProperty.call(initialState, expression.path)
  ) {
    const value = initialState[expression.path];
    if (value === null || ['number', 'string', 'boolean'].includes(typeof value)) return { ok: true, value };
  }
  return { ok: false, value: undefined };
}

function confidenceSupported(spec) {
  if (spec?.confidence == null) return true;
  return spec.confidence?.kind === 'LiteralExpr'
    && typeof spec.confidence.value === 'number'
    && Number.isFinite(spec.confidence.value)
    && spec.confidence.value >= 0
    && spec.confidence.value <= 1;
}

function claimSupported(claim, initialState) {
  return PRIMITIVE_TYPES.has(claim?.baseType)
    && typeof claim?.path === 'string'
    && claim.path.length > 0
    && typeof claim?.source === 'string'
    && claim.source.length > 0
    && array(claim?.dependencies).length === 0
    && array(claim?.evidence).every(item => typeof item === 'string')
    && staticPrimitive(claim?.expression, initialState).ok
    && confidenceSupported(claim);
}

function revisionSupported(revision, initialState) {
  return typeof revision?.target === 'string'
    && revision.target.length > 0
    && typeof revision?.source === 'string'
    && revision.source.length > 0
    && array(revision?.dependencies).length === 0
    && array(revision?.evidence).every(item => typeof item === 'string')
    && staticPrimitive(revision?.expression, initialState).ok
    && confidenceSupported(revision);
}

function knowledgeValue(spec, baseType, value, formedAtRoot, options = {}) {
  return knowledgeClaim(baseType, value, {
    confidence: options.confidence ?? spec?.confidence?.value ?? 1,
    evidence: options.evidence ?? array(spec?.evidence),
    source: options.source ?? spec?.source,
    scope: options.scope ?? spec?.scope ?? 'local',
    status: options.status ?? spec?.status ?? 'provisional',
    dependencies: options.dependencies ?? array(spec?.dependencies),
    revision: options.revision ?? 1,
    alternatives: options.alternatives ?? [],
    formedAtRoot,
  });
}

function knowledgeRecord(value) {
  return {
    kind: 'RecordConstructExpr',
    canonicalType: KNOWLEDGE_RECORD_TYPE,
    fields: [
      { name: 'kind', value: literal('Text', 'Knowledge') },
      { name: 'baseType', value: literal('Text', value.baseType) },
      { name: 'value', value: literal(value.baseType, value.value) },
      { name: 'confidence', value: literal('Number', value.confidence) },
      { name: 'evidence', value: sequenceExpression(array(value.evidence)) },
      { name: 'source', value: literal('Text', value.source) },
      { name: 'scope', value: literal('Text', value.scope ?? 'local') },
      { name: 'status', value: literal('Text', value.status ?? 'provisional') },
      { name: 'dependencies', value: sequenceExpression(array(value.dependencies)) },
      { name: 'revision', value: literal('Number', value.revision ?? 1) },
      { name: 'alternatives', value: { kind: 'CallExpr', name: 'empty_sequence', args: [] } },
      { name: 'formedAtRoot', value: literal('Text', value.formedAtRoot) },
    ],
  };
}

function isKnowledgePath(expr, paths) { return expr?.kind === 'PathExpr' && paths.has(expr.path); }
function rewriteKnowledgeAccessors(value, knowledgePaths) {
  if (Array.isArray(value)) return value.map(item => rewriteKnowledgeAccessors(item, knowledgePaths));
  if (!value || typeof value !== 'object') return value;
  if (value.kind === 'CallExpr' && array(value.args).length >= 1 && isKnowledgePath(value.args[0], knowledgePaths)) {
    const target = rewriteKnowledgeAccessors(value.args[0], knowledgePaths);
    if (value.name === 'confidence' || value.name === 'certainty') return field(target, 'confidence');
    if (value.name === 'knowledge_value' || value.name === 'belief') return field(target, 'value');
    if (value.name === 'knowledge_status') return field(target, 'status');
    if (value.name === 'evidence_count') return { kind: 'CallExpr', name: 'length', args: [field(target, 'evidence')] };
    if (value.name === 'known' || value.name === 'supported') {
      const threshold = value.args[1] ? rewriteKnowledgeAccessors(value.args[1], knowledgePaths) : literal('Number', 0.5);
      return {
        kind: 'BinaryExpr',
        operator: 'and',
        left: {
          kind: 'UnaryExpr',
          operator: 'not',
          expression: {
            kind: 'BinaryExpr',
            operator: '==',
            left: field(clone(target), 'status'),
            right: literal('Text', 'forgotten'),
          },
        },
        right: {
          kind: 'BinaryExpr',
          operator: '>=',
          left: field(clone(target), 'confidence'),
          right: threshold,
        },
      };
    }
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteKnowledgeAccessors(item, knowledgePaths)]));
}

function buildReinforcementPlan(program) {
  const initialState = initialLiteralState(program);
  if (initialState === null) return null;

  const learns = array(program?.directives)
    .map((directive, index) => ({ directive, index }))
    .filter(item => item.directive?.kind === 'Learn');
  if (
    learns.length !== 2
    || learns[0].index !== 0
    || learns[1].index !== 1
    || learns[0].directive?.name === learns[1].directive?.name
  ) return null;

  const knowledges = array(program?.knowledges);
  const baseDeclaration = knowledges.find(item => item?.name === learns[0].directive.name) ?? null;
  const revisionDeclaration = knowledges.find(item => item?.name === learns[1].directive.name) ?? null;
  const baseClaims = array(baseDeclaration?.claims);
  const revisions = array(revisionDeclaration?.revisions);

  if (
    !baseDeclaration
    || !revisionDeclaration
    || baseClaims.length !== 1
    || array(baseDeclaration.derives).length !== 0
    || array(baseDeclaration.revisions).length !== 0
    || array(baseDeclaration.decays).length !== 0
    || array(baseDeclaration.preserves).length !== 0
    || array(revisionDeclaration.claims).length !== 0
    || array(revisionDeclaration.derives).length !== 0
    || revisions.length !== 1
    || array(revisionDeclaration.decays).length !== 0
    || array(revisionDeclaration.preserves).length !== 0
  ) return null;

  const claim = baseClaims[0];
  const revision = revisions[0];
  if (!claimSupported(claim, initialState) || !revisionSupported(revision, initialState)) return null;
  if (revision.target !== claim.path) return null;

  const claimStatic = staticPrimitive(claim.expression, initialState);
  const revisionStatic = staticPrimitive(revision.expression, initialState);
  if (!claimStatic.ok || !revisionStatic.ok || JSON.stringify(claimStatic.value) !== JSON.stringify(revisionStatic.value)) return null;

  const claimFormedAtRoot = realityRoot(initialState);
  let current;
  try {
    current = knowledgeValue(claim, claim.baseType, claimStatic.value, claimFormedAtRoot, {
      dependencies: [],
      status: claim.status ?? 'provisional',
      revision: 1,
    });
  } catch {
    return null;
  }

  const afterClaim = clone(initialState);
  afterClaim[claim.path] = current;
  const revisionFormedAtRoot = realityRoot(afterClaim);
  let candidate;
  let reinforced;
  try {
    candidate = knowledgeValue(revision, claim.baseType, revisionStatic.value, revisionFormedAtRoot, {
      dependencies: [],
      status: revision.status ?? 'revision',
      revision: current.revision + 1,
    });
    reinforced = reviseKnowledge(current, candidate);
  } catch {
    return null;
  }

  if (
    reinforced?.status !== 'reinforced'
    || reinforced?.revision !== 2
    || array(reinforced?.alternatives).length !== 0
    || reinforced?.formedAtRoot !== revisionFormedAtRoot
  ) return null;

  return {
    initialState,
    baseDeclaration,
    revisionDeclaration,
    claim,
    revision,
    current,
    reinforced,
    claimFormedAtRoot,
    revisionFormedAtRoot,
    learns,
  };
}

function revisionTruthBoundary() {
  return {
    boundedSingleClaimKnowledgeSubsetOnly: true,
    boundedPrimitiveMultiClaimKnowledgeSubsetOnly: false,
    boundedContiguousMultiLearnKnowledgeSubsetOnly: true,
    maxBoundedClaimCountPerLearn: 1,
    maxBoundedLearnDirectiveCount: 2,
    contiguousLeadingLearnDirectivesRequired: true,
    distinctLearnDeclarationNamesRequired: true,
    primitiveClaimTypesOnly: true,
    boundedSameValueReinforcementRevisionSubsetNativeClaimed: true,
    revisionMustTargetImmediatelyPriorLeadingKnowledgeClaim: true,
    revisionExpressionRestrictedToLiteralOrInitialPrimitivePath: true,
    revisionConfidenceMustBeLiteralWhenExplicit: true,
    revisionSourceIdentityMustBeExplicit: true,
    revisionDependenciesRemainProviderBound: true,
    contradictoryRevisionAlternativesRemainProviderBound: true,
    arbitraryRevisionTopologyRemainsProviderBound: true,
    decayRemainsProviderBound: true,
    derivedKnowledgeInRevisionSliceRemainsProviderBound: true,
    knowledgePreserveInRevisionSliceRemainsProviderBound: true,
    nativeKnowledgeRecordType: KNOWLEDGE_RECORD_TYPE,
    referenceSequentialFormationAcrossLearnTransactionsRequired: true,
    oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: true,
    repeatedKnowledgeTargetAllowedOnlyForProvenOrderedRevision: true,
    referenceRuntimeStateParityTargeted: true,
    knowledgeDomainReceiptParityClaimed: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
  };
}

function lowerBoundedReinforcementRevision(program, baseResult) {
  const plan = buildReinforcementPlan(program);
  if (!plan) return null;

  const target = plan.claim.path;
  const knowledgePaths = new Set([target]);
  let transformed = rewriteKnowledgeAccessors(clone(program), knowledgePaths);
  const reserved = new Set(array(transformed.rules).map(rule => rule?.name).filter(Boolean));

  const allocateRule = (baseName) => {
    let ruleName = baseName;
    let suffix = 0;
    while (reserved.has(ruleName)) { suffix += 1; ruleName = `${baseName}_${suffix}`; }
    reserved.add(ruleName);
    return ruleName;
  };

  transformed.facets = array(transformed.facets).map(facet => (
    facet.path === target
      ? {
        ...facet,
        deferred: false,
        value: knowledgeRecord(plan.current),
        nativeKnowledgeRecordType: KNOWLEDGE_RECORD_TYPE,
        nativeKnowledgeMetadataRetained: true,
      }
      : facet
  ));

  const baseRule = allocateRule(`__rcl_foundation_knowledge_${sanitizeName(plan.baseDeclaration.name)}_0`);
  const revisionRule = allocateRule(`__rcl_foundation_knowledge_${sanitizeName(plan.revisionDeclaration.name)}_1_revision`);
  const baseWitness = `rcl:foundation:knowledge:${plan.baseDeclaration.name}`;
  const revisionWitness = `rcl:foundation:knowledge:${plan.revisionDeclaration.name}:revision`;

  const syntheticRules = [
    {
      kind: 'Emergence',
      name: baseRule,
      cause: `knowledge.${plan.baseDeclaration.name}`,
      when: trueExpression(),
      needs: [],
      alters: [{ target, expression: knowledgeRecord(plan.current) }],
      calls: [],
      preserves: [],
      witnesses: [baseWitness],
    },
    {
      kind: 'Emergence',
      name: revisionRule,
      cause: `knowledge.${plan.revisionDeclaration.name}`,
      when: trueExpression(),
      needs: [],
      alters: [{ target, expression: knowledgeRecord(plan.reinforced) }],
      calls: [],
      preserves: [],
      witnesses: [revisionWitness],
    },
  ];

  transformed = {
    ...transformed,
    knowledges: array(transformed.knowledges).filter(item => (
      item?.name !== plan.baseDeclaration.name && item?.name !== plan.revisionDeclaration.name
    )),
    rules: [...array(transformed.rules), ...syntheticRules],
    directives: array(transformed.directives).map((directive, index) => {
      if (index === 0) return { kind: 'Realize', rule: baseRule };
      if (index === 1) return { kind: 'Realize', rule: revisionRule };
      return directive;
    }),
  };

  const lowered = [
    {
      domain: 'knowledge',
      declaration: plan.baseDeclaration.name,
      directive: 'Learn',
      directiveIndex: 0,
      syntheticRule: baseRule,
      stateTargets: [target],
      claimCount: 1,
      claimPaths: [target],
      primitiveClaimCount: 1,
      revisionCount: 0,
      knowledgeMutationMode: 'claim-first-write',
      claimPath: target,
      evidenceCount: array(plan.current.evidence).length,
      formedAtRoot: plan.claimFormedAtRoot,
      formedAtRoots: [{ path: target, root: plan.claimFormedAtRoot }],
      witness: baseWitness,
      authorityClass: 'epistemic',
    },
    {
      domain: 'knowledge',
      declaration: plan.revisionDeclaration.name,
      directive: 'Learn',
      directiveIndex: 1,
      syntheticRule: revisionRule,
      stateTargets: [target],
      claimCount: 1,
      claimPaths: [target],
      primitiveClaimCount: 0,
      revisionCount: 1,
      revisionPaths: [target],
      knowledgeMutationMode: 'revision-existing-target',
      revisionSemantics: 'same-value-reinforcement',
      claimPath: target,
      evidenceCount: array(plan.reinforced.evidence).length,
      formedAtRoot: plan.revisionFormedAtRoot,
      formedAtRoots: [{ path: target, root: plan.revisionFormedAtRoot }],
      witness: revisionWitness,
      authorityClass: 'epistemic',
    },
  ];

  return {
    ...baseResult,
    format: FOUNDATION_KNOWLEDGE_REVISION_DIRECT_LOWERING_FORMAT,
    version: FOUNDATION_KNOWLEDGE_REVISION_DIRECT_LOWERING_VERSION,
    program: transformed,
    lowered,
    diagnostics: [],
    summary: {
      loweredCount: 2,
      knowledgeLoweredDeclarationCount: 2,
      consumedDirectiveCount: 2,
      syntheticRuleCount: 2,
      remainingKnowledgeCount: transformed.knowledges.length,
      nativeKnowledgeRecordCount: 2,
      boundedDerivedKnowledgeCount: 0,
      boundedKnowledgeRevisionCount: 1,
      boundedSameValueReinforcementRevisionCount: 1,
      formedAtRoot: plan.claimFormedAtRoot,
      formedAtRoots: [
        { phase: 'claim', path: target, root: plan.claimFormedAtRoot },
        { phase: 'revision', path: target, root: plan.revisionFormedAtRoot },
      ],
    },
    truthBoundary: revisionTruthBoundary(),
  };
}

export function lowerDeclaredKnowledgeToCore(program) {
  const existing = lowerExistingKnowledgeToCore(program);
  if (existing?.summary?.knowledgeLoweredDeclarationCount > 0) return existing;

  const learns = array(program?.directives).filter(item => item?.kind === 'Learn');
  const learnedNames = new Set(learns.map(item => item?.name));
  const hasRevisionCandidate = array(program?.knowledges).some(item => (
    learnedNames.has(item?.name) && array(item?.revisions).length > 0
  ));
  if (!hasRevisionCandidate) return existing;

  return lowerBoundedReinforcementRevision(program, existing) ?? existing;
}
