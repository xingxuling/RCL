import crypto from 'node:crypto';
import { FOUNDATION_CONTRACT_VERSION } from './foundation-contract.mjs';

export const FOUNDATION_GOVERNANCE_GATE_FORMAT = 'taowind.rcl-foundation-governance-gate.v0.1';
export const FOUNDATION_GOVERNANCE_GATE_VERSION = '0.1.0';

export class FoundationGovernanceGateError extends Error {
  constructor(code, details = {}) {
    super(`${code}${Object.keys(details).length ? `:${JSON.stringify(details)}` : ''}`);
    this.name = 'FoundationGovernanceGateError';
    this.code = code;
    this.details = structuredClone(details);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableRoot(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function hasArray(value, key) {
  return value && Array.isArray(value[key]);
}

function structuralFailures(governance, contractVersion = FOUNDATION_CONTRACT_VERSION) {
  const failures = [];
  if (contractVersion !== FOUNDATION_CONTRACT_VERSION) failures.push('RCL_4R_CONTRACT_VERSION_MISMATCH');
  if (!governance || typeof governance !== 'object' || Array.isArray(governance)) {
    failures.push('RCL_4R_GOVERNANCE_REQUIRED');
    return failures;
  }
  if (!hasArray(governance, 'explicitVariables')) failures.push('RCL_4R_EXPLICIT_VARIABLES_REQUIRED');
  if (!governance.uncertainty || typeof governance.uncertainty !== 'object') failures.push('RCL_4R_UNCERTAINTY_REQUIRED');
  if (!governance.providerCapabilities || typeof governance.providerCapabilities !== 'object' || !Array.isArray(governance.providerCapabilities.required) || typeof governance.providerCapabilities.externalSideEffects !== 'boolean') failures.push('RCL_4R_PROVIDER_CAPABILITIES_REQUIRED');
  if (!hasArray(governance, 'authorityRequirements')) failures.push('RCL_4R_AUTHORITY_REQUIREMENTS_REQUIRED');
  if (!hasArray(governance, 'irreversibleEffects')) failures.push('RCL_4R_IRREVERSIBLE_EFFECTS_REQUIRED');
  if (!hasArray(governance, 'invariants')) failures.push('RCL_4R_INVARIANTS_REQUIRED');
  if (!governance.adaptiveInvariantField || typeof governance.adaptiveInvariantField !== 'object' || !Array.isArray(governance.adaptiveInvariantField.active)) failures.push('RCL_4R_ADAPTIVE_INVARIANT_FIELD_REQUIRED');
  if (!hasArray(governance, 'causalParents')) failures.push('RCL_4R_CAUSAL_PARENTS_REQUIRED');
  if (!hasArray(governance, 'evidenceRequirements')) failures.push('RCL_4R_EVIDENCE_REQUIREMENTS_REQUIRED');
  return failures;
}

export function validateFoundationGovernance(governance, { contractVersion = FOUNDATION_CONTRACT_VERSION } = {}) {
  const failures = structuralFailures(governance, contractVersion);
  return {
    format: FOUNDATION_GOVERNANCE_GATE_FORMAT,
    version: FOUNDATION_GOVERNANCE_GATE_VERSION,
    contractVersion,
    passed: failures.length === 0,
    failures,
    governanceRoot: failures.includes('RCL_4R_GOVERNANCE_REQUIRED') ? null : stableRoot(governance),
  };
}

function objectIdentity(value, fields) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const picked = Object.fromEntries(fields.filter(field => value[field] !== undefined).map(field => [field, value[field]]));
  return Object.keys(picked).length ? JSON.stringify(canonicalize(picked)) : JSON.stringify(canonicalize(value));
}

function requirementSatisfied(requirement, available, fields) {
  if (requirement?.required === false) return true;
  const expected = objectIdentity(requirement, fields);
  return available.some(candidate => {
    if (candidate?.status && !['verified', 'authorized', 'active', 'approved'].includes(String(candidate.status))) return false;
    return objectIdentity(candidate, fields) === expected;
  });
}

function evidenceSatisfied(requirement, evidenceRefs) {
  if (requirement?.required === false) return true;
  const expected = typeof requirement === 'string' ? requirement : requirement?.reference ?? requirement?.evidence_id ?? requirement?.root ?? requirement?.kind;
  if (!expected) return false;
  return evidenceRefs.some(candidate => {
    const actual = typeof candidate === 'string' ? candidate : candidate?.reference ?? candidate?.evidence_id ?? candidate?.root ?? candidate?.kind;
    return actual === expected;
  });
}

function invariantName(value) {
  if (typeof value === 'string') return value;
  return value?.name ?? value?.id ?? value?.expression ?? null;
}

function invariantPassed(name, invariantResults) {
  if (!name) return false;
  if (Array.isArray(invariantResults)) {
    const found = invariantResults.find(item => invariantName(item) === name);
    return Boolean(found && (found.passed === true || found.status === 'pass' || found.status === 'satisfied'));
  }
  const value = invariantResults?.[name];
  return value === true || value?.passed === true || value?.status === 'pass' || value?.status === 'satisfied';
}

function isIrreversible(effect) {
  if (!effect || typeof effect !== 'object') return false;
  if (effect.reversible === false) return true;
  const classification = String(effect.classification ?? effect.riskLevel ?? '').toLowerCase();
  if (['irreversible', 'permanent', 'critical'].includes(classification)) return true;
  return Array.isArray(effect.effects) && effect.effects.some(item => item?.reversible === false);
}

export function evaluateFoundationCommit(governance, context = {}) {
  const structural = validateFoundationGovernance(governance, { contractVersion: context.contractVersion ?? FOUNDATION_CONTRACT_VERSION });
  const failures = [...structural.failures];
  if (!structural.passed) {
    return {
      ...structural,
      status: 'REJECTED',
      sovereigntyGate: 'EXPLICIT_APPROVAL',
      requiresExplicitApproval: true,
      commitRoot: null,
    };
  }

  const availableCapabilities = context.availableCapabilities ?? [];
  const authorityGrants = context.authorityGrants ?? [];
  const evidenceRefs = context.evidenceRefs ?? [];
  const invariantResults = context.invariantResults ?? {};

  const requiredCapabilities = governance.providerCapabilities.required.filter(item => item?.required !== false);
  for (const requirement of requiredCapabilities) {
    if (!requirementSatisfied(requirement, availableCapabilities, ['provider', 'host', 'capability'])) {
      failures.push('RCL_4R_PROVIDER_CAPABILITY_MISSING');
      break;
    }
  }

  for (const requirement of governance.authorityRequirements.filter(item => item?.required !== false)) {
    if (!requirementSatisfied(requirement, authorityGrants, ['action', 'scope', 'capability', 'target'])) {
      failures.push('RCL_4R_AUTHORITY_GRANT_MISSING');
      break;
    }
  }

  for (const requirement of governance.evidenceRequirements.filter(item => item?.required !== false)) {
    if (!evidenceSatisfied(requirement, evidenceRefs)) {
      failures.push('RCL_4R_EVIDENCE_MISSING');
      break;
    }
  }

  const activeInvariants = [...governance.invariants, ...governance.adaptiveInvariantField.active];
  for (const invariant of activeInvariants) {
    const name = invariantName(invariant);
    const required = typeof invariant === 'object' ? invariant.required !== false : true;
    if (required && !invariantPassed(name, invariantResults)) {
      failures.push('RCL_4R_INVARIANT_UNSATISFIED');
      break;
    }
  }

  const irreversible = governance.irreversibleEffects.some(isIrreversible);
  const externalSideEffects = governance.providerCapabilities.externalSideEffects === true;
  const requiresExplicitApproval = irreversible || externalSideEffects;
  if (requiresExplicitApproval && context.explicitApproval !== true) failures.push('RCL_4R_EXPLICIT_APPROVAL_REQUIRED');

  const decision = {
    format: FOUNDATION_GOVERNANCE_GATE_FORMAT,
    version: FOUNDATION_GOVERNANCE_GATE_VERSION,
    contractVersion: context.contractVersion ?? FOUNDATION_CONTRACT_VERSION,
    governanceRoot: structural.governanceRoot,
    status: failures.length ? 'REJECTED' : 'ACCEPTED',
    passed: failures.length === 0,
    failures: [...new Set(failures)],
    sovereigntyGate: requiresExplicitApproval ? 'EXPLICIT_APPROVAL' : 'AUTONOMOUS',
    requiresExplicitApproval,
    evaluated: {
      requiredCapabilities: requiredCapabilities.length,
      authorityRequirements: governance.authorityRequirements.length,
      evidenceRequirements: governance.evidenceRequirements.length,
      activeInvariants: activeInvariants.length,
      irreversible,
      externalSideEffects,
    },
  };
  decision.commitRoot = decision.passed ? stableRoot(decision) : null;
  return decision;
}

export function assertFoundationCommit(governance, context = {}) {
  const decision = evaluateFoundationCommit(governance, context);
  if (!decision.passed) throw new FoundationGovernanceGateError('RCL_FOUNDATION_4R_GATE_FAILED', { failures: decision.failures });
  return decision;
}
