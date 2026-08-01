import test from 'node:test';
import assert from 'node:assert/strict';
import { realityRoot } from '../src/canonical.mjs';
import { createExecutionObservation } from '../src/differential-absorption-runner.mjs';
import {
  extractCapabilitiesFromJsonSchema,
  extractCapabilitiesFromOpenApi,
} from '../src/source-capability-frontends.mjs';
import { forgeEquivalenceCorpus } from '../src/equivalence-corpus-forge.mjs';
import { createMutationPlan } from '../src/equivalence-corpus-common.mjs';
import {
  RCL_EXECUTABLE_NEGATIVE_CONTROL_SET_FORMAT,
  RCLExecutableNegativeControlError,
  synthesizeExecutableNegativeControls,
  runCorpusDifferentialExperiment,
} from '../src/executable-negative-controls.mjs';
import {
  RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT,
  analyzeCorpusFeedback,
  materializeAdaptiveCorpusRevision,
  runAdaptiveCorpusLoop,
} from '../src/adaptive-corpus-loop.mjs';

function richAccept(output) {
  return createExecutionObservation({
    output,
    effects: [{ kind: 'contract-evaluation' }],
    evidence: [{ claim: 'fixture-oracle' }],
    resourceDelta: { reads: 1 },
    authority: { capability: 'contract.evaluate' },
    exitCode: 0,
  });
}

function reject(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function jsonSchemaOracle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return reject('TYPE', 'root must be object');
  }
  if (!Object.hasOwn(input, 'id')) return reject('REQUIRED', 'id required');
  if (typeof input.id !== 'string') return reject('TYPE', 'id must be string');
  if (input.id.length < 1) return reject('MIN_LENGTH', 'id too short');
  if (Object.keys(input).some(key => key !== 'id')) {
    return reject('ADDITIONAL_PROPERTY', 'closed object');
  }
  return richAccept({ decision: 'accept', normalized: { id: input.id } });
}

const jsonSchemaSource = input => jsonSchemaOracle(input);
const jsonSchemaAbsorbed = input => jsonSchemaOracle(structuredClone(input));

function openApiOracle(input) {
  if (input?.mode === 'response') {
    if (String(input.status) !== '200') {
      return reject('UNDECLARED_STATUS', 'status is not declared');
    }
    return richAccept({ decision: 'accept', mode: 'response', status: '200' });
  }
  return richAccept({ decision: 'accept', mode: 'request' });
}

const openApiSource = input => openApiOracle(input);
const openApiAbsorbed = input => openApiOracle(structuredClone(input));

function schemaCorpus() {
  const bundle = extractCapabilitiesFromJsonSchema({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Identity',
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'string', minLength: 1 } },
  }, { includeDefinitions: false });
  return forgeEquivalenceCorpus(bundle);
}

function openApiCorpus() {
  const bundle = extractCapabilitiesFromOpenApi({
    openapi: '3.1.2',
    info: { title: 'Ping API', version: '1.0.0' },
    paths: {
      '/ping': {
        get: {
          operationId: 'ping',
          responses: { 200: { description: 'pong' } },
        },
      },
    },
  });
  return forgeEquivalenceCorpus(bundle);
}

test('synthesizes one executable negative-control adapter per bound mutation plan', () => {
  const corpus = schemaCorpus();
  const capabilityCorpus = corpus.corpora[0];
  const controls = synthesizeExecutableNegativeControls(capabilityCorpus, {
    baselineAdapter: {
      id: 'absorbed-json-schema',
      runtime: 'fixture-rcl-validator',
      execute: jsonSchemaAbsorbed,
    },
  });
  assert.equal(controls.format, RCL_EXECUTABLE_NEGATIVE_CONTROL_SET_FORMAT);
  assert.equal(controls.coverageComplete, true);
  assert.equal(controls.requiredPlanIds.length, capabilityCorpus.mutationPlanCount);
  assert.equal(controls.negativeControls.length, capabilityCorpus.mutationPlanCount);
  assert.equal(controls.blockedPlans.length, 0);
  assert.ok(controls.executablePlans.every(item => item.detectionCaseIds.length > 0));
});

