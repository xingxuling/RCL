import { parseReality } from './parser.mjs';
import { realityRoot } from './canonical.mjs';

export const MOTHER_STRUCTURE_IR_VERSION = '0.1.0-alpha.1';
export const MOTHER_STRUCTURE_IR_FORMAT = 'rcl.mother-structure.ir.v0.1';
export const MOTHER_STRUCTURE_CORPUS_FORMAT = 'rcl.mother-structure.corpus.v0.1';
export const MOTHER_STRUCTURE_STATUS = 'CANDIDATE_ONLY';

export const MOTHER_STRUCTURE_CLASSIFICATIONS = Object.freeze([
  'FRAMEWORK_CANDIDATE',
  'STD_CANDIDATE',
  'PACK',
  'EXAMPLE',
  'RCL_GAP_CANDIDATE',
  'AUXILIARY_LANGUAGE_PROVIDER',
]);

const FRAMEWORK_STRUCTURE_IDS = new Set([
  'rcl.rule.authorized_transition',
]);

const STD_STRUCTURE_IDS = new Set([
  'rcl.facet.declaration',
  'rcl.authority.subject_warrant',
  'rcl.provider.host_offer',
  'rcl.rule.foresee_realize',
]);

const PACK_PREFIXES = [
  'rcl.ui.',
  'package.',
  'forge.',
  'evidence.',
  'platform.',
  'json.',
];

const AUXILIARY_PREFIXES = [
  'implementation.',
  'implementation_',
  'aux.',
];

const MOTHER_STRUCTURE_TOP_LEVEL_KINDS = new Set([
  'FacetDecl',
  'SubjectDecl',
  'HostDecl',
  'ReckonDecl',
  'MetaDecl',
  'DialectDecl',
  'EffectDecl',
  'CapabilityPolicyDecl',
  'StoreDecl',
  'Emergence',
  'Resonance',
  'Foresee',
  'Realize',
  'NativeUIDecl',
]);

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(message);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortedUnique(values) {
  return [...new Set(values.filter(value => value !== null && value !== undefined).map(String))].sort();
}

function pathShape(value) {
  const text = String(value ?? '');
  return {
    depth: text ? text.split('.').length : 0,
    qualified: text.includes('.'),
  };
}

function typeShape(value) {
  const text = String(value ?? '');
  const genericStart = text.indexOf('<');
  if (genericStart < 0) return { qualifiedDepth: text ? text.split('.').length : 0, genericArity: 0 };
  const args = text.slice(genericStart + 1, -1);
  return {
    qualifiedDepth: text.slice(0, genericStart).split('.').length,
    genericArity: args ? args.split(',').length : 0,
  };
}

function expressionShape(expression) {
  if (!expression || typeof expression !== 'object') return { kind: 'missing' };
  if (expression.kind === 'BinaryExpr') return { kind: 'binary', operator: expression.operator };
  if (expression.kind === 'UnaryExpr') return { kind: 'unary', operator: expression.operator };
  if (expression.kind === 'CallExpr') return { kind: 'call', arity: asArray(expression.args).length };
  if (expression.kind === 'PathExpr') return { kind: 'path', ...pathShape(expression.path) };
  if (expression.kind === 'RecordLiteralExpr') return { kind: 'record', fieldCount: asArray(expression.fields).length };
  if (expression.kind === 'ListLiteralExpr') return { kind: 'list', itemCount: asArray(expression.items).length };
  if (expression.kind === 'MatchUnionExpr') {
    return {
      kind: 'match',
      caseCount: asArray(expression.cases).length,
      wildcardCount: asArray(expression.cases).filter(item => item?.wildcard).length,
    };
  }
  if (expression.kind === 'LiteralExpr') return { kind: 'literal', valueType: expression.valueType ?? 'unknown' };
  return { kind: 'unknown', nodeKind: String(expression.kind ?? 'unknown') };
}

function expressionShapes(expressions) {
  return asArray(expressions).map(expressionShape);
}

function addSymbol(nodes, id, label, classes = []) {
  const existing = nodes.find(node => node.id === id);
  if (existing) {
    existing.classes = sortedUnique([...(existing.classes ?? []), ...classes]);
    return;
  }
  nodes.push({ id, label, classes: sortedUnique(classes) });
}

function addRelation(relations, source, predicate, target, relationClass = predicate) {
  relations.push({ source, predicate, target, relationClass });
}

