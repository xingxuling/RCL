import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCapabilitiesFromJsonSchema,
  metabolizeSourceCapabilityBundle,
} from '../src/source-capability-frontends.mjs';

test('an extracted JSON Schema capability enters the real metabolism compiler as semantic-absorbed', () => {
  const bundle = extractCapabilitiesFromJsonSchema({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'MinimalNode',
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1 } },
  }, { includeDefinitions: false });

  const batch = metabolizeSourceCapabilityBundle(bundle, { subject: 'source_frontend_integration_test' });
  assert.equal(batch.format, 'rcl.source-capability-metabolism-batch.v0.1');
  assert.equal(batch.capabilityCount, 1);
  assert.equal(batch.stageCounts['semantic-absorbed'], 1);
  assert.equal(batch.reports[0].specRoot, bundle.capabilities[0].root);
  assert.equal(batch.reports[0].assessment.stage, 'semantic-absorbed');
  assert.match(batch.reports[0].generatedRcl, /dialect json_schema_minimalnode/);
  assert.match(batch.reports[0].generatedRcl, /effect ValidateStructure/);
  assert.equal(batch.reports[0].equivalence.caseCount, 0);
});
