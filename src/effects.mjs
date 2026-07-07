import { compileReality } from './compiler.mjs';
import { realityRoot } from './canonical.mjs';

export const RCL_EFFECT_SYSTEM_VERSION = '0.13.0-alpha.1';

export const RCL_EFFECT_KINDS = Object.freeze({
  AUTHORITY: 'Authority',
  WARRANT: 'Warrant',
  PRESERVE: 'Preserve',
  ALTER_REALITY: 'AlterReality',
  HOST_CALL: 'HostCall',
  OBSERVE: 'Observe',
  EVIDENCE: 'Evidence',
});

function expressionRoot(expression) {
  return expression ? realityRoot(expression) : null;
}

function actorForRule(rule) {
  return rule.cause ?? rule.from ?? null;
}

function normalizeEffect(effect) {
  const normalized = {
    kind: effect.kind,
    source: effect.source ?? null,
    subject: effect.subject ?? null,
    capability: effect.capability ?? null,
    target: effect.target ?? null,
    host: effect.host ?? null,
    operation: effect.operation ?? null,
    deterministic: effect.deterministic ?? true,
    replay: effect.replay ?? 'deterministic',
    evidenceRequired: Boolean(effect.evidenceRequired),
    expressionRoot: effect.expressionRoot ?? null,
  };
  return Object.freeze({ ...normalized, root: realityRoot(normalized) });
}

export function analyzeProgramEffects(sourceOrProgram) {
  const program = typeof sourceOrProgram === 'string' ? compileReality(sourceOrProgram) : sourceOrProgram;
  const effects = [];
  const byRule = [];

  for (const warrant of program.warrants ?? []) {
    effects.push(normalizeEffect({
      kind: RCL_EFFECT_KINDS.WARRANT,
      source: `subject:${warrant.subject}`,
      subject: warrant.subject,
      capability: warrant.capability,
      target: warrant.target,
      deterministic: true,
      replay: warrant.condition ? 'conditioned' : 'deterministic',
      expressionRoot: expressionRoot(warrant.condition),
    }));
  }

  for (const host of program.hosts ?? []) {
    for (const offer of host.offers ?? []) {
      effects.push(normalizeEffect({
        kind: RCL_EFFECT_KINDS.HOST_CALL,
        source: `host:${host.name}`,
        host: host.name,
        operation: offer.name,
        capability: `${host.name}.${offer.name}`,
        target: host.name,
        deterministic: false,
        replay: 'requires-provider-receipt',
        evidenceRequired: true,
      }));
    }
  }

  for (const rule of program.rules ?? []) {
    const ruleEffects = [];
    const actor = actorForRule(rule);
    for (const need of rule.needs ?? []) {
      ruleEffects.push(normalizeEffect({
        kind: RCL_EFFECT_KINDS.AUTHORITY,
        source: `rule:${rule.name}`,
        subject: actor,
        capability: need.capability,
        target: need.target,
        deterministic: true,
        replay: 'checked-before-transition',
      }));
    }
    for (const alter of rule.alters ?? []) {
      ruleEffects.push(normalizeEffect({
        kind: RCL_EFFECT_KINDS.ALTER_REALITY,
        source: `rule:${rule.name}`,
        subject: actor,
        target: alter.target,
        deterministic: true,
        replay: 'transition-delta',
        evidenceRequired: true,
        expressionRoot: expressionRoot(alter.expression),
      }));
    }
    for (const preserve of rule.preserves ?? []) {
      ruleEffects.push(normalizeEffect({
        kind: RCL_EFFECT_KINDS.PRESERVE,
        source: `rule:${rule.name}`,
        subject: actor,
        deterministic: true,
        replay: 'boundary-check',
        expressionRoot: expressionRoot(preserve),
      }));
    }
    for (const call of rule.calls ?? []) {
      ruleEffects.push(normalizeEffect({
        kind: RCL_EFFECT_KINDS.HOST_CALL,
        source: `rule:${rule.name}`,
        subject: actor,
        host: call.host,
        operation: call.capability,
        capability: call.fullCapability ?? `${call.host}.${call.capability}`,
        target: call.target,
        deterministic: false,
        replay: 'requires-simulator-or-receipt',
        evidenceRequired: true,
      }));
    }
    for (const witness of rule.witnesses ?? []) {
      ruleEffects.push(normalizeEffect({
        kind: RCL_EFFECT_KINDS.EVIDENCE,
        source: `rule:${rule.name}`,
        subject: actor,
        target: witness,
        deterministic: true,
        replay: 'literal-witness',
      }));
    }
    effects.push(...ruleEffects);
    byRule.push(Object.freeze({
      rule: rule.name,
      actor,
      effects: ruleEffects,
      root: realityRoot({ rule: rule.name, actor, effects: ruleEffects.map(effect => effect.root) }),
    }));
  }

  for (const domain of [
    ...(program.metaDomains ?? []), ...(program.physicals ?? []), ...(program.perceptions ?? []),
    ...(program.neurals ?? []), ...(program.livings ?? []), ...(program.genetics ?? []),
    ...(program.quantitatives ?? []), ...(program.knowledges ?? []), ...(program.naturalLanguages ?? []),
    ...(program.understandings ?? []), ...(program.creations ?? []), ...(program.spacetimes ?? []),
    ...(program.accelerations ?? []), ...(program.compressions ?? []), ...(program.energies ?? []),
    ...(program.elements ?? []), ...(program.sciences ?? []), ...(program.embodiments ?? []), ...(program.spirits ?? []),
  ]) {
    for (const preserve of domain.preserves ?? []) {
      effects.push(normalizeEffect({
        kind: RCL_EFFECT_KINDS.PRESERVE,
        source: `domain:${domain.name}`,
        target: domain.name,
        deterministic: true,
        replay: 'domain-boundary-check',
        expressionRoot: expressionRoot(preserve),
      }));
    }
  }

  const counts = effects.reduce((acc, effect) => {
    acc[effect.kind] = (acc[effect.kind] ?? 0) + 1;
    return acc;
  }, {});
  const profile = {
    format: 'rcl.effect-profile.v0.13',
    version: RCL_EFFECT_SYSTEM_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    counts,
    effects,
    rules: byRule,
  };
  return Object.freeze({ ...profile, root: realityRoot({ ...profile, effects: effects.map(effect => effect.root), rules: byRule.map(rule => rule.root) }) });
}

export function createEffectSignature(sourceOrProgram) {
  const profile = analyzeProgramEffects(sourceOrProgram);
  const signature = {
    format: 'rcl.effect-signature.v0.13',
    version: RCL_EFFECT_SYSTEM_VERSION,
    program: profile.program,
    programRoot: profile.programRoot,
    counts: profile.counts,
    effectRoots: profile.effects.map(effect => effect.root),
  };
  return Object.freeze({ ...signature, root: realityRoot(signature) });
}
