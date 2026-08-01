import { realityRoot } from './canonical.mjs';
import { normalizeExternalCapabilitySpec } from './capability-metabolism.mjs';
import {
  finalizeBundle,
  parseJsonInput,
  pushDiagnostic,
  safeIdentifier,
  uniqueStrings,
} from './source-capability-common.mjs';

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
    'maxProperties',
  ];
  for (const keyword of scalarKeywords) {
    if (Object.hasOwn(schema, keyword)) output.push(`${pointer} ${keyword} ${JSON.stringify(schema[keyword])}`);
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

function jsonSchemaCapabilitySpec(schema, { id, sourceRoot, dialect, provenance, definitionPath }) {
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
          name: 'ValidateStructure', deterministic: true, replay: 'deterministic',
          evidenceRequired: true,
          description: 'Evaluate structural assertions against one JSON instance.',
        },
        {
          name: 'AnnotateSchema', deterministic: true, replay: 'deterministic',
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
      nativeLoweringWitness: { kind: 'source-frontend-candidate', frontend: 'json-schema', sourceRoot },
    },
    evidence: { equivalenceCases: [], provenance: uniqueStrings([dialect, definitionPath, ...provenance]) },
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
    frontend: 'json-schema', sourceVersion: dialect, source: schema, specs, diagnostics,
    coverage: {
      rootSchema: true,
      definitionsObserved: Object.keys(definitions).length,
      definitionsEmitted: specs.length - 1,
      assertionKeywordsCollected: specs.reduce((sum, spec) => sum + spec.semantics.invariants.length, 0),
    },
    boundary: 'JSON Schema frontend v0.1 extracts a deterministic capability specification from JSON Schema objects. It does not itself validate instances, resolve remote references, or prove complete vocabulary coverage.',
  });
}
