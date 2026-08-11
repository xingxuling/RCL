import { quantity, measurement } from './quantity.mjs';
import { knowledgeClaim } from './knowledge.mjs';
import { RCLRuntimeError } from './errors.mjs';
import {
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
} from './differential-absorption-runner.mjs';
import { invokeRbc13DomainCallReference } from './rbc13-domain-call-salvage.mjs';

export const RBC13_DOMAIN_OPERATION_DIFFERENTIAL_FORMAT =
  'taowind.rcl-rbc13-domain-operation-differential.v0.1';

export const RBC13_ADMITTED_DOMAIN_OPERATION_KEYS = Object.freeze([
  'core.echo',
  'quantity.make',
  'quantitative.measure',
  'knowledge.claim',
]);

function currentOracle(input) {
  const key = `${input?.domain}.${input?.operation}`;
  const args = input?.args ?? [];
  if (key === 'core.echo') {
    if (args.length !== 1) throw new RCLRuntimeError('RCL_DOMAIN_CORE_ECHO_ARITY', 'core.echo expects one argument');
    return args[0];
  }
  if (key === 'quantity.make') return quantity(args[0], args[1], args[2] || undefined);
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
  throw new RCLRuntimeError(
    'RCL_DOMAIN_OPERATION_MISSING',
    `Domain operation '${key}' is not present in the RBC 1.3 salvage inventory`,
    { key },
  );
}

function pureOperationObservation(output) {
  return createExecutionObservation({
    status: 'ok',
    output,
    effects: [{
      kind: 'internal-domain-evaluation',
      externalMutation: false,
      persistentMutation: false,
    }],
    evidence: [{
      kind: 'semantic-contract',
      contract: 'rbc13-domain-operation-differential.v0.1',
    }],
    resourceDelta: {
      externalResourcesCreated: 0,
      externalResourcesMutated: 0,
      persistentStateMutation: false,
    },
    authority: {
      required: false,
      boundary: 'pure-internal-domain-operation',
    },
    exitCode: 0,
  });
}

function sourceExecute(input) {
  return pureOperationObservation(invokeRbc13DomainCallReference(
    input?.domain,
    input?.operation,
    input?.args ?? [],
  ));
}

function currentExecute(input) {
  return pureOperationObservation(currentOracle(input));
}

function mutantExecute(input) {
  return pureOperationObservation({
    mutation: 'wrap-output',
    output: currentOracle(input),
  });
}

const temperature25 = quantity('Temperature', 25);
const temperatureHalf = quantity('Temperature', 0.5);

const CASES = Object.freeze({
  'core.echo': Object.freeze([
    Object.freeze({ id: 'echo_text', tags: ['positive'], input: Object.freeze({ domain: 'core', operation: 'echo', args: Object.freeze(['hello']) }) }),
    Object.freeze({ id: 'echo_number', tags: ['positive'], input: Object.freeze({ domain: 'core', operation: 'echo', args: Object.freeze([42]) }) }),
    Object.freeze({ id: 'echo_truth', tags: ['positive'], input: Object.freeze({ domain: 'core', operation: 'echo', args: Object.freeze([true]) }) }),
    Object.freeze({ id: 'echo_sequence', tags: ['positive'], input: Object.freeze({ domain: 'core', operation: 'echo', args: Object.freeze([Object.freeze(['a', 1, true])]) }) }),
    Object.freeze({ id: 'echo_dynamic_dispatch', tags: ['positive', 'dynamic'], input: Object.freeze({ domain: 'core', operation: 'echo', dynamic: true, args: Object.freeze(['dynamic']) }) }),
    Object.freeze({ id: 'echo_invalid_dispatch', tags: ['negative', 'dispatch'], input: Object.freeze({ domain: 'core', operation: 'missing', args: Object.freeze(['x']) }) }),
    Object.freeze({ id: 'echo_invalid_arity', tags: ['negative', 'arity'], input: Object.freeze({ domain: 'core', operation: 'echo', args: Object.freeze([]) }) }),
  ]),
  'quantity.make': Object.freeze([
    Object.freeze({ id: 'quantity_temperature_default_unit', tags: ['positive'], input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['Temperature', 25, '']) }) }),
    Object.freeze({ id: 'quantity_length_custom_unit', tags: ['positive'], input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['Length', 2, 'cm']) }) }),
    Object.freeze({ id: 'quantity_invalid_type', tags: ['negative'], input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['Warp', 1, '']) }) }),
    Object.freeze({ id: 'quantity_non_finite_value', tags: ['negative', 'non-finite'], input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['Temperature', Number.NaN, '']) }) }),
    Object.freeze({ id: 'quantity_invalid_value_parameter', tags: ['negative', 'parameter'], input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['Temperature', 'not-a-number', '']) }) }),
    Object.freeze({ id: 'quantity_missing_value_parameter', tags: ['negative', 'parameter'], input: Object.freeze({ domain: 'quantity', operation: 'make', args: Object.freeze(['Temperature']) }) }),
  ]),
  'quantitative.measure': Object.freeze([
    Object.freeze({
      id: 'measure_number', tags: ['positive'],
      input: Object.freeze({ domain: 'quantitative', operation: 'measure', args: Object.freeze(['Number', 42, 0.25, 0.9, '', 'ratio', Object.freeze(['probe:A']), 'probe-A']) }),
    }),
    Object.freeze({
      id: 'measure_temperature', tags: ['positive'],
      input: Object.freeze({ domain: 'quantitative', operation: 'measure', args: Object.freeze(['Temperature', temperature25, temperatureHalf, 0.9, '', 'ratio', Object.freeze(['sensor:e1', 'sensor:e1', 'sensor:e2']), 'sensor-A']) }),
    }),
    Object.freeze({
      id: 'measure_invalid_confidence', tags: ['negative'],
      input: Object.freeze({ domain: 'quantitative', operation: 'measure', args: Object.freeze(['Number', 42, 0.25, 2, '', 'ratio', Object.freeze([]), '']) }),
    }),
    Object.freeze({
      id: 'measure_type_mismatch', tags: ['negative'],
      input: Object.freeze({ domain: 'quantitative', operation: 'measure', args: Object.freeze(['Number', 'forty-two', 0.25, 0.9, '', 'ratio', Object.freeze([]), '']) }),
    }),
    Object.freeze({
      id: 'measure_uncertainty_type_mismatch', tags: ['negative'],
      input: Object.freeze({ domain: 'quantitative', operation: 'measure', args: Object.freeze(['Number', 42, 'quarter', 0.9, '', 'ratio', Object.freeze([]), '']) }),
    }),
  ]),
  'knowledge.claim': Object.freeze([
    Object.freeze({
      id: 'knowledge_number', tags: ['positive'],
      input: Object.freeze({ domain: 'knowledge', operation: 'claim', args: Object.freeze(['Number', 42, 0.8, Object.freeze(['probe:A']), 'lab', 'local', 'provisional', Object.freeze([]), 1, 'root-1']) }),
    }),
    Object.freeze({
      id: 'knowledge_temperature_deduplicates_sets', tags: ['positive'],
      input: Object.freeze({ domain: 'knowledge', operation: 'claim', args: Object.freeze(['Temperature', temperature25, 0.8, Object.freeze(['e1', 'e1', 'e2']), 'lab', 'local', 'provisional', Object.freeze(['dep:a', 'dep:a', 'dep:b']), 1, 'root-1']) }),
    }),
    Object.freeze({
      id: 'knowledge_invalid_confidence', tags: ['negative'],
      input: Object.freeze({ domain: 'knowledge', operation: 'claim', args: Object.freeze(['Number', 42, 2, Object.freeze([]), '', 'local', 'provisional', Object.freeze([]), 1, '']) }),
    }),
    Object.freeze({
      id: 'knowledge_type_mismatch', tags: ['negative'],
      input: Object.freeze({ domain: 'knowledge', operation: 'claim', args: Object.freeze(['Text', 42, 0.8, Object.freeze([]), '', 'local', 'provisional', Object.freeze([]), 1, '']) }),
    }),
  ]),
});

