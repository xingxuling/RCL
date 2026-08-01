import {
  createCorpusCase,
  createMutationPlan,
  finalizeCapabilityCorpus,
  parseJsonLiteral,
  safeIdentifier,
  uniqueStrings,
} from './equivalence-corpus-common.mjs';

function parseInvariantModel(spec) {
  const model = {
    rootType: 'any',
    required: [],
    closed: false,
    properties: new Map(),
  };
  function property(name) {
    if (!model.properties.has(name)) model.properties.set(name, { name, type: 'any' });
    return model.properties.get(name);
  }
  for (const invariant of spec.semantics?.invariants ?? []) {
    const text = String(invariant);
    const rootType = text.match(/^root instance type (.+)$/);
    if (rootType) model.rootType = rootType[1];
    const required = text.match(/^\$ required (.+)$/);
    if (required) model.required.push(...required[1].split(',').map(value => value.trim()).filter(Boolean));
    if (text === '$ additionalProperties false' || text === '$ unevaluatedProperties false') model.closed = true;
    const propertyKeyword = text.match(/^\$\/properties\/([^ ]+) ([A-Za-z][A-Za-z0-9]*) (.+)$/);
    if (!propertyKeyword) continue;
    const [, name, keyword, encoded] = propertyKeyword;
    const item = property(name);
    const parsed = parseJsonLiteral(encoded, encoded);
    if (keyword === 'type') item.type = Array.isArray(parsed) ? parsed.join('|') : String(parsed);
    else if (keyword === 'enum') item.enum = parsed;
    else if (keyword === 'const') item.const = parsed;
    else item[keyword] = parsed;
  }
  model.required = uniqueStrings(model.required);
  return model;
}

function typeBase(type) {
  return String(type ?? 'any').split('|')[0];
}

function validValue(constraint = {}) {
  if (Object.hasOwn(constraint, 'const')) return constraint.const;
  if (Array.isArray(constraint.enum) && constraint.enum.length > 0) return constraint.enum[0];
  const type = typeBase(constraint.type);
  if (type === 'string') {
    const minimum = Number.isInteger(constraint.minLength) ? constraint.minLength : 1;
    return 'x'.repeat(Math.max(1, minimum));
  }
  if (type === 'integer' || type === 'number') {
    let value = 0;
    if (Number.isFinite(constraint.minimum)) value = constraint.minimum;
    if (Number.isFinite(constraint.exclusiveMinimum)) value = constraint.exclusiveMinimum + (type === 'integer' ? 1 : 0.5);
    if (Number.isFinite(constraint.maximum)) value = Math.min(value, constraint.maximum);
    if (Number.isFinite(constraint.multipleOf) && constraint.multipleOf !== 0) {
      value = Math.ceil(value / constraint.multipleOf) * constraint.multipleOf;
    }
    return type === 'integer' ? Math.trunc(value) : value;
  }
  if (type === 'boolean') return true;
  if (type === 'null') return null;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return 'value';
}

function wrongTypeValue(type) {
  const base = typeBase(type);
  if (base === 'string') return 17;
  if (base === 'number' || base === 'integer') return 'not-a-number';
  if (base === 'boolean') return 'not-a-boolean';
  if (base === 'array') return {};
  if (base === 'object') return [];
  if (base === 'null') return false;
  return null;
}

