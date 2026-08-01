import { realityRoot } from './canonical.mjs';
import {
  RCL_CAPABILITY_SPEC_FORMAT,
  normalizeExternalCapabilitySpec,
  metabolizeExternalCapability,
} from './capability-metabolism.mjs';

export const RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION = '0.1.0-alpha.1';
export const RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT = 'rcl.source-capability-bundle.v0.1';
export const RCL_SOURCE_CAPABILITY_FRONTEND_KINDS = Object.freeze([
  'json-schema',
  'openapi',
  'sql-ddl',
]);

export class RCLSourceCapabilityFrontendError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLSourceCapabilityFrontendError';
    this.code = code;
    this.details = details;
  }
}

function assertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLSourceCapabilityFrontendError(code, message, { value });
  }
  return value;
}

function safeIdentifier(value, fallback = 'source_capability') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^([^A-Za-z_])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function parseJsonInput(input, code, label) {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      throw new RCLSourceCapabilityFrontendError(
        code,
        `${label} frontend v0.1 accepts JSON objects or JSON text, not YAML`,
        { prefix: trimmed.slice(0, 80) },
      );
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new RCLSourceCapabilityFrontendError(code, `${label} JSON could not be parsed`, {
        message: error.message,
      });
    }
  }
  return assertObject(input, code, `${label} input must be an object or JSON object string`);
}

function pushDiagnostic(diagnostics, level, code, message, details = {}) {
  diagnostics.push(Object.freeze({ level, code, message, details }));
}

function finalizeBundle({ frontend, sourceVersion, source, specs, diagnostics, coverage, boundary }) {
  const normalizedSpecs = specs.map(spec => (
    spec?.format === RCL_CAPABILITY_SPEC_FORMAT ? spec : normalizeExternalCapabilitySpec(spec)
  ));
  const sourceRoot = realityRoot(source);
  const body = {
    format: RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT,
    version: RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION,
    frontend,
    sourceVersion: String(sourceVersion ?? 'unknown'),
    sourceRoot,
    capabilityCount: normalizedSpecs.length,
    capabilityRoots: normalizedSpecs.map(spec => spec.root),
    capabilities: normalizedSpecs,
    diagnostics,
    coverage,
    boundary,
  };
  return Object.freeze({ ...body, root: realityRoot({
    ...body,
    capabilities: normalizedSpecs.map(spec => spec.root),
  }) });
}

function schemaDisplayName(schema, fallback) {
  const fromId = typeof schema.$id === 'string'
    ? schema.$id.split(/[\\/#]/).filter(Boolean).at(-1)
    : null;
  return String(schema.title ?? fromId ?? fallback);
}

function schemaTypeLabel(schema) {
  if (Array.isArray(schema?.type)) return schema.type.join('|');
  if (typeof schema?.type === 'string') return schema.type;
  if (schema?.enum) return 'enum';
  if (Object.hasOwn(schema ?? {}, 'const')) return 'const';
  if (schema?.properties || schema?.required) return 'object';
  if (schema?.items || schema?.prefixItems) return 'array';
  return 'any';
}

function collectJsonSchemaInvariants(schema, pointer = '$', output = [], depth = 0) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || depth > 32) return output;
  const scalarKeywords = [
    'type', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
    'multipleOf', 'minLength', 'maxLength', 'pattern', 'format', 'minItems',
    'maxItems', 'uniqueItems', 'minContains', 'maxContains', 'minProperties',
    'maxProperties', 'minLength', 'maxLength',
  ];
  for (const keyword of scalarKeywords) {
    if (Object.hasOwn(schema, keyword)) {
      output.push(`${pointer} ${keyword} ${JSON.stringify(schema[keyword])}`);
    }
  }
  if (Array.isArray(schema.enum)) output.push(`${pointer} enum ${JSON.stringify(schema.enum)}`);
  if (Array.isArray(schema.required) && schema.required.length > 0) {
    output.push(`${pointer} required ${schema.required.join(',')}`);
  }
  if (schema.additionalProperties === false) output.push(`${pointer} additionalProperties false`);
  if (schema.unevaluatedProperties === false) output.push(`${pointer} unevaluatedProperties false`);
  if (schema.unevaluatedItems === false) output.push(`${pointer} unevaluatedItems false`);
  if (schema.dependentRequired && typeof schema.dependentRequired === 'object') {
    for (const [key, dependencies] of Object.entries(schema.dependentRequired)) {
      output.push(`${pointer} dependentRequired ${key}:${[].concat(dependencies).join(',')}`);
    }
  }
  for (const combinator of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(schema[combinator])) output.push(`${pointer} ${combinator} branches=${schema[combinator].length}`);
  }
  if (schema.not) output.push(`${pointer} not constraint`);
  if (schema.if) output.push(`${pointer} conditional if/then/else`);
  if (schema.contains) output.push(`${pointer} contains constraint`);
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [property, child] of Object.entries(schema.properties)) {
      collectJsonSchemaInvariants(child, `${pointer}/properties/${property}`, output, depth + 1);
    }
  }
  if (schema.items && typeof schema.items === 'object') {
    collectJsonSchemaInvariants(schema.items, `${pointer}/items`, output, depth + 1);
  }
  if (Array.isArray(schema.prefixItems)) {
    schema.prefixItems.forEach((child, index) => {
      collectJsonSchemaInvariants(child, `${pointer}/prefixItems/${index}`, output, depth + 1);
    });
  }
  return output;
}

