import { createExecutionObservation } from '../src/differential-absorption-runner.mjs';
import { extractCapabilitiesFromOpenApi } from '../src/source-capability-frontends.mjs';
import { forgeEquivalenceCorpus } from '../src/equivalence-corpus-forge.mjs';
import { runAdaptiveCorpusLoop } from '../src/adaptive-corpus-loop.mjs';

const bundle = extractCapabilitiesFromOpenApi({
  openapi: '3.1.2',
  info: { title: 'Adaptive Ping API', version: '1.0.0' },
  paths: {
    '/ping': {
      get: {
        operationId: 'ping',
        responses: { 200: { description: 'pong' } },
      },
    },
  },
});

const corpus = forgeEquivalenceCorpus(bundle).corpora[0];

function accepted(output) {
  return createExecutionObservation({
    output,
    effects: [{ kind: 'contract-evaluation' }],
    evidence: [{ kind: 'fixture-oracle' }],
    resourceDelta: { contractReads: 1 },
    authority: { capability: 'api.contract.evaluate' },
    exitCode: 0,
  });
}

function fixtureContractRuntime(input) {
  if (input?.mode === 'response' && String(input.status) !== '200') {
    const error = new Error('response status is not declared by the fixture contract');
    error.code = 'UNDECLARED_RESPONSE_STATUS';
    throw error;
  }
  return accepted({
    decision: 'accept',
    mode: input?.mode ?? 'request',
    status: input?.status ?? null,
  });
}

const report = await runAdaptiveCorpusLoop({
  corpus,
  source: {
    id: 'fixture_openapi_source',
    runtime: 'fixture-openapi-contract-runtime',
    execute: input => fixtureContractRuntime(input),
  },
  absorbed: {
    id: 'fixture_rcl_candidate',
    runtime: 'fixture-rcl-contract-runtime',
    execute: input => fixtureContractRuntime(structuredClone(input)),
  },
  repeats: 2,
  maxIterations: 3,
});

console.log(JSON.stringify({
  capability: report.capability,
  status: report.status,
  converged: report.converged,
  promotionEligible: report.promotionEligible,
  initialCorpusRoot: corpus.root,
  finalCorpusRoot: report.finalCorpusRoot,
  initialCaseCount: corpus.caseCount,
  finalCaseCount: report.corpus.caseCount,
  iterations: report.iterations.map(item => ({
    iteration: item.iteration,
    passed: item.passed,
    promotionEligible: item.promotionEligible,
    cycleStatus: item.cycleStatus,
    corpusRoot: item.corpusRoot,
    differentialRoot: item.differentialRoot,
  })),
  finalNegativeControls: report.finalExperiment.differential.negativeControls.map(control => ({
    id: control.id,
    detected: control.detected,
    detectedCaseIds: control.detectedCaseIds,
  })),
  boundary: report.boundary,
}, null, 2));
