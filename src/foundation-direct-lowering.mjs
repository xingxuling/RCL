export const FOUNDATION_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-direct-lowering.v0.1';
export const FOUNDATION_DIRECT_LOWERING_VERSION = '0.1.0';

function diagnostic(code, message, details = {}) {
  return { code, message, details };
}

function trueExpression() {
  return { kind: 'LiteralExpr', valueType: 'Truth', value: true };
}

function sanitizeName(value) {
  return String(value ?? 'unnamed').replace(/[^A-Za-z0-9_]+/g, '_');
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function perceptionRule(perception, directiveIndex) {
  const ruleName = `__rcl_foundation_perception_${sanitizeName(perception.name)}_${directiveIndex}`;
  return {
    ruleName,
    rule: {
      kind: 'Emergence',
      name: ruleName,
      cause: perception.observer || `perception.${perception.name}`,
      when: trueExpression(),
      needs: [],
      alters: array(perception.channels).map(channel => ({
        target: channel.path,
        expression: channel.expression,
      })),
      calls: [],
      preserves: array(perception.preserves),
      witnesses: [`rcl:foundation:perception:${perception.name}`],
    },
  };
}

export function lowerDeclaredFoundationToCore(program, options = {}) {
  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    throw new TypeError('compiled RCL program object is required');
  }

  const enabledDomains = new Set(options.domains ?? ['perception']);
  const diagnostics = [];
  const lowered = [];
  const syntheticRules = [];
  const consumedDirectiveIndexes = new Set();
  const consumedPerceptions = new Set();
  const rewrittenDirectives = [];

  const perceptions = array(program.perceptions);
  const perceptionsByName = new Map(perceptions.map(item => [item.name, item]));

  array(program.directives).forEach((directive, index) => {
    if (directive?.kind !== 'Observe' || !enabledDomains.has('perception')) {
      rewrittenDirectives.push(directive);
      return;
    }

    const perception = perceptionsByName.get(directive.name);
    if (!perception) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN',
        `Observe target '${directive.name}' is not a declared perception`,
        { directiveIndex: index, domain: 'perception', target: directive.name },
      ));
      rewrittenDirectives.push(directive);
      return;
    }

    const { ruleName, rule } = perceptionRule(perception, index);
    syntheticRules.push(rule);
    rewrittenDirectives.push({ kind: 'Realize', rule: ruleName });
    consumedDirectiveIndexes.add(index);
    consumedPerceptions.add(perception.name);
    lowered.push({
      domain: 'perception',
      declaration: perception.name,
      directive: 'Observe',
      syntheticRule: ruleName,
      stateTargets: array(perception.channels).map(channel => channel.path),
      preserveCount: array(perception.preserves).length,
      witness: `rcl:foundation:perception:${perception.name}`,
    });
  });

  const remainingPerceptions = perceptions.filter(item => !consumedPerceptions.has(item.name));
  for (const perception of remainingPerceptions) {
    diagnostics.push(diagnostic(
      'RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED',
      `Perception '${perception.name}' remains declared because no Observe directive was lowered`,
      { domain: 'perception', declaration: perception.name },
    ));
  }

  const transformed = {
    ...program,
    perceptions: remainingPerceptions,
    rules: [...array(program.rules), ...syntheticRules],
    directives: rewrittenDirectives,
  };

  return {
    format: FOUNDATION_DIRECT_LOWERING_FORMAT,
    version: FOUNDATION_DIRECT_LOWERING_VERSION,
    program: transformed,
    lowered,
    diagnostics,
    summary: {
      loweredCount: lowered.length,
      syntheticRuleCount: syntheticRules.length,
      consumedDirectiveCount: consumedDirectiveIndexes.size,
      remainingPerceptionCount: remainingPerceptions.length,
      enabledDomains: [...enabledDomains].sort(),
    },
    truthBoundary: {
      directDomains: ['perception'].filter(domain => enabledDomains.has(domain)),
      stateTransitionParityTargeted: true,
      domainReceiptParityClaimed: false,
      allFoundationDomainsNativeClaimed: false,
      providerBridgeRemovedGlobally: false,
    },
  };
}