function capabilityId(operationKey) {
  return `rbc13_domain_${operationKey.replaceAll('.', '_')}`;
}

export function rbc13DomainOperationCases(operationKey) {
  if (!RBC13_ADMITTED_DOMAIN_OPERATION_KEYS.includes(operationKey)) {
    throw new TypeError(`Unsupported admitted domain operation '${operationKey}'`);
  }
  return CASES[operationKey];
}

export async function runRbc13DomainOperationDifferential(operationKey, options = {}) {
  const cases = rbc13DomainOperationCases(operationKey);
  const positiveIds = cases.filter(item => item.tags.includes('positive')).map(item => item.id);
  const report = await runIndependentDifferentialAbsorption({
    capability: capabilityId(operationKey),
    source: {
      id: `legacy_${operationKey.replaceAll('.', '_')}_reference`,
      runtime: 'rcl-stale-reference-semantics-reconstructed-on-current-modules',
      provenance: [
        'agent/advanced-runtime-rcl:src/runtime.mjs#invokeInternalDomain',
        'src/rbc13-domain-call-salvage.mjs',
      ],
      execute: sourceExecute,
    },
    absorbed: {
      id: `current_${operationKey.replaceAll('.', '_')}_oracle`,
      runtime: 'rcl-current-source-modules',
      provenance: ['src/quantity.mjs', 'src/knowledge.mjs'],
      execute: currentExecute,
    },
    cases,
    repeats: options.repeats ?? 3,
    timeoutMs: options.timeoutMs ?? 5_000,
    requireDeterministicReplay: true,
    requireNegativeControl: true,
    negativeControls: [{
      id: `${operationKey.replaceAll('.', '_')}_wrapped_output_mutant`,
      mustDifferCaseIds: positiveIds,
      adapter: {
        id: `${operationKey.replaceAll('.', '_')}_mutant`,
        runtime: 'rcl-current-source-modules-mutant',
        provenance: ['synthetic-negative-control:wrap-output'],
        execute: mutantExecute,
      },
    }],
  });

  return Object.freeze({
    format: RBC13_DOMAIN_OPERATION_DIFFERENTIAL_FORMAT,
    operationKey,
    capability: report.capability,
    status: report.passed ? 'PASS' : 'FAIL',
    passed: report.passed,
    promotionEligible: report.promotionEligible,
    evidenceScore: report.score,
    differentialRoot: report.root,
    caseCount: report.caseCount,
    passedCaseCount: report.passedCaseCount,
    controlsPassed: report.controlsPassed,
    coverage: report.coverage,
    nativeVerificationClaimed: false,
    boundary:
      'Operation-scoped semantic differential evidence can qualify an implementation for native-candidate evaluation. It does not prove opcode-45 native execution or Native Promotion.',
    report,
  });
}

export async function runAllRbc13DomainOperationDifferentials(options = {}) {
  const reports = [];
  for (const operationKey of RBC13_ADMITTED_DOMAIN_OPERATION_KEYS) {
    reports.push(await runRbc13DomainOperationDifferential(operationKey, options));
  }
  return Object.freeze(reports);
}
