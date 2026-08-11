import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const RBC13_JSON_SCHEMA_DONOR_CONTRACT_PATH = path.join(
  ROOT,
  'examples',
  'rbc13-json-schema-donor-contract.json',
);

export function loadRbc13JsonSchemaDonorContract() {
  return JSON.parse(fs.readFileSync(RBC13_JSON_SCHEMA_DONOR_CONTRACT_PATH, 'utf8'));
}

export const RBC13_JSON_SCHEMA_SUPPORTED_KEYWORDS = Object.freeze([
  '$schema', '$id', 'title', 'description', 'type', 'required', 'properties',
  'additionalProperties', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength',
  'items', 'minItems', 'maxItems',
]);

export const RBC13_JSON_SCHEMA_UNSUPPORTED_KEYWORDS = Object.freeze([
  '$ref', '$defs', 'oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else',
  'pattern', 'format', 'propertyNames', 'dependentRequired', 'dependentSchemas',
  'contains', 'uniqueItems', 'unevaluatedProperties', 'unevaluatedItems',
  'const', 'multipleOf',
]);

function sameJson(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((item, index) => sameJson(item, right[index]));
  if (typeof left === 'object') {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return JSON.stringify(leftKeys) === JSON.stringify(rightKeys)
      && leftKeys.every(key => sameJson(left[key], right[key]));
  }
  return false;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function contractError(keyword, instancePath, schemaPath, params, message) {
  return { keyword, instancePath, schemaPath, params, message };
}

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateContractShape(schema, pathName = '#', seen = new Set()) {
  if (!isJsonObject(schema) || seen.has(schema)) return ['schema must be a finite JSON object graph'];
  seen.add(schema);
  const errors = [];
  const keys = Object.keys(schema);
  for (const key of keys) {
    if (!RBC13_JSON_SCHEMA_SUPPORTED_KEYWORDS.includes(key)) {
      errors.push(`unsupported keyword ${key} at ${pathName}`);
    }
  }
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('wrong $schema');
  if (schema.type !== 'object') errors.push('root type must be object');
  if (!Array.isArray(schema.required) || JSON.stringify(schema.required) !== JSON.stringify(['id', 'value', 'unit'])) errors.push('root required must be [id,value,unit]');
  if (schema.additionalProperties !== false) errors.push('root additionalProperties must be false');
  if (!isJsonObject(schema.properties)) errors.push('root properties must be an object');
  const expectedProperties = ['id', 'value', 'unit', 'confidence', 'tags', 'metadata'];
  if (JSON.stringify(Object.keys(schema.properties ?? {}).sort()) !== JSON.stringify(expectedProperties.sort())) errors.push('root properties set differs');
  const expected = {
    id: { type: 'string', minLength: 3, maxLength: 64 },
    value: { type: 'number', minimum: -1000, maximum: 1000 },
    unit: { type: 'string', enum: ['mL', 'ml', 'g'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    tags: { type: 'array', minItems: 0, maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 16 } },
    metadata: {
      type: 'object', required: ['source'], additionalProperties: false,
      properties: {
        source: { type: 'string', minLength: 1, maxLength: 32 },
        verified: { type: 'boolean' },
      },
    },
  };
  for (const name of expectedProperties) {
    const actual = schema.properties?.[name];
    if (!sameJson(actual, expected[name])) errors.push(`property ${name} differs from fixed donor subset`);
  }
  seen.delete(schema);
  return errors;
}

export function validateRbc13JsonSchemaDonorContract(schema) {
  const errors = validateContractShape(schema);
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    supportedKeywords: RBC13_JSON_SCHEMA_SUPPORTED_KEYWORDS,
    unsupportedKeywords: RBC13_JSON_SCHEMA_UNSUPPORTED_KEYWORDS,
  });
}

export function isJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value) && Object.values(value).every(isJsonValue);
}