function jsonSchemaCapabilitySpec(schema, {
  id,
  sourceRoot,
  dialect,
  provenance,
  definitionPath,
}) {
  const name = schemaDisplayName(schema, id);
  const invariants = uniqueStrings([
    `schema identity ${definitionPath ?? '$'}`,
    `root instance type ${schemaTypeLabel(schema)}`,
    ...collectJsonSchemaInvariants(schema),
  ]);
  return normalizeExternalCapabilitySpec({
    id: `json_schema_${safeIdentifier(id || name)}`,
    version: '0.1.0',
    source: {
      ecosystem: 'json_schema',
      construct: definitionPath ? 'definition_validator' : 'document_validator',
      version: dialect,
      referenceRoot: sourceRoot,
    },
    operation: {
      name: `validate_${safeIdentifier(name)}`,
      inputs: ['JsonInstance'],
      outputs: ['ValidationResult', 'ValidationAnnotations'],
    },
    semantics: {
      description: `Validate a JSON instance against ${name}.`,
      effects: [
        {
          name: 'ValidateStructure',
          deterministic: true,
          replay: 'deterministic',
          evidenceRequired: true,
          description: 'Evaluate structural assertions against one JSON instance.',
        },
        {
          name: 'AnnotateSchema',
          deterministic: true,
          replay: 'deterministic',
          evidenceRequired: false,
          description: 'Produce schema annotations and validation locations.',
        },
      ],
      invariants,
      failureModes: ['schema_validation_failed', 'unsupported_schema_vocabulary', 'reference_resolution_failed'],
      resourceModel: [`schema:${sourceRoot}`, 'json_instance:input'],
      authority: ['schema.validate'],
    },
    lowering: {
      targets: ['validation_ir', 'native_rbc'],
      providerRequired: false,
      nativeLoweringWitness: {
        kind: 'source-frontend-candidate',
        frontend: 'json-schema',
        sourceRoot,
      },
    },
    evidence: {
      equivalenceCases: [],
      provenance: uniqueStrings([dialect, definitionPath, ...provenance]),
    },
    synthesis: {
      tags: ['validation', 'schema', 'json', schemaTypeLabel(schema)],
      compatibleWith: ['openapi_contract', 'typed_data_model'],
      conflictsWith: [],
    },
  });
}