function finalizeGraph(nodes = [], relations = []) {
  const symbolMap = new Map();
  for (const node of nodes) {
    if (!node?.id) continue;
    const existing = symbolMap.get(node.id);
    if (existing) existing.classes = sortedUnique([...(existing.classes ?? []), ...(node.classes ?? [])]);
    else symbolMap.set(node.id, { id: String(node.id), label: String(node.label ?? node.id), classes: sortedUnique(node.classes ?? []) });
  }
  const symbols = [...symbolMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  const symbolIds = new Set(symbols.map(node => node.id));
  const relationMap = new Map();
  for (const relation of relations) {
    if (!relation?.source || !relation?.target || !symbolIds.has(relation.source) || !symbolIds.has(relation.target)) continue;
    const relationClass = String(relation.relationClass ?? relation.predicate ?? 'related');
    const id = `${relation.source}|${relationClass}|${relation.target}`;
    if (!relationMap.has(id)) relationMap.set(id, {
      id,
      source: String(relation.source),
      predicate: String(relation.predicate ?? relationClass),
      target: String(relation.target),
      relationClass,
    });
  }
  const normalizedRelations = [...relationMap.values()].sort((left, right) => left.id.localeCompare(right.id));
  return { symbols, relations: normalizedRelations };
}

function normalizeSource(program, options = {}) {
  const sourcePath = options.sourcePath === undefined || options.sourcePath === null ? null : String(options.sourcePath);
  const sourceSha256 = options.sourceSha256 === undefined || options.sourceSha256 === null ? null : String(options.sourceSha256);
  const evidenceRefs = sortedUnique(options.evidenceRefs ?? (sourcePath ? [sourcePath] : []));
  return {
    realityName: String(program.name),
    sourcePath,
    sourceSha256,
    scope: String(options.scope ?? 'unknown'),
    lineage: String(options.lineage ?? 'primary-or-example-source'),
    evidenceRefs,
  };
}

function makeStructure(structureId, graph, slots, metadata, ordinal, source) {
  const normalizedGraph = finalizeGraph(graph.nodes, graph.relations);
  const normalizedSlots = slots ?? {};
  const shapeRoot = realityRoot({ structureId, graph: normalizedGraph, slots: normalizedSlots });
  const instanceId = `mother.${realityRoot({
    shapeRoot,
    ordinal,
    sourcePath: source.sourcePath,
    sourceSha256: source.sourceSha256,
  }).slice(0, 32)}`;
  return {
    structureId,
    instanceId,
    shapeRoot,
    status: MOTHER_STRUCTURE_STATUS,
    graph: normalizedGraph,
    slots: normalizedSlots,
    fingerprints: {
      symbolClasses: sortedUnique(normalizedGraph.symbols.flatMap(node => node.classes ?? [])),
      relationClasses: sortedUnique(normalizedGraph.relations.map(relation => relation.relationClass)),
    },
    evidence: {
      sourcePath: source.sourcePath,
      sourceSha256: source.sourceSha256,
      scope: source.scope,
      lineage: source.lineage,
      evidenceRefs: source.evidenceRefs,
    },
    metadata: metadata ?? {},
  };
}

function buildRuleGraph(rule, directives = []) {
  const nodes = [{ id: 'rule', label: 'rule', classes: ['transition'] }];
  const relations = [];
  if (rule.cause) {
    addSymbol(nodes, 'actor', 'actor', ['cause']);
    addRelation(relations, 'rule', 'has_cause', 'actor');
  }
  if (rule.from) {
    addSymbol(nodes, 'source', 'source', ['subject']);
    addRelation(relations, 'rule', 'has_source', 'source');
  }
  if (rule.into) {
    addSymbol(nodes, 'target', 'target', ['subject']);
    addRelation(relations, 'rule', 'has_target', 'target');
  }
  if (rule.when) {
    addSymbol(nodes, 'guard', 'guard', ['condition']);
    addRelation(relations, 'rule', 'guarded_by', 'guard');
  }
  if (asArray(rule.needs).length) {
    addSymbol(nodes, 'capability', 'capability', ['authority']);
    addSymbol(nodes, 'resource', 'resource', ['authority']);
    addRelation(relations, 'rule', 'requires', 'capability');
    addRelation(relations, 'capability', 'scoped_to', 'resource');
  }
  if (asArray(rule.alters).length) {
    addSymbol(nodes, 'effect', 'effect', ['mutation']);
    addSymbol(nodes, 'state', 'state', ['mutable']);
    addRelation(relations, 'rule', 'has_effect', 'effect');
    addRelation(relations, 'effect', 'targets', 'state');
  }
  if (asArray(rule.preserves).length) {
    addSymbol(nodes, 'invariant', 'invariant', ['constraint']);
    addRelation(relations, 'rule', 'preserves', 'invariant');
  }
  if (asArray(rule.witnesses).length) {
    addSymbol(nodes, 'witness', 'witness', ['evidence']);
    addRelation(relations, 'rule', 'witnessed_by', 'witness');
  }
  if (asArray(rule.calls).length) {
    addSymbol(nodes, 'provider', 'provider', ['lowering']);
    addRelation(relations, 'rule', 'calls', 'provider');
  }
  for (const directive of sortedUnique(directives)) {
    const id = directive.toLowerCase();
    addSymbol(nodes, id, id, ['phase']);
    addRelation(relations, 'rule', directive === 'Foresee' ? 'foresees' : 'realizes', id);
  }
  return { nodes, relations };
}

function ruleIsComplete(rule) {
  const hasActor = Boolean(rule.cause) || (Boolean(rule.from) && Boolean(rule.into));
  return Boolean(
    hasActor
    && rule.when
    && asArray(rule.needs).length
    && asArray(rule.alters).length
    && asArray(rule.preserves).length
    && asArray(rule.witnesses).length,
  );
}

function ruleSlots(rule, directives) {
  return {
    hasCause: Boolean(rule.cause),
    hasSource: Boolean(rule.from),
    hasTarget: Boolean(rule.into),
    hasGuard: Boolean(rule.when),
    needs: asArray(rule.needs).length,
    alters: asArray(rule.alters).length,
    preserves: asArray(rule.preserves).length,
    witnesses: asArray(rule.witnesses).length,
    calls: asArray(rule.calls).length,
    foresee: directives.includes('Foresee'),
    realize: directives.includes('Realize'),
  };
}

function collectFacetEntries(node, ownerKind, entries) {
  if (!node || typeof node !== 'object') return;
  if (node.kind === 'FacetDecl') {
    entries.push({ node, ownerKind });
    return;
  }
  for (const key of ['facets', 'bodies', 'fields', 'systems', 'organs']) {
    for (const child of asArray(node[key])) collectFacetEntries(child, node.kind ?? ownerKind, entries);
  }
}

function extractFacet(add, facet, ownerKind) {
  add(
    'rcl.facet.declaration',
    {
      nodes: [
        { id: 'facet', label: 'facet' },
        { id: 'type', label: 'type' },
        { id: 'initial', label: 'initial_value' },
      ],
      relations: [
        { source: 'facet', predicate: 'typed_as', target: 'type' },
        { source: 'facet', predicate: 'initialized_by', target: 'initial' },
      ],
    },
    { pathDepth: pathShape(facet.path).depth, valueTypeShape: typeShape(facet.valueType), initialized: Boolean(facet.value) },
    {
      ownerKind,
      nested: ownerKind !== 'RealityProgram',
      valueType: facet.valueType ?? null,
      expressionShape: expressionShape(facet.value),
    },
  );
}

function extractSubject(add, subject) {
  const warrants = asArray(subject.warrants);
  if (!warrants.length) return;
  const conditionalCount = warrants.filter(item => item?.condition).length;
  const nodes = [
    { id: 'subject', label: 'subject' },
    { id: 'warrant', label: 'warrant' },
    { id: 'capability', label: 'capability' },
    { id: 'resource', label: 'resource' },
  ];
  const relations = [
    { source: 'subject', predicate: 'holds', target: 'warrant' },
    { source: 'warrant', predicate: 'grants', target: 'capability' },
    { source: 'capability', predicate: 'scoped_to', target: 'resource' },
  ];
  if (conditionalCount) {
    nodes.push({ id: 'condition', label: 'condition', classes: ['guard'] });
    relations.push({ source: 'warrant', predicate: 'guarded_by', target: 'condition' });
  }
  add(
    'rcl.authority.subject_warrant',
    { nodes, relations },
    { warrantCount: warrants.length, conditionalCount },
    {
      conditionalShapes: warrants.filter(item => item?.condition).map(item => expressionShape(item.condition)),
      capabilityPathDepths: warrants.map(item => pathShape(item.capability).depth),
      targetPathDepths: warrants.map(item => pathShape(item.target).depth),
    },
  );
}

function extractHost(add, host) {
  const offers = asArray(host.offers);
  if (!offers.length) return;
  add(
    'rcl.provider.host_offer',
    {
      nodes: [
        { id: 'host', label: 'host', classes: ['provider'] },
        { id: 'capability', label: 'capability' },
        { id: 'result', label: 'result_type' },
      ],
      relations: [
        { source: 'host', predicate: 'offers', target: 'capability' },
        { source: 'capability', predicate: 'returns', target: 'result' },
      ],
    },
    { offerCount: offers.length },
    { returnTypeShapes: offers.map(item => typeShape(item.returnType)) },
  );
}

function extractRule(add, rule, directivesByRule) {
  const directives = sortedUnique(directivesByRule.get(rule.name) ?? []);
  const complete = ruleIsComplete(rule);
  add(
    complete ? 'rcl.rule.authorized_transition' : 'rcl.rule.transition',
    buildRuleGraph(rule),
    ruleSlots(rule, directives),
    {
      ruleKind: rule.kind,
      complete,
      actorMode: rule.cause ? 'cause' : rule.from || rule.into ? 'from_into' : 'none',
      directives,
      expressionShapes: {
        when: expressionShape(rule.when),
        alters: asArray(rule.alters).map(item => expressionShape(item.expression)),
        preserves: expressionShapes(rule.preserves),
      },
    },
  );
  if (directives.includes('Foresee') && directives.includes('Realize')) {
    add(
      'rcl.rule.foresee_realize',
      buildRuleGraph(rule, directives),
      ruleSlots(rule, directives),
      { ruleKind: rule.kind, directivePair: true, directives },
    );
  }
}

function visitUiView(node, graphState) {
  if (!node || typeof node !== 'object') return;
  graphState.viewCount += 1;
  graphState.roleClasses.push(node.role ?? 'view');
  addSymbol(graphState.nodes, 'ui', 'ui', ['native-ui']);
  addSymbol(graphState.nodes, 'view', 'view', [node.role ?? 'view']);
  addRelation(graphState.relations, 'ui', 'declares_view', 'view');
  if (node.layout) {
    graphState.layoutCount += 1;
    addSymbol(graphState.nodes, 'layout', 'layout', [node.layout.mode ?? 'layout']);
    addRelation(graphState.relations, 'view', 'has_layout', 'layout');
  }
  const bindings = asArray(node.bindings);
  if (bindings.length) {
    graphState.bindingCount += bindings.length;
    addSymbol(graphState.nodes, 'binding', 'binding', ['state-binding']);
    addSymbol(graphState.nodes, 'state', 'state', ['ui-state']);
    addRelation(graphState.relations, 'view', 'binds', 'binding');
    addRelation(graphState.relations, 'binding', 'reads', 'state');
  }
  for (const event of asArray(node.events)) {
    graphState.eventCount += 1;
    addSymbol(graphState.nodes, 'event', 'event', [event.eventType ?? 'event']);
    addRelation(graphState.relations, 'view', 'handles', 'event');
    for (const statement of asArray(event.statements)) {
      if (statement.kind === 'UISetState') {
        graphState.setStateCount += 1;
        addSymbol(graphState.nodes, 'effect', 'state_effect', ['set-state']);
        addSymbol(graphState.nodes, 'state', 'state', ['ui-state']);
        addRelation(graphState.relations, 'event', 'sets_state', 'effect');
        addRelation(graphState.relations, 'effect', 'targets', 'state');
      } else if (statement.kind === 'UINavigate') {
        graphState.navigationEffectCount += 1;
        addSymbol(graphState.nodes, 'route', 'route', ['navigation']);
        addRelation(graphState.relations, 'event', 'navigates', 'route');
      } else if (statement.kind === 'UIRealizeReality') {
        graphState.realizationEffectCount += 1;
        addSymbol(graphState.nodes, 'rule', 'rule', ['realization']);
        addRelation(graphState.relations, 'event', 'realizes', 'rule');
      }
    }
  }
  for (const child of asArray(node.children)) visitUiView(child, graphState);
}

function extractUi(add, ui) {
  const uiBase = { stateTypes: asArray(ui.states).map(item => item.valueType), uiNamePresent: Boolean(ui.name) };
  if (asArray(ui.states).length) {
    add(
      'rcl.ui.state_declaration',
      {
        nodes: [
          { id: 'ui', label: 'ui' },
          { id: 'state', label: 'state' },
          { id: 'initial', label: 'initial_value' },
        ],
        relations: [
          { source: 'ui', predicate: 'declares_state', target: 'state' },
          { source: 'state', predicate: 'initialized_by', target: 'initial' },
        ],
      },
      { stateCount: asArray(ui.states).length },
      { ...uiBase, valueShapes: asArray(ui.states).map(item => expressionShape(item.expression)) },
    );
  }
  if (asArray(ui.derivedStates).length) {
    add(
      'rcl.ui.derived_state',
      {
        nodes: [
          { id: 'ui', label: 'ui' },
          { id: 'derived', label: 'derived_state' },
          { id: 'source', label: 'source_state' },
        ],
        relations: [
          { source: 'ui', predicate: 'declares_derived_state', target: 'derived' },
          { source: 'derived', predicate: 'depends_on', target: 'source' },
        ],
      },
      { derivedStateCount: asArray(ui.derivedStates).length },
      { valueShapes: asArray(ui.derivedStates).map(item => expressionShape(item.expression)) },
    );
  }

  const graphState = {
    nodes: [],
    relations: [],
    viewCount: 0,
    bindingCount: 0,
    eventCount: 0,
    setStateCount: 0,
    navigationEffectCount: 0,
    realizationEffectCount: 0,
    layoutCount: 0,
    roleClasses: [],
  };
  for (const root of asArray(ui.viewTrees)) visitUiView(root, graphState);
  if (graphState.viewCount) {
    add(
      'rcl.ui.view_tree',
      graphState,
      {
        viewCount: graphState.viewCount,
        bindingCount: graphState.bindingCount,
        eventCount: graphState.eventCount,
        setStateCount: graphState.setStateCount,
        navigationEffectCount: graphState.navigationEffectCount,
        realizationEffectCount: graphState.realizationEffectCount,
        layoutCount: graphState.layoutCount,
      },
      { roleClasses: sortedUnique(graphState.roleClasses) },
    );
  }
  if (graphState.bindingCount && graphState.setStateCount) {
    add(
      'rcl.ui.state_binding_event',
      {
        nodes: [
          { id: 'state', label: 'state' },
          { id: 'view', label: 'view' },
          { id: 'event', label: 'event' },
          { id: 'effect', label: 'effect' },
        ],
        relations: [
          { source: 'state', predicate: 'binds_to', target: 'view' },
          { source: 'view', predicate: 'handles', target: 'event' },
          { source: 'event', predicate: 'produces', target: 'effect' },
          { source: 'effect', predicate: 'targets', target: 'state' },
        ],
      },
      { bindingCount: graphState.bindingCount, setStateCount: graphState.setStateCount },
      { navigationEffectCount: graphState.navigationEffectCount, realizationEffectCount: graphState.realizationEffectCount },
    );
  }
  if (ui.lifecycle) {
    add(
      'rcl.ui.lifecycle_restore',
      {
        nodes: [
          { id: 'ui', label: 'ui' },
          { id: 'lifecycle', label: 'lifecycle' },
          { id: 'state', label: 'restorable_state' },
        ],
        relations: [
          { source: 'ui', predicate: 'has_lifecycle', target: 'lifecycle' },
          { source: 'lifecycle', predicate: 'restores', target: 'state' },
        ],
      },
      { stageCount: asArray(ui.lifecycle.stages).length, restoreCount: asArray(ui.lifecycle.restore).length },
      { restorePresent: Boolean(asArray(ui.lifecycle.restore).length) },
    );
  }
  if (ui.navigation) {
    add(
      'rcl.ui.navigation_routes',
      {
        nodes: [
          { id: 'ui', label: 'ui' },
          { id: 'router', label: 'router' },
          { id: 'route', label: 'route' },
          { id: 'view', label: 'view' },
        ],
        relations: [
          { source: 'ui', predicate: 'has_navigation', target: 'router' },
          { source: 'router', predicate: 'declares_route', target: 'route' },
          { source: 'route', predicate: 'targets_view', target: 'view' },
        ],
      },
      { routeCount: asArray(ui.navigation.routes).length, initialPresent: Boolean(ui.navigation.initial) },
      { initialDeclared: Boolean(ui.navigation.initial) },
    );
  }
  if (ui.deviceAdaptation) {
    add(
      'rcl.ui.device_adaptation',
      {
        nodes: [
          { id: 'ui', label: 'ui' },
          { id: 'profile', label: 'device_profile' },
          { id: 'layout', label: 'adaptive_layout' },
        ],
        relations: [
          { source: 'ui', predicate: 'has_profile', target: 'profile' },
          { source: 'profile', predicate: 'selects_layout', target: 'layout' },
        ],
      },
      { profileCount: asArray(ui.deviceAdaptation.profiles).length, defaultPresent: Boolean(ui.deviceAdaptation.defaultProfile) },
      { boundedProfileCount: asArray(ui.deviceAdaptation.profiles).filter(item => item.minWidth !== null || item.maxWidth !== null).length },
    );
  }
  if (asArray(ui.themes).length || asArray(ui.styles).length) {
    const propertyCount = asArray(ui.themes).reduce((sum, item) => sum + asArray(item.declarations).length, 0)
      + asArray(ui.styles).reduce((sum, item) => sum + asArray(item.declarations).length, 0);
    add(
      'rcl.ui.style_theme',
      {
        nodes: [
          { id: 'ui', label: 'ui' },
          { id: 'theme', label: 'theme' },
          { id: 'style', label: 'style' },
          { id: 'property', label: 'property' },
        ],
        relations: [
          { source: 'ui', predicate: 'has_theme', target: 'theme' },
          { source: 'ui', predicate: 'has_style', target: 'style' },
          { source: 'style', predicate: 'declares_property', target: 'property' },
        ],
      },
      { themeCount: asArray(ui.themes).length, styleCount: asArray(ui.styles).length, propertyCount },
      { selectorKinds: sortedUnique(asArray(ui.styles).map(item => item.selector?.kind)) },
    );
  }
}

function extractReckon(add, node) {
  add(
    'rcl.reckon.function_contract',
    {
      nodes: [
        { id: 'reckon', label: 'reckon' },
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
        { id: 'body', label: 'expression' },
      ],
      relations: [
        { source: 'reckon', predicate: 'accepts', target: 'input' },
        { source: 'reckon', predicate: 'returns', target: 'output' },
        { source: 'reckon', predicate: 'defined_by', target: 'body' },
      ],
    },
    { parameterCount: asArray(node.params).length, returnTypeShape: typeShape(node.returnType) },
    { expressionShape: expressionShape(node.expression), parameterTypeShapes: asArray(node.params).map(item => typeShape(item.valueType)) },
  );
}

function extractDialect(add, node) {
  const operations = asArray(node.operations);
  const nodes = [{ id: 'dialect', label: 'dialect' }];
  const relations = [];
  if (operations.length) {
    addSymbol(nodes, 'operation', 'operation', ['semantic-operation']);
    addRelation(relations, 'dialect', 'declares', 'operation');
  }
  if (node.lowersTo?.length || operations.some(item => asArray(item.lowersTo).length)) {
    addSymbol(nodes, 'target', 'lowering_target', ['lowering']);
    addRelation(relations, 'dialect', 'lowers_to', 'target');
  }
  if (asArray(node.invariants).length) {
    addSymbol(nodes, 'invariant', 'invariant', ['constraint']);
    addRelation(relations, 'dialect', 'preserves', 'invariant');
  }
  if (operations.some(item => asArray(item.effects).length)) {
    addSymbol(nodes, 'effect', 'effect', ['effect']);
    addRelation(relations, 'operation', 'declares_effect', 'effect');
  }
  add(
    'rcl.dialect.lowering_contract',
    { nodes, relations },
    {
      operationCount: operations.length,
      loweringCount: asArray(node.lowersTo).length + operations.reduce((sum, item) => sum + asArray(item.lowersTo).length, 0),
      invariantCount: asArray(node.invariants).length,
      effectCount: operations.reduce((sum, item) => sum + asArray(item.effects).length, 0),
    },
    { layer: node.layer ?? null, domainPresent: Boolean(node.domain) },
  );
}

function extractEffect(add, node) {
  add(
    'rcl.effect.replay_contract',
    {
      nodes: [
        { id: 'effect', label: 'effect' },
        { id: 'replay', label: 'replay_policy' },
        { id: 'evidence', label: 'evidence_requirement' },
        { id: 'target', label: 'lowering_target' },
      ],
      relations: [
        { source: 'effect', predicate: 'has_replay_policy', target: 'replay' },
        { source: 'effect', predicate: 'requires_evidence', target: 'evidence' },
        { source: 'effect', predicate: 'lowers_to', target: 'target' },
      ],
    },
    { deterministic: Boolean(node.deterministic), evidenceRequired: Boolean(node.evidenceRequired), loweringCount: asArray(node.lowersTo).length },
    { replayPresent: Boolean(node.replay) },
  );
}

function extractCapabilityPolicy(add, node) {
  const nodes = [{ id: 'policy', label: 'capability_policy' }];
  const relations = [];
  const addPolicyClass = (id, label, predicate, values, classes = []) => {
    if (!asArray(values).length) return;
    addSymbol(nodes, id, label, classes);
    addRelation(relations, 'policy', predicate, id);
  };
  addPolicyClass('effect', 'effect', 'governs_effect', [...asArray(node.allowedEffects), ...asArray(node.deniedEffects)]);
  addPolicyClass('capability', 'capability', 'allows_capability', node.capabilities, ['authority']);
  addPolicyClass('host', 'host_capability', 'allows_host', node.hostCapabilities, ['provider']);
  if (Object.keys(node.budget ?? {}).length) addPolicyClass('budget', 'budget', 'bounds', Object.keys(node.budget));
  add(
    'rcl.authority.capability_policy',
    { nodes, relations },
    {
      allowedEffectCount: asArray(node.allowedEffects).length,
      deniedEffectCount: asArray(node.deniedEffects).length,
      capabilityCount: asArray(node.capabilities).length,
      hostCapabilityCount: asArray(node.hostCapabilities).length,
      budgetCount: Object.keys(node.budget ?? {}).length,
    },
    { deterministicReplayRequired: Boolean(node.requireDeterministicReplay) },
  );
}

function extractStore(add, node) {
  add(
    'rcl.store.persistence_contract',
    {
      nodes: [
        { id: 'store', label: 'store' },
        { id: 'branch', label: 'branch' },
        { id: 'commit', label: 'commit' },
      ],
      relations: [
        { source: 'store', predicate: 'declares_branch', target: 'branch' },
        { source: 'store', predicate: 'declares_commit', target: 'commit' },
      ],
    },
    { branchCount: asArray(node.branches).length, commitCount: asArray(node.commits).length },
    {},
  );
}

function extractMeta(add, node) {
  if (!asArray(node.inspections).length && !asArray(node.revisions).length && !asArray(node.preserves).length) return;
  add(
    'rcl.meta.revision_contract',
    {
      nodes: [
        { id: 'meta', label: 'meta' },
        { id: 'inspection', label: 'inspection' },
        { id: 'revision', label: 'revision' },
        { id: 'invariant', label: 'invariant' },
      ],
      relations: [
        { source: 'meta', predicate: 'inspects', target: 'inspection' },
        { source: 'meta', predicate: 'revises', target: 'revision' },
        { source: 'meta', predicate: 'preserves', target: 'invariant' },
      ],
    },
    { inspectionCount: asArray(node.inspections).length, revisionCount: asArray(node.revisions).length, preserveCount: asArray(node.preserves).length },
    {},
  );
}

function normalizeStructureObservation(row) {
  assertObject(row, 'Mother Structure observation must be an object');
  if (!row.structureId) throw new TypeError('Mother Structure observation requires structureId');
  if (row.status !== undefined && row.status !== MOTHER_STRUCTURE_STATUS && row.status !== 'CANDIDATE') {
    throw new TypeError(`Mother Structure observation is not candidate-only: ${String(row.status)}`);
  }
  const graph = finalizeGraph(row.graph?.symbols ?? row.graph?.nodes ?? [], row.graph?.relations ?? row.graph?.edges ?? []);
  const evidence = row.evidence ?? {};
  const sourcePath = evidence.sourcePath ?? row.sourcePath ?? null;
  const sourceSha256 = evidence.sourceSha256 ?? row.sourceSha256 ?? null;
  const scope = String(evidence.scope ?? row.scope ?? 'unknown');
  const lineage = String(evidence.lineage ?? row.metadata?.lineage ?? 'primary-or-example-source');
  const slots = row.slots ?? row.metadata?.slotCounts ?? {};
  const shapeRoot = row.shapeRoot ?? realityRoot({ structureId: row.structureId, graph, slots });
  return {
    structureId: String(row.structureId),
    instanceId: String(row.instanceId ?? row.id ?? `observation.${realityRoot({ structureId: row.structureId, graph, sourcePath, sourceSha256 })}`),
    shapeRoot,
    status: MOTHER_STRUCTURE_STATUS,
    graph,
    slots,
    fingerprints: row.fingerprints ?? {
      symbolClasses: sortedUnique(graph.symbols.flatMap(node => node.classes ?? [])),
      relationClasses: sortedUnique(graph.relations.map(relation => relation.relationClass)),
    },
    evidence: {
      sourcePath,
      sourceSha256,
      scope,
      lineage,
      evidenceRefs: sortedUnique(evidence.evidenceRefs ?? row.metadata?.evidenceRefs ?? (sourcePath ? [sourcePath] : [])),
    },
    metadata: row.metadata ?? {},
    gapCandidate: row.gapCandidate === true
      || row.classification === 'RCL_GAP_CANDIDATE'
      || row.metadata?.classification === 'RCL_GAP_CANDIDATE',
  };
}

function addAstStructure(structures, source, ordinalState, structureId, graph, slots, metadata) {
  structures.push(makeStructure(structureId, graph, slots, metadata, ordinalState.value, source));
  ordinalState.value += 1;
}

export function buildMotherStructureIR(programOrSource, options = {}) {
  const program = typeof programOrSource === 'string' ? parseReality(programOrSource) : programOrSource;
  assertObject(program, 'Mother Structure IR requires a RealityProgram AST or RCL source string');
  if (program.kind !== 'RealityProgram' || typeof program.name !== 'string' || !Array.isArray(program.body)) {
    throw new TypeError('Mother Structure IR requires a RealityProgram AST with a body array');
  }

  const source = normalizeSource(program, options);
  const structures = [];
  const ordinalState = { value: 0 };
  const add = (structureId, graph, slots, metadata) => addAstStructure(structures, source, ordinalState, structureId, graph, slots, metadata);
  const directivesByRule = new Map();
  const ruleNames = new Set();
  const unresolvedDirectives = [];

  for (const node of program.body) {
    if (node?.kind === 'Emergence' || node?.kind === 'Resonance') ruleNames.add(node.name);
  }
  for (const node of program.body) {
    if (node?.kind !== 'Foresee' && node?.kind !== 'Realize') continue;
    if (!ruleNames.has(node.rule)) unresolvedDirectives.push({ kind: node.kind });
    const directives = directivesByRule.get(node.rule) ?? [];
    directives.push(node.kind);
    directivesByRule.set(node.rule, directives);
  }

  const facets = [];
  for (const node of program.body) {
    if (node?.kind === 'FacetDecl') collectFacetEntries(node, 'RealityProgram', facets);
    else collectFacetEntries(node, node?.kind ?? 'unknown', facets);
  }
  for (const entry of facets) extractFacet(add, entry.node, entry.ownerKind);

  const seenKinds = new Set();
  for (const node of program.body) {
    if (!node || typeof node !== 'object') continue;
    seenKinds.add(node.kind);
    if (node.kind === 'SubjectDecl') extractSubject(add, node);
    else if (node.kind === 'HostDecl') extractHost(add, node);
    else if (node.kind === 'ReckonDecl') extractReckon(add, node);
    else if (node.kind === 'MetaDecl') extractMeta(add, node);
    else if (node.kind === 'DialectDecl') extractDialect(add, node);
    else if (node.kind === 'EffectDecl') extractEffect(add, node);
    else if (node.kind === 'CapabilityPolicyDecl') extractCapabilityPolicy(add, node);
    else if (node.kind === 'StoreDecl') extractStore(add, node);
    else if (node.kind === 'Emergence' || node.kind === 'Resonance') extractRule(add, node, directivesByRule);
    else if (node.kind === 'NativeUIDecl') extractUi(add, node);
  }

  const unmodeledTopLevelKinds = sortedUnique([...seenKinds].filter(kind => !MOTHER_STRUCTURE_TOP_LEVEL_KINDS.has(kind)));
  const structureKinds = sortedUnique(structures.map(structure => structure.structureId));
  const irWithoutRoot = {
    format: MOTHER_STRUCTURE_IR_FORMAT,
    version: MOTHER_STRUCTURE_IR_VERSION,
    status: MOTHER_STRUCTURE_STATUS,
    source,
    coverage: {
      profile: 'rcl-ast-mother-structure-candidate-v0.1',
      extractedTopLevelKinds: sortedUnique([...seenKinds].filter(kind => MOTHER_STRUCTURE_TOP_LEVEL_KINDS.has(kind))),
      unmodeledTopLevelKinds,
      unresolvedDirectives,
      noAutomaticPromotion: true,
    },
    summary: {
      structureCount: structures.length,
      structureKinds,
    },
    structures,
    authorityBoundary: {
      canonicalOwner: 'RCL candidate extraction only',
      promotion: 'NOT_AUTOMATIC',
      finalDecision: 'INTEGRATION_COURT_AND_HUMAN_AUTHORIZATION_REQUIRED',
      evidenceRequired: [
        'independent recurrence across scopes',
        'positive and negative regression coverage',
        'K400 nine-gate evidence',
        'signed RCL_GAP comparison when a gap is claimed',
      ],
      labelsAreNotMechanisms: true,
    },
  };
  return {
    ...irWithoutRoot,
    root: realityRoot(irWithoutRoot),
  };
}

export function buildMotherStructureIRFromSource(source, options = {}) {
  if (typeof source !== 'string') throw new TypeError('RCL source must be a string');
  return buildMotherStructureIR(source, options);
}

export function classifyMotherStructure(structure, stats = {}) {
  assertObject(structure, 'Mother Structure classification requires a structure object');
  const structureId = String(structure.structureId ?? '');
  const occurrenceCount = Number(stats.occurrenceCount ?? structure.occurrenceCount ?? 0);
  const scopeCount = Number(stats.scopeCount ?? structure.scopeCount ?? 0);
  const independentSourceCount = Number(stats.independentSourceCount ?? structure.independentSourceCount ?? 0);
  if (structure.gapCandidate === true || structure.classification === 'RCL_GAP_CANDIDATE') {
    return {
      classification: 'RCL_GAP_CANDIDATE',
      rationale: 'Explicitly marked as a gap candidate; this API never converts a gap candidate into a formal RCL_GAP.',
      promotion: 'NOT_ELIGIBLE',
    };
  }
  if (AUXILIARY_PREFIXES.some(prefix => structureId.startsWith(prefix))) {
    return {
      classification: 'AUXILIARY_LANGUAGE_PROVIDER',
      rationale: 'Execution, packaging, filesystem, browser, device, provider, or signing mechanics remain outside RCL semantic ownership.',
      promotion: 'NOT_AUTOMATIC',
    };
  }
  if (FRAMEWORK_STRUCTURE_IDS.has(structureId) && occurrenceCount >= 3 && scopeCount >= 2 && independentSourceCount >= 2) {
    return {
      classification: 'FRAMEWORK_CANDIDATE',
      rationale: 'Repeated governed transition shape crosses the conservative frequency and scope thresholds.',
      promotion: 'NOT_AUTOMATIC',
    };
  }
  if (STD_STRUCTURE_IDS.has(structureId) && occurrenceCount >= 3 && scopeCount >= 2 && independentSourceCount >= 2) {
    return {
      classification: 'STD_CANDIDATE',
      rationale: 'Small composable RCL-owned structure crosses the conservative frequency and scope thresholds.',
      promotion: 'NOT_AUTOMATIC',
    };
  }
  if (PACK_PREFIXES.some(prefix => structureId.startsWith(prefix))) {
    return {
      classification: 'PACK',
      rationale: 'Coherent bounded UI/package/Forge/evidence envelope; recurrence does not establish a universal Core primitive.',
      promotion: 'NOT_AUTOMATIC',
    };
  }
  if (occurrenceCount < 3 || scopeCount < 2 || independentSourceCount < 2) {
    return {
      classification: 'EXAMPLE',
      rationale: 'Observed recurrence is too narrow for a Framework or std recommendation; retain as evidence until independently repeated.',
      promotion: 'NOT_AUTOMATIC',
    };
  }
  return {
    classification: 'PACK',
    rationale: 'Repeated bounded structure without a declared universal semantic contract; keep as a pack candidate.',
    promotion: 'NOT_AUTOMATIC',
  };
}

function sourceKey(observation) {
  return observation.evidence.sourceSha256 || observation.evidence.sourcePath || observation.instanceId;
}

function independentSource(observation) {
  return observation.evidence.lineage !== 'candidate-or-evidence-lineage';
}

export function buildMotherStructureCorpus(inputs, options = {}) {
  if (!Array.isArray(inputs)) throw new TypeError('Mother Structure corpus requires an array of IRs or observations');
  const observations = [];
  const coverage = {
    sourceIrCount: 0,
    externalObservationCount: 0,
    unmodeledTopLevelKinds: new Set(),
    unresolvedDirectiveCount: 0,
  };
  for (const input of inputs) {
    if (input?.format === MOTHER_STRUCTURE_IR_FORMAT) {
      const verification = verifyMotherStructureIR(input);
      if (!verification.ok) throw new TypeError(`Invalid Mother Structure IR: ${verification.errors.join('; ')}`);
      coverage.sourceIrCount += 1;
      for (const kind of input.coverage?.unmodeledTopLevelKinds ?? []) coverage.unmodeledTopLevelKinds.add(kind);
      coverage.unresolvedDirectiveCount += asArray(input.coverage?.unresolvedDirectives).length;
      observations.push(...input.structures.map(normalizeStructureObservation));
    } else if (input?.format === MOTHER_STRUCTURE_CORPUS_FORMAT) {
      observations.push(...asArray(input.observations).map(normalizeStructureObservation));
    } else if (input?.structureId) {
      coverage.externalObservationCount += 1;
      observations.push(normalizeStructureObservation(input));
    } else if (Array.isArray(input?.records)) {
      coverage.externalObservationCount += input.records.length;
      observations.push(...input.records.map(normalizeStructureObservation));
    } else {
      throw new TypeError('Mother Structure corpus input must be a Mother Structure IR, corpus, observation, or records wrapper');
    }
  }

  const groups = new Map();
  for (const observation of observations) {
    const row = groups.get(observation.structureId) ?? { structureId: observation.structureId, observations: [] };
    row.observations.push(observation);
    groups.set(observation.structureId, row);
  }
  const minOccurrences = Number(options.minOccurrences ?? 3);
  const minScopes = Number(options.minScopes ?? 2);
  const minIndependentSources = Number(options.minIndependentSources ?? 2);
  const structures = [...groups.values()].sort((left, right) => left.structureId.localeCompare(right.structureId)).map(group => {
    const rows = group.observations;
    const sourceCount = new Set(rows.map(sourceKey)).size;
    const independentCount = new Set(rows.filter(independentSource).map(sourceKey)).size;
    const scopeCount = new Set(rows.map(row => row.evidence.scope)).size;
    const stats = {
      occurrenceCount: rows.length,
      uniqueSourceCount: sourceCount,
      independentSourceCount: independentCount,
      scopeCount,
    };
    const classification = classifyMotherStructure({
      structureId: group.structureId,
      gapCandidate: rows.some(row => row.gapCandidate),
    }, stats);
    return {
      structureId: group.structureId,
      status: MOTHER_STRUCTURE_STATUS,
      recurrence: {
        ...stats,
        repeated: rows.length >= 2,
        meetsCandidateThreshold: rows.length >= minOccurrences && scopeCount >= minScopes && independentCount >= minIndependentSources,
        thresholds: { minOccurrences, minScopes, minIndependentSources },
      },
      classification: classification.classification,
      rationale: classification.rationale,
      promotion: classification.promotion,
      shapeRoots: sortedUnique(rows.map(row => row.shapeRoot)),
      representative: rows[0].graph,
      observationIds: rows.map(row => row.instanceId).sort(),
      sourcePaths: sortedUnique(rows.map(row => row.evidence.sourcePath)),
      scopes: sortedUnique(rows.map(row => row.evidence.scope)),
      independentSourcePaths: sortedUnique(rows.filter(independentSource).map(row => row.evidence.sourcePath)),
      formalRclGap: {
        eligible: false,
        reason: 'Frequency, labels, clusters, and provider output do not establish a formal RCL_GAP; signed PRIMITIVE/IR/RUNTIME/PROFILE comparison is required.',
      },
    };
  });
  const normalizedCoverage = {
    sourceIrCount: coverage.sourceIrCount,
    externalObservationCount: coverage.externalObservationCount,
    unmodeledTopLevelKinds: sortedUnique([...coverage.unmodeledTopLevelKinds]),
    unresolvedDirectiveCount: coverage.unresolvedDirectiveCount,
  };
  const dwacInput = observations.map(observation => ({
    system_id: `mother.${observation.instanceId}`,
    domain: observation.evidence.scope,
    source: {
      source_id: `${observation.evidence.sourceSha256 ?? observation.evidence.sourcePath ?? observation.instanceId}:${observation.instanceId}`,
      provenance_class: 'REPOSITORY_STRUCTURAL_OBSERVATION',
      canonical_status: 'CANDIDATE',
      canonical_owner: 'RCL candidate extraction only',
      evidence_refs: observation.evidence.evidenceRefs,
    },
    symbols: observation.graph.symbols,
    relations: observation.graph.relations.map(relation => ({
      ...relation,
      claim_kind: 'SOURCE_ASSERTION',
      properties: { relation_class: relation.relationClass },
    })),
    metadata: {
      structureId: observation.structureId,
      shapeRoot: observation.shapeRoot,
      invariants: ['labels_are_not_mechanisms', 'candidate_only', 'no_authority_transfer'],
      scopeConditions: [observation.evidence.scope, observation.evidence.lineage, observation.structureId],
    },
  }));
  const corpusWithoutRoot = {
    format: MOTHER_STRUCTURE_CORPUS_FORMAT,
    version: MOTHER_STRUCTURE_IR_VERSION,
    status: MOTHER_STRUCTURE_STATUS,
    thresholds: { minOccurrences, minScopes, minIndependentSources },
    coverage: normalizedCoverage,
    summary: {
      observationCount: observations.length,
      structureCount: structures.length,
      classificationCounts: structures.reduce((counts, row) => {
        counts[row.classification] = (counts[row.classification] ?? 0) + 1;
        return counts;
      }, {}),
    },
    structures,
    observations,
    dwacInput,
    authorityBoundary: {
      status: 'CANDIDATE_ONLY',
      decisions: MOTHER_STRUCTURE_CLASSIFICATIONS,
      finalDecision: 'NOT_DECIDED',
      formalGapRule: 'NO_FORMAL_RCL_GAP_FROM_CLUSTERING_ALONE',
      noAutomaticRegistryWrites: true,
    },
  };
  return {
    ...corpusWithoutRoot,
    root: realityRoot(corpusWithoutRoot),
  };
}

export function verifyMotherStructureIR(ir) {
  const errors = [];
  if (!ir || typeof ir !== 'object' || Array.isArray(ir)) return { ok: false, errors: ['IR must be an object'], structureCount: 0 };
  if (ir.format !== MOTHER_STRUCTURE_IR_FORMAT) errors.push(`unexpected format: ${String(ir.format)}`);
  if (ir.version !== MOTHER_STRUCTURE_IR_VERSION) errors.push(`unexpected version: ${String(ir.version)}`);
  if (ir.status !== MOTHER_STRUCTURE_STATUS) errors.push(`unexpected status: ${String(ir.status)}`);
  if (!Array.isArray(ir.structures)) errors.push('structures must be an array');
  const structures = Array.isArray(ir.structures) ? ir.structures : [];
  for (const [index, structure] of structures.entries()) {
    if (!structure || typeof structure !== 'object') {
      errors.push(`structures[${index}] must be an object`);
      continue;
    }
    if (!structure.structureId) errors.push(`structures[${index}] missing structureId`);
    if (!structure.instanceId) errors.push(`structures[${index}] missing instanceId`);
    if (structure.status !== MOTHER_STRUCTURE_STATUS) errors.push(`structures[${index}] is not candidate-only`);
    const graph = structure.graph;
    if (!graph || !Array.isArray(graph.symbols) || !Array.isArray(graph.relations)) errors.push(`structures[${index}] graph is malformed`);
    const symbolIds = new Set((graph?.symbols ?? []).map(node => node.id));
    for (const relation of graph?.relations ?? []) {
      if (!symbolIds.has(relation.source) || !symbolIds.has(relation.target)) errors.push(`structures[${index}] relation endpoint is missing`);
    }
  }
  if (typeof ir.root === 'string') {
    const { root, ...withoutRoot } = ir;
    if (realityRoot(withoutRoot) !== root) errors.push('root does not match the candidate IR payload');
  }
  return { ok: errors.length === 0, errors, structureCount: ir.structures?.length ?? 0 };
}

export function verifyMotherStructureCorpus(corpus) {
  const errors = [];
  if (!corpus || typeof corpus !== 'object' || Array.isArray(corpus)) return { ok: false, errors: ['corpus must be an object'] };
  if (corpus.format !== MOTHER_STRUCTURE_CORPUS_FORMAT) errors.push(`unexpected format: ${String(corpus.format)}`);
  if (corpus.version !== MOTHER_STRUCTURE_IR_VERSION) errors.push(`unexpected version: ${String(corpus.version)}`);
  if (corpus.status !== MOTHER_STRUCTURE_STATUS) errors.push(`unexpected status: ${String(corpus.status)}`);
  if (!Array.isArray(corpus.structures)) errors.push('corpus structures must be an array');
  if (!Array.isArray(corpus.observations)) errors.push('corpus observations must be an array');
  const structures = Array.isArray(corpus.structures) ? corpus.structures : [];
  for (const row of structures) {
    if (!MOTHER_STRUCTURE_CLASSIFICATIONS.includes(row.classification)) errors.push(`unknown classification: ${String(row.classification)}`);
    if (row.promotion !== 'NOT_AUTOMATIC' && row.promotion !== 'NOT_ELIGIBLE') errors.push(`automatic promotion marker on ${String(row.structureId)}`);
  }
  if (typeof corpus.root === 'string') {
    const { root, ...withoutRoot } = corpus;
    if (realityRoot(withoutRoot) !== root) errors.push('root does not match the candidate corpus payload');
  }
  return { ok: errors.length === 0, errors, structureCount: corpus.structures?.length ?? 0, observationCount: corpus.observations?.length ?? 0 };
}
