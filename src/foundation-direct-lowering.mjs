export const FOUNDATION_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-direct-lowering.v0.6';
export const FOUNDATION_DIRECT_LOWERING_VERSION = '0.6.0';

const MAX_STATIC_DOMAIN_STEPS = 256;

function diagnostic(code, message, details = {}) { return { code, message, details }; }
function trueExpression() { return { kind: 'LiteralExpr', valueType: 'Truth', value: true }; }
function pathExpression(path) { return { kind: 'PathExpr', path }; }
function addExpression(left, right) { return { kind: 'BinaryExpr', operator: '+', left, right }; }
function sanitizeName(value) { return String(value ?? 'unnamed').replace(/[^A-Za-z0-9_]+/g, '_'); }
function array(value) { return Array.isArray(value) ? value : []; }
function unique(values) { return [...new Set(values)]; }
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

function livingSenseRule(living, ruleName, stepIndex, stepCount, stageCount) {
  const witness = `rcl:foundation:living:${living.name}:step:${stepIndex}:sense`;
  return {
    rule: {
      kind: 'Emergence', name: ruleName, cause: `living.${living.name}.sense`,
      when: trueExpression(), needs: [],
      alters: array(living.senses).map(sense => ({ target: sense.path, expression: pathExpression(sense.source) })),
      calls: [], preserves: [], witnesses: [witness],
    },
    metadata: {
      domain: 'living', declaration: living.name, directive: 'Live', stage: 'sense', stageIndex: 1, stageCount,
      syntheticRule: ruleName, stateTargets: array(living.senses).map(sense => sense.path), preserveCount: 0,
      witness, authorityClass: 'intrinsic-life-cycle', sourceReality: living.name,
      stepIndex, stepCount, cycleIndex: null, cycleName: null, originalWitnesses: [],
      body: living.body ?? null, livingNeeds: [...array(living.needs)], changeModes: array(living.senses).map(() => 'sense-sync'),
    },
  };
}
function livingCycleRule(living, cycle, ruleName, stepIndex, stepCount, cycleIndex, stageIndex, stageCount) {
  const witness = `rcl:foundation:living:${cycle.name}:step:${stepIndex}:cycle:${cycleIndex}`;
  return {
    rule: {
      kind: 'Emergence', name: ruleName, cause: `living.${cycle.name}`,
      when: cycle.when ?? trueExpression(), needs: [],
      alters: array(cycle.changes).map(change => ({ target: change.target, expression: cloneAst(change.expression) })),
      calls: [], preserves: array(living.maintains).map(cloneAst), witnesses: [...array(cycle.witnesses), witness],
    },
    metadata: {
      domain: 'living', declaration: living.name, directive: 'Live', stage: 'cycle', stageIndex, stageCount,
      syntheticRule: ruleName, stateTargets: array(cycle.changes).map(change => change.target), preserveCount: array(living.maintains).length,
      witness, authorityClass: 'intrinsic-life-cycle', sourceReality: living.name,
      stepIndex, stepCount, cycleIndex, cycleName: cycle.name, originalWitnesses: [...array(cycle.witnesses)],
      body: living.body ?? null, livingNeeds: [...array(living.needs)], changeModes: array(cycle.changes).map(change => change.mode ?? 'cycle'),
    },
  };
}