function minimalDocument(model, includeOptional = false) {
  if (typeBase(model.rootType) !== 'object') return validValue({ type: model.rootType });
  const output = {};
  for (const [name, constraint] of model.properties) {
    if (includeOptional || model.required.includes(name)) output[name] = validValue(constraint);
  }
  return output;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function pushCase(cases, raw, maxCases) {
  if (cases.length >= maxCases) return null;
  const created = createCorpusCase(raw);
  cases.push(created);
  return created;
}

export function forgeJsonSchemaCapabilityCorpus(spec, options = {}) {
  const model = parseInvariantModel(spec);
  const capability = safeIdentifier(spec.id);
  const maxCases = Number.isInteger(options.maxCasesPerCapability) ? options.maxCasesPerCapability : 64;
  const cases = [];
  const plans = [];
  const minimal = minimalDocument(model, false);
  const full = minimalDocument(model, true);

  pushCase(cases, {
    id: `${capability}_valid_minimal`, capability, classification: 'valid', input: minimal,
    expected: { status: 'accept', reason: 'minimal instance satisfying extracted required/type constraints' },
    targets: ['root instance type', ...model.required.map(name => `required:${name}`)],
    tags: ['json-schema', 'minimal'], provenance: [spec.root],
  }, maxCases);
  if (JSON.stringify(full) !== JSON.stringify(minimal)) {
    pushCase(cases, {
      id: `${capability}_valid_full`, capability, classification: 'valid', input: full,
      expected: { status: 'accept', reason: 'instance containing all extracted properties' },
      targets: [...model.properties.keys()].map(name => `property:${name}`),
      tags: ['json-schema', 'full'], provenance: [spec.root],
    }, maxCases);
  }

  for (const name of model.required) {
    if (typeBase(model.rootType) !== 'object') continue;
    const missing = clone(minimal);
    delete missing[name];
    const missingCase = pushCase(cases, {
      id: `${capability}_invalid_missing_${name}`, capability, classification: 'invalid', input: missing,
      expected: { status: 'reject', reason: `required property '${name}' is absent`, errorClass: 'required' },
      targets: [`required:${name}`], tags: ['json-schema', 'required'], provenance: [spec.root],
    }, maxCases);
    if (missingCase) plans.push(createMutationPlan({
      id: `${capability}_mutant_ignore_required_${name}`, capability, operator: 'ignore-required',
      target: name, description: `Mutant validator accepts an instance missing required property '${name}'.`,
      expectedDetectionCaseIds: [missingCase.id],
    }));
  }

  for (const [name, constraint] of model.properties) {
    if (typeBase(model.rootType) !== 'object') continue;
    const base = clone(full);
    base[name] = wrongTypeValue(constraint.type);
    const wrongCase = pushCase(cases, {
      id: `${capability}_invalid_type_${name}`, capability, classification: 'invalid', input: base,
      expected: { status: 'reject', reason: `property '${name}' violates extracted type ${constraint.type}`, errorClass: 'type' },
      targets: [`type:${name}:${constraint.type}`], tags: ['json-schema', 'type'], provenance: [spec.root],
    }, maxCases);
    if (wrongCase) plans.push(createMutationPlan({
      id: `${capability}_mutant_ignore_type_${name}`, capability, operator: 'ignore-type', target: name,
      description: `Mutant validator skips the type assertion for '${name}'.`, expectedDetectionCaseIds: [wrongCase.id],
    }));

    if (Array.isArray(constraint.enum) && constraint.enum.length > 0) {
      const invalid = clone(full);
      invalid[name] = '__outside_enum__';
      const enumCase = pushCase(cases, {
        id: `${capability}_invalid_enum_${name}`, capability, classification: 'invalid', input: invalid,
        expected: { status: 'reject', reason: `property '${name}' is outside the extracted enum`, errorClass: 'enum' },
        targets: [`enum:${name}`], tags: ['json-schema', 'enum'], provenance: [spec.root],
      }, maxCases);
      if (enumCase) plans.push(createMutationPlan({
        id: `${capability}_mutant_ignore_enum_${name}`, capability, operator: 'ignore-enum', target: name,
        description: `Mutant validator ignores enum membership for '${name}'.`, expectedDetectionCaseIds: [enumCase.id],
      }));
    }

    if (Number.isInteger(constraint.minLength)) {
      const boundary = clone(full);
      boundary[name] = 'x'.repeat(constraint.minLength);
      pushCase(cases, {
        id: `${capability}_boundary_min_length_${name}`, capability, classification: 'boundary', input: boundary,
        expected: { status: 'accept', reason: `property '${name}' is exactly minLength` },
        targets: [`minLength:${name}:${constraint.minLength}`], tags: ['json-schema', 'boundary'], provenance: [spec.root],
      }, maxCases);
      if (constraint.minLength > 0) {
        const invalid = clone(full);
        invalid[name] = 'x'.repeat(constraint.minLength - 1);
        pushCase(cases, {
          id: `${capability}_invalid_min_length_${name}`, capability, classification: 'invalid', input: invalid,
          expected: { status: 'reject', reason: `property '${name}' is shorter than minLength`, errorClass: 'minLength' },
          targets: [`minLength:${name}:${constraint.minLength}`], tags: ['json-schema', 'boundary'], provenance: [spec.root],
        }, maxCases);
      }
    }
    if (Number.isInteger(constraint.maxLength)) {
      const boundary = clone(full);
      boundary[name] = 'x'.repeat(constraint.maxLength);
      pushCase(cases, {
        id: `${capability}_boundary_max_length_${name}`, capability, classification: 'boundary', input: boundary,
        expected: { status: 'accept', reason: `property '${name}' is exactly maxLength` },
        targets: [`maxLength:${name}:${constraint.maxLength}`], tags: ['json-schema', 'boundary'], provenance: [spec.root],
      }, maxCases);
      const invalid = clone(full);
      invalid[name] = 'x'.repeat(constraint.maxLength + 1);
      pushCase(cases, {
        id: `${capability}_invalid_max_length_${name}`, capability, classification: 'invalid', input: invalid,
        expected: { status: 'reject', reason: `property '${name}' exceeds maxLength`, errorClass: 'maxLength' },
        targets: [`maxLength:${name}:${constraint.maxLength}`], tags: ['json-schema', 'boundary'], provenance: [spec.root],
      }, maxCases);
    }
    for (const [keyword, direction, delta] of [
      ['minimum', 'below', -1], ['maximum', 'above', 1],
      ['exclusiveMinimum', 'at-exclusive-minimum', 0], ['exclusiveMaximum', 'at-exclusive-maximum', 0],
    ]) {
      if (!Number.isFinite(constraint[keyword])) continue;
      const boundary = clone(full);
      boundary[name] = constraint[keyword] + delta;
      pushCase(cases, {
        id: `${capability}_invalid_${safeIdentifier(keyword)}_${name}`, capability, classification: 'invalid', input: boundary,
        expected: { status: 'reject', reason: `property '${name}' is ${direction} ${keyword}`, errorClass: keyword },
        targets: [`${keyword}:${name}:${constraint[keyword]}`], tags: ['json-schema', 'numeric-boundary'], provenance: [spec.root],
      }, maxCases);
    }
  }

  if (model.closed && typeBase(model.rootType) === 'object') {
    const invalid = clone(full);
    invalid.__unexpected_property__ = true;
    const closedCase = pushCase(cases, {
      id: `${capability}_invalid_additional_property`, capability, classification: 'invalid', input: invalid,
      expected: { status: 'reject', reason: 'root object is closed to additional properties', errorClass: 'additionalProperties' },
      targets: ['additionalProperties:false'], tags: ['json-schema', 'closed-object'], provenance: [spec.root],
    }, maxCases);
    if (closedCase) plans.push(createMutationPlan({
      id: `${capability}_mutant_allow_additional_properties`, capability, operator: 'allow-additional-properties', target: '$',
      description: 'Mutant validator accepts undeclared root properties.', expectedDetectionCaseIds: [closedCase.id],
    }));
  }

  const diagnostics = [];
  for (const invariant of spec.semantics?.invariants ?? []) {
    if (/ pattern /.test(invariant)) diagnostics.push({
      level: 'info', code: 'RCL_CORPUS_JSON_PATTERN_UNSYNTHESIZED',
      message: 'Pattern constraints are preserved as targets but v0.1 does not synthesize regex witnesses.',
      invariant,
    });
    if (/ (?:allOf|anyOf|oneOf|conditional|contains|dependentRequired) /.test(invariant)) diagnostics.push({
      level: 'info', code: 'RCL_CORPUS_JSON_COMPLEX_KEYWORD_UNSYNTHESIZED',
      message: 'Complex JSON Schema keyword requires a later solver-backed generator.', invariant,
    });
  }

  return finalizeCapabilityCorpus({
    spec,
    frontend: 'json-schema',
    cases,
    mutationPlans: plans,
    diagnostics,
    coverage: {
      rootType: model.rootType,
      propertyCount: model.properties.size,
      requiredCount: model.required.length,
      closedObjectCovered: model.closed,
      validCaseCount: cases.filter(testCase => testCase.classification === 'valid').length,
      invalidCaseCount: cases.filter(testCase => testCase.classification === 'invalid').length,
      boundaryCaseCount: cases.filter(testCase => testCase.classification === 'boundary').length,
      truncated: cases.length >= maxCases,
    },
  });
}
