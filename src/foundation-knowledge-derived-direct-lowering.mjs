import { realityRoot } from './canonical.mjs';
import { knowledgeClaim, isKnowledge } from './knowledge.mjs';
import {
  FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS,
  FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS,
  lowerDeclaredKnowledgeToCore as lowerBaseKnowledgeToCore,
} from './foundation-knowledge-direct-lowering.mjs';

export { FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS, FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS };
export const FOUNDATION_KNOWLEDGE_DERIVED_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-knowledge-derived-direct-lowering.v0.1';
export const FOUNDATION_KNOWLEDGE_DERIVED_DIRECT_LOWERING_VERSION = '0.1.0';

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
function unique(values) { return new Set(values).size === values.length; }
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

function baseClaimSupported(spec, initialState) {
  return PRIMITIVE_TYPES.has(spec?.baseType)
    && typeof spec?.path === 'string'
    && spec.path.length > 0
    && typeof spec?.source === 'string'
    && spec.source.length > 0
    && array(spec?.dependencies).length === 0
    && array(spec?.evidence).every(item => typeof item === 'string')
    && staticPrimitive(spec?.expression, initialState).ok
    && confidenceSupported(spec);
}

function deriveSupported(spec, initialState) {
  const dependencies = array(spec?.dependencies);
  return PRIMITIVE_TYPES.has(spec?.baseType)
    && typeof spec?.path === 'string'
    && spec.path.length > 0
    && typeof spec?.source === 'string'
    && spec.source.length > 0
    && dependencies.length > 0
    && unique(dependencies)
    && dependencies.every(path => typeof path === 'string' && path.length > 0)
    && array(spec?.evidence).every(item => typeof item === 'string')
    && staticPrimitive(spec?.expression, initialState).ok
    && confidenceSupported(spec);
}

function knowledgeValue(spec, value, formedAtRoot, options = {}) {
  return knowledgeClaim(options.baseType ?? spec.baseType, value, {
    confidence: options.confidence ?? spec?.confidence?.value ?? 1,
    evidence: options.evidence ?? array(spec.evidence),
    source: options.source ?? spec.source,
    scope: options.scope ?? spec.scope ?? 'local',
    status: options.status ?? spec.status ?? 'provisional',
    dependencies: options.dependencies ?? array(spec.dependencies),
    revision: options.revision ?? 1,
    alternatives: [],
    formedAtRoot,
  });
}

function planLearn(entries, initialState) {
  const working = clone(initialState);
  const plans = [];
  for (const entry of entries) {
    const steps = [];
    for (const claim of entry.claims) {
      const evaluated = staticPrimitive(claim.expression, initialState);
      if (!evaluated.ok) return null;
      const formedAtRoot = realityRoot(working);
      let value;
      try {
        value = knowledgeValue(claim, evaluated.value, formedAtRoot, { dependencies: [], status: claim.status ?? 'provisional' });
      } catch {
        return null;
      }
      steps.push({ kind: 'claim', spec: claim, path: claim.path, formedAtRoot, value });
      working[claim.path] = value;
    }

    const pending = [...entry.derives];
    let passes = 0;
    while (pending.length > 0 && passes <= entry.derives.length + 1) {
      passes += 1;
      let progressed = false;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const derive = pending[index];
        const dependencies = array(derive.dependencies).map(path => working[path]);
        if (dependencies.length === 0 || dependencies.some(value => !isKnowledge(value))) continue;
        const evaluated = staticPrimitive(derive.expression, initialState);
        if (!evaluated.ok) return null;
        const formedAtRoot = realityRoot(working);
        const dependencyConfidence = Math.min(...dependencies.map(value => value.confidence));
        const explicitConfidence = derive?.confidence?.value ?? 1;
        const evidence = [...array(derive.evidence), ...dependencies.flatMap(value => array(value.evidence))];
        let value;
        try {
          value = knowledgeValue(derive, evaluated.value, formedAtRoot, {
            confidence: Math.min(explicitConfidence, dependencyConfidence),
            evidence,
            status: derive.status ?? 'derived',
            dependencies: array(derive.dependencies),
          });
        } catch {
          return null;
        }
        steps.push({ kind: 'derive', spec: derive, path: derive.path, formedAtRoot, value });
        working[derive.path] = value;
        pending.splice(index, 1);
        progressed = true;
      }
      if (!progressed) break;
    }
    if (pending.length > 0) return null;
    plans.push(steps);
  }
  return plans;
}

function knowledgeRecordFromClaim(claim, formedAtRoot) {
  return {
    kind: 'RecordConstructExpr',
    canonicalType: KNOWLEDGE_RECORD_TYPE,
    fields: [
      { name: 'kind', value: literal('Text', 'Knowledge') },
      { name: 'baseType', value: literal('Text', claim.baseType) },
      { name: 'value', value: clone(claim.expression) },
      { name: 'confidence', value: clone(claim.confidence ?? literal('Number', 1)) },
      { name: 'evidence', value: sequenceExpression(array(claim.evidence)) },
      { name: 'source', value: literal('Text', claim.source) },
      { name: 'scope', value: literal('Text', claim.scope ?? 'local') },
      { name: 'status', value: literal('Text', claim.status ?? 'provisional') },
      { name: 'dependencies', value: { kind: 'CallExpr', name: 'empty_sequence', args: [] } },
      { name: 'revision', value: literal('Number', 1) },
      { name: 'alternatives', value: { kind: 'CallExpr', name: 'empty_sequence', args: [] } },
      { name: 'formedAtRoot', value: literal('Text', formedAtRoot) },
    ],
  };
}