function geneticStageRules(genetic, mutationRuleName, expressionRuleName, generationIndex, generationCount) {
  const mutationWitness = `rcl:foundation:genetic:${genetic.name}:generation:${generationIndex}:mutation`;
  const expressionWitness = `rcl:foundation:genetic:${genetic.name}:generation:${generationIndex}:expression`;
  const mutationTargets = array(genetic.mutations).map(change => change.target);
  const expressionTargets = array(genetic.expressions).map(change => change.target);
  return {
    mutation: {
      kind: 'Emergence', name: mutationRuleName, cause: `genetic.${genetic.name}.mutation`,
      when: trueExpression(), needs: [],
      alters: array(genetic.mutations).map(mutation => ({
        target: mutation.target,
        expression: addExpression(pathExpression(mutation.target), cloneAst(mutation.expression)),
      })),
      calls: [], preserves: [], witnesses: [mutationWitness],
    },
    expression: {
      kind: 'Emergence', name: expressionRuleName, cause: `genetic.${genetic.name}.expression`,
      when: trueExpression(), needs: [],
      alters: array(genetic.expressions).map(expression => ({ target: expression.target, expression: cloneAst(expression.expression) })),
      calls: [], preserves: array(genetic.preserves).map(cloneAst),
      witnesses: [...array(genetic.witnesses), expressionWitness],
    },
    metadata: [
      {
        domain: 'genetic', declaration: genetic.name, directive: 'Inherit', stage: 'mutation', stageIndex: 1, stageCount: 2,
        syntheticRule: mutationRuleName, stateTargets: mutationTargets, preserveCount: 0, witness: mutationWitness,
        authorityClass: 'lineage-transformation', sourceReality: genetic.name, generationIndex, generationCount,
        originalWitnesses: [...array(genetic.witnesses)], finalStage: false,
      },
      {
        domain: 'genetic', declaration: genetic.name, directive: 'Inherit', stage: 'expression', stageIndex: 2, stageCount: 2,
        syntheticRule: expressionRuleName, stateTargets: expressionTargets, preserveCount: array(genetic.preserves).length,
        witness: expressionWitness, authorityClass: 'lineage-transformation', sourceReality: genetic.name,
        generationIndex, generationCount, originalWitnesses: [...array(genetic.witnesses)], finalStage: true,
        generationStateTargets: unique([...mutationTargets, ...expressionTargets]),
      },
    ],
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

  const enabledDomains = new Set(options.domains ?? ['perception', 'physical', 'neural', 'genetic', 'living']);
  const diagnostics = []; const lowered = []; const syntheticRules = [];
  const consumedDirectiveIndexes = new Set(); const consumedPerceptions = new Set();
  const consumedPhysicalLaws = new Set(); const consumedNeurals = new Set(); const consumedGenetics = new Set(); const consumedLivings = new Set();
  const rewrittenDirectives = [];
  const reservedRuleNames = new Set(array(program.rules).map(rule => rule?.name).filter(Boolean));
  let renamedSyntheticRuleCount = 0; let physicalLoweredStepCount = 0; let neuralLoweredTransactionCount = 0;
  let geneticLoweredGenerationCount = 0; let geneticLoweredStageCount = 0;
  let livingLoweredStepCount = 0; let livingLoweredStageCount = 0;

  const perceptions = array(program.perceptions);
  const perceptionsByName = new Map(perceptions.map(item => [item.name, item]));
  const physicals = array(program.physicals); const physicalLawByName = new Map();
  for (const physical of physicals) for (const law of array(physical?.laws)) physicalLawByName.set(law.name, law);
  const neurals = array(program.neurals); const neuralByName = new Map(neurals.map(item => [item.name, item]));
  const genetics = array(program.genetics); const geneticByName = new Map(genetics.map(item => [item.name, item]));
  const livings = array(program.livings); const livingByName = new Map(livings.map(item => [item.name, item]));

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

    if (directive?.kind === 'Live' && enabledDomains.has('living')) {
      const living = livingByName.get(directive.name);
      if (!living) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN', `Live target '${directive.name}' is not a declared living reality`, { directiveIndex: index, domain: 'living', target: directive.name }));
        rewrittenDirectives.push(directive); return;
      }
      const stepCount = literalStepCount(directive.count);
      if (stepCount === null) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_LIVING_DYNAMIC_STEPS_UNSUPPORTED', `Live '${living.name}' requires a literal step count between 1 and ${MAX_STATIC_DOMAIN_STEPS} for bounded staged direct lowering`, { directiveIndex: index, domain: 'living', declaration: living.name }));
        rewrittenDirectives.push(directive); return;
      }
      const hasSenseStage = array(living.senses).length > 0;
      const stageCount = array(living.cycles).length + (hasSenseStage ? 1 : 0);
      for (let stepIndex = 1; stepIndex <= stepCount; stepIndex += 1) {
        let stageOffset = 0;
        if (hasSenseStage) {
          stageOffset = 1;
          const allocation = allocateSyntheticRuleName(`__rcl_foundation_living_${sanitizeName(living.name)}_${index}_${stepIndex}_sense`, reservedRuleNames);
          if (allocation.renamed) { renamedSyntheticRuleCount += 1; diagnostics.push(collisionDiagnostic('living', living.name, index, allocation, { stepIndex, stage: 'sense' })); }
          const staged = livingSenseRule(living, allocation.ruleName, stepIndex, stepCount, stageCount);
          syntheticRules.push(staged.rule); rewrittenDirectives.push({ kind: 'Realize', rule: allocation.ruleName });
          lowered.push({ ...staged.metadata, directiveIndex: index }); livingLoweredStageCount += 1;
        }
        array(living.cycles).forEach((cycle, cycleOffset) => {
          const cycleIndex = cycleOffset + 1;
          const stageIndex = stageOffset + cycleIndex;
          const allocation = allocateSyntheticRuleName(`__rcl_foundation_living_${sanitizeName(cycle.name)}_${index}_${stepIndex}_${cycleIndex}`, reservedRuleNames);
          if (allocation.renamed) { renamedSyntheticRuleCount += 1; diagnostics.push(collisionDiagnostic('living', cycle.name, index, allocation, { stepIndex, cycleIndex, stage: 'cycle' })); }
          const staged = livingCycleRule(living, cycle, allocation.ruleName, stepIndex, stepCount, cycleIndex, stageIndex, stageCount);
          syntheticRules.push(staged.rule); rewrittenDirectives.push({ kind: 'Realize', rule: allocation.ruleName });
          lowered.push({ ...staged.metadata, directiveIndex: index }); livingLoweredStageCount += 1;
        });
        livingLoweredStepCount += 1;
      }
      consumedDirectiveIndexes.add(index); consumedLivings.add(living.name); return;
    }

    if (directive?.kind === 'Inherit' && enabledDomains.has('genetic')) {
      const genetic = geneticByName.get(directive.name);
      if (!genetic) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN', `Inherit target '${directive.name}' is not a declared genetic reality`, { directiveIndex: index, domain: 'genetic', target: directive.name }));
        rewrittenDirectives.push(directive); return;
      }
      const generationCount = literalStepCount(directive.count);
      if (generationCount === null) {
        diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_GENETIC_DYNAMIC_GENERATIONS_UNSUPPORTED', `Inherit '${genetic.name}' requires a literal generation count between 1 and ${MAX_STATIC_DOMAIN_STEPS} for bounded staged direct lowering`, { directiveIndex: index, domain: 'genetic', declaration: genetic.name }));
        rewrittenDirectives.push(directive); return;
      }
      for (let generationIndex = 1; generationIndex <= generationCount; generationIndex += 1) {
        const mutationAllocation = allocateSyntheticRuleName(`__rcl_foundation_genetic_${sanitizeName(genetic.name)}_${index}_${generationIndex}_mutation`, reservedRuleNames);
        const expressionAllocation = allocateSyntheticRuleName(`__rcl_foundation_genetic_${sanitizeName(genetic.name)}_${index}_${generationIndex}_expression`, reservedRuleNames);
        if (mutationAllocation.renamed) { renamedSyntheticRuleCount += 1; diagnostics.push(collisionDiagnostic('genetic', genetic.name, index, mutationAllocation, { generationIndex, stage: 'mutation' })); }
        if (expressionAllocation.renamed) { renamedSyntheticRuleCount += 1; diagnostics.push(collisionDiagnostic('genetic', genetic.name, index, expressionAllocation, { generationIndex, stage: 'expression' })); }
        const staged = geneticStageRules(genetic, mutationAllocation.ruleName, expressionAllocation.ruleName, generationIndex, generationCount);
        syntheticRules.push(staged.mutation, staged.expression);
        rewrittenDirectives.push({ kind: 'Realize', rule: mutationAllocation.ruleName }, { kind: 'Realize', rule: expressionAllocation.ruleName });
        lowered.push(...staged.metadata.map(item => ({ ...item, directiveIndex: index })));
        geneticLoweredGenerationCount += 1; geneticLoweredStageCount += 2;
      }
      consumedDirectiveIndexes.add(index); consumedGenetics.add(genetic.name); return;
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

  const remainingLiveTargets = new Set(rewrittenDirectives.filter(item => item?.kind === 'Live').map(item => item.name));
  const transformedLivings = livings.filter(living => !consumedLivings.has(living.name) || remainingLiveTargets.has(living.name));
  for (const living of transformedLivings) diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED', `Living reality '${living.name}' remains declared because no fully supported Live directive consumed it`, { domain: 'living', declaration: living.name }));

  const remainingInheritTargets = new Set(rewrittenDirectives.filter(item => item?.kind === 'Inherit').map(item => item.name));
  const transformedGenetics = genetics.filter(genetic => !consumedGenetics.has(genetic.name) || remainingInheritTargets.has(genetic.name));
  for (const genetic of transformedGenetics) diagnostics.push(diagnostic('RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED', `Genetic reality '${genetic.name}' remains declared because no fully supported Inherit directive consumed it`, { domain: 'genetic', declaration: genetic.name }));

  const transformed = {
    ...program, perceptions: remainingPerceptions, physicals: transformedPhysicals, neurals: transformedNeurals, genetics: transformedGenetics, livings: transformedLivings,
    rules: [...array(program.rules), ...syntheticRules], directives: rewrittenDirectives,
  };
  return {
    format: FOUNDATION_DIRECT_LOWERING_FORMAT, version: FOUNDATION_DIRECT_LOWERING_VERSION,
    program: transformed, lowered, diagnostics,
    summary: {
      loweredCount: lowered.length, syntheticRuleCount: syntheticRules.length, consumedDirectiveCount: consumedDirectiveIndexes.size,
      remainingPerceptionCount: remainingPerceptions.length, remainingPhysicalCount: transformedPhysicals.length,
      remainingNeuralCount: transformedNeurals.length, remainingGeneticCount: transformedGenetics.length, remainingLivingCount: transformedLivings.length,
      physicalLoweredStepCount, neuralLoweredTransactionCount, geneticLoweredGenerationCount, geneticLoweredStageCount, livingLoweredStepCount, livingLoweredStageCount,
      renamedSyntheticRuleCount, enabledDomains: [...enabledDomains].sort(),
    },
    truthBoundary: {
      directDomains: ['perception', 'physical', 'neural', 'genetic', 'living'].filter(domain => enabledDomains.has(domain)),
      stateTransitionParityTargeted: true, domainReceiptParityTargeted: true,
      physicalDirectLoweringBoundedToStaticStepCountAndDt: true,
      neuralDirectLoweringBoundedToStaticStepCount: true,
      geneticDirectLoweringBoundedToStaticGenerationCount: true,
      geneticUsesTwoStageMutationThenExpressionTransactions: true,
      geneticPreservesCheckedOnlyAfterExpressionStage: true,
      geneticDomainReceiptParityClaimed: false,
      livingDirectLoweringBoundedToStaticStepCount: true,
      livingSenseSynchronizationIsSeparateStageWhenSensesExist: true,
      livingCycleConditionsEvaluateAfterSenseSynchronizationAndPriorCycles: true,
      livingMaintainsCheckedOnlyOnTriggeredCycleStages: true,
      livingDomainReceiptParityClaimed: false,
      allFoundationDomainsNativeClaimed: false, providerBridgeRemovedGlobally: false,
    },
  };
}
