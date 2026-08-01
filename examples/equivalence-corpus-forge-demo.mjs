import {
  extractCapabilitiesFromJsonSchema,
  extractCapabilitiesFromOpenApi,
  extractCapabilitiesFromSqlDdl,
} from '../src/source-capability-frontends.mjs';
import {
  createDifferentialExperimentPlan,
  forgeEquivalenceCorpus,
} from '../src/equivalence-corpus-forge.mjs';

const sources = [
  extractCapabilitiesFromJsonSchema({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'DialogueNode',
    type: 'object',
    required: ['id', 'online'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 32 },
      online: { type: 'boolean' },
      kind: { enum: ['vision', 'dialogue', 'control'] },
    },
  }, { includeDefinitions: false }),
  extractCapabilitiesFromOpenApi({
    openapi: '3.1.2',
    info: { title: 'Dialogue Node API', version: '0.1.0' },
    paths: {
      '/nodes/{nodeId}/commands': {
        post: {
          operationId: 'dispatchNodeCommand',
          parameters: [
            { name: 'nodeId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: { 202: { description: 'accepted' }, 400: { description: 'invalid' } },
        },
      },
    },
  }),
  extractCapabilitiesFromSqlDdl(`
    CREATE TABLE dialogue_nodes (
      id TEXT PRIMARY KEY,
      online BOOLEAN NOT NULL,
      owner_id BIGINT NOT NULL REFERENCES owners(id),
      score NUMERIC(12,2) NOT NULL CHECK (score >= 0)
    );
  `),
];

const results = sources.map(bundle => {
  const forged = forgeEquivalenceCorpus(bundle);
  const first = forged.corpora[0];
  const plan = createDifferentialExperimentPlan(forged, {
    capability: first.capability,
    includeObserve: false,
  });
  return {
    frontend: forged.frontend,
    sourceRoot: forged.sourceRoot,
    corpusRoot: forged.root,
    capabilityCount: forged.capabilityCount,
    caseCount: forged.caseCount,
    mutationPlanCount: forged.mutationPlanCount,
    firstCapability: {
      id: first.capability,
      specRoot: first.specRoot,
      corpusRoot: first.root,
      coverage: first.coverage,
      cases: first.cases.map(testCase => ({
        id: testCase.id,
        classification: testCase.classification,
        expected: testCase.expected.status,
        root: testCase.root,
      })),
    },
    experimentPlan: {
      root: plan.root,
      caseCount: plan.caseCount,
      executionRequirements: plan.executionRequirements,
    },
  };
});

console.log(JSON.stringify(results, null, 2));
