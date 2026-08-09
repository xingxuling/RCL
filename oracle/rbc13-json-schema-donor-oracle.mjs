#!/usr/bin/env node
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const ORACLE_FORMAT = 'rcl.rbc13-json-schema-independent-donor-oracle.v0.1';
const ORACLE_VERSION = 'ajv@8.20.0';

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
}

function normalizedErrors(errors) {
  return (errors ?? []).map(item => ({
    keyword: item.keyword,
    instancePath: item.instancePath,
    schemaPath: item.schemaPath,
    params: stableJson(item.params ?? {}),
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch (error) {
    process.stdout.write(JSON.stringify({ format: ORACLE_FORMAT, oracle: ORACLE_VERSION, status: 'ERROR', error: String(error.message ?? error) }));
    process.exitCode = 2;
    return;
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false, strictNumbers: true, validateFormats: false });
  let validate;
  try {
    validate = ajv.compile(input.schema);
  } catch (error) {
    process.stdout.write(JSON.stringify({ format: ORACLE_FORMAT, oracle: ORACLE_VERSION, status: 'SCHEMA_COMPILE_ERROR', error: String(error.message ?? error) }));
    process.exitCode = 3;
    return;
  }
  const outputs = (input.cases ?? []).map(item => {
    const valid = validate(item.instance);
    return {
      caseId: item.id,
      valid,
      errors: normalizedErrors(validate.errors),
    };
  });
  const body = {
    format: ORACLE_FORMAT,
    oracle: ORACLE_VERSION,
    status: 'OK',
    implementation: 'Ajv2020',
    options: { allErrors: true, strict: false, strictNumbers: true, validateFormats: false },
    outputs,
  };
  process.stdout.write(JSON.stringify(body));
}

main();

