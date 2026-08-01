import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT,
  RCLDifferentialAbsorptionError,
  attachIndependentDifferentialEvidence,
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
} from '../src/differential-absorption-runner.mjs';

function transfer(input) {
  if (input.amount > input.balance) {
    const error = new Error('insufficient funds');
    error.code = 'INSUFFICIENT_FUNDS';
    error.details = { balance: input.balance, amount: input.amount };
    throw error;
  }
  const nextBalance = input.balance - input.amount;
  return createExecutionObservation({
    output: { nextBalance },
    effects: [{ kind: 'debit', amount: input.amount }],
    evidence: [{ claim: 'balance-preserved', before: input.balance, after: nextBalance }],
    receipts: [{ runtimeReceipt: `${input.balance}:${input.amount}` }],
    resourceDelta: { balance: -input.amount },
    authority: { actor: input.actor, capability: 'account.debit' },
  });
}

const cases = [
  { id: 'normal_transfer', input: { balance: 100, amount: 30, actor: 'owner' }, tags: ['success'] },
  { id: 'zero_transfer', input: { balance: 100, amount: 0, actor: 'owner' }, tags: ['boundary'] },
  { id: 'insufficient_funds', input: { balance: 20, amount: 30, actor: 'owner' }, tags: ['error'] },
];

test('independent differential runner verifies output, error, effects, evidence, resources, authority and negative controls', async () => {
  const report = await runIndependentDifferentialAbsorption({
    capability: 'transactional_debit',
    source: { id: 'source_sql', runtime: 'sqlite-reference', execute: input => transfer(input) },
    absorbed: { id: 'absorbed_rcl', runtime: 'rcl-js-candidate', execute: input => transfer({ ...input }) },
    cases,
    repeats: 2,
    negativeControls: [{
      id: 'wrong_balance_mutant',
      adapter: {
        id: 'absorbed_mutant',
        runtime: 'rcl-js-mutant',
        execute(input) {
          if (input.amount > input.balance) return transfer(input);
          return createExecutionObservation({
            output: { nextBalance: input.balance + input.amount },
            effects: [{ kind: 'credit', amount: input.amount }],
            evidence: [{ claim: 'mutated' }],
            resourceDelta: { balance: input.amount },
            authority: { actor: input.actor, capability: 'account.debit' },
          });
        },
      },
      mustDifferCaseIds: ['normal_transfer', 'zero_transfer'],
    }],
  });

  assert.equal(report.format, RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT);
  assert.equal(report.passed, true);
  assert.equal(report.passedCaseCount, 3);
  assert.equal(report.failedCaseCount, 0);
  assert.equal(report.controlsPassed, true);
  assert.equal(report.negativeControls[0].detected, true);
  assert.equal(report.coverage.successObserved, true);
  assert.equal(report.coverage.errorObserved, true);
  assert.equal(report.coverage.effectsObserved, true);
  assert.equal(report.coverage.evidenceObserved, true);
  assert.equal(report.coverage.resourceDeltaObserved, true);
  assert.equal(report.coverage.authorityObserved, true);
  assert.equal(report.promotionEligible, true);
  assert.ok(report.score >= 0.8);
});

test('semantic output mismatch is rejected', async () => {
  const report = await runIndependentDifferentialAbsorption({
    capability: 'mismatch_probe',
    source: { id: 'source', runtime: 'source-runtime', execute: input => ({ value: input.value }) },
    absorbed: { id: 'absorbed', runtime: 'absorbed-runtime', execute: input => ({ value: input.value + 1 }) },
    cases: [{ id: 'mismatch', input: { value: 1 } }],
    requireNegativeControl: false,
  });
  assert.equal(report.passed, false);
  assert.equal(report.failedCaseCount, 1);
  assert.equal(report.cases[0].comparison.equivalent, false);
});

test('nondeterministic absorbed replay is rejected even when first output matches', async () => {
  let counter = 0;
  const report = await runIndependentDifferentialAbsorption({
    capability: 'replay_probe',
    source: { id: 'source', runtime: 'source-runtime', execute: () => 1 },
    absorbed: { id: 'absorbed', runtime: 'absorbed-runtime', execute: () => { counter += 1; return counter; } },
    cases: [{ id: 'replay', input: null }],
    repeats: 2,
    requireNegativeControl: false,
  });
  assert.equal(report.cases[0].comparison.equivalent, true);
  assert.equal(report.cases[0].absorbed.deterministic, false);
  assert.equal(report.cases[0].comparison.passed, false);
  assert.equal(report.passed, false);
});

test('shared executor reference fails the independence gate', async () => {
  const execute = input => input;
  await assert.rejects(
    () => runIndependentDifferentialAbsorption({
      capability: 'independence_probe',
      source: { id: 'source', runtime: 'source-runtime', execute },
      absorbed: { id: 'absorbed', runtime: 'absorbed-runtime', execute },
      cases: [{ id: 'same', input: 1 }],
      requireNegativeControl: false,
    }),
    error => error instanceof RCLDifferentialAbsorptionError && error.code === 'RCL_DIFFERENTIAL_INDEPENDENCE_REQUIRED',
  );
});

test('timeouts become comparable error observations rather than uncaught failures', async () => {
  const report = await runIndependentDifferentialAbsorption({
    capability: 'timeout_probe',
    source: { id: 'source', runtime: 'source-runtime', execute: async () => new Promise(resolve => setTimeout(() => resolve(1), 30)) },
    absorbed: { id: 'absorbed', runtime: 'absorbed-runtime', execute: async () => new Promise(resolve => setTimeout(() => resolve(1), 30)) },
    cases: [{ id: 'timeout', input: null }],
    repeats: 1,
    timeoutMs: 5,
    requireNegativeControl: false,
  });
  assert.equal(report.passed, false);
  assert.equal(report.cases[0].comparison.equivalent, true);
  assert.equal(report.cases[0].comparison.infrastructureFailure, true);
  assert.equal(report.cases[0].source.primary.status, 'error');
  assert.equal(report.cases[0].source.primary.error.code, 'RCL_DIFFERENTIAL_EXECUTION_TIMEOUT');
});

test('differential evidence can be attached to a matching metabolism report', async () => {
  const differential = await runIndependentDifferentialAbsorption({
    capability: 'attach_probe',
    source: { id: 'source', runtime: 'source-runtime', execute: input => input },
    absorbed: { id: 'absorbed', runtime: 'absorbed-runtime', execute: input => structuredClone(input) },
    cases: [{ id: 'same', input: { value: 1 } }],
    requireNegativeControl: false,
  });
  const metabolism = {
    format: 'rcl.capability-metabolism-report.v0.1',
    capability: 'attach_probe',
    root: 'metabolism-root',
    equivalence: { root: 'declared-root' },
  };
  const envelope = attachIndependentDifferentialEvidence(metabolism, differential);
  assert.equal(envelope.verificationTier, 'independent-differential');
  assert.equal(envelope.independentDifferentialRoot, differential.root);
});
