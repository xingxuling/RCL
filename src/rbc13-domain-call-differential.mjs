import { quantity, measurement } from './quantity.mjs';
import { knowledgeClaim } from './knowledge.mjs';
import { runIndependentDifferentialAbsorption } from './differential-absorption-runner.mjs';
import { invokeRbc13DomainCallReference } from './rbc13-domain-call-salvage.mjs';

export const RBC13_DOMAIN_CALL_DIFFERENTIAL_FORMAT =
  'taowind.rcl-rbc13-domain-call-differential.v0.1';

function invokeCurrentOracle(input) {
  const { domain, operation, args = [] } = input ?? {};
  const key = `${domain}.${operation}`;
  if (key === 'core.echo') return args[0];
  if (key === 'quantity.make') {
    return quantity(args[0], args[1], args[2] || undefined);
  }
  if (key === 'quantitative.measure') {
    return measurement(args[0], args[1], {
      uncertainty: args[2],
      confidence: args[3],
      unit: args[4] || undefined,
      scale: args[5],
      evidence: args[6],
      calibratedBy: args[7] || null,
    });
  }
  if (key === 'knowledge.claim') {
    return knowledgeClaim(args[0], args[1], {
      confidence: args[2],
      evidence: args[3],
      source: args[4] || null,
      scope: args[5],
      status: args[6],
      dependencies: args[7],
      revision: args[8],
      formedAtRoot: args[9] || null,
    });
  }
  const error = new Error(`Current oracle does not expose '${key}'`);
  error.code = 'RCL_DOMAIN_OPERATION_MISSING';
  throw error;
}

function sourceAdapterExecute(input) {
  return invokeRbc13DomainCallReference(
    input?.domain,
    input?.operation,
    input?.args ?? [],
  );
}

function currentOracleAdapterExecute(input) {
  return invokeCurrentOracle(input);
}

function mutationControlExecute(input) {
  return {
    mutation: 'wrap-output',
    original: invokeCurrentOracle(input),
  };
}

export const RBC13_DOMAIN_CALL_DIFFERENTIAL_CASES = Object.freeze([
  Object.freeze({
    id: 'core_echo_text',
    tags: ['positive', 'core'],
    input: Object.freeze({ domain: 'core', operation: 'echo', args: Object.freeze(['hello']) }),
  }),
  Object.freeze({
    id: 'quantity_temperature',
    tags: ['positive', 'quantity'],
    input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['Temperature', 25, '']) }),
  }),
  Object.freeze({
    id: 'measurement_number',
    tags: ['positive', 'quantitative'],
    input: Object.freeze({
      domain: 'quantitative',
      operation: 'measure',
      args: Object.freeze(['Number', 42, 0.25, 0.9, '', 'ratio', Object.freeze(['probe:A']), 'probe-A']),
    }),
  }),
  Object.freeze({
    id: 'knowledge_number',
    tags: ['positive', 'knowledge'],
    input: Object.freeze({
      domain: 'knowledge',
      operation: 'claim',
      args: Object.freeze(['Number', 42, 0.8, Object.freeze(['probe:A']), 'lab', 'local', 'provisional', Object.freeze([]), 1, 'root-1']),
    }),
  }),
  Object.freeze({
    id: 'invalid_quantity_type',
    tags: ['negative', 'quantity', 'type'],
    input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['NotAQuantity', 1, '']) }),
  }),
  Object.freeze({
    id: 'invalid_measurement_confidence',
    tags: ['negative', 'quantitative', 'range'],
    input: Object.freeze({
      domain: 'quantitative',
      operation: 'measure',
      args: Object.freeze(['Number', 42, 0.25, 2, '', 'ratio', Object.freeze([]), null]),
    }),
  }),
]);

export async function runRbc13DomainCallDifferential(options = {}) {
  const report = await runIndependentDifferentialAbsorption({
    capability: 'rbc13_domain_call_reference_salvage',
    source: {
      id: 'legacy_domain_call_reference',
      runtime: 'rcl-stale-reference-semantics-reconstructed-on-current-modules',
      provenance: [
        'agent/advanced-runtime-rcl:src/runtime.mjs#invokeInternalDomain',
        'research/rbc13-domain-call-salvage-v0.1:src/rbc13-domain-call-salvage.mjs',
      ],
      execute: sourceAdapterExecute,
    },
    absorbed: {
      id: 'current_module_oracle',
      runtime: 'rcl-current-source-modules',
      provenance: [
        'src/quantity.mjs',
        'src/knowledge.mjs',
      ],
      execute: currentOracleAdapterExecute,
    },
    cases: RBC13_DOMAIN_CALL_DIFFERENTIAL_CASES,
    repeats: options.repeats ?? 3,
    timeoutMs: options.timeoutMs ?? 5_000,
    requireDeterministicReplay: true,
    requireNegativeControl: true,
    negativeControls: [
      {
        id: 'wrapped_output_mutant',
        mustDifferCaseIds: RBC13_DOMAIN_CALL_DIFFERENTIAL_CASES
          .filter(item => item.tags.includes('positive'))
          .map(item => item.id),
        adapter: {
          id: 'domain_call_wrapped_output_mutant',
          runtime: 'rcl-current-source-modules-mutant',
          provenance: ['synthetic-negative-control:wrap-output'],
          execute: mutationControlExecute,
        },
      },
    ],
  });

  return Object.freeze({
    format: RBC13_DOMAIN_CALL_DIFFERENTIAL_FORMAT,
    status: report.passed ? 'PASS' : 'FAIL',
    migrationParityPassed: report.passed,
    nativePromotionAllowed: false,
    genericPromotionEligible: report.promotionEligible,
    evidenceScore: report.score,
    differentialRoot: report.root,
    caseCount: report.caseCount,
    passedCaseCount: report.passedCaseCount,
    controlsPassed: report.controlsPassed,
    coverage: report.coverage,
    boundary:
      'This proves current-process migration parity between two separately invoked source adapters. It does not prove RBC 1.3 lowering, native-VM parity, Foundation authority equivalence, or canonical promotion.',
    report,
  });
}