export function extractCapabilitiesFromJsonSchema(input, options = {}) {
  const schema = parseJsonInput(input, 'RCL_SOURCE_JSON_SCHEMA_PARSE', 'JSON Schema');
  const diagnostics = [];
  const dialect = String(schema.$schema ?? options.dialect ?? 'https://json-schema.org/draft/2020-12/schema');
  const sourceRoot = realityRoot(schema);
  const rootName = schemaDisplayName(schema, options.id ?? 'root');
  const specs = [jsonSchemaCapabilitySpec(schema, {
    id: options.id ?? rootName,
    sourceRoot,
    dialect,
    provenance: options.provenance ?? [],
    definitionPath: '$',
  })];

  const definitions = schema.$defs && typeof schema.$defs === 'object' ? schema.$defs : {};
  if (options.includeDefinitions !== false) {
    for (const [name, definition] of Object.entries(definitions)) {
      if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        pushDiagnostic(diagnostics, 'warning', 'RCL_SOURCE_JSON_SCHEMA_DEFINITION_SKIPPED',
          `Definition '${name}' is not a schema object and was skipped`);
        continue;
      }
      specs.push(jsonSchemaCapabilitySpec(definition, {
        id: `${rootName}_${name}`,
        sourceRoot,
        dialect,
        provenance: options.provenance ?? [],
        definitionPath: `$defs/${name}`,
      }));
    }
  }

  if (schema.$dynamicRef || schema.$dynamicAnchor) {
    pushDiagnostic(diagnostics, 'info', 'RCL_SOURCE_JSON_SCHEMA_DYNAMIC_REFERENCE',
      'Dynamic references are preserved as invariants but are not resolved by frontend v0.1');
  }
  if (schema.$vocabulary) {
    pushDiagnostic(diagnostics, 'info', 'RCL_SOURCE_JSON_SCHEMA_VOCABULARY',
      'Vocabulary declarations are recorded through the source root but not independently implemented');
  }

  return finalizeBundle({
    frontend: 'json-schema',
    sourceVersion: dialect,
    source: schema,
    specs,
    diagnostics,
    coverage: {
      rootSchema: true,
      definitionsObserved: Object.keys(definitions).length,
      definitionsEmitted: specs.length - 1,
      assertionKeywordsCollected: specs.reduce((sum, spec) => sum + spec.semantics.invariants.length, 0),
    },
    boundary: 'JSON Schema frontend v0.1 extracts a deterministic capability specification from JSON Schema objects. It does not itself validate instances, resolve remote references, or prove complete vocabulary coverage.',
  });
}

