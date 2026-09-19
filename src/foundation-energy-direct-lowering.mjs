export const FOUNDATION_ENERGY_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-energy-direct-lowering.v0.1';
export const FOUNDATION_ENERGY_DIRECT_LOWERING_VERSION = '0.1.0';

function array(value) { return Array.isArray(value) ? value : []; }
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}
function diagnostic(code, message, details = {}) { return { code, message, details }; }
function literal(valueType, value) { return { kind: 'LiteralExpr', valueType, value }; }
function path(pathValue) { return { kind: 'PathExpr', path: pathValue }; }
function binary(operator, left, right) { return { kind: 'BinaryExpr', operator, left, right }; }
function joules(value) { return { kind: 'CallExpr', name: 'joules', args: [literal('Number', value)] }; }
function sanitize(value) { return String(value ?? 'unnamed').replace(/[^A-Za-z0-9_]+/g, '_'); }

function isStaticEnergyExpression(expr) {
  if (!expr || typeof expr !== 'object') return false;
  if (expr.kind === 'LiteralExpr') return true;
  if (expr.kind === 'UnaryExpr') return isStaticEnergyExpression(expr.expression);
  if (expr.kind === 'BinaryExpr') return isStaticEnergyExpression(expr.left) && isStaticEnergyExpression(expr.right);
  if (expr.kind === 'CallExpr') {
    if (!['joules', 'choose', 'min', 'max'].includes(expr.name)) return false;
    return array(expr.args).every(isStaticEnergyExpression);
  }
  return false;
}

