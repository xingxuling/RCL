import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertFoundationCommit,
  evaluateFoundationCommit,
  validateFoundationGovernance,
  FoundationGovernanceGateError,
} from '../src/foundation-governance-gate.mjs';

function governance(overrides = {}) {
  return {
    explicitVariables: [{ name: 'world.energy', value: 12, unit: 'MJ' }],
    uncertainty: { status: 'bounded', variables: [{ name: 'world.energy', range: [10, 14] }] },
    providerCapabilities: { required: [], externalSideEffects: false },
    authorityRequirements: [],
    irreversibleEffects: [],
    invariants: [],
    adaptiveInvariantField: { version: '0.1.0', mode: 'static-plus-runtime', active: [] },
    causalParents: [{ kind: 'transition', root: 'a'.repeat(64) }],
    evidenceRequirements: [{ kind: 'rcl-transition-root', reference: 'b'.repeat(64), required: true }],
    ...overrides,
  };
}

test('structural 4R gate requires the full governance contract', () => {
  const valid = validateFoundationGovernance(governance());
  assert.equal(valid.passed, true);
  const invalid = validateFoundationGovernance({});
  assert.equal(invalid.passed, false);
  assert.ok(invalid.failures.includes('RCL_4R_PROVIDER_CAPABILITIES_REQUIRED'));
  assert.ok(invalid.failures.includes('RCL_4R_EVIDENCE_REQUIREMENTS_REQUIRED'));
});

test('contract version mismatch fails closed', () => {
  const result = validateFoundationGovernance(governance(), { contractVersion: '9.9.9' });
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes('RCL_4R_CONTRACT_VERSION_MISMATCH'));
});

test('commit gate rejects missing capability, evidence and invariant proof', () => {
  const g = governance({
    providerCapabilities: { required: [{ host: 'native:rcl', capability: 'state-transition', required: true }], externalSideEffects: false },
    invariants: [{ name: 'state-root-bound', required: true }],
  });
  const result = evaluateFoundationCommit(g, { evidenceRefs: [] });
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes('RCL_4R_PROVIDER_CAPABILITY_MISSING'));
  assert.ok(result.failures.includes('RCL_4R_EVIDENCE_MISSING'));
  assert.ok(result.failures.includes('RCL_4R_INVARIANT_UNSATISFIED'));
});

test('external or irreversible reality requires explicit approval', () => {
  const ref = 'b'.repeat(64);
  const g = governance({
    providerCapabilities: { required: [{ host: 'api:world', capability: 'write', required: true }], externalSideEffects: true },
    authorityRequirements: [{ capability: 'write', target: 'world', required: true }],
    irreversibleEffects: [{ classification: 'irreversible', effects: [{ id: 'advance', reversible: false }] }],
  });
  const context = {
    availableCapabilities: [{ host: 'api:world', capability: 'write', status: 'verified' }],
    authorityGrants: [{ capability: 'write', target: 'world', status: 'authorized' }],
    evidenceRefs: [ref],
  };
  const rejected = evaluateFoundationCommit(g, context);
  assert.equal(rejected.passed, false);
  assert.equal(rejected.sovereigntyGate, 'EXPLICIT_APPROVAL');
  assert.ok(rejected.failures.includes('RCL_4R_EXPLICIT_APPROVAL_REQUIRED'));
  const accepted = evaluateFoundationCommit(g, { ...context, explicitApproval: true });
  assert.equal(accepted.passed, true);
  assert.equal(accepted.status, 'ACCEPTED');
  assert.match(accepted.commitRoot, /^[0-9a-f]{64}$/);
});

test('authorized bounded reality produces deterministic commit root', () => {
  const ref = 'b'.repeat(64);
  const g = governance();
  const context = { evidenceRefs: [ref] };
  const first = assertFoundationCommit(g, context);
  const second = assertFoundationCommit(g, context);
  assert.equal(first.commitRoot, second.commitRoot);
  assert.equal(first.sovereigntyGate, 'AUTONOMOUS');
});

test('assertFoundationCommit exposes one fail-closed error surface', () => {
  assert.throws(
    () => assertFoundationCommit(governance(), { evidenceRefs: [] }),
    error => error instanceof FoundationGovernanceGateError && error.code === 'RCL_FOUNDATION_4R_GATE_FAILED',
  );
});
