import { realityRoot } from './canonical.mjs';
import { knowledgeClaim } from './knowledge.mjs';

export const FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-knowledge-direct-lowering.v0.3';
export const FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_VERSION = '0.3.0';
export const FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS = 4;
export const FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS = 2;

const KNOWLEDGE_RECORD_TYPE = 'taowind.rcl.native.Knowledge.v0.1';
const PRIMITIVE_KNOWLEDGE_TYPES = new Set(['Number', 'Text', 'Truth']);

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
function diagnostic(code, message, details = {}) { return { code, message, details }; }
function unique(values) { return new Set(values).size === values.length; }

function allocateSyntheticRuleName(baseRuleName, reservedNames) {
  let ruleName = baseRuleName;
  let suffix = 0;
  while (reservedNames.has(ruleName)) { suffix += 1; ruleName = `${baseRuleName}_${suffix}`; }
  reservedNames.add(ruleName);
  return { ruleName, baseRuleName, renamed: ruleName !== baseRuleName };
}

function sequenceExpression(values) {
  let sequence = { kind: 'CallExpr', name: 'empty_sequence', args: [] };
  for (const value of values) {
    sequence = {
      kind: 'CallExpr',
      name: 'sequence_append',
      args: [sequence, literal('Text', String(value))],
    };
  }
  return sequence;
}

function initialLiteralState(program) {
  const state = {};
  for (const facet of array(program.facets)) {
    if (facet?.deferred === true) continue;
    if (facet?.value?.kind !== 'LiteralExpr') return null;
    state[facet.path] = facet.value.value;
  }
  return state;
}

function staticPrimitiveExpressionValue(expression, state) {
  if (expression?.kind === 'LiteralExpr') {
    return { supported: true, value: expression.value };
  }
  if (
    expression?.kind === 'PathExpr'
    && typeof expression.path === 'string'
    && Object.prototype.hasOwnProperty.call(state, expression.path)
  ) {
    const value = state[expression.path];
    if (value === null || ['number', 'string', 'boolean'].includes(typeof value)) {
      return { supported: true, value };
    }
  }
  return { supported: false, value: undefined };
}

function claimSupported(claim, initialState) {
  if (!PRIMITIVE_KNOWLEDGE_TYPES.has(claim?.baseType)) return false;
  if (typeof claim?.path !== 'string' || claim.path.length === 0) return false;
  if (typeof claim?.source !== 'string' || claim.source.length === 0) return false;
  if (array(claim?.dependencies).length !== 0) return false;
  if (!array(claim?.evidence).every(item => typeof item === 'string')) return false;
  if (!staticPrimitiveExpressionValue(claim?.expression, initialState).supported) return false;
  if (claim?.confidence != null) {
    if (claim.confidence?.kind !== 'LiteralExpr' || typeof claim.confidence.value !== 'number') return false;
    if (!Number.isFinite(claim.confidence.value) || claim.confidence.value < 0 || claim.confidence.value > 1) return false;
  }
  return true;
}

function makeReferenceKnowledgeValue(claim, staticValue, formedAtRoot) {
  return knowledgeClaim(claim.baseType, staticValue, {
    confidence: claim?.confidence?.value ?? 1,
    evidence: array(claim.evidence),
    source: claim.source,
    scope: claim.scope ?? 'local',
    status: claim.status ?? 'provisional',
    dependencies: [],
    revision: 1,
    alternatives: [],
    formedAtRoot,
  });
}

function buildSequentialLearnFormationPlans(entries, initialState) {
  const working = clone(initialState);
  const plans = [];
  for (const entry of entries) {
    const plan = [];
    for (const claim of entry.claims) {
      const staticValue = staticPrimitiveExpressionValue(claim.expression, initialState);
      if (!staticValue.supported) return null;
      const formedAtRoot = realityRoot(working);
      let referenceValue;
      try {
        referenceValue = makeReferenceKnowledgeValue(claim, staticValue.value, formedAtRoot);
      } catch {
        return null;
      }
      plan.push({ path: claim.path, formedAtRoot, staticValue: staticValue.value });
      working[claim.path] = referenceValue;
    }
    plans.push(plan);
  }
  return plans;
}

function knowledgeRecord(claim, formedAtRoot) {
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

function isKnowledgePath(expr, paths) {
  return expr?.kind === 'PathExpr' && paths.has(expr.path);
}

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
      const threshold = value.args[1]
        ? rewriteKnowledgeAccessors(value.args[1], knowledgePaths)
        : literal('Number', 0.5);
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

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, rewriteKnowledgeAccessors(item, knowledgePaths)]),
  );
}

