import { realityRoot } from './canonical.mjs';

export const RBC13_JSON_SCHEMA_DONOR_CORPUS_FORMAT =
  'rcl.rbc13-json-schema-donor-corpus.v0.1';

function record(id, instance) {
  return Object.freeze({ id, instance: structuredClone(instance) });
}

function measurement(id, value, unit = 'mL', extra = {}) {
  return { id, value, unit, ...extra };
}

function buildPositiveCases() {
  const rows = [];
  const units = ['mL', 'ml', 'g', 'mL', 'ml', 'g', 'mL', 'ml'];
  for (let index = 0; index < 8; index += 1) {
    rows.push(record(`positive-basic-${String(index + 1).padStart(2, '0')}`,
      measurement(`id-${String(index + 1).padStart(2, '0')}`, index * 11 - 33, units[index])));
  }
  for (let index = 0; index < 8; index += 1) {
    rows.push(record(`positive-confidence-${String(index + 1).padStart(2, '0')}`,
      measurement(`confidence-${String(index + 1).padStart(2, '0')}`, index + 0.25, 'mL', {
        confidence: index / 7,
      })));
  }
  for (let index = 0; index < 8; index += 1) {
    const tags = Array.from({ length: (index % 4) + 1 }, (_, tagIndex) => `t${index}-${tagIndex}`);
    rows.push(record(`positive-tags-${String(index + 1).padStart(2, '0')}`,
      measurement(`tag-${String(index + 1).padStart(2, '0')}`, index, 'g', { tags })));
  }
  for (let index = 0; index < 8; index += 1) {
    rows.push(record(`positive-metadata-${String(index + 1).padStart(2, '0')}`,
      measurement(`metadata-${String(index + 1).padStart(2, '0')}`, 100 - index, 'ml', {
        metadata: { source: `sensor-${index}`, verified: index % 2 === 0 },
      })));
  }
  for (let index = 0; index < 8; index += 1) {
    rows.push(record(`positive-nested-${String(index + 1).padStart(2, '0')}`,
      measurement(`nested-${String(index + 1).padStart(2, '0')}`, -index, 'mL', {
        confidence: 0.5,
        tags: ['nested', `n${index}`],
        metadata: { source: `lab-${index}`, verified: true },
      })));
  }
  return rows;
}

function buildMissingRequiredCases() {
  const rows = [];
  const variants = [
    ['id'], ['value'], ['unit'], ['id', 'value'], ['id', 'unit'], ['value', 'unit'],
    ['id', 'value', 'unit'], ['id', 'value', 'unit'],
  ];
  for (let index = 0; index < variants.length; index += 1) {
    const value = measurement(`missing-${index}`, index, 'mL');
    for (const key of variants[index]) delete value[key];
    rows.push(record(`negative-missing-${String(index + 1).padStart(2, '0')}`, value));
  }
  return rows;
}

function buildWrongTypeCases() {
  const variants = [
    { id: 1 }, { value: '1' }, { unit: 1 }, { confidence: '0.5' },
    { tags: 'tag' }, { tags: [1] }, { metadata: 'sensor' }, { metadata: { source: 1 } },
  ];
  return variants.map((change, index) => record(
    `negative-type-${String(index + 1).padStart(2, '0')}`,
    measurement(`type-${index}`, 1, 'mL', change),
  ));
}

function buildAdditionalPropertyCases() {
  const variants = [
    { extra: true }, { unexpected: 1 }, { nestedExtra: { source: 's' } },
    { tags: ['ok'], extra: 'root' }, { metadata: { source: 's', extra: true } },
    { confidence: 0.5, unknown: null }, { extraObject: {} }, { uppercaseUNIT: 'ML' },
  ];
  return variants.map((change, index) => record(
    `negative-additional-${String(index + 1).padStart(2, '0')}`,
    measurement(`additional-${index}`, 1, 'mL', change),
  ));
}

function buildNestedCases() {
  const variants = [
    { metadata: {} }, { metadata: { verified: true } },
    { metadata: { source: '' } }, { metadata: { source: 's'.repeat(33) } },
    { metadata: { source: 's', verified: 'yes' } }, { tags: [''] },
    { tags: ['x'.repeat(17)] }, { tags: ['ok', 2] },
  ];
  return variants.map((change, index) => record(
    `negative-nested-${String(index + 1).padStart(2, '0')}`,
    measurement(`nested-bad-${index}`, 1, 'mL', change),
  ));
}