function literalEfficiency(expr) {
  if (expr?.kind !== 'LiteralExpr' || expr.valueType !== 'Number') return null;
  const value = Number(expr.value);
  if (!Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

function flowTopologyIsDisjoint(flows) {
  const touched = new Set();
  for (const flow of flows) {
    for (const reservoir of [flow?.from, flow?.to]) {
      if (!reservoir || touched.has(reservoir)) return false;
      touched.add(reservoir);
    }
  }
  return true;
}

function energyRule(domain, directiveIndex, ruleName) {
  const flows = array(domain.flows);
  const alters = [];
  const syntheticPreserves = [];
  const flowMetadata = [];

  for (const flow of flows) {
    const amount = clone(flow.amount);
    const efficiency = literalEfficiency(flow.efficiency);
    const delivered = binary('*', clone(amount), literal('Number', efficiency));
    alters.push({
      target: flow.from,
      expression: binary('-', path(flow.from), clone(amount)),
    });
    alters.push({
      target: flow.to,
      expression: binary('+', path(flow.to), delivered),
    });
    // Reference semantics reject a flow when sourceBefore < amount. Because the
    // direct rule subtracts exactly amount atomically, projected source >= 0 is
    // equivalent to sourceBefore >= amount and therefore fails closed before commit.
    syntheticPreserves.push(binary('>=', path(flow.from), joules(0)));
    flowMetadata.push({
      name: flow.name,
      from: flow.from,
      to: flow.to,
      amount: clone(flow.amount),
      efficiency,
      evidence: clone(flow.evidence ?? []),
    });
  }

  const witness = `rcl:foundation:energy:${domain.name}:energize:${directiveIndex}`;
  return {
    rule: {
      kind: 'Emergence',
      name: ruleName,
      cause: `energy.${domain.name}`,
      when: literal('Truth', true),
      needs: [],
      alters,
      calls: [],
      preserves: [...array(domain.preserves).map(clone), ...syntheticPreserves],
      witnesses: [...array(domain.witnesses), witness],
    },
    metadata: {
      domain: 'energy',
      declaration: domain.name,
      directive: 'Energize',
      directiveIndex,
      syntheticRule: ruleName,
      witness,
      authorityClass: 'energy-budget-flow',
      sourceReality: domain.name,
      flowCount: flows.length,
      stateTargets: flows.flatMap(flow => [flow.from, flow.to]),
      preserveCount: array(domain.preserves).length,
      syntheticSourceBoundCount: syntheticPreserves.length,
      flows: flowMetadata,
    },
  };
}

export function lowerDeclaredEnergyToCore(program) {
  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    throw new TypeError('compiled RCL program object is required');
  }

  const energies = array(program.energies);
  const byName = new Map(energies.map(item => [item.name, item]));
  const diagnostics = [];
  const lowered = [];
  const syntheticRules = [];
  const rewrittenDirectives = [];
  const consumedEnergyNames = new Set();
  const reservedRuleNames = new Set(array(program.rules).map(rule => rule?.name).filter(Boolean));

  array(program.directives).forEach((directive, directiveIndex) => {
    if (directive?.kind !== 'Energize') {
      rewrittenDirectives.push(directive);
      return;
    }

    const domain = byName.get(directive.name);
    if (!domain) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_ENERGY_DIRECT_TARGET_UNKNOWN',
        `Energize target '${directive.name}' is not a declared energy reality`,
        { directiveIndex, target: directive.name },
      ));
      rewrittenDirectives.push(directive);
      return;
    }

    const flows = array(domain.flows);
    if (flows.length === 0) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_ENERGY_DIRECT_FLOW_MISSING',
        `Energy reality '${domain.name}' has no flow to lower`,
        { directiveIndex, domain: domain.name },
      ));
      rewrittenDirectives.push(directive);
      return;
    }

    const dynamicAmount = flows.find(flow => !isStaticEnergyExpression(flow.amount));
    if (dynamicAmount) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_ENERGY_DIRECT_DYNAMIC_AMOUNT_UNSUPPORTED',
        `Energy flow '${dynamicAmount.name}' requires a state-independent amount for atomic direct lowering`,
        { directiveIndex, domain: domain.name, flow: dynamicAmount.name },
      ));
      rewrittenDirectives.push(directive);
      return;
    }

    const invalidEfficiency = flows.find(flow => literalEfficiency(flow.efficiency) === null);
    if (invalidEfficiency) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_ENERGY_DIRECT_EFFICIENCY_UNSUPPORTED',
        `Energy flow '${invalidEfficiency.name}' requires a literal efficiency in [0,1] for direct lowering`,
        { directiveIndex, domain: domain.name, flow: invalidEfficiency.name },
      ));
      rewrittenDirectives.push(directive);
      return;
    }

    if (!flowTopologyIsDisjoint(flows)) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_ENERGY_DIRECT_COUPLED_RESERVOIRS_UNSUPPORTED',
        `Energy reality '${domain.name}' reuses a reservoir across flows; sequential reference semantics cannot be collapsed into one atomic native rule`,
        { directiveIndex, domain: domain.name, flows: flows.map(flow => ({ name: flow.name, from: flow.from, to: flow.to })) },
      ));
      rewrittenDirectives.push(directive);
      return;
    }

    let ruleName = `__rcl_foundation_energy_${sanitize(domain.name)}_${directiveIndex}`;
    let suffix = 0;
    const requestedRuleName = ruleName;
    while (reservedRuleNames.has(ruleName)) {
      suffix += 1;
      ruleName = `${requestedRuleName}_${suffix}`;
    }
    reservedRuleNames.add(ruleName);
    if (ruleName !== requestedRuleName) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_ENERGY_DIRECT_RULE_NAME_COLLISION_AVOIDED',
        `Synthetic energy rule '${requestedRuleName}' collided; allocated '${ruleName}'`,
        { directiveIndex, domain: domain.name, requestedRuleName, allocatedRuleName: ruleName },
      ));
    }

    const compiled = energyRule(domain, directiveIndex, ruleName);
    syntheticRules.push(compiled.rule);
    rewrittenDirectives.push({ kind: 'Realize', rule: ruleName });
    lowered.push(compiled.metadata);
    consumedEnergyNames.add(domain.name);
  });

  const remainingTargets = new Set(
    rewrittenDirectives.filter(item => item?.kind === 'Energize').map(item => item.name),
  );
  const remainingEnergies = energies.filter(domain => (
    !consumedEnergyNames.has(domain.name) || remainingTargets.has(domain.name)
  ));
  for (const domain of remainingEnergies) {
    diagnostics.push(diagnostic(
      'RCL_FOUNDATION_ENERGY_DIRECT_DECLARATION_UNCONSUMED',
      `Energy reality '${domain.name}' remains declared because no fully supported Energize directive consumed it`,
      { domain: domain.name },
    ));
  }

  return {
    format: FOUNDATION_ENERGY_DIRECT_LOWERING_FORMAT,
    version: FOUNDATION_ENERGY_DIRECT_LOWERING_VERSION,
    program: {
      ...program,
      energies: remainingEnergies,
      rules: [...array(program.rules), ...syntheticRules],
      directives: rewrittenDirectives,
    },
    lowered,
    diagnostics,
    summary: {
      loweredDirectiveCount: lowered.length,
      loweredFlowCount: lowered.reduce((total, item) => total + item.flowCount, 0),
      syntheticRuleCount: syntheticRules.length,
      remainingEnergyCount: remainingEnergies.length,
      atomicDisjointFlowOnly: true,
    },
    truthBoundary: {
      directDomain: 'energy',
      stateTransitionParityTargeted: true,
      energyReceiptParityClaimed: false,
      stateIndependentAmountsRequired: true,
      literalEfficiencyRequired: true,
      disjointReservoirTopologyRequired: true,
      sourceSufficiencyFailsClosedViaProjectedNonnegativePreserve: true,
      oneEnergizeDirectiveLowersToOneAtomicCoreTransaction: true,
      allEnergyProgramsNativeClaimed: false,
      providerBridgeRemovedGlobally: false,
    },
  };
}