const OPENAPI_METHODS = Object.freeze(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const READ_METHODS = new Set(['get', 'head', 'options']);

function resolveLocalRef(document, value) {
  if (!value || typeof value !== 'object' || typeof value.$ref !== 'string') return value;
  if (!value.$ref.startsWith('#/')) return value;
  const parts = value.$ref.slice(2).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = document;
  for (const part of parts) current = current?.[part];
  return current ?? value;
}

function openApiSchemaLabel(schema, document) {
  if (schema?.$ref) return safeIdentifier(schema.$ref.split('/').at(-1));
  const resolved = resolveLocalRef(document, schema);
  if (resolved?.$ref) return safeIdentifier(resolved.$ref.split('/').at(-1));
  if (resolved?.title) return safeIdentifier(resolved.title);
  if (resolved?.type) return safeIdentifier(Array.isArray(resolved.type) ? resolved.type.join('_or_') : resolved.type);
  if (resolved?.properties) return 'object';
  return 'any';
}

function collectOpenApiParameters(document, pathItem, operation) {
  const combined = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
  const seen = new Set();
  const parameters = [];
  for (const raw of combined) {
    const parameter = resolveLocalRef(document, raw);
    if (!parameter || typeof parameter !== 'object') continue;
    const key = `${parameter.in}:${parameter.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parameters.push({
      name: String(parameter.name ?? 'parameter'),
      in: String(parameter.in ?? 'unknown'),
      required: parameter.required === true || parameter.in === 'path',
      schema: openApiSchemaLabel(parameter.schema, document),
    });
  }
  return parameters;
}

function collectOpenApiContentSchemas(document, content = {}) {
  const labels = [];
  for (const [mediaType, media] of Object.entries(content ?? {})) {
    labels.push(`${safeIdentifier(mediaType)}:${openApiSchemaLabel(media?.schema, document)}`);
  }
  return labels;
}

function openApiCapabilitySpec(document, pathName, method, pathItem, operation, sourceRoot, provenance) {
  const info = document.info ?? {};
  const operationName = safeIdentifier(operation.operationId ?? `${method}_${pathName}`);
  const parameters = collectOpenApiParameters(document, pathItem, operation);
  const requestBody = resolveLocalRef(document, operation.requestBody);
  const requestSchemas = collectOpenApiContentSchemas(document, requestBody?.content);
  const responses = operation.responses ?? {};
  const responseSchemas = [];
  for (const [status, responseRaw] of Object.entries(responses)) {
    const response = resolveLocalRef(document, responseRaw);
    const schemas = collectOpenApiContentSchemas(document, response?.content);
    responseSchemas.push(`${status}:${schemas.join('|') || 'no_body'}`);
  }
  const readOnly = READ_METHODS.has(method);
  const effects = [
    {
      name: readOnly ? 'ExternalRead' : 'ExternalMutation',
      deterministic: false,
      replay: 'requires-provider-receipt',
      evidenceRequired: true,
      description: `${method.toUpperCase()} ${pathName}`,
    },
    {
      name: 'ValidateResponse',
      deterministic: true,
      replay: 'deterministic-given-response',
      evidenceRequired: true,
      description: 'Validate the provider response against declared response contracts.',
    },
  ];
  const invariants = uniqueStrings([
    `http method ${method.toUpperCase()}`,
    `http path ${pathName}`,
    ...parameters.filter(parameter => parameter.required)
      .map(parameter => `required ${parameter.in} parameter ${parameter.name}:${parameter.schema}`),
    ...(requestBody?.required ? ['request body required'] : []),
    ...requestSchemas.map(label => `request content ${label}`),
    ...Object.keys(responses).map(status => `declared response ${status}`),
    ...responseSchemas.map(label => `response contract ${label}`),
  ]);
  return normalizeExternalCapabilitySpec({
    id: `openapi_${operationName}`,
    version: '0.1.0',
    source: {
      ecosystem: 'openapi',
      construct: 'http_operation',
      version: String(document.openapi),
      referenceRoot: sourceRoot,
    },
    operation: {
      name: operationName,
      inputs: uniqueStrings([
        ...parameters.map(parameter => `${parameter.in}_${parameter.name}_${parameter.schema}`),
        ...requestSchemas.map(label => `request_${label}`),
      ]),
      outputs: uniqueStrings(responseSchemas.length > 0 ? responseSchemas : ['HttpResponse']),
    },
    semantics: {
      description: String(operation.summary ?? operation.description ?? `${method.toUpperCase()} ${pathName} from ${info.title ?? 'OpenAPI service'}`),
      effects,
      invariants,
      failureModes: ['transport_failure', 'http_client_error', 'http_server_error', 'response_schema_violation'],
      resourceModel: uniqueStrings([
        `endpoint:${method.toUpperCase()}:${pathName}`,
        ...(document.servers ?? []).map(server => `server:${server.url}`),
      ]),
      authority: [readOnly ? 'api.read' : 'api.mutate', 'api.invoke'],
    },
    lowering: {
      targets: ['http_provider_call', 'capability_ir'],
      providerRequired: true,
      provider: `openapi:${safeIdentifier(info.title ?? 'service')}`,
    },
    evidence: {
      equivalenceCases: [],
      provenance: uniqueStrings([`openapi:${document.openapi}`, pathName, method, ...provenance]),
    },
    synthesis: {
      tags: ['api', 'http', method, readOnly ? 'read' : 'mutation'],
      compatibleWith: ['json_schema_root', 'provider_runtime'],
      conflictsWith: [],
    },
  });
}

export function extractCapabilitiesFromOpenApi(input, options = {}) {
  const document = parseJsonInput(input, 'RCL_SOURCE_OPENAPI_PARSE', 'OpenAPI');
  if (typeof document.openapi !== 'string' || !/^3\./.test(document.openapi)) {
    throw new RCLSourceCapabilityFrontendError(
      'RCL_SOURCE_OPENAPI_VERSION',
      'OpenAPI frontend v0.1 requires an OpenAPI 3.x document',
      { openapi: document.openapi },
    );
  }
  const diagnostics = [];
  const sourceRoot = realityRoot(document);
  const specs = [];
  for (const [pathName, rawPathItem] of Object.entries(document.paths ?? {})) {
    const pathItem = resolveLocalRef(document, rawPathItem);
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of OPENAPI_METHODS) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;
      specs.push(openApiCapabilitySpec(
        document,
        pathName,
        method,
        pathItem,
        operation,
        sourceRoot,
        options.provenance ?? [],
      ));
    }
  }
  if (specs.length === 0) {
    throw new RCLSourceCapabilityFrontendError(
      'RCL_SOURCE_OPENAPI_OPERATIONS_REQUIRED',
      'No OpenAPI operations were found under paths',
    );
  }
  const remoteRefs = JSON.stringify(document).match(/"\$ref"\s*:\s*"(?!#\/)[^"]+"/g) ?? [];
  if (remoteRefs.length > 0) {
    pushDiagnostic(diagnostics, 'warning', 'RCL_SOURCE_OPENAPI_REMOTE_REF',
      'Remote references were preserved but not resolved by frontend v0.1', { count: remoteRefs.length });
  }
  if (document.webhooks) {
    pushDiagnostic(diagnostics, 'info', 'RCL_SOURCE_OPENAPI_WEBHOOKS',
      'Webhook declarations are not emitted as capabilities in frontend v0.1');
  }

  return finalizeBundle({
    frontend: 'openapi',
    sourceVersion: document.openapi,
    source: document,
    specs,
    diagnostics,
    coverage: {
      pathCount: Object.keys(document.paths ?? {}).length,
      operationCount: specs.length,
      serverCount: (document.servers ?? []).length,
      localReferenceResolution: true,
      remoteReferenceResolution: false,
    },
    boundary: 'OpenAPI frontend v0.1 extracts one capability per OpenAPI 3.x operation from JSON documents. It does not execute HTTP, resolve remote references, expand callbacks or webhooks, or prove full specification conformance.',
  });
}

function stripSqlComments(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ');
}

function normalizeSqlForRoot(sql) {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim();
}

function splitTopLevel(input, delimiter = ',') {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quote) {
      if (character === quote) {
        if ((quote === "'" || quote === '"') && input[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === delimiter && depth === 0) {
      parts.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

function findMatchingParen(input, openIndex) {
  let depth = 0;
  let quote = null;
  for (let index = openIndex; index < input.length; index += 1) {
    const character = input[index];
    if (quote) {
      if (character === quote) {
        if ((quote === "'" || quote === '"') && input[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === '`') quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function readSqlIdentifierPart(input, start) {
  let index = start;
  while (/\s/.test(input[index] ?? '')) index += 1;
  if (['"', '`', '['].includes(input[index])) {
    const opener = input[index];
    const closer = opener === '[' ? ']' : opener;
    let value = '';
    index += 1;
    while (index < input.length && input[index] !== closer) {
      value += input[index];
      index += 1;
    }
    return { value, end: index + 1 };
  }
  const match = input.slice(index).match(/^([A-Za-z_][A-Za-z0-9_$]*)/);
  return match ? { value: match[1], end: index + match[1].length } : null;
}

function readSqlIdentifier(input, start) {
  const parts = [];
  let cursor = start;
  while (true) {
    const part = readSqlIdentifierPart(input, cursor);
    if (!part) break;
    parts.push(part.value);
    cursor = part.end;
    while (/\s/.test(input[cursor] ?? '')) cursor += 1;
    if (input[cursor] !== '.') break;
    cursor += 1;
  }
  return parts.length > 0 ? { value: parts.join('.'), end: cursor } : null;
}

function extractCreateTableStatements(sql) {
  const normalized = stripSqlComments(sql);
  const regex = /\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:(?:TEMPORARY|TEMP|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/ig;
  const statements = [];
  let match;
  while ((match = regex.exec(normalized))) {
    const identifier = readSqlIdentifier(normalized, regex.lastIndex);
    if (!identifier) continue;
    let cursor = identifier.end;
    while (/\s/.test(normalized[cursor] ?? '')) cursor += 1;
    if (normalized[cursor] !== '(') continue;
    const close = findMatchingParen(normalized, cursor);
    if (close < 0) {
      throw new RCLSourceCapabilityFrontendError(
        'RCL_SOURCE_SQL_UNBALANCED_TABLE',
        `CREATE TABLE '${identifier.value}' has no matching closing parenthesis`,
      );
    }
    statements.push({
      table: identifier.value,
      body: normalized.slice(cursor + 1, close),
      statement: normalized.slice(match.index, close + 1),
    });
    regex.lastIndex = close + 1;
  }
  return statements;
}

const SQL_CONSTRAINT_WORDS = [
  'CONSTRAINT', 'NOT NULL', 'NULL', 'PRIMARY KEY', 'UNIQUE', 'CHECK', 'DEFAULT',
  'REFERENCES', 'COLLATE', 'GENERATED', 'IDENTITY', 'STORAGE', 'COMPRESSION',
];

function firstConstraintIndex(text) {
  let best = -1;
  const upper = text.toUpperCase();
  for (const keyword of SQL_CONSTRAINT_WORDS) {
    const index = upper.search(new RegExp(`\s${keyword.replace(/ /g, '\\s+')}\b`, 'i'));
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }
  return best;
}

function parseSqlColumn(item) {
  const identifier = readSqlIdentifier(item, 0);
  if (!identifier) return null;
  const rest = item.slice(identifier.end).trim();
  if (!rest) return null;
  const constraintIndex = firstConstraintIndex(` ${rest}`);
  const adjusted = constraintIndex < 0 ? -1 : Math.max(0, constraintIndex - 1);
  const type = (adjusted < 0 ? rest : rest.slice(0, adjusted)).trim();
  const constraints = adjusted < 0 ? '' : rest.slice(adjusted).trim();
  return {
    name: identifier.value,
    type: type || 'unknown',
    constraints,
    notNull: /\bNOT\s+NULL\b/i.test(constraints),
    primaryKey: /\bPRIMARY\s+KEY\b/i.test(constraints),
    unique: /\bUNIQUE\b/i.test(constraints),
    hasDefault: /\bDEFAULT\b/i.test(constraints),
    references: /\bREFERENCES\b/i.test(constraints),
    check: /\bCHECK\s*\(/i.test(constraints),
  };
}

function sqlTableCapabilitySpec(statement, sourceRoot, dialect, provenance) {
  const tableId = safeIdentifier(statement.table.replace(/\./g, '_'));
  const items = splitTopLevel(statement.body);
  const tableConstraints = [];
  const columns = [];
  for (const item of items) {
    if (/^(?:CONSTRAINT\b|PRIMARY\s+KEY\b|UNIQUE\b|CHECK\b|FOREIGN\s+KEY\b|EXCLUDE\b)/i.test(item)) {
      tableConstraints.push(item.replace(/\s+/g, ' ').trim());
    } else {
      const column = parseSqlColumn(item);
      if (column) columns.push(column);
      else tableConstraints.push(item.replace(/\s+/g, ' ').trim());
    }
  }
  const invariants = uniqueStrings([
    `relational table ${statement.table}`,
    ...columns.map(column => `column ${column.name} type ${column.type}`),
    ...columns.filter(column => column.notNull).map(column => `column ${column.name} not null`),
    ...columns.filter(column => column.primaryKey).map(column => `column ${column.name} primary key`),
    ...columns.filter(column => column.unique).map(column => `column ${column.name} unique`),
    ...columns.filter(column => column.references).map(column => `column ${column.name} references another relation`),
    ...columns.filter(column => column.check).map(column => `column ${column.name} check constraint`),
    ...tableConstraints.map(constraint => `table constraint ${constraint}`),
  ]);
  return {
    spec: normalizeExternalCapabilitySpec({
      id: `sql_table_${tableId}`,
      version: '0.1.0',
      source: {
        ecosystem: 'sql',
        construct: 'create_table',
        version: dialect,
        referenceRoot: sourceRoot,
      },
      operation: {
        name: `persist_${tableId}`,
        inputs: columns.map(column => `${safeIdentifier(column.name)}_${safeIdentifier(column.type)}`),
        outputs: [`${tableId}_stored_row`],
      },
      semantics: {
        description: `Persist and constrain rows for relational table ${statement.table}.`,
        effects: [
          {
            name: 'RelationalWrite',
            deterministic: false,
            replay: 'requires-transaction-receipt',
            evidenceRequired: true,
            description: 'Write a row through a relational provider transaction.',
          },
          {
            name: 'ConstraintValidation',
            deterministic: true,
            replay: 'deterministic-given-row-and-schema',
            evidenceRequired: true,
            description: 'Evaluate declared column and table constraints.',
          },
        ],
        invariants,
        failureModes: ['not_null_violation', 'unique_violation', 'check_violation', 'foreign_key_violation', 'transaction_failure'],
        resourceModel: [`relation:${statement.table}`, 'transaction:provider'],
        authority: ['database.write', `table.${tableId}.insert`],
      },
      lowering: {
        targets: ['relational_ir', 'provider_call'],
        providerRequired: true,
        provider: `sql:${safeIdentifier(dialect)}`,
      },
      evidence: {
        equivalenceCases: [],
        provenance: uniqueStrings([`sql-dialect:${dialect}`, statement.table, ...provenance]),
      },
      synthesis: {
        tags: ['sql', 'relational', 'storage', 'constraint'],
        compatibleWith: ['ownership_lifecycle', 'relational_transaction'],
        conflictsWith: [],
      },
    }),
    columns,
    tableConstraints,
  };
}

export function extractCapabilitiesFromSqlDdl(input, options = {}) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new RCLSourceCapabilityFrontendError(
      'RCL_SOURCE_SQL_INPUT',
      'SQL DDL frontend requires a non-empty SQL string',
    );
  }
  const dialect = String(options.dialect ?? 'postgresql-create-table-subset');
  const normalizedSource = normalizeSqlForRoot(input);
  const sourceRoot = realityRoot(normalizedSource);
  const statements = extractCreateTableStatements(input);
  if (statements.length === 0) {
    throw new RCLSourceCapabilityFrontendError(
      'RCL_SOURCE_SQL_CREATE_TABLE_REQUIRED',
      'No supported CREATE TABLE statement was found',
    );
  }
  const diagnostics = [];
  const extracted = statements.map(statement => sqlTableCapabilitySpec(
    statement,
    sourceRoot,
    dialect,
    options.provenance ?? [],
  ));
  for (const item of extracted) {
    if (item.columns.length === 0) {
      pushDiagnostic(diagnostics, 'warning', 'RCL_SOURCE_SQL_NO_COLUMNS',
        `Table capability '${item.spec.id}' has no parsed columns`);
    }
  }
  if (/\b(?:ALTER|CREATE\s+(?:UNIQUE\s+)?INDEX|CREATE\s+TYPE|CREATE\s+VIEW)\b/i.test(input)) {
    pushDiagnostic(diagnostics, 'info', 'RCL_SOURCE_SQL_ADDITIONAL_DDL',
      'DDL outside CREATE TABLE is present but not emitted by frontend v0.1');
  }

  return finalizeBundle({
    frontend: 'sql-ddl',
    sourceVersion: dialect,
    source: normalizedSource,
    specs: extracted.map(item => item.spec),
    diagnostics,
    coverage: {
      tableCount: statements.length,
      columnCount: extracted.reduce((sum, item) => sum + item.columns.length, 0),
      tableConstraintCount: extracted.reduce((sum, item) => sum + item.tableConstraints.length, 0),
      supportedStatements: ['CREATE TABLE'],
    },
    boundary: 'SQL DDL frontend v0.1 extracts relational storage capabilities from a PostgreSQL-shaped CREATE TABLE subset. It is not a complete SQL parser and does not execute migrations, ALTER statements, indexes, views, triggers, procedures or dialect-specific semantics.',
  });
}

export function detectSourceCapabilityKind(input, options = {}) {
  if (options.kind) {
    if (!RCL_SOURCE_CAPABILITY_FRONTEND_KINDS.includes(options.kind)) {
      throw new RCLSourceCapabilityFrontendError(
        'RCL_SOURCE_FRONTEND_KIND',
        `Unsupported source capability kind '${options.kind}'`,
        { supported: RCL_SOURCE_CAPABILITY_FRONTEND_KINDS },
      );
    }
    return options.kind;
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    if (typeof input.openapi === 'string') return 'openapi';
    if (input.$schema || input.$id || input.$defs || input.properties || input.type) return 'json-schema';
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:(?:TEMPORARY|TEMP|UNLOGGED)\s+)?TABLE\b/i.test(trimmed)) return 'sql-ddl';
    if (trimmed.startsWith('{')) {
      const parsed = parseJsonInput(trimmed, 'RCL_SOURCE_DETECT_JSON', 'Source capability');
      return detectSourceCapabilityKind(parsed, options);
    }
  }
  throw new RCLSourceCapabilityFrontendError(
    'RCL_SOURCE_FRONTEND_UNDETECTED',
    'Could not detect a supported JSON Schema, OpenAPI or SQL DDL source',
  );
}

