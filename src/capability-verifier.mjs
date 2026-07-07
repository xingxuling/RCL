import { RCLError } from './errors.mjs';
import { realityRoot } from './canonical.mjs';
import { analyzeProgramEffects, RCL_EFFECT_KINDS } from './effects.mjs';

export const RCL_CAPABILITY_VERIFIER_VERSION = '0.13.0-alpha.1';

export class RCLCapabilityError extends RCLError {
  constructor(diagnostics, details = {}) {
    super('RCL_CAPABILITY_REJECTED', diagnostics.map(item => item.message).join('; '), { diagnostics, ...details });
    this.name = 'RCLCapabilityError';
    this.diagnostics = diagnostics;
  }
}

function diagnostic(code, message, effect = null) {
  return { code, message, effectRoot: effect?.root ?? null, kind: effect?.kind ?? null, source: effect?.source ?? null };
}

function scopeMatches(granted, required) {
  if (granted === '*' || granted === required) return true;
  if (!granted || !required) return false;
  return required.startsWith(`${granted}.`);
}

function normalizeCapabilitySpec(spec) {
  if (typeof spec === 'string') {
    const [capability, target = '*'] = spec.includes('@') ? spec.split('@') : [spec, '*'];
    return { capability, target };
  }
  return { capability: spec.capability ?? '*', target: spec.target ?? '*' };
}

function capabilityAllowed(effect, specs) {
  if (!specs || specs.length === 0) return true;
  return specs.map(normalizeCapabilitySpec).some(spec => {
    const cap = spec.capability === '*' || spec.capability === effect.capability;
    const target = spec.target === '*' || scopeMatches(spec.target, effect.target ?? '*');
    return cap && target;
  });
}

function hostCapabilityAllowed(effect, specs) {
  if (!specs || specs.length === 0) return true;
  const full = effect.capability ?? `${effect.host}.${effect.operation}`;
  return specs.some(spec => spec === '*' || spec === full || (spec.endsWith('.*') && full.startsWith(spec.slice(0, -1))));
}

export function verifyProgramCapabilities(sourceOrProgram, policy = {}) {
  const profile = analyzeProgramEffects(sourceOrProgram);
  const diagnostics = [];
  const allowedEffects = policy.allowedEffects ? new Set(policy.allowedEffects) : null;
  const deniedEffects = new Set(policy.deniedEffects ?? []);
  const budget = policy.budget ?? {};

  for (const effect of profile.effects) {
    if (allowedEffects && !allowedEffects.has(effect.kind)) diagnostics.push(diagnostic('RCL_CAPABILITY_EFFECT_NOT_ALLOWED', `Effect '${effect.kind}' is outside the allowed effect set`, effect));
    if (deniedEffects.has(effect.kind)) diagnostics.push(diagnostic('RCL_CAPABILITY_EFFECT_DENIED', `Effect '${effect.kind}' is explicitly denied`, effect));
    if ([RCL_EFFECT_KINDS.AUTHORITY, RCL_EFFECT_KINDS.WARRANT].includes(effect.kind) && !capabilityAllowed(effect, policy.capabilities)) {
      diagnostics.push(diagnostic('RCL_CAPABILITY_SCOPE_DENIED', `Capability '${effect.capability}' on '${effect.target}' is outside policy scope`, effect));
    }
    if (effect.kind === RCL_EFFECT_KINDS.HOST_CALL && !hostCapabilityAllowed(effect, policy.hostCapabilities)) {
      diagnostics.push(diagnostic('RCL_HOST_CAPABILITY_DENIED', `Host capability '${effect.capability}' is outside policy scope`, effect));
    }
    if (policy.requireDeterministicReplay && effect.deterministic === false) {
      diagnostics.push(diagnostic('RCL_NONDETERMINISTIC_EFFECT', `Effect '${effect.kind}' requires an external simulator, receipt or provider replay`, effect));
    }
  }

  const count = kind => profile.counts[kind] ?? 0;
  if (budget.maxEffects !== undefined && profile.effects.length > budget.maxEffects) diagnostics.push(diagnostic('RCL_CAPABILITY_BUDGET_EFFECTS', `Effect count ${profile.effects.length} exceeds budget ${budget.maxEffects}`));
  if (budget.maxAlterations !== undefined && count(RCL_EFFECT_KINDS.ALTER_REALITY) > budget.maxAlterations) diagnostics.push(diagnostic('RCL_CAPABILITY_BUDGET_ALTERS', `AlterReality count ${count(RCL_EFFECT_KINDS.ALTER_REALITY)} exceeds budget ${budget.maxAlterations}`));
  if (budget.maxHostCalls !== undefined && count(RCL_EFFECT_KINDS.HOST_CALL) > budget.maxHostCalls) diagnostics.push(diagnostic('RCL_CAPABILITY_BUDGET_HOST_CALLS', `HostCall count ${count(RCL_EFFECT_KINDS.HOST_CALL)} exceeds budget ${budget.maxHostCalls}`));
  if (budget.maxRules !== undefined && profile.rules.length > budget.maxRules) diagnostics.push(diagnostic('RCL_CAPABILITY_BUDGET_RULES', `Rule count ${profile.rules.length} exceeds budget ${budget.maxRules}`));

  const report = {
    format: 'rcl.capability-verification.v0.13',
    version: RCL_CAPABILITY_VERIFIER_VERSION,
    status: diagnostics.length === 0 ? 'verified' : 'rejected',
    program: profile.program,
    programRoot: profile.programRoot,
    profileRoot: profile.root,
    diagnostics,
    policy: {
      allowedEffects: policy.allowedEffects ?? null,
      deniedEffects: policy.deniedEffects ?? [],
      capabilities: policy.capabilities ?? null,
      hostCapabilities: policy.hostCapabilities ?? null,
      budget,
      requireDeterministicReplay: Boolean(policy.requireDeterministicReplay),
    },
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export function assertProgramCapabilities(sourceOrProgram, policy = {}) {
  const report = verifyProgramCapabilities(sourceOrProgram, policy);
  if (report.status !== 'verified') throw new RCLCapabilityError(report.diagnostics, { reportRoot: report.root });
  return report;
}
