export const FOUNDATION_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-direct-lowering.v0.4';
export const FOUNDATION_DIRECT_LOWERING_VERSION = '0.4.0';

const MAX_STATIC_DOMAIN_STEPS = 256;

function diagnostic(code, message, details = {}) { return { code, message, details }; }
function trueExpression() { return { kind: 'LiteralExpr', valueType: 'Truth', value: true }; }
function sanitizeName(value) { return String(value ?? 'unnamed').replace(/[^A-Za-z0-9_]+/g, '_'); }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneAst(value) {
  if (Array.isArray(value)) return value.map(cloneAst);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAst(item)]));
  return value;
}
function substitutePathExpression(value, path, replacement) {
  if (Array.isArray(value)) return value.map(item => substitutePathExpression(item, path, replacement));
  if (value && typeof value === 'object') {
    if (value.kind === 'PathExpr' && value.path === path) return cloneAst(replacement);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitutePathExpression(item, path, replacement)]));
  }
  return value;
}
function isStaticPhysicalDtExpression(expr) {
  if (!expr || typeof expr !== 'object') return false;
  if (expr.kind === 'LiteralExpr') return true;
  if (expr.kind === 'UnaryExpr') return isStaticPhysicalDtExpression(expr.expression);
  if (expr.kind === 'BinaryExpr') return isStaticPhysicalDtExpression(expr.left) && isStaticPhysicalDtExpression(expr.right);
  if (expr.kind === 'CallExpr') return expr.name === 'seconds' && array(expr.args).every(isStaticPhysicalDtExpression);
  return false;
}
function literalStepCount(expr) {
  if (expr?.kind !== 'LiteralExpr' || expr.valueType !== 'Number') return null;
  const count = Number(expr.value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_STATIC_DOMAIN_STEPS) return null;
  return count;
}
function allocateSyntheticRuleName(baseRuleName, reservedNames) {
  let ruleName = baseRuleName; let suffix = 0;
  while (reservedNames.has(ruleName)) { suffix += 1; ruleName = `${baseRuleName}_${suffix}`; }
  reservedNames.add(ruleName);
  return { ruleName, baseRuleName, renamed: ruleName !== baseRuleName };
}
function perceptionRule(perception, ruleName) {
  return { ruleName, rule: {
    kind: 'Emergence', name: ruleName, cause: perception.observer || `perception.${perception.name}`,
    when: trueExpression(), needs: [],
    alters: array(perception.channels).map(channel => ({ target: channel.path, expression: channel.expression })),
    calls: [], preserves: array(perception.preserves), witnesses: [`rcl:foundation:perception:${perception.name}`],
  } };
}
function physicalRule(law, directive, ruleName, stepIndex, stepCount) {
  const stepVariable = law?.step?.name;
  const witness = `rcl:foundation:physical:${law.name}:step:${stepIndex}`;
  return {
    witness,
    rule: {
      kind: 'Emergence', name: ruleName, cause: `physical.${law.name}`,
      when: substitutePathExpression(law.when ?? trueExpression(), stepVariable, directive.dt), needs: [],
      alters: array(law.evolves).map(change => ({ target: change.target, expression: substitutePathExpression(change.expression, stepVariable, directive.dt) })),
      calls: [], preserves: array(law.conserves).map(expr => substitutePathExpression(expr, stepVariable, directive.dt)),
      witnesses: [...array(law.witnesses), witness],
    },
    metadata: {
      domain: 'physical', declaration: law.name, directive: 'Advance', syntheticRule: ruleName,
      stateTargets: array(law.evolves).map(change => change.target), preserveCount: array(law.conserves).length,
      witness, authorityClass: 'natural-law', sourceReality: law.domain ?? null,
      stepIndex, stepCount, stepVariable, dtExpression: cloneAst(directive.dt), originalWitnesses: [...array(law.witnesses)],
    },
  };
}
function neuralRule(neural, pathway, ruleName, stepIndex, stepCount, pathwayIndex) {
  const witness = `rcl:foundation:neural:${pathway.name}:step:${stepIndex}`;
  return {
    witness,
    rule: {
      kind: 'Emergence', name: ruleName, cause: `neural.${pathway.name}`,
      when: pathway.when ?? trueExpression(), needs: [],
      alters: array(pathway.changes).map(change => ({ target: change.target, expression: change.expression })),
      calls: [], preserves: array(pathway.preserves), witnesses: [...array(pathway.witnesses), witness],
    },
    metadata: {
      domain: 'neural', declaration: pathway.name, directive: 'Propagate', syntheticRule: ruleName,
      stateTargets: array(pathway.changes).map(change => change.target), preserveCount: array(pathway.preserves).length,
      witness, authorityClass: 'intrinsic-neural-dynamics', sourceReality: neural.name,
      stepIndex, stepCount, pathwayIndex, originalWitnesses: [...array(pathway.witnesses)],
      changeModes: array(pathway.changes).map(change => change.mode ?? 'transmit'),
    },
  };
}
function collisionDiagnostic(domain, declaration, directiveIndex, allocation, extra = {}) {
  return diagnostic(
    'RCL_FOUNDATION_DIRECT_LOWERING_RULE_NAME_COLLISION_AVOIDED',
    `Synthetic ${domain} rule '${allocation.baseRuleName}' would collide with an existing rule; allocated '${allocation.ruleName}' instead`,
    { directiveIndex, domain, declaration, requestedRuleName: allocation.baseRuleName, allocatedRuleName: allocation.ruleName, ...extra },
  );
}

