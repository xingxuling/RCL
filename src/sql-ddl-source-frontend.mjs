import { realityRoot } from './canonical.mjs';
import { normalizeExternalCapabilitySpec } from './capability-metabolism.mjs';
import {
  finalizeBundle,
  pushDiagnostic,
  safeIdentifier,
  uniqueStrings,
  RCLSourceCapabilityFrontendError,
} from './source-capability-common.mjs';

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

const SQL_CONSTRAINT_PREFIXES = Object.freeze([
  ['NOT', 'NULL'],
  ['PRIMARY', 'KEY'],
  ['CONSTRAINT'],
  ['NULL'],
  ['UNIQUE'],
  ['CHECK'],
  ['DEFAULT'],
  ['REFERENCES'],
  ['COLLATE'],
  ['GENERATED'],
  ['IDENTITY'],
  ['STORAGE'],
  ['COMPRESSION'],
]);

function isSqlIdentifierCharacter(character) {
  return /[A-Za-z0-9_$]/.test(character ?? '');
}

function matchSqlKeywordSequence(input, start, words) {
  let cursor = start;
  for (let index = 0; index < words.length; index += 1) {
    if (index > 0) {
      if (!/\s/.test(input[cursor] ?? '')) return false;
      while (/\s/.test(input[cursor] ?? '')) cursor += 1;
    }
    const word = words[index];
    if (input.slice(cursor, cursor + word.length).toUpperCase() !== word) return false;
    cursor += word.length;
    if (isSqlIdentifierCharacter(input[cursor])) return false;
  }
  return true;
}

function firstConstraintIndex(text) {
  let depth = 0;
  let quote = null;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote) {
        if ((quote === "'" || quote === '"') && text[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(') {
      depth += 1;
      continue;
    }
    if (character === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0 || !/[A-Za-z]/.test(character)) continue;
    if (index > 0 && !/\s/.test(text[index - 1])) continue;
    if (SQL_CONSTRAINT_PREFIXES.some(words => matchSqlKeywordSequence(text, index, words))) return index;
  }
  return -1;
}

function parseSqlColumn(item) {
  const identifier = readSqlIdentifier(item, 0);
  if (!identifier) return null;
  const rest = item.slice(identifier.end).trim();
  if (!rest) return null;
  const constraintIndex = firstConstraintIndex(rest);
  const type = (constraintIndex < 0 ? rest : rest.slice(0, constraintIndex)).trim();
  const constraints = constraintIndex < 0 ? '' : rest.slice(constraintIndex).trim();
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
      source: { ecosystem: 'sql', construct: 'create_table', version: dialect, referenceRoot: sourceRoot },
      operation: {
        name: `persist_${tableId}`,
        inputs: columns.map(column => `${safeIdentifier(column.name)}_${safeIdentifier(column.type)}`),
        outputs: [`${tableId}_stored_row`],
      },
      semantics: {
        description: `Persist and constrain rows for relational table ${statement.table}.`,
        effects: [
          {
            name: 'RelationalWrite', deterministic: false,
            replay: 'requires-transaction-receipt', evidenceRequired: true,
            description: 'Write a row through a relational provider transaction.',
          },
          {
            name: 'ConstraintValidation', deterministic: true,
            replay: 'deterministic-given-row-and-schema', evidenceRequired: true,
            description: 'Evaluate declared column and table constraints.',
          },
        ],
        invariants,
        failureModes: ['not_null_violation', 'unique_violation', 'check_violation', 'foreign_key_violation', 'transaction_failure'],
        resourceModel: [`relation:${statement.table}`, 'transaction:provider'],
        authority: ['database.write', `table.${tableId}.insert`],
      },
      lowering: {
        targets: ['relational_ir', 'provider_call'], providerRequired: true,
        provider: `sql:${safeIdentifier(dialect)}`,
      },
      evidence: { equivalenceCases: [], provenance: uniqueStrings([`sql-dialect:${dialect}`, statement.table, ...provenance]) },
      synthesis: {
        tags: ['sql', 'relational', 'storage', 'constraint'],
        compatibleWith: ['ownership_lifecycle', 'relational_transaction'], conflictsWith: [],
      },
    }),
    columns,
    tableConstraints,
  };
}

export function extractCapabilitiesFromSqlDdl(input, options = {}) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new RCLSourceCapabilityFrontendError('RCL_SOURCE_SQL_INPUT', 'SQL DDL frontend requires a non-empty SQL string');
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
    statement, sourceRoot, dialect, options.provenance ?? [],
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
    frontend: 'sql-ddl', sourceVersion: dialect, source: normalizedSource,
    specs: extracted.map(item => item.spec), diagnostics,
    coverage: {
      tableCount: statements.length,
      columnCount: extracted.reduce((sum, item) => sum + item.columns.length, 0),
      tableConstraintCount: extracted.reduce((sum, item) => sum + item.tableConstraints.length, 0),
      supportedStatements: ['CREATE TABLE'],
    },
    boundary: 'SQL DDL frontend v0.1 extracts relational storage capabilities from a PostgreSQL-shaped CREATE TABLE subset. It is not a complete SQL parser and does not execute migrations, ALTER statements, indexes, views, triggers, procedures or dialect-specific semantics.',
  });
}