test('corpus experiment executes generated cases and executable mutants', async () => {
  const corpus = schemaCorpus();
  const report = await runCorpusDifferentialExperiment({
    corpus,
    capability: corpus.corpora[0].capability,
    source: {
      id: 'json-schema-source',
      runtime: 'fixture-source-validator',
      execute: jsonSchemaSource,
    },
    absorbed: {
      id: 'json-schema-absorbed',
      runtime: 'fixture-rcl-validator',
      execute: jsonSchemaAbsorbed,
    },
    repeats: 2,
  });
  assert.equal(report.passed, true);
  assert.equal(report.promotionEligible, true);
  assert.equal(report.differential.controlsPassed, true);
  assert.ok(report.differential.negativeControls.every(control => control.detected));
  assert.equal(report.blockedNegativeControlCount, 0);
});

test('negative controls do not fabricate detection for an already-permissive baseline', async () => {
  const corpus = schemaCorpus();
  const alwaysAcceptSource = input => richAccept({ decision: 'accept', input });
  const alwaysAcceptAbsorbed = input => richAccept({
    decision: 'accept',
    input: structuredClone(input),
  });
  const report = await runCorpusDifferentialExperiment({
    corpus,
    capability: corpus.corpora[0].capability,
    source: { id: 'permissive-source', runtime: 'fixture-source', execute: alwaysAcceptSource },
    absorbed: { id: 'permissive-absorbed', runtime: 'fixture-rcl', execute: alwaysAcceptAbsorbed },
    repeats: 1,
  });
  assert.equal(report.promotionEligible, false);
  assert.equal(report.differential.controlsPassed, false);
  assert.ok(report.differential.negativeControls.some(control => control.detected === false));
});

test('stale content roots are rejected before executable mutation synthesis', () => {
  const corpus = structuredClone(schemaCorpus().corpora[0]);
  corpus.cases[0].input.id = 'tampered-without-new-root';
  assert.throws(
    () => synthesizeExecutableNegativeControls(corpus, {
      baselineAdapter: {
        id: 'absorbed-json-schema',
        runtime: 'fixture-rcl-validator',
        execute: jsonSchemaAbsorbed,
      },
    }),
    error => error instanceof RCLExecutableNegativeControlError
      && error.code === 'RCL_EXECUTABLE_CONTROL_CASE_INTEGRITY',
  );
});

test('an unbound mutation plan becomes a blocking control', async () => {
  const corpus = openApiCorpus();
  const capabilityCorpus = corpus.corpora[0];
  const controls = synthesizeExecutableNegativeControls(capabilityCorpus, {
    baselineAdapter: {
      id: 'openapi-absorbed',
      runtime: 'fixture-openapi-runtime',
      execute: openApiAbsorbed,
    },
  });
  assert.equal(controls.coverageComplete, false);
  assert.ok(controls.blockedPlanIds.some(id => id.includes('accept_undeclared_status')));
  assert.equal(controls.negativeControls.length, controls.requiredPlanIds.length);

  const experiment = await runCorpusDifferentialExperiment({
    corpus: capabilityCorpus,
    source: { id: 'openapi-source', runtime: 'fixture-source-runtime', execute: openApiSource },
    absorbed: { id: 'openapi-absorbed', runtime: 'fixture-rcl-runtime', execute: openApiAbsorbed },
    repeats: 2,
  });
  assert.equal(experiment.passed, false);
  assert.equal(experiment.promotionEligible, false);
  assert.ok(experiment.differential.negativeControls.some(control => control.detected === false));
});