export function lowerDeclaredFoundationToCore(program, options = {}) {
  if (!program || typeof program !== 'object' || Array.isArray(program)) throw new TypeError('compiled RCL program object is required');

  const enabledDomains = new Set(options.domains ?? ['perception', 'physical', 'neural']);
  const diagnostics = []; const lowered = []; const syntheticRules = [];
  const consumedDirectiveIndexes = new Set(); const consumedPerceptions = new Set();
  const consumedPhysicalLaws = new Set(); const consumedNeurals = new Set();
  const rewrittenDirectives = [];
  const reservedRuleNames = new Set(array(program.rules).map(rule => rule?.name).filter(Boolean));
  let renamedSyntheticRuleCount = 0; let physicalLoweredStepCount = 0; let neuralLoweredTransactionCount = 0;

  const perceptions = array(program.perceptions);
  const perceptionsByName = new Map(perceptions.map(item => [item.name, item]));
  const physicals = array(program.physicals); const physicalLawByName = new Map();
  for (const physical of physicals) for (const law of array(physical?.laws)) physicalLawByName.set(law.name, law);
  const neurals = array(program.neurals); const neuralByName = new Map(neurals.map(item => [item.name, item]));

  array(program.directives).forEach((directive, index) => {
    if (directive?.kind === 'Observe' && enabledDomains.has('perception')) {
      const perception = perceptionsByName.get(directive.name);
      if (!perception) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN', `Observe target '${directive.name}' is not a declared perception`, { directiveIndex: index, domain: 'perception', target: directive.name }));
        rewrittenDirectives.push(directive); return;
      }
      const allocation = allocateSyntheticRuleName(`__rcl_foundation_perception_${sanitizeName(perception.name)}_${index}`, reservedRuleNames);
      if (allocation.renamed) { renamedSyntheticRuleCount += 1; diagnostics.push(collisionDiagnostic('perception', perception.name, index, allocation)); }
      const { ruleName, rule } = perceptionRule(perception, allocation.ruleName);
      syntheticRules.push(rule); rewrittenDirectives.push({ kind: 'Realize', rule: ruleName });
      consumedDirectiveIndexes.add(index); consumedPerceptions.add(perception.name);
      lowered.push({
        domain: 'perception', declaration: perception.name, directive: 'Observe', directiveIndex: index,
        syntheticRule: ruleName, stateTargets: array(perception.channels).map(channel => channel.path),
        preserveCount: array(perception.preserves).length, witness: `rcl:foundation:perception:${perception.name}`,
        observer: perception.observer ?? null, sourceReality: perception.source ?? null, authorityClass: 'observation',
      });
      return;
    }

    if (directive?.kind === 'Advance' && enabledDomains.has('physical')) {
      const law = physicalLawByName.get(directive.name);
      if (!law) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN', `Advance target '${directive.name}' is not a declared physical law`, { directiveIndex: index, domain: 'physical', target: directive.name }));
        rewrittenDirectives.push(directive); return;
      }
      if (!law?.step?.name) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_PHYSICAL_STEP_MISSING', `Physical law '${law.name}' cannot be lowered without a step variable`, { directiveIndex: index, domain: 'physical', declaration: law.name }));
        rewrittenDirectives.push(directive); return;
      }
      const stepCount = literalStepCount(directive.count);
      if (stepCount === null) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_PHYSICAL_DYNAMIC_STEPS_UNSUPPORTED', `Advance '${law.name}' requires a literal step count between 1 and ${MAX_STATIC_DOMAIN_STEPS} for bounded direct lowering`, { directiveIndex: index, domain: 'physical', declaration: law.name }));
        rewrittenDirectives.push(directive); return;
      }
      if (!isStaticPhysicalDtExpression(directive.dt)) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_PHYSICAL_DYNAMIC_DT_UNSUPPORTED', `Advance '${law.name}' requires a state-independent dt expression for direct lowering`, { directiveIndex: index, domain: 'physical', declaration: law.name }));
        rewrittenDirectives.push(directive); return;
      }
      for (let stepIndex = 1; stepIndex <= stepCount; stepIndex += 1) {
        const allocation = allocateSyntheticRuleName(`__rcl_foundation_physical_${sanitizeName(law.name)}_${index}_${stepIndex}`, reservedRuleNames);
        if (allocation.renamed) { renamedSyntheticRuleCount += 1; diagnostics.push(collisionDiagnostic('physical', law.name, index, allocation, { stepIndex })); }
        const loweredStep = physicalRule(law, directive, allocation.ruleName, stepIndex, stepCount);
        syntheticRules.push(loweredStep.rule); rewrittenDirectives.push({ kind: 'Realize', rule: allocation.ruleName });
        lowered.push({ ...loweredStep.metadata, directiveIndex: index }); physicalLoweredStepCount += 1;
      }
      consumedDirectiveIndexes.add(index); consumedPhysicalLaws.add(law.name); return;
    }

    if (directive?.kind === 'Propagate' && enabledDomains.has('neural')) {
      const neural = neuralByName.get(directive.name);
      if (!neural) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN', `Propagate target '${directive.name}' is not a declared neural domain`, { directiveIndex: index, domain: 'neural', target: directive.name }));
        rewrittenDirectives.push(directive); return;
      }
      if (array(neural.pathways).length === 0) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_NEURAL_PATHWAYS_MISSING', `Neural domain '${neural.name}' cannot be lowered without pathways`, { directiveIndex: index, domain: 'neural', declaration: neural.name }));
        rewrittenDirectives.push(directive); return;
      }
      const stepCount = literalStepCount(directive.count);
      if (stepCount === null) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_NEURAL_DYNAMIC_STEPS_UNSUPPORTED', `Propagate '${neural.name}' requires a literal step count between 1 and ${MAX_STATIC_DOMAIN_STEPS} for bounded direct lowering`, { directiveIndex: index, domain: 'neural', declaration: neural.name }));
        rewrittenDirectives.push(directive); return;
      }
      for (let stepIndex = 1; stepIndex <= stepCount; stepIndex += 1) {
        array(neural.pathways).forEach((pathway, pathwayOffset) => {
          const pathwayIndex = pathwayOffset + 1;
          const allocation = allocateSyntheticRuleName(`__rcl_foundation_neural_${sanitizeName(pathway.name)}_${index}_${stepIndex}_${pathwayIndex}`, reservedRuleNames);
          if (allocation.renamed) { renamedSyntheticRuleCount += 1; diagnostics.push(collisionDiagnostic('neural', pathway.name, index, allocation, { stepIndex, pathwayIndex })); }
          const loweredStep = neuralRule(neural, pathway, allocation.ruleName, stepIndex, stepCount, pathwayIndex);
          syntheticRules.push(loweredStep.rule); rewrittenDirectives.push({ kind: 'Realize', rule: allocation.ruleName });
          lowered.push({ ...loweredStep.metadata, directiveIndex: index }); neuralLoweredTransactionCount += 1;
        });
      }
      consumedDirectiveIndexes.add(index); consumedNeurals.add(neural.name); return;
    }

    rewrittenDirectives.push(directive);
  });

  const remainingPerceptions = perceptions.filter(item => !consumedPerceptions.has(item.name));
  for (const perception of remainingPerceptions) diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED', `Perception '${perception.name}' remains declared because no Observe directive was lowered`, { domain: 'perception', declaration: perception.name }));

  const remainingAdvanceTargets = new Set(rewrittenDirectives.filter(item => item?.kind === 'Advance').map(item => item.name));
  const transformedPhysicals = physicals.map(physical => {
    const remainingLaws = array(physical?.laws).filter(law => !consumedPhysicalLaws.has(law.name) || remainingAdvanceTargets.has(law.name));
    return remainingLaws.length > 0 ? { ...physical, laws: remainingLaws } : null;
  }).filter(Boolean);
  for (const physical of transformedPhysicals) for (const law of array(physical?.laws)) diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED', `Physical law '${law.name}' remains declared because no fully supported Advance directive consumed it`, { domain: 'physical', declaration: law.name }));

  const remainingPropagateTargets = new Set(rewrittenDirectives.filter(item => item?.kind === 'Propagate').map(item => item.name));
  const transformedNeurals = neurals.filter(neural => !consumedNeurals.has(neural.name) || remainingPropagateTargets.has(neural.name));
  for (const neural of transformedNeurals) diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED', `Neural domain '${neural.name}' remains declared because no fully supported Propagate directive consumed it`, { domain: 'neural', declaration: neural.name }));

  const transformed = {
    ...program, perceptions: remainingPerceptions, physicals: transformedPhysicals, neurals: transformedNeurals,
    rules: [...array(program.rules), ...syntheticRules], directives: rewrittenDirectives,
  };
  return {
    format: FOUNDATION_DIRECT_LOWERING_FORMAT, version: FOUNDATION_DIRECT_LOWERING_VERSION,
    program: transformed, lowered, diagnostics,
    summary: {
      loweredCount: lowered.length, syntheticRuleCount: syntheticRules.length, consumedDirectiveCount: consumedDirectiveIndexes.size,
      remainingPerceptionCount: remainingPerceptions.length, remainingPhysicalCount: transformedPhysicals.length,
      remainingNeuralCount: transformedNeurals.length, physicalLoweredStepCount, neuralLoweredTransactionCount,
      renamedSyntheticRuleCount, enabledDomains: [...enabledDomains].sort(),
    },
    truthBoundary: {
      directDomains: ['perception', 'physical', 'neural'].filter(domain => enabledDomains.has(domain)),
      stateTransitionParityTargeted: true, domainReceiptParityTargeted: true,
      physicalDirectLoweringBoundedToStaticStepCountAndDt: true,
      neuralDirectLoweringBoundedToStaticStepCount: true,
      allFoundationDomainsNativeClaimed: false, providerBridgeRemovedGlobally: false,
    },
  };
}
