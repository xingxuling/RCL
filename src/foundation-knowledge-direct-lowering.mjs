import { realityRoot } from './canonical.mjs';
import { knowledgeClaim } from './knowledge.mjs';

export const FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-knowledge-direct-lowering.v0.2';
export const FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_VERSION = '0.2.0';
export const FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS = 4;

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

function buildSequentialClaimFormationPlan(claims, initialState) {
  const working = clone(initialState);
  const plan = [];
  for (const claim of claims) {
    const staticValue = staticPrimitiveExpressionValue(claim.expression, initialState);
    if (!staticValue.supported) return null;
    const formedAtRoot = realityRoot(working);
    let referenceValue;
    try {
      referenceValue = knowledgeClaim(claim.baseType, staticValue.value, {
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
    } catch {
      return null;
    }
    plan.push({ path: claim.path, formedAtRoot, staticValue: staticValue.value });
    working[claim.path] = referenceValue;
  }
  return plan;
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
    maxBoundedClaimCount: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS,
    exactlyOneFirstLearnDirectiveRequired: true,
    directMultiClaimExpressionsRestrictedToLiteralOrInitialPrimitivePath: true,
    referenceSequentialClaimFormationRootsMustBePreserved: true,
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

  let eligible = null;
  if (learnDirectives.length === 1 && learnDirectives[0].index === 0) {
    const declaration = knowledges.find(item => item.name === learnDirectives[0].directive.name) ?? null;
    const claims = array(declaration?.claims);
    const claimPaths = claims.map(claim => claim?.path).filter(Boolean);
    const initialState = initialLiteralState(program);
    const formationPlan = initialState === null ? null : buildSequentialClaimFormationPlan(claims, initialState);
    if (
      declaration
      && claims.length >= 1
      && claims.length <= FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS
      && claimPaths.length === claims.length
      && unique(claimPaths)
      && array(declaration.derives).length === 0
      && array(declaration.revisions).length === 0
      && array(declaration.decays).length === 0
      && array(declaration.preserves).length === 0
      && initialState !== null
      && claims.every(claim => claimSupported(claim, initialState))
      && formationPlan?.length === claims.length
    ) {
      eligible = {
        declaration,
        claims,
        claimPaths,
        formationPlan,
        directiveIndex: learnDirectives[0].index,
        formedAtRoot: formationPlan[0].formedAtRoot,
      };
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
            'exactly one Learn directive and it must be the first directive',
            `between 1 and ${FOUNDATION_KNOWLEDGE_MAX_BOUNDED_CLAIMS} primitive claims with unique state paths`,
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

  const knowledgePaths = new Set(eligible.claimPaths);
  let transformed = rewriteKnowledgeAccessors(clone(program), knowledgePaths);
  const declaration = array(transformed.knowledges).find(item => item.name === eligible.declaration.name);
  const claims = array(declaration.claims);
  const formedRootByPath = new Map(eligible.formationPlan.map(item => [item.path, item.formedAtRoot]));
  const recordsByPath = new Map(claims.map(claim => [
    claim.path,
    knowledgeRecord(claim, formedRootByPath.get(claim.path)),
  ]));

  transformed.facets = array(transformed.facets).map(facet => {
    if (facet.owner !== declaration.name || !knowledgePaths.has(facet.path)) return facet;
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

  const reservedRuleNames = new Set(array(transformed.rules).map(rule => rule?.name).filter(Boolean));
  const allocation = allocateSyntheticRuleName(
    `__rcl_foundation_knowledge_${sanitizeName(declaration.name)}_${eligible.directiveIndex}`,
    reservedRuleNames,
  );
  if (allocation.renamed) {
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

  transformed = {
    ...transformed,
    knowledges: array(transformed.knowledges).filter(item => item.name !== declaration.name),
    rules: [...array(transformed.rules), syntheticRule],
    directives: array(transformed.directives).map((directive, index) => (
      index === eligible.directiveIndex ? { kind: 'Realize', rule: allocation.ruleName } : directive
    )),
  };

  const formedAtRoots = eligible.formationPlan.map(item => ({ path: item.path, root: item.formedAtRoot }));
  const lowered = [{
    domain: 'knowledge',
    declaration: declaration.name,
    directive: 'Learn',
    directiveIndex: eligible.directiveIndex,
    syntheticRule: allocation.ruleName,
    stateTargets: [...eligible.claimPaths],
    claimCount: claims.length,
    claimPaths: [...eligible.claimPaths],
    claimPath: eligible.claimPaths[0],
    evidenceCount: claims.reduce((sum, claim) => sum + array(claim.evidence).length, 0),
    formedAtRoot: eligible.formedAtRoot,
    formedAtRoots,
    witness,
    authorityClass: 'epistemic',
  }];

  return {
    format: FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_FORMAT,
    version: FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_VERSION,
    program: transformed,
    lowered,
    diagnostics,
    summary: {
      loweredCount: 1,
      knowledgeLoweredDeclarationCount: 1,
      consumedDirectiveCount: 1,
      syntheticRuleCount: 1,
      remainingKnowledgeCount: transformed.knowledges.length,
      nativeKnowledgeRecordCount: claims.length,
      renamedSyntheticRuleCount: allocation.renamed ? 1 : 0,
      formedAtRoot: eligible.formedAtRoot,
      formedAtRoots,
    },
    truthBoundary: boundedTruthBoundary({
      literalConfidenceRequiredWhenExplicit: true,
      explicitSourceIdentityRequired: true,
      knowledgeValueConfidenceEvidenceSourceScopeStatusRevisionAndFormedRootsRetained: true,
      knowledgeAccessorsLoweredToTypedRecordFields: true,
      oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: true,
    }),
  };
}
