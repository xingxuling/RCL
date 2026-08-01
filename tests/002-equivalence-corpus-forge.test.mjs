import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCapabilitiesFromJsonSchema,
  extractCapabilitiesFromOpenApi,
  extractCapabilitiesFromSqlDdl,
} from '../src/source-capability-frontends.mjs';
import {
  RCL_EQUIVALENCE_CORPUS_FORMAT,
  RCLEquivalenceCorpusError,
  createDifferentialExperimentPlan,
  differentialCasesFromCorpus,
  forgeEquivalenceCorpus,
} from '../src/equivalence-corpus-forge.mjs';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Order',
  type: 'object',
  required: ['id', 'total'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 8 },
    total: { type: 'number', minimum: 0 },
    state: { enum: ['new', 'paid'] },
  },
};

const openApi = {
  openapi: '3.1.2',
  info: { title: 'Order API', version: '1.0.0' },
  paths: {
    '/orders/{id}': {
      get: {
        operationId: 'getOrder',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'ok' }, 404: { description: 'missing' } },
      },
    },
    '/orders': {
      post: {
        operationId: 'createOrder',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: { description: 'created' } },
      },
    },
  },
};

const sql = `
CREATE TABLE accounts (
  id BIGINT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0)
);
CREATE TABLE transfers (
  id BIGINT PRIMARY KEY,
  from_account BIGINT NOT NULL REFERENCES accounts(id),
  amount NUMERIC(12,2) NOT NULL,
  UNIQUE (from_account, id)
);
`;

test('forges deterministic JSON Schema valid, invalid and boundary cases', () => {
  const bundle = extractCapabilitiesFromJsonSchema(schema, { includeDefinitions: false });
  const first = forgeEquivalenceCorpus(bundle);
  const second = forgeEquivalenceCorpus(bundle);
  assert.equal(first.format, RCL_EQUIVALENCE_CORPUS_FORMAT);
  assert.equal(first.root, second.root);
  const corpus = first.corpora[0];
  assert.ok(corpus.cases.some(item => item.id.includes('valid_minimal')));
  assert.ok(corpus.cases.some(item => item.id.includes('invalid_missing_id') && item.expected.status === 'reject'));
  assert.ok(corpus.cases.some(item => item.id.includes('boundary_min_length_id')));
  assert.ok(corpus.cases.some(item => item.id.includes('invalid_additional_property')));
  assert.ok(corpus.mutationPlanCount >= 4);
});

test('forges one OpenAPI corpus per operation without invoking the network', () => {
  const bundle = extractCapabilitiesFromOpenApi(openApi);
  const forged = forgeEquivalenceCorpus(bundle);
  assert.equal(forged.capabilityCount, 2);
  const read = forged.corpora.find(item => item.capability === 'openapi_getorder');
  const create = forged.corpora.find(item => item.capability === 'openapi_createorder');
  assert.ok(read.cases.some(item => item.id.includes('missing_path_id')));
  assert.ok(read.cases.some(item => item.input.mode === 'response'));
  assert.ok(create.cases.some(item => item.id.includes('missing_request_body')));
  assert.ok(create.diagnostics.some(item => item.code === 'RCL_CORPUS_OPENAPI_NO_NETWORK_EXECUTION'));
});

test('forges SQL transaction probes for not-null, uniqueness, references and checks', () => {
  const bundle = extractCapabilitiesFromSqlDdl(sql);
  const forged = forgeEquivalenceCorpus(bundle);
  const accounts = forged.corpora.find(item => item.capability === 'sql_table_accounts');
  const transfers = forged.corpora.find(item => item.capability === 'sql_table_transfers');
  assert.ok(accounts.cases.some(item => item.id.includes('invalid_null_email')));
  assert.ok(accounts.cases.some(item => item.id.includes('invalid_duplicate_id')));
  assert.ok(accounts.cases.some(item => item.id.includes('check_probe_balance') && item.expected.status === 'observe'));
  assert.ok(transfers.cases.some(item => item.id.includes('invalid_reference_from_account')));
});

test('converts a capability corpus into differential runner cases without fabricating outputs', () => {
  const forged = forgeEquivalenceCorpus(extractCapabilitiesFromJsonSchema(schema, { includeDefinitions: false }));
  const cases = differentialCasesFromCorpus(forged, { includeObserve: false });
  assert.ok(cases.length > 0);
  for (const item of cases) {
    assert.equal(Object.hasOwn(item, 'sourceOutput'), false);
    assert.equal(Object.hasOwn(item, 'absorbedOutput'), false);
    assert.ok(item.tags.some(tag => tag.startsWith('expected:')));
  }
});

test('creates an execution plan that requires independent adapters and makes no verdict', () => {
  const forged = forgeEquivalenceCorpus(extractCapabilitiesFromJsonSchema(schema, { includeDefinitions: false }));
  const plan = createDifferentialExperimentPlan(forged);
  assert.equal(plan.executionRequirements.sourceAdapterRequired, true);
  assert.equal(plan.executionRequirements.absorbedAdapterRequired, true);
  assert.equal(plan.executionRequirements.distinctAdapterDescriptorsRequired, true);
  assert.equal(Object.hasOwn(plan, 'passed'), false);
  assert.match(plan.boundary, /not a differential report/);
});

test('requires explicit capability selection for multi-capability batches', () => {
  const forged = forgeEquivalenceCorpus(extractCapabilitiesFromOpenApi(openApi));
  assert.throws(
    () => differentialCasesFromCorpus(forged),
    error => error instanceof RCLEquivalenceCorpusError
      && error.code === 'RCL_CORPUS_CAPABILITY_SELECTION_REQUIRED',
  );
  const cases = differentialCasesFromCorpus(forged, { capability: 'openapi_getorder' });
  assert.ok(cases.length > 0);
});

test('honors deterministic per-capability case budgets', () => {
  const bundle = extractCapabilitiesFromJsonSchema(schema, { includeDefinitions: false });
  const forged = forgeEquivalenceCorpus(bundle, { maxCasesPerCapability: 3 });
  assert.equal(forged.corpora[0].caseCount, 3);
  assert.equal(forged.corpora[0].coverage.truncated, true);
});

test('rejects unsupported capability ecosystems rather than guessing', () => {
  assert.throws(
    () => forgeEquivalenceCorpus({
      id: 'unknown_capability',
      source: { ecosystem: 'unknown', construct: 'unknown', version: '0' },
      semantics: { invariants: ['unknown invariant'] },
    }),
    error => error instanceof RCLEquivalenceCorpusError
      && error.code === 'RCL_CORPUS_FRONTEND_UNSUPPORTED',
  );
});