function boundedTruthBoundary(extra = {}) {
  return {
    boundedSingleClaimKnowledgeSubsetOnly: false,
    boundedPrimitiveMultiClaimKnowledgeSubsetOnly: true,
    boundedContiguousMultiLearnKnowledgeSubsetOnly: true,
    maxBoundedClaimCountPerLearn: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS,
    maxBoundedLearnDirectiveCount: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS,
    maxBoundedClaimCount: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS,
    exactlyOneFirstLearnDirectiveRequired: false,
    contiguousLeadingLearnDirectivesRequired: true,
    distinctLearnDeclarationNamesRequired: true,
    globallyUniqueLearnedClaimPathsRequired: true,
    directMultiClaimExpressionsRestrictedToLiteralOrInitialPrimitivePath: true,
    referenceSequentialClaimFormationRootsMustBePreserved: true,
    referenceSequentialFormationAcrossLearnTransactionsRequired: true,
    primitiveClaimTypesOnly: true,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    nativeKnowledgeRecordType: KNOWLEDGE_RECORD_TYPE,
    referenceRuntimeStateParityTargeted: true,
    knowledgeDomainReceiptParityClaimed: false,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    ...extra,
  };
}

export function lowerDeclaredKnowledgeToCore(program) {
  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    throw new TypeError('compiled RCL program object is required');
  }

  const diagnostics = [];
  const knowledges = array(program.knowledges);
  const learnDirectives = array(program.directives)
    .map((directive, index) => ({ directive, index }))
    .filter(item => item.directive?.kind === 'Learn');
  const initialState = initialLiteralState(program);

  let eligible = null;
  if (
    initialState !== null
    && learnDirectives.length >= 1
    && learnDirectives.length <= FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS
    && learnDirectives.every((item, index) => item.index === index)
    && unique(learnDirectives.map(item => item.directive?.name))
  ) {
    const entries = [];
    let valid = true;
    const allClaimPaths = [];
    for (const learn of learnDirectives) {
      const declaration = knowledges.find(item => item.name === learn.directive.name) ?? null;
      const claims = array(declaration?.claims);
      const claimPaths = claims.map(claim => claim?.path).filter(Boolean);
      const declarationValid = Boolean(
        declaration
        && claims.length >= 1
        && claims.length <= FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS
        && claimPaths.length === claims.length
        && unique(claimPaths)
        && array(declaration.derives).length === 0
        && array(declaration.revisions).length === 0
        && array(declaration.decays).length === 0
        && array(declaration.preserves).length === 0
        && claims.every(claim => claimSupported(claim, initialState))
      );
      if (!declarationValid) {
        valid = false;
        break;
      }
      allClaimPaths.push(...claimPaths);
      entries.push({
        declaration,
        claims,
        claimPaths,
        directiveIndex: learn.index,
      });
    }
    if (valid && unique(allClaimPaths)) {
      const formationPlans = buildSequentialLearnFormationPlans(entries, initialState);
      if (formationPlans?.length === entries.length && formationPlans.every((plan, index) => plan.length === entries[index].claims.length)) {
        eligible = entries.map((entry, index) => ({
          ...entry,
          formationPlan: formationPlans[index],
          formedAtRoot: formationPlans[index][0].formedAtRoot,
        }));
      }
    }
  }

  if (!eligible) {
    for (const declaration of knowledges) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED',
        `Knowledge reality '${declaration.name}' is outside the bounded direct-lowering subset`,
        {
          domain: 'knowledge',
          declaration: declaration.name,
          requirements: [
            `between 1 and ${FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS} distinct Learn directives, contiguous from directive index 0`,
            `between 1 and ${FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS} primitive claims per learned declaration with globally unique state paths`,
            'claim values must be literals or direct paths to pre-Learn primitive literal facets',
            'literal confidence in [0,1] when explicit',
            'explicit static source identity',
            'no dependencies, derives, revisions, decay, or preserve clauses',
            'all pre-Learn non-deferred facets must be primitive literals',
          ],
        },
      ));
    }
    return {
      format: FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_FORMAT,
      version: FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_VERSION,
      program: clone(program),
      lowered: [],
      diagnostics,
      summary: {
        loweredCount: 0,
        knowledgeLoweredDeclarationCount: 0,
        consumedDirectiveCount: 0,
        syntheticRuleCount: 0,
        remainingKnowledgeCount: knowledges.length,
        nativeKnowledgeRecordCount: 0,
        renamedSyntheticRuleCount: 0,
      },
      truthBoundary: boundedTruthBoundary(),
    };
  }

  const knowledgePaths = new Set(eligible.flatMap(item => item.claimPaths));
  let transformed = rewriteKnowledgeAccessors(clone(program), knowledgePaths);
  const reservedRuleNames = new Set(array(transformed.rules).map(rule => rule?.name).filter(Boolean));
  const syntheticRules = [];
  const lowered = [];
  const learnedNames = new Set();
  const ruleByDirectiveIndex = new Map();
  const allFormedAtRoots = [];
  let renamedSyntheticRuleCount = 0;
  let nativeKnowledgeRecordCount = 0;

  for (const item of eligible) {
    const declaration = array(transformed.knowledges).find(entry => entry.name === item.declaration.name);
    const claims = array(declaration?.claims);
    const formedRootByPath = new Map(item.formationPlan.map(entry => [entry.path, entry.formedAtRoot]));
    const recordsByPath = new Map(claims.map(claim => [
      claim.path,
      knowledgeRecord(claim, formedRootByPath.get(claim.path)),
    ]));

    transformed.facets = array(transformed.facets).map(facet => {
      if (facet.owner !== declaration.name || !item.claimPaths.includes(facet.path)) return facet;
      const record = recordsByPath.get(facet.path);
      if (!record) return facet;
      return {
        ...facet,
        deferred: false,
        value: record,
        nativeKnowledgeRecordType: KNOWLEDGE_RECORD_TYPE,
        nativeKnowledgeMetadataRetained: true,
      };
    });

    const allocation = allocateSyntheticRuleName(
      `__rcl_foundation_knowledge_${sanitizeName(declaration.name)}_${item.directiveIndex}`,
      reservedRuleNames,
    );
    if (allocation.renamed) {
      renamedSyntheticRuleCount += 1;
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_RULE_NAME_COLLISION_AVOIDED',
        `Synthetic knowledge rule '${allocation.baseRuleName}' would collide with an existing rule; allocated '${allocation.ruleName}' instead`,
        {
          declaration: declaration.name,
          requestedRuleName: allocation.baseRuleName,
          allocatedRuleName: allocation.ruleName,
        },
      ));
    }

    const witness = `rcl:foundation:knowledge:${declaration.name}`;
    const syntheticRule = {
      kind: 'Emergence',
      name: allocation.ruleName,
      cause: `knowledge.${declaration.name}`,
      when: trueExpression(),
      needs: [],
      alters: claims.map(claim => ({ target: claim.path, expression: recordsByPath.get(claim.path) })),
      calls: [],
      preserves: [],
      witnesses: [witness],
    };
    syntheticRules.push(syntheticRule);
    learnedNames.add(declaration.name);
    ruleByDirectiveIndex.set(item.directiveIndex, allocation.ruleName);

    const formedAtRoots = item.formationPlan.map(entry => ({ path: entry.path, root: entry.formedAtRoot }));
    allFormedAtRoots.push(...formedAtRoots);
    nativeKnowledgeRecordCount += claims.length;
    lowered.push({
      domain: 'knowledge',
      declaration: declaration.name,
      directive: 'Learn',
      directiveIndex: item.directiveIndex,
      syntheticRule: allocation.ruleName,
      stateTargets: [...item.claimPaths],
      claimCount: claims.length,
      claimPaths: [...item.claimPaths],
      claimPath: item.claimPaths[0],
      evidenceCount: claims.reduce((sum, claim) => sum + array(claim.evidence).length, 0),
      formedAtRoot: item.formedAtRoot,
      formedAtRoots,
      witness,
      authorityClass: 'epistemic',
    });
  }

  transformed = {
    ...transformed,
    knowledges: array(transformed.knowledges).filter(item => !learnedNames.has(item.name)),
    rules: [...array(transformed.rules), ...syntheticRules],
    directives: array(transformed.directives).map((directive, index) => (
      ruleByDirectiveIndex.has(index) ? { kind: 'Realize', rule: ruleByDirectiveIndex.get(index) } : directive
    )),
  };

  return {
    format: FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_FORMAT,
    version: FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_VERSION,
    program: transformed,
    lowered,
    diagnostics,
    summary: {
      loweredCount: lowered.length,
      knowledgeLoweredDeclarationCount: lowered.length,
      consumedDirectiveCount: lowered.length,
      syntheticRuleCount: syntheticRules.length,
      remainingKnowledgeCount: transformed.knowledges.length,
      nativeKnowledgeRecordCount,
      renamedSyntheticRuleCount,
      formedAtRoot: lowered[0]?.formedAtRoot ?? null,
      formedAtRoots: allFormedAtRoots,
      boundedLearnDirectiveCount: lowered.length,
    },
    truthBoundary: boundedTruthBoundary({
      literalConfidenceRequiredWhenExplicit: true,
      explicitSourceIdentityRequired: true,
      knowledgeValueConfidenceEvidenceSourceScopeStatusRevisionAndFormedRootsRetained: true,
      knowledgeAccessorsLoweredToTypedRecordFields: true,
      oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: true,
      multipleLearnDirectivesRemainSeparateOrderedAtomicTransactions: true,
    }),
  };
}
