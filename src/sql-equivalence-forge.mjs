import {
  createCorpusCase,
  createMutationPlan,
  finalizeCapabilityCorpus,
  safeIdentifier,
} from './equivalence-corpus-common.mjs';

function modelFromSpec(spec) {
  const model = { table: spec.id, columns: new Map(), tableConstraints: [] };
  const column = name => {
    if (!model.columns.has(name)) model.columns.set(name, { name, type: 'unknown' });
    return model.columns.get(name);
  };
  for (const invariant of spec.semantics?.invariants ?? []) {
    const text = String(invariant);
    const table = text.match(/^relational table (.+)$/);
    const type = text.match(/^column ([^ ]+) type (.+)$/);
    const flag = text.match(/^column ([^ ]+) (not null|primary key|unique|references another relation|check constraint)$/);
    const tableConstraint = text.match(/^table constraint (.+)$/);
    if (table) model.table = table[1];
    else if (type) column(type[1]).type = type[2];
    else if (flag) {
      const item = column(flag[1]);
      const key = flag[2].replace(/ /g, '_');
      item[key] = true;
    } else if (tableConstraint) model.tableConstraints.push(tableConstraint[1]);
  }
  return model;
}

function valueForSqlType(type) {
  const normalized = String(type).toUpperCase();
  if (/\b(?:BIGINT|INTEGER|INT|SMALLINT|NUMERIC|DECIMAL|REAL|DOUBLE|FLOAT|SERIAL)\b/.test(normalized)) return 1;
  if (/\bBOOL(?:EAN)?\b/.test(normalized)) return true;
  if (/\bJSONB?\b/.test(normalized)) return {};
  if (/\b(?:DATE|TIMESTAMP|TIME)\b/.test(normalized)) return '2000-01-01T00:00:00Z';
  if (/\b(?:BYTEA|BLOB|BINARY)\b/.test(normalized)) return '00';
  return 'value';
}