function knowledgeRecordFromDerived(value) {
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
      { name: 'status', value: literal('Text', value.status ?? 'derived') },
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
        kind: 'BinaryExpr', operator: 'and',
        left: { kind: 'UnaryExpr', operator: 'not', expression: { kind: 'BinaryExpr', operator: '==', left: field(clone(target), 'status'), right: literal('Text', 'forgotten') } },
        right: { kind: 'BinaryExpr', operator: '>=', left: field(clone(target), 'confidence'), right: threshold },
      };
    }
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteKnowledgeAccessors(item, knowledgePaths)]));
}

function truthBoundary(derivedCount) {
  return {
    boundedSingleClaimKnowledgeSubsetOnly: false,
    boundedPrimitiveMultiClaimKnowledgeSubsetOnly: true,
    boundedContiguousMultiLearnKnowledgeSubsetOnly: true,
    maxBoundedClaimCountPerLearn: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS,
    maxBoundedLearnDirectiveCount: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS,
    maxBoundedClaimCount: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS,
    contiguousLeadingLearnDirectivesRequired: true,
    distinctLearnDeclarationNamesRequired: true,
    globallyUniqueLearnedClaimPathsRequired: true,
    directMultiClaimExpressionsRestrictedToLiteralOrInitialPrimitivePath: true,
    referenceSequentialClaimFormationRootsMustBePreserved: true,
    referenceSequentialFormationAcrossLearnTransactionsRequired: true,
    primitiveClaimTypesOnly: true,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    boundedDerivedKnowledgeDependencySubsetNativeClaimed: derivedCount > 0,
    boundedDerivedDependenciesMustResolveWithinLeadingKnowledgeTransactions: true,
    boundedDerivedExpressionsRestrictedToLiteralOrInitialPrimitivePath: true,
    boundedDerivedDependencyConfidenceUsesMinimumBound: true,
    boundedDerivedDependencyEvidencePropagationPreserved: true,
    unrestrictedDependenciesDerivedKnowledgeRevisionsAndDecayRemainProviderBound: true,
    revisionsAndDecayRemainProviderBound: true,
    nativeKnowledgeRecordType: KNOWLEDGE_RECORD_TYPE,
    referenceRuntimeStateParityTargeted: true,
    knowledgeDomainReceiptParityClaimed: false,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    literalConfidenceRequiredWhenExplicit: true,
    explicitSourceIdentityRequired: true,
    knowledgeValueConfidenceEvidenceSourceScopeStatusRevisionAndFormedRootsRetained: true,
    knowledgeAccessorsLoweredToTypedRecordFields: true,
    oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: true,
    multipleLearnDirectivesRemainSeparateOrderedAtomicTransactions: true,
  };
}

