import { isJsonValue } from './rbc13-json-schema-contract.mjs';

export const RBC13_JSON_SCHEMA_CANDIDATE_ADAPTER_FORMAT =
  'rcl.rbc13-json-schema-candidate-adapter.v0.1';

function pointerSegment(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function pathJoin(path, segment) {
  return `${path}/${pointerSegment(segment)}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
}

function sameJson(left, right) {
  return JSON.stringify(stableJson(left)) === JSON.stringify(stableJson(right));
}

function isType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return false;
}

function unicodeLength(value) {
  return Array.from(value).length;
}

function error(keyword, instancePath, schemaPath, params, message) {
  return { keyword, instancePath, schemaPath, params, message };
}

function addError(errors, keyword, instancePath, schemaPath, params, message) {
  errors.push(error(keyword, instancePath, schemaPath, params, message));
}

function evaluate(schema, value, instancePath, schemaPath, errors, mutation) {
  const typeValid = !schema.type || isType(value, schema.type);
  if (schema.type && !typeValid) {
    addError(errors, 'type', instancePath, `${schemaPath}/type`, { type: schema.type }, `must be ${schema.type}`);
  }
  if (schema.enum && !schema.enum.some(item => sameJson(item, value))) {
    const enumMatchesCaseInsensitively = mutation === 'enum-equality-bug'
      && typeof value === 'string'
      && schema.enum.some(item => typeof item === 'string' && item.toLowerCase() === value.toLowerCase());
    if (!enumMatchesCaseInsensitively) {
      addError(errors, 'enum', instancePath, `${schemaPath}/enum`, { allowedValues: schema.enum }, 'must be equal to one of the allowed values');
    }
  }
  if (typeValid && typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && !(mutation === 'minimum-comparison' ? value > schema.minimum : value >= schema.minimum)) {
      addError(errors, 'minimum', instancePath, `${schemaPath}/minimum`, { comparison: '>=', limit: schema.minimum }, 'must be >= ' + schema.minimum);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      addError(errors, 'maximum', instancePath, `${schemaPath}/maximum`, { comparison: '<=', limit: schema.maximum }, 'must be <= ' + schema.maximum);
    }
  }
  if (typeValid && typeof value === 'string') {
    const length = unicodeLength(value);
    if (schema.minLength !== undefined && length < schema.minLength) addError(errors, 'minLength', instancePath, `${schemaPath}/minLength`, { limit: schema.minLength }, 'must NOT be shorter than ' + schema.minLength + ' characters');
    if (schema.maxLength !== undefined && length > schema.maxLength) addError(errors, 'maxLength', instancePath, `${schemaPath}/maxLength`, { limit: schema.maxLength }, 'must NOT be longer than ' + schema.maxLength + ' characters');
  }
  if (typeValid && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) addError(errors, 'minItems', instancePath, `${schemaPath}/minItems`, { limit: schema.minItems }, 'must NOT have fewer than ' + schema.minItems + ' items');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) addError(errors, 'maxItems', instancePath, `${schemaPath}/maxItems`, { limit: schema.maxItems }, 'must NOT have more than ' + schema.maxItems + ' items');
    if (schema.items && mutation !== 'array-item-bypass') value.forEach((item, index) => evaluate(schema.items, item, pathJoin(instancePath, index), `${schemaPath}/items`, errors, mutation));
  }
  if (typeValid && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(schema.required) && mutation !== 'ignore-required') {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) addError(errors, 'required', instancePath, `${schemaPath}/required`, { missingProperty: key }, `must have required property '${key}'`);
      }
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    if (schema.additionalProperties === false && mutation !== 'additional-properties-true') {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) addError(errors, 'additionalProperties', instancePath, `${schemaPath}/additionalProperties`, { additionalProperty: key }, 'must NOT have additional properties');
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) evaluate(childSchema, value[key], pathJoin(instancePath, key), `${schemaPath}/properties/${pointerSegment(key)}`, errors, mutation);
    }
  }
}

function normalizedErrors(errors) {
  return errors.map(item => ({
    keyword: item.keyword,
    instancePath: item.instancePath,
    schemaPath: item.schemaPath,
    params: stableJson(item.params),
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export function evaluateRbc13JsonSchemaCandidate(schema, instance, options = {}) {
  const errors = [];
  if (!isJsonValue(instance)) {
    addError(errors, 'rclNonFinite', '', '#', {}, 'must be a finite JSON value');
  } else {
    evaluate(schema, instance, '', '#', errors, options.mutation ?? null);
  }
  const normalized = normalizedErrors(errors);
  return Object.freeze({
    format: RBC13_JSON_SCHEMA_CANDIDATE_ADAPTER_FORMAT,
    valid: normalized.length === 0,
    errors: Object.freeze(normalized),
  });
}
