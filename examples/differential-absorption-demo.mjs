import {
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
} from '../src/differential-absorption-runner.mjs';

function referenceTransaction(input) {
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
    evidence: [{ claim: 'conservation', before: input.balance, after: nextBalance }],
    resourceDelta: { balance: -input.amount },
    authority: { actor: input.actor, capability: 'account.debit' },
    receipts: [{ runtime: 'reference', input }],
  });
}

function absorbedTransaction(input) {
  return referenceTransaction(structuredClone(input));
}

const report = await runIndependentDifferentialAbsorption({
  capability: 'transactional_debit',
  source: {
    id: 'sql_reference',
    runtime: 'reference-transaction-runtime',
    execute: referenceTransaction,
  },
  absorbed: {
    id: 'rcl_candidate',
    runtime: 'rcl-candidate-runtime',
    execute: absorbedTransaction,
  },
  cases: [
    { id: 'normal', input: { balance: 100, amount: 30, actor: 'owner' } },
    { id: 'boundary_zero', input: { balance: 100, amount: 0, actor: 'owner' } },
    { id: 'failure', input: { balance: 20, amount: 30, actor: 'owner' } },
  ],
  repeats: 2,
  negativeControls: [{
    id: 'credit_instead_of_debit',
    adapter: {
      id: 'mutated_candidate',
      runtime: 'rcl-mutant-runtime',
      execute(input) {
        if (input.amount > input.balance) return referenceTransaction(input);
        return createExecutionObservation({
          output: { nextBalance: input.balance + input.amount },
          effects: [{ kind: 'credit', amount: input.amount }],
          evidence: [{ claim: 'mutation' }],
          resourceDelta: { balance: input.amount },
          authority: { actor: input.actor, capability: 'account.debit' },
        });
      },
    },
    mustDifferCaseIds: ['normal', 'boundary_zero'],
  }],
});

console.log(JSON.stringify({
  capability: report.capability,
  passed: report.passed,
  score: report.score,
  promotionEligible: report.promotionEligible,
  cases: report.cases.map(item => ({
    id: item.id,
    equivalent: item.comparison.equivalent,
    sourceDeterministic: item.source.deterministic,
    absorbedDeterministic: item.absorbed.deterministic,
  })),
  negativeControls: report.negativeControls.map(control => ({
    id: control.id,
    detected: control.detected,
    detectedCaseIds: control.detectedCaseIds,
  })),
  coverage: report.coverage,
  boundary: report.boundary,
}, null, 2));
