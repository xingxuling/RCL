import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildRbc13JsonSchemaDonorCorpus, RBC13_JSON_SCHEMA_MUTATION_CONTROLS } from '../src/rbc13-json-schema-donor-corpus.mjs';
import { loadRbc13JsonSchemaDonorContract, validateRbc13JsonSchemaDonorContract } from '../src/rbc13-json-schema-contract.mjs';
import { evaluateRbc13JsonSchemaCandidate } from '../src/rbc13-json-schema-candidate-adapter.mjs';

const ROOT = process.cwd();

function fixedSchema() {
  const contract = loadRbc13JsonSchemaDonorContract();
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:rcl:rbc13:test-donor',
    title: contract.intent.title,
    description: contract.intent.description,
    type: contract.intent.rootType,
    required: contract.intent.requiredFields,
    properties: contract.intent.properties,
    additionalProperties: contract.intent.additionalProperties,
  };
}

test('RBC13 donor corpus is deterministic and covers 40/40/20', () => {
  const first = buildRbc13JsonSchemaDonorCorpus();
  const second = buildRbc13JsonSchemaDonorCorpus();
  assert.equal(first.caseCount, 100);
  assert.deepEqual(first.classificationCounts, { positive: 40, negative: 40, boundary: 20 });
  assert.equal(first.root, second.root);
  assert.deepEqual(first.cases, second.cases);
});

test('Ajv donor oracle and candidate adapter agree on the full semantic projection', () => {
  const schema = fixedSchema();
  assert.equal(validateRbc13JsonSchemaDonorContract(schema).valid, true);
  const corpus = buildRbc13JsonSchemaDonorCorpus();
  const run = spawnSync(process.execPath, ['oracle/rbc13-json-schema-donor-oracle.mjs'], {
    cwd: ROOT,
    input: JSON.stringify({ schema, cases: corpus.cases }),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const oracle = JSON.parse(run.stdout);
  assert.equal(oracle.status, 'OK');
  assert.equal(oracle.oracle, 'ajv@8.20.0');
  const mismatches = corpus.cases.filter((item, index) => {
    const candidate = evaluateRbc13JsonSchemaCandidate(schema, item.instance);
    const expected = oracle.outputs[index];
    return candidate.valid !== expected.valid || JSON.stringify(candidate.errors) !== JSON.stringify(expected.errors);
  });
  assert.equal(mismatches.length, 0);
});

test('all five mutation controls are independently detected', () => {
  const schema = fixedSchema();
  const corpus = buildRbc13JsonSchemaDonorCorpus();
  const run = spawnSync(process.execPath, ['oracle/rbc13-json-schema-donor-oracle.mjs'], {
    cwd: ROOT,
    input: JSON.stringify({ schema, cases: corpus.cases }),
    encoding: 'utf8',
  });
  const oracle = JSON.parse(run.stdout);
  const detected = RBC13_JSON_SCHEMA_MUTATION_CONTROLS.map(control => corpus.cases.some((item, index) => {
    const candidate = evaluateRbc13JsonSchemaCandidate(schema, item.instance, { mutation: control.id });
    const expected = oracle.outputs[index];
    return candidate.valid !== expected.valid || JSON.stringify(candidate.errors) !== JSON.stringify(expected.errors);
  }));
  assert.deepEqual(detected, [true, true, true, true, true]);
});

test('independent oracle has no RCL candidate/helper imports', () => {
  const source = fs.readFileSync(path.join(ROOT, 'oracle', 'rbc13-json-schema-donor-oracle.mjs'), 'utf8');
  assert.match(source, /ajv\/dist\/2020\.js/);
  assert.doesNotMatch(source, /rbc13-json-schema-candidate-adapter|src\//);
});