function nominalRow(model) {
  const row = {};
  for (const [name, column] of model.columns) row[name] = valueForSqlType(column.type);
  return row;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function forgeSqlCapabilityCorpus(spec, options = {}) {
  const capability = safeIdentifier(spec.id);
  const model = modelFromSpec(spec);
  const maxCases = Number.isInteger(options.maxCasesPerCapability) ? options.maxCasesPerCapability : 64;
  const cases = [];
  const plans = [];
  const add = raw => {
    if (cases.length >= maxCases) return null;
    const testCase = createCorpusCase(raw);
    cases.push(testCase);
    return testCase;
  };
  const row = nominalRow(model);
  add({
    id: `${capability}_valid_insert`, capability, classification: 'valid',
    input: { kind: 'sql-transaction-probe', operation: 'insert', table: model.table, row },
    expected: { status: 'accept', reason: 'row contains values for every extracted column' },
    targets: [...model.columns.keys()].map(name => `column:${name}`), tags: ['sql', 'insert'], provenance: [spec.root],
  });

  for (const [name, column] of model.columns) {
    if (column.not_null) {
      const missing = clone(row);
      delete missing[name];
      const missingCase = add({
        id: `${capability}_invalid_missing_${name}`, capability, classification: 'invalid',
        input: { kind: 'sql-transaction-probe', operation: 'insert', table: model.table, row: missing },
        expected: { status: 'reject', reason: `NOT NULL column '${name}' is absent`, errorClass: 'not-null' },
        targets: [`not-null:${name}`], tags: ['sql', 'not-null'], provenance: [spec.root],
      });
      const nullRow = clone(row);
      nullRow[name] = null;
      const nullCase = add({
        id: `${capability}_invalid_null_${name}`, capability, classification: 'invalid',
        input: { kind: 'sql-transaction-probe', operation: 'insert', table: model.table, row: nullRow },
        expected: { status: 'reject', reason: `NOT NULL column '${name}' is null`, errorClass: 'not-null' },
        targets: [`not-null:${name}`], tags: ['sql', 'not-null'], provenance: [spec.root],
      });
      plans.push(createMutationPlan({
        id: `${capability}_mutant_ignore_not_null_${name}`, capability, operator: 'ignore-not-null', target: name,
        description: `Mutant storage implementation accepts null or missing '${name}'.`,
        expectedDetectionCaseIds: [missingCase?.id, nullCase?.id].filter(Boolean),
      }));
    }

    if (column.primary_key || column.unique) {
      const duplicateCase = add({
        id: `${capability}_invalid_duplicate_${name}`, capability, classification: 'invalid',
        input: {
          kind: 'sql-transaction-probe', operation: 'transaction', table: model.table,
          statements: [{ operation: 'insert', row }, { operation: 'insert', row: clone(row) }],
        },
        expected: { status: 'reject', reason: `duplicate value violates ${column.primary_key ? 'primary key' : 'unique'} constraint on '${name}'`, errorClass: 'unique' },
        targets: [`unique:${name}`], tags: ['sql', 'unique', 'transaction'], provenance: [spec.root],
      });
      if (duplicateCase) plans.push(createMutationPlan({
        id: `${capability}_mutant_ignore_unique_${name}`, capability, operator: 'ignore-unique', target: name,
        description: `Mutant implementation permits duplicate '${name}' values.`, expectedDetectionCaseIds: [duplicateCase.id],
      }));
    }

    if (column.references_another_relation) {
      const referenceRow = clone(row);
      referenceRow[name] = '__missing_reference__';
      const referenceCase = add({
        id: `${capability}_invalid_reference_${name}`, capability, classification: 'invalid',
        input: { kind: 'sql-transaction-probe', operation: 'insert', table: model.table, row: referenceRow },
        expected: { status: 'reject', reason: `foreign reference for '${name}' is intentionally absent`, errorClass: 'foreign-key' },
        targets: [`reference:${name}`], tags: ['sql', 'foreign-key'], provenance: [spec.root],
      });
      if (referenceCase) plans.push(createMutationPlan({
        id: `${capability}_mutant_ignore_reference_${name}`, capability, operator: 'ignore-foreign-key', target: name,
        description: `Mutant implementation skips referential integrity for '${name}'.`, expectedDetectionCaseIds: [referenceCase.id],
      }));
    }

    if (column.check_constraint) {
      const probeRow = clone(row);
      probeRow[name] = typeof row[name] === 'number' ? -1 : '__check_probe__';
      add({
        id: `${capability}_check_probe_${name}`, capability, classification: 'mutation-probe',
        input: { kind: 'sql-transaction-probe', operation: 'insert', table: model.table, row: probeRow },
        expected: { status: 'observe', reason: 'CHECK existence is known, but its expression is not retained in the semantic invariant string' },
        targets: [`check:${name}`], tags: ['sql', 'check', 'no-overclaim'], provenance: [spec.root],
      });
    }
  }

  for (let index = 0; index < model.tableConstraints.length; index += 1) {
    add({
      id: `${capability}_table_constraint_probe_${index + 1}`, capability, classification: 'mutation-probe',
      input: { kind: 'sql-transaction-probe', operation: 'insert', table: model.table, row: clone(row), constraint: model.tableConstraints[index] },
      expected: { status: 'observe', reason: 'table constraint is preserved textually; v0.1 does not solve arbitrary SQL expressions' },
      targets: [`table-constraint:${model.tableConstraints[index]}`], tags: ['sql', 'table-constraint', 'no-overclaim'], provenance: [spec.root],
    });
  }

  return finalizeCapabilityCorpus({
    spec,
    frontend: 'sql-ddl',
    cases,
    mutationPlans: plans,
    diagnostics: [{
      level: 'info', code: 'RCL_CORPUS_SQL_NO_DATABASE_EXECUTION',
      message: 'Corpus generation is side-effect free. SQL probes require isolated source and absorbed database adapters.',
    }],
    coverage: {
      table: model.table,
      columnCount: model.columns.size,
      notNullCount: [...model.columns.values()].filter(column => column.not_null).length,
      uniqueCount: [...model.columns.values()].filter(column => column.unique || column.primary_key).length,
      referenceCount: [...model.columns.values()].filter(column => column.references_another_relation).length,
      checkProbeCount: cases.filter(testCase => testCase.tags.includes('check')).length,
      tableConstraintProbeCount: model.tableConstraints.length,
      truncated: cases.length >= maxCases,
    },
  });
}