test('adaptive feedback forges and binds an undeclared-status probe', async () => {
  const corpus = openApiCorpus().corpora[0];
  const experiment = await runCorpusDifferentialExperiment({
    corpus,
    source: { id: 'openapi-source', runtime: 'fixture-source-runtime', execute: openApiSource },
    absorbed: { id: 'openapi-absorbed', runtime: 'fixture-rcl-runtime', execute: openApiAbsorbed },
  });
  const cycle = analyzeCorpusFeedback({ corpus, feedback: experiment, iteration: 1 });
  assert.equal(cycle.status, 'adaptation-proposed');
  assert.ok(cycle.supplementalCases.some(testCase => testCase.input?.status === '591'));
  assert.ok(cycle.gaps.some(gap => gap.kind === 'mutation-plan-unbound'));

  const revision = materializeAdaptiveCorpusRevision({ corpus, cycle });
  assert.equal(revision.format, RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT);
  assert.ok(revision.caseCount > corpus.caseCount);
  const rebound = revision.mutationPlans.find(
    plan => plan.operator === 'accept_undeclared_status',
  );
  assert.ok(rebound.expectedDetectionCaseIds.length > 0);
});

test('adaptive loop reruns the revision and converges', async () => {
  const corpus = openApiCorpus().corpora[0];
  const loop = await runAdaptiveCorpusLoop({
    corpus,
    source: { id: 'openapi-source', runtime: 'fixture-source-runtime', execute: openApiSource },
    absorbed: { id: 'openapi-absorbed', runtime: 'fixture-rcl-runtime', execute: openApiAbsorbed },
    maxIterations: 3,
    repeats: 2,
  });
  assert.equal(loop.status, 'converged');
  assert.equal(loop.converged, true);
  assert.equal(loop.promotionEligible, true);
  assert.equal(loop.iterationCount, 2);
  assert.equal(loop.finalCycle.status, 'sufficient');
  assert.ok(loop.corpus.caseCount > corpus.caseCount);
});

test('adaptive corpus and cycle roots are deterministic', async () => {
  const corpus = openApiCorpus().corpora[0];
  const run = async () => {
    const experiment = await runCorpusDifferentialExperiment({
      corpus,
      source: { id: 'openapi-source', runtime: 'fixture-source-runtime', execute: openApiSource },
      absorbed: { id: 'openapi-absorbed', runtime: 'fixture-rcl-runtime', execute: openApiAbsorbed },
      repeats: 1,
    });
    const cycle = analyzeCorpusFeedback({ corpus, feedback: experiment, iteration: 1 });
    return { cycle, revision: materializeAdaptiveCorpusRevision({ corpus, cycle }) };
  };
  const first = await run();
  const second = await run();
  assert.equal(first.cycle.root, second.cycle.root);
  assert.equal(first.revision.root, second.revision.root);
});

test('unsupported mutation operators stay blocked', async () => {
  const base = schemaCorpus().corpora[0];
  const unsupportedPlan = createMutationPlan({
    id: 'unsupported_operator',
    capability: base.capability,
    operator: 'rewrite_time_itself',
    target: '$',
    description: 'unsupported',
    expectedDetectionCaseIds: [base.cases[0].id],
  });
  const { root: _baseRoot, ...baseBody } = base;
  const corpusBody = {
    ...baseBody,
    mutationPlanCount: 1,
    mutationPlans: [unsupportedPlan],
    mutationPlanRoots: [unsupportedPlan.root],
  };
  const corpus = {
    ...corpusBody,
    root: realityRoot({
      ...corpusBody,
      cases: corpusBody.caseRoots,
      mutationPlans: corpusBody.mutationPlanRoots,
    }),
  };
  const report = await runCorpusDifferentialExperiment({
    corpus,
    source: { id: 'json-source', runtime: 'fixture-source', execute: jsonSchemaSource },
    absorbed: { id: 'json-absorbed', runtime: 'fixture-rcl', execute: jsonSchemaAbsorbed },
    repeats: 1,
  });
  assert.equal(report.promotionEligible, false);
  assert.ok(report.controlSet.blockedPlans[0].reasons.includes('operator-handler-unavailable'));
});

test('capability stack exports executable controls and adaptive APIs', async () => {
  const stack = await import('../src/capability-absorption-stack.mjs');
  assert.equal(typeof stack.synthesizeExecutableNegativeControls, 'function');
  assert.equal(typeof stack.runCorpusDifferentialExperiment, 'function');
  assert.equal(typeof stack.analyzeCorpusFeedback, 'function');
  assert.equal(typeof stack.runAdaptiveCorpusLoop, 'function');
});