function extendedLowering(program, baseResult) {
  const knowledges = array(program?.knowledges);
  const learnDirectives = array(program?.directives)
    .map((directive, index) => ({ directive, index }))
    .filter(item => item.directive?.kind === 'Learn');
  const initialState = initialLiteralState(program);
  if (
    initialState === null
    || learnDirectives.length < 1
    || learnDirectives.length > FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS
    || !learnDirectives.every((item, index) => item.index === index)
    || !unique(learnDirectives.map(item => item.directive?.name))
  ) return null;

  const entries = [];
  const allTargets = [];
  let totalDerived = 0;
  for (const learn of learnDirectives) {
    const declaration = knowledges.find(item => item.name === learn.directive.name) ?? null;
    const claims = array(declaration?.claims);
    const derives = array(declaration?.derives);
    const targets = [...claims.map(item => item?.path), ...derives.map(item => item?.path)];
    if (
      !declaration
      || derives.length < 1
      || claims.length < 1
      || targets.length < 1
      || targets.length > FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS
      || targets.some(path => typeof path !== 'string' || path.length === 0)
      || !unique(targets)
      || array(declaration.revisions).length !== 0
      || array(declaration.decays).length !== 0
      || array(declaration.preserves).length !== 0
      || !claims.every(claim => baseClaimSupported(claim, initialState))
      || !derives.every(derive => deriveSupported(derive, initialState))
    ) return null;
    allTargets.push(...targets);
    totalDerived += derives.length;
    entries.push({ declaration, claims, derives, targets, directiveIndex: learn.index });
  }
  if (!unique(allTargets)) return null;

  const plans = planLearn(entries, initialState);
  if (!plans || plans.length !== entries.length || !plans.every((plan, index) => plan.length === entries[index].targets.length)) return null;

  const knowledgePaths = new Set(allTargets);
  let transformed = rewriteKnowledgeAccessors(clone(program), knowledgePaths);
  const reserved = new Set(array(transformed.rules).map(rule => rule?.name).filter(Boolean));
  const syntheticRules = [];
  const learnedNames = new Set();
  const ruleByDirective = new Map();
  const lowered = [];
  const allFormedAtRoots = [];
  let renamedSyntheticRuleCount = 0;
  let nativeKnowledgeRecordCount = 0;

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const item = entries[entryIndex];
    const plan = plans[entryIndex];
    const declaration = array(transformed.knowledges).find(entry => entry.name === item.declaration.name);
    const records = new Map();
    for (const step of plan) {
      records.set(step.path, step.kind === 'claim'
        ? knowledgeRecordFromClaim(step.spec, step.formedAtRoot)
        : knowledgeRecordFromDerived(step.value));
    }
    transformed.facets = array(transformed.facets).map(facet => (
      facet.owner === declaration.name && records.has(facet.path)
        ? { ...facet, deferred: false, value: records.get(facet.path), nativeKnowledgeRecordType: KNOWLEDGE_RECORD_TYPE, nativeKnowledgeMetadataRetained: true }
        : facet
    ));

    const baseName = `__rcl_foundation_knowledge_${sanitizeName(declaration.name)}_${item.directiveIndex}`;
    let ruleName = baseName;
    let suffix = 0;
    while (reserved.has(ruleName)) { suffix += 1; ruleName = `${baseName}_${suffix}`; }
    reserved.add(ruleName);
    if (ruleName !== baseName) renamedSyntheticRuleCount += 1;
    const witness = `rcl:foundation:knowledge:${declaration.name}`;
    syntheticRules.push({
      kind: 'Emergence', name: ruleName, cause: `knowledge.${declaration.name}`, when: trueExpression(),
      needs: [], alters: plan.map(step => ({ target: step.path, expression: records.get(step.path) })), calls: [], preserves: [], witnesses: [witness],
    });
    learnedNames.add(declaration.name);
    ruleByDirective.set(item.directiveIndex, ruleName);

    const targets = plan.map(step => step.path);
    const formedAtRoots = plan.map(step => ({ path: step.path, root: step.formedAtRoot }));
    allFormedAtRoots.push(...formedAtRoots);
    nativeKnowledgeRecordCount += targets.length;
    lowered.push({
      domain: 'knowledge', declaration: declaration.name, directive: 'Learn', directiveIndex: item.directiveIndex,
      syntheticRule: ruleName, stateTargets: targets, claimCount: targets.length, claimPaths: targets,
      primitiveClaimCount: item.claims.length, primitiveClaimPaths: item.claims.map(claim => claim.path),
      derivedKnowledgeCount: item.derives.length, derivedKnowledgePaths: item.derives.map(derive => derive.path),
      dependencyEdgeCount: item.derives.reduce((sum, derive) => sum + array(derive.dependencies).length, 0),
      claimPath: targets[0],
      evidenceCount: plan.reduce((sum, step) => sum + array(step.value?.evidence).length, 0),
      formedAtRoot: plan[0].formedAtRoot, formedAtRoots, witness, authorityClass: 'epistemic',
    });
  }

  transformed = {
    ...transformed,
    knowledges: array(transformed.knowledges).filter(item => !learnedNames.has(item.name)),
    rules: [...array(transformed.rules), ...syntheticRules],
    directives: array(transformed.directives).map((directive, index) => (
      ruleByDirective.has(index) ? { kind: 'Realize', rule: ruleByDirective.get(index) } : directive
    )),
  };

  return {
    ...baseResult,
    format: FOUNDATION_KNOWLEDGE_DERIVED_DIRECT_LOWERING_FORMAT,
    version: FOUNDATION_KNOWLEDGE_DERIVED_DIRECT_LOWERING_VERSION,
    program: transformed,
    lowered,
    diagnostics: [],
    summary: {
      loweredCount: lowered.length,
      knowledgeLoweredDeclarationCount: lowered.length,
      consumedDirectiveCount: lowered.length,
      syntheticRuleCount: syntheticRules.length,
      remainingKnowledgeCount: transformed.knowledges.length,
      nativeKnowledgeRecordCount,
      boundedDerivedKnowledgeCount: totalDerived,
      renamedSyntheticRuleCount,
      formedAtRoot: lowered[0]?.formedAtRoot ?? null,
      formedAtRoots: allFormedAtRoots,
      boundedLearnDirectiveCount: lowered.length,
    },
    truthBoundary: truthBoundary(totalDerived),
  };
}

export function lowerDeclaredKnowledgeToCore(program) {
  const base = lowerBaseKnowledgeToCore(program);
  if (base?.summary?.knowledgeLoweredDeclarationCount > 0) return base;
  const learnedNames = new Set(array(program?.directives).filter(item => item?.kind === 'Learn').map(item => item.name));
  const hasDerivedCandidate = array(program?.knowledges).some(item => learnedNames.has(item?.name) && array(item?.derives).length > 0);
  if (!hasDerivedCandidate) return base;
  return extendedLowering(program, base) ?? base;
}