function buildConstraintCases() {
  const variants = [
    { unit: 'ML' }, { value: -1001 }, { value: 1001 }, { id: 'ab' },
    { id: 'i'.repeat(65) }, { confidence: -0.01 }, { confidence: 1.01 },
    { tags: ['a', 'b', 'c', 'd', 'e'] },
  ];
  return variants.map((change, index) => record(
    `negative-constraint-${String(index + 1).padStart(2, '0')}`,
    measurement(`constraint-${index}`, 1, 'mL', change),
  ));
}

function buildBoundaryCases() {
  return [
    record('boundary-empty-tags', measurement('b-empty-tags', 0, 'mL', { tags: [] })),
    record('boundary-empty-metadata', measurement('b-empty-metadata', 0, 'mL', { metadata: { source: 's' } })),
    record('boundary-minimal-root', measurement('b-minimal', 0, 'mL')),
    record('boundary-negative-number', measurement('b-negative', -1000, 'mL')),
    record('boundary-positive-number', measurement('b-positive', 1000, 'mL')),
    record('boundary-confidence-zero', measurement('b-confidence-zero', 0, 'mL', { confidence: 0 })),
    record('boundary-confidence-one', measurement('b-confidence-one', 0, 'mL', { confidence: 1 })),
    record('boundary-id-min', measurement('abc', 0, 'mL')),
    record('boundary-id-max', measurement('i'.repeat(64), 0, 'mL')),
    record('boundary-source-min', measurement('b-source-min', 0, 'mL', { metadata: { source: 's' } })),
    record('boundary-source-max', measurement('b-source-max', 0, 'mL', { metadata: { source: 's'.repeat(32) } })),
    record('boundary-tags-max', measurement('b-tags-max', 0, 'mL', { tags: ['a', 'b', 'c', 'd'] })),
    record('boundary-tag-min-length', measurement('b-tag-min', 0, 'mL', { tags: ['a'] })),
    record('boundary-tag-max-length', measurement('b-tag-max', 0, 'mL', { tags: ['t'.repeat(16)] })),
    record('boundary-nested-verified-false', measurement('b-false', 0, 'mL', { metadata: { source: 's', verified: false } })),
    record('boundary-nested-combined', measurement('b-combined', 42, 'g', { confidence: 0.75, tags: ['x', 'y'], metadata: { source: 'lab', verified: true } })),
    record('boundary-root-null', null),
    record('boundary-root-array', []),
    record('boundary-root-string', 'not-an-object'),
    record('boundary-root-boolean', false),
  ];
}

export function buildRbc13JsonSchemaDonorCorpus() {
  const cases = [
    ...buildPositiveCases().map(item => ({ ...item, classification: 'positive' })),
    ...buildMissingRequiredCases().map(item => ({ ...item, classification: 'negative' })),
    ...buildWrongTypeCases().map(item => ({ ...item, classification: 'negative' })),
    ...buildAdditionalPropertyCases().map(item => ({ ...item, classification: 'negative' })),
    ...buildNestedCases().map(item => ({ ...item, classification: 'negative' })),
    ...buildConstraintCases().map(item => ({ ...item, classification: 'negative' })),
    ...buildBoundaryCases().map(item => ({ ...item, classification: 'boundary' })),
  ].map(item => Object.freeze({ ...item, instance: structuredClone(item.instance) }));
  const counts = cases.reduce((result, item) => {
    result[item.classification] = (result[item.classification] ?? 0) + 1;
    return result;
  }, {});
  const body = {
    format: RBC13_JSON_SCHEMA_DONOR_CORPUS_FORMAT,
    version: '0.1.0',
    deterministic: true,
    hiddenFromModel: true,
    caseCount: cases.length,
    classificationCounts: counts,
    cases,
  };
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export const RBC13_JSON_SCHEMA_MUTATION_CONTROLS = Object.freeze([
  Object.freeze({ id: 'ignore-required', description: 'candidate skips required checks' }),
  Object.freeze({ id: 'minimum-comparison', description: 'candidate treats the inclusive minimum as invalid' }),
  Object.freeze({ id: 'additional-properties-true', description: 'candidate accepts undeclared object properties' }),
  Object.freeze({ id: 'array-item-bypass', description: 'candidate skips array item validation' }),
  Object.freeze({ id: 'enum-equality-bug', description: 'candidate compares enum values case-insensitively' }),
]);
