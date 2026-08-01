import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCapabilitiesFromJsonSchema,
  metabolizeSourceCapabilityBundle,
} from '../src/source-capability-frontends.mjs';

function compactReport(batch, bundle) {
  const report = batch?.reports?.[0] ?? null;
  return {
    batchFormat: batch?.format ?? null,
    capabilityCount: batch?.capabilityCount ?? null,
    stageCounts: batch?.stageCounts ?? null,
    bundleRoot: bundle?.root ?? null,
    capabilityRoot: bundle?.capabilities?.[0]?.root ?? null,
    reportRoot: report?.root ?? null,
    specRoot: report?.specRoot ?? null,
    stage: report?.assessment?.stage ?? null,
    score: report?.assessment?.score ?? null,
    assessmentErrors: report?.assessment?.errors ?? null,
    assessmentGaps: report?.assessment?.gaps ?? null,
    equivalenceCaseCount: report?.equivalence?.caseCount ?? null,
    generatedRclPrefix: typeof report?.generatedRcl === 'string'
      ? report.generatedRcl.slice(0, 500)
      : null,
  };
}

test('an extracted JSON Schema capability enters the real metabolism compiler as semantic-absorbed', () => {
  const bundle = extractCapabilitiesFromJsonSchema({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'MinimalNode',
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1 } },
  }, { includeDefinitions: false });

  let batch;
  try {
    batch = metabolizeSourceCapabilityBundle(bundle, { subject: 'source_frontend_integration_test' });
  } catch (error) {
    const diagnostic = {
      kind: 'metabolism-exception',
      name: error?.name ?? null,
      code: error?.code ?? null,
      message: error?.message ?? String(error),
      details: error?.details ?? null,
      stack: error?.stack ?? null,
      bundleRoot: bundle.root,
      capabilityRoot: bundle.capabilities[0].root,
    };
    assert.fail(`SOURCE_FRONTEND_METABOLISM_EXCEPTION ${JSON.stringify(diagnostic)}`);
  }

  const diagnostic = compactReport(batch, bundle);
  const message = `SOURCE_FRONTEND_METABOLISM_DIAGNOSTIC ${JSON.stringify(diagnostic)}`;

  assert.equal(batch.format, 'rcl.source-capability-metabolism-batch.v0.1', message);
  assert.equal(batch.capabilityCount, 1, message);
  assert.equal(batch.stageCounts['semantic-absorbed'], 1, message);
  assert.equal(batch.reports[0].specRoot, bundle.capabilities[0].root, message);
  assert.equal(batch.reports[0].assessment.stage, 'semantic-absorbed', message);
  assert.match(batch.reports[0].generatedRcl, /dialect json_schema_minimalnode/, message);
  assert.match(batch.reports[0].generatedRcl, /effect ValidateStructure/, message);
  assert.equal(batch.reports[0].equivalence.caseCount, 0, message);
});