export function extractSourceCapabilities(input, options = {}) {
  const kind = detectSourceCapabilityKind(input, options);
  if (kind === 'json-schema') return extractCapabilitiesFromJsonSchema(input, options);
  if (kind === 'openapi') return extractCapabilitiesFromOpenApi(input, options);
  return extractCapabilitiesFromSqlDdl(input, options);
}

export function metabolizeSourceCapabilityBundle(input, options = {}) {
  const bundle = input?.format === RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT
    ? input
    : extractSourceCapabilities(input, options.frontendOptions ?? options);
  const metabolize = options.metabolize ?? metabolizeExternalCapability;
  if (typeof metabolize !== 'function') {
    throw new RCLSourceCapabilityFrontendError(
      'RCL_SOURCE_METABOLIZER_REQUIRED',
      'Source capability metabolism requires a metabolize function',
    );
  }
  const reports = bundle.capabilities.map(spec => metabolize(spec, {
    subject: options.subject ?? `source_frontend_${bundle.frontend}`,
  }));
  const stageCounts = {};
  for (const report of reports) {
    const stage = report?.assessment?.stage ?? 'unknown';
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  }
  const body = {
    format: 'rcl.source-capability-metabolism-batch.v0.1',
    version: RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION,
    frontend: bundle.frontend,
    sourceRoot: bundle.sourceRoot,
    bundleRoot: bundle.root,
    capabilityCount: bundle.capabilityCount,
    reportRoots: reports.map(report => report.root),
    reports,
    stageCounts,
    boundary: 'Source extraction and semantic metabolism do not establish independent differential equivalence or native verification. Those require the later absorption gates.',
  };
  return Object.freeze({ ...body, root: realityRoot({
    ...body,
    reports: reports.map(report => report.root),
  }) });
}
