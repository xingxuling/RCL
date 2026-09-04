import { realityRoot } from './canonical.mjs';

export const RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION = '0.1.0-candidate.1';
export const RCL_RELATIONAL_TRANSACTION_PROTOCOL_FORMAT = 'rcl.relational-transaction-protocol.v0.1';
export const RCL_RELATIONAL_SCHEMA_FORMAT = 'rcl.relational-schema.v0.1';
export const RCL_RELATIONAL_SNAPSHOT_FORMAT = 'rcl.relational-snapshot.v0.1';
export const RCL_RELATIONAL_QUERY_FORMAT = 'rcl.relational-query-result.v0.1';
export const RCL_RELATIONAL_TRANSACTION_FORMAT = 'rcl.relational-transaction.v0.1';
export const RCL_RELATIONAL_COMMIT_FORMAT = 'rcl.relational-commit-receipt.v0.1';
export const RCL_RELATIONAL_PROVIDER_COMMIT_FORMAT = 'rcl.relational-provider-commit-receipt.v0.1';
export const RCL_RELATIONAL_RECOVERY_REQUEST_FORMAT = 'rcl.relational-recovery-request.v0.1';
export const RCL_RELATIONAL_PROVIDER_RECOVERY_FORMAT = 'rcl.relational-provider-recovery-receipt.v0.1';
export const RCL_RELATIONAL_RECOVERY_ADMISSION_FORMAT = 'rcl.relational-recovery-admission.v0.1';

const SHA256_RE = /^[0-9a-f]{64}$/u;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/u;
const COLUMN_TYPES = new Set(['integer', 'number', 'text', 'boolean', 'json']);
const PREDICATE_OPERATORS = new Set(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'isNull', 'notNull']);
const AGGREGATE_FUNCTIONS = new Set(['count', 'sum', 'min', 'max']);
const AUTHORITY_FLAGS = Object.freeze([
  'canonicalPromotionPerformed',
  'rclEvidenceCommitPerformed',
  'worldFactPromoted',
  'rncsRealityCommitPerformed',
]);

export class RelationalTransactionProtocolError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RelationalTransactionProtocolError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RelationalTransactionProtocolError(code, message, details);
}

function text(value, code, label = code) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(code, `${label} must be a non-empty string`, { value });
  const normalized = value.trim();
  if (!NAME_RE.test(normalized) && label.endsWith('name')) fail(code, `${label} has an invalid name`, { value });
  return normalized;
}

function root(value, code, label = code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) fail(code, `${label} must be a lowercase SHA-256 root`, { value });
  return value;
}

function revision(value, code = 'RCL_RELATIONAL_REVISION_INVALID') {
  if (!Number.isSafeInteger(value) || value < 0) fail(code, 'revision must be a non-negative safe integer', { value });
  return value;
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function cloneCanonical(value, label = 'value', seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('RCL_RELATIONAL_CANONICAL_DATA_INVALID', `${label} contains a non-finite number`, { label, value });
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) fail('RCL_RELATIONAL_CANONICAL_DATA_CYCLE', `${label} contains a cycle`, { label });
    seen.add(value);
    const result = value.map((item, index) => cloneCanonical(item, `${label}[${index}]`, seen));
    seen.delete(value);
    return result;
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail('RCL_RELATIONAL_CANONICAL_DATA_INVALID', `${label} must contain plain data`, { label });
    if (seen.has(value)) fail('RCL_RELATIONAL_CANONICAL_DATA_CYCLE', `${label} contains a cycle`, { label });
    seen.add(value);
    const result = Object.fromEntries(Object.keys(value).sort(compareText).map((key) => {
      if (value[key] === undefined) fail('RCL_RELATIONAL_CANONICAL_DATA_INVALID', `${label}.${key} must not be undefined`, { label, key });
      return [key, cloneCanonical(value[key], `${label}.${key}`, seen)];
    }));
    seen.delete(value);
    return result;
  }
  fail('RCL_RELATIONAL_CANONICAL_DATA_INVALID', `${label} must contain JSON-like data`, { label, type: typeof value });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function listOfStrings(value, code, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    fail(code, `${label} must be an array of non-empty strings`, { value });
  }
  const values = value.map((item) => item.trim());
  if (new Set(values).size !== values.length) fail(code, `${label} must not contain duplicates`, { value });
  return values;
}

function normalizeColumn(raw, relationName) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('RCL_RELATIONAL_COLUMN_INVALID', 'relation column must be an object', { relationName, raw });
  const name = text(raw.name, 'RCL_RELATIONAL_COLUMN_NAME_INVALID', 'column name');
  if (!NAME_RE.test(name)) fail('RCL_RELATIONAL_COLUMN_NAME_INVALID', 'column name has an invalid name', { relationName, name });
  const type = raw.type ?? 'json';
  if (!COLUMN_TYPES.has(type)) fail('RCL_RELATIONAL_COLUMN_TYPE_INVALID', 'relation column has an unsupported type', { relationName, name, type });
  return { name, type, nullable: raw.nullable === true };
}

function normalizeRelation(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('RCL_RELATIONAL_RELATION_INVALID', 'relation must be an object', { raw });
  const name = text(raw.name, 'RCL_RELATIONAL_RELATION_NAME_INVALID', 'relation name');
  const columns = Array.isArray(raw.columns) && raw.columns.length > 0
    ? raw.columns.map((column) => normalizeColumn(column, name))
    : fail('RCL_RELATIONAL_COLUMNS_REQUIRED', 'relation must declare at least one column', { relation: name });
  const columnNames = columns.map((column) => column.name);
  if (new Set(columnNames).size !== columnNames.length) fail('RCL_RELATIONAL_COLUMN_DUPLICATE', 'relation columns must be unique', { relation: name });
  const primaryKey = listOfStrings(raw.primaryKey, 'RCL_RELATIONAL_PRIMARY_KEY_INVALID', `${name}.primaryKey`);
  for (const key of primaryKey) {
    if (!columnNames.includes(key)) fail('RCL_RELATIONAL_PRIMARY_KEY_COLUMN_UNKNOWN', 'primary key references an unknown column', { relation: name, key });
    if (columns.find((column) => column.name === key).nullable) fail('RCL_RELATIONAL_PRIMARY_KEY_NULLABLE', 'primary-key columns cannot be nullable', { relation: name, key });
  }
  const foreignKeys = (raw.foreignKeys ?? []).map((foreignKey) => {
    if (!foreignKey || typeof foreignKey !== 'object' || Array.isArray(foreignKey)) fail('RCL_RELATIONAL_FOREIGN_KEY_INVALID', 'foreign key must be an object', { relation: name, foreignKey });
    const localColumns = listOfStrings(foreignKey.columns, 'RCL_RELATIONAL_FOREIGN_KEY_COLUMNS_INVALID', `${name}.foreignKeys.columns`);
    for (const key of localColumns) if (!columnNames.includes(key)) fail('RCL_RELATIONAL_FOREIGN_KEY_COLUMN_UNKNOWN', 'foreign key references an unknown local column', { relation: name, key });
    const targetRelation = text(foreignKey.targetRelation, 'RCL_RELATIONAL_FOREIGN_KEY_TARGET_INVALID', 'foreign-key target relation');
    const targetColumns = listOfStrings(foreignKey.targetColumns, 'RCL_RELATIONAL_FOREIGN_KEY_TARGET_COLUMNS_INVALID', `${name}.foreignKeys.targetColumns`);
    if (localColumns.length !== targetColumns.length) fail('RCL_RELATIONAL_FOREIGN_KEY_ARITY_MISMATCH', 'foreign-key local and target columns must have equal arity', { relation: name, localColumns, targetColumns });
    return { columns: localColumns, targetRelation, targetColumns };
  }).sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)));
  return { name, columns, primaryKey, foreignKeys };
}

function relationByName(schema, relationName) {
  const relation = schema.relations.find((candidate) => candidate.name === relationName);
  if (!relation) fail('RCL_RELATIONAL_RELATION_UNKNOWN', 'unknown relation', { relation: relationName });
  return relation;
}

function validateSchemaReferences(relations) {
  const byName = new Map(relations.map((relation) => [relation.name, relation]));
  for (const relation of relations) {
    for (const foreignKey of relation.foreignKeys) {
      const target = byName.get(foreignKey.targetRelation);
      if (!target) fail('RCL_RELATIONAL_FOREIGN_KEY_TARGET_UNKNOWN', 'foreign key references an unknown relation', { relation: relation.name, targetRelation: foreignKey.targetRelation });
      for (const column of foreignKey.targetColumns) {
        if (!target.columns.some((candidate) => candidate.name === column)) {
          fail('RCL_RELATIONAL_FOREIGN_KEY_TARGET_COLUMN_UNKNOWN', 'foreign key references an unknown target column', { relation: relation.name, targetRelation: target.name, column });
        }
      }
      if (foreignKey.targetColumns.length !== target.primaryKey.length
        || foreignKey.targetColumns.some((column, index) => column !== target.primaryKey[index])) {
        fail('RCL_RELATIONAL_FOREIGN_KEY_TARGET_NOT_UNIQUE', 'foreign keys must target the declared primary key in this candidate', {
          relation: relation.name,
          targetRelation: target.name,
          targetColumns: foreignKey.targetColumns,
          primaryKey: target.primaryKey,
        });
      }
      for (let index = 0; index < foreignKey.columns.length; index += 1) {
        const local = relation.columns.find((column) => column.name === foreignKey.columns[index]);
        const targetColumn = target.columns.find((column) => column.name === foreignKey.targetColumns[index]);
        if (local.type !== targetColumn.type) fail('RCL_RELATIONAL_FOREIGN_KEY_TYPE_MISMATCH', 'foreign-key column types must match', { relation: relation.name, local: local.name, targetRelation: target.name, target: targetColumn.name });
      }
    }
  }
}

export function createRelationalSchema(input = {}) {
  const schemaId = text(input.schemaId, 'RCL_RELATIONAL_SCHEMA_ID_REQUIRED', 'schemaId');
  const rawRelations = Array.isArray(input.relations) ? input.relations : fail('RCL_RELATIONAL_RELATIONS_REQUIRED', 'schema must declare relations');
  const relations = rawRelations.map(normalizeRelation).sort((left, right) => compareText(left.name, right.name));
  if (new Set(relations.map((relation) => relation.name)).size !== relations.length) fail('RCL_RELATIONAL_RELATION_DUPLICATE', 'schema relation names must be unique');
  validateSchemaReferences(relations);
  const core = {
    format: RCL_RELATIONAL_SCHEMA_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    schemaId,
    relations,
  };
  return deepFreeze({ ...core, schemaRoot: realityRoot(core) });
}

function assertSchema(schema) {
  if (!schema || schema.format !== RCL_RELATIONAL_SCHEMA_FORMAT) fail('RCL_RELATIONAL_SCHEMA_FORMAT_INVALID', 'invalid relational schema');
  const supplied = root(schema.schemaRoot, 'RCL_RELATIONAL_SCHEMA_ROOT_INVALID', 'schemaRoot');
  const { schemaRoot, ...core } = schema;
  if (supplied !== realityRoot(core)) fail('RCL_RELATIONAL_SCHEMA_ROOT_MISMATCH', 'relational schema root does not match its content');
  return schema;
}

function valueMatchesType(value, column, label) {
  if (value === null) {
    if (!column.nullable) fail('RCL_RELATIONAL_NULLABILITY_VIOLATION', `${label} is not nullable`, { label, column: column.name });
    return;
  }
  const valid = column.type === 'integer'
    ? Number.isSafeInteger(value)
    : column.type === 'number'
      ? Number.isFinite(value)
      : column.type === 'text'
        ? typeof value === 'string'
        : column.type === 'boolean'
          ? typeof value === 'boolean'
          : value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' || Array.isArray(value) || (value && typeof value === 'object');
  if (!valid) fail('RCL_RELATIONAL_COLUMN_VALUE_TYPE_INVALID', `${label} does not match its declared type`, { label, column: column.name, type: column.type, value });
}

function normalizeRow(relation, rawRow, rowIndex) {
  if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) fail('RCL_RELATIONAL_ROW_INVALID', 'relation row must be an object', { relation: relation.name, rowIndex });
  const expected = new Set(relation.columns.map((column) => column.name));
  const supplied = Object.keys(rawRow);
  for (const key of supplied) if (!expected.has(key)) fail('RCL_RELATIONAL_UNKNOWN_COLUMN', 'row contains an unknown column', { relation: relation.name, rowIndex, column: key });
  for (const column of relation.columns) {
    if (!Object.prototype.hasOwnProperty.call(rawRow, column.name)) fail('RCL_RELATIONAL_MISSING_COLUMN', 'row is missing a declared column', { relation: relation.name, rowIndex, column: column.name });
    valueMatchesType(rawRow[column.name], column, `${relation.name}[${rowIndex}].${column.name}`);
  }
  const row = Object.fromEntries(relation.columns.map((column) => [column.name, cloneCanonical(rawRow[column.name], `${relation.name}[${rowIndex}].${column.name}`)]));
  for (const key of relation.primaryKey) if (row[key] === null) fail('RCL_RELATIONAL_PRIMARY_KEY_NULL', 'primary-key value cannot be null', { relation: relation.name, rowIndex, column: key });
  return row;
}

function primaryKeyToken(relation, row) {
  return relation.primaryKey.map((column) => JSON.stringify(row[column])).join('|');
}

function validateRelations(schema, relationRows) {
  const indexes = new Map();
  for (const relation of schema.relations) {
    const rows = relationRows[relation.name];
    const seen = new Map();
    for (const [rowIndex, row] of rows.entries()) {
      const key = primaryKeyToken(relation, row);
      if (seen.has(key)) fail('RCL_RELATIONAL_PRIMARY_KEY_DUPLICATE', 'primary-key uniqueness violated', { relation: relation.name, rowIndex, previousRowIndex: seen.get(key), key });
      seen.set(key, rowIndex);
    }
    indexes.set(relation.name, seen);
  }
  for (const relation of schema.relations) {
    for (const foreignKey of relation.foreignKeys) {
      const targetRelation = relationByName(schema, foreignKey.targetRelation);
      const targetRows = relationRows[targetRelation.name];
      const targetKeys = new Set(targetRows.map((row) => foreignKey.targetColumns.map((column) => JSON.stringify(row[column])).join('|')));
      for (const [rowIndex, row] of relationRows[relation.name].entries()) {
        const values = foreignKey.columns.map((column) => row[column]);
        if (values.some((value) => value === null)) continue;
        const key = values.map((value) => JSON.stringify(value)).join('|');
        if (!targetKeys.has(key)) fail('RCL_RELATIONAL_FOREIGN_KEY_MISSING', 'foreign-key target row does not exist', { relation: relation.name, rowIndex, targetRelation: targetRelation.name, key });
      }
    }
  }
  return indexes;
}

function normalizeRelationRows(schema, rawRows = {}) {
  if (!rawRows || typeof rawRows !== 'object' || Array.isArray(rawRows)) fail('RCL_RELATIONAL_ROWS_INVALID', 'snapshot rows must be an object keyed by relation name');
  const known = new Set(schema.relations.map((relation) => relation.name));
  for (const key of Object.keys(rawRows)) if (!known.has(key)) fail('RCL_RELATIONAL_RELATION_UNKNOWN', 'snapshot rows contain an unknown relation', { relation: key });
  const relations = Object.fromEntries(schema.relations.map((relation) => {
    const rows = rawRows[relation.name] ?? [];
    if (!Array.isArray(rows)) fail('RCL_RELATIONAL_ROWS_INVALID', 'relation rows must be an array', { relation: relation.name });
    return [relation.name, rows.map((row, index) => normalizeRow(relation, row, index))];
  }));
  validateRelations(schema, relations);
  return relations;
}

function assertSnapshot(schema, snapshot) {
  assertSchema(schema);
  if (!snapshot || snapshot.format !== RCL_RELATIONAL_SNAPSHOT_FORMAT) fail('RCL_RELATIONAL_SNAPSHOT_FORMAT_INVALID', 'invalid relational snapshot');
  if (snapshot.schemaRoot !== schema.schemaRoot) fail('RCL_RELATIONAL_SNAPSHOT_SCHEMA_MISMATCH', 'snapshot belongs to another schema', { expected: schema.schemaRoot, actual: snapshot.schemaRoot });
  const supplied = root(snapshot.snapshotRoot, 'RCL_RELATIONAL_SNAPSHOT_ROOT_INVALID', 'snapshotRoot');
  const { snapshotRoot, ...core } = snapshot;
  if (supplied !== realityRoot(core)) fail('RCL_RELATIONAL_SNAPSHOT_ROOT_MISMATCH', 'relational snapshot root does not match its content');
  const normalized = normalizeRelationRows(schema, snapshot.relations);
  if (realityRoot(normalized) !== realityRoot(snapshot.relations)) fail('RCL_RELATIONAL_SNAPSHOT_NONCANONICAL', 'relational snapshot rows are not canonical');
  return snapshot;
}

export function createRelationalSnapshot(schema, input = {}) {
  assertSchema(schema);
  const rows = normalizeRelationRows(schema, input.relations ?? input.rows ?? {});
  const core = {
    format: RCL_RELATIONAL_SNAPSHOT_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    schemaRoot: schema.schemaRoot,
    revision: revision(input.revision ?? 0),
    relations: rows,
  };
  return deepFreeze({ ...core, snapshotRoot: realityRoot(core) });
}

export function verifyRelationalSnapshot(schema, snapshot) {
  assertSnapshot(schema, snapshot);
  return Object.freeze({ status: 'VERIFIED', schemaRoot: schema.schemaRoot, snapshotRoot: snapshot.snapshotRoot, revision: snapshot.revision });
}

function normalizePredicate(raw, schema, baseRelation, joinRelation) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('RCL_RELATIONAL_PREDICATE_INVALID', 'query predicate must be an object');
  const from = raw.from ?? 'base';
  if (!['base', 'join'].includes(from)) fail('RCL_RELATIONAL_PREDICATE_SOURCE_INVALID', 'predicate source must be base or join', { from });
  const relation = from === 'base' ? baseRelation : joinRelation;
  if (!relation) fail('RCL_RELATIONAL_PREDICATE_JOIN_REQUIRED', 'join predicate requires a join');
  const column = text(raw.column, 'RCL_RELATIONAL_PREDICATE_COLUMN_INVALID', 'predicate column');
  if (!relation.columns.some((candidate) => candidate.name === column)) fail('RCL_RELATIONAL_PREDICATE_COLUMN_UNKNOWN', 'predicate references an unknown column', { from, column });
  const op = raw.op;
  if (!PREDICATE_OPERATORS.has(op)) fail('RCL_RELATIONAL_PREDICATE_OPERATOR_INVALID', 'predicate operator is unsupported', { op });
  if (['isNull', 'notNull'].includes(op)) return { from, column, op };
  const value = cloneCanonical(raw.value, 'predicate.value');
  if (op === 'in' && (!Array.isArray(value) || value.length === 0)) fail('RCL_RELATIONAL_PREDICATE_VALUE_INVALID', 'in predicate requires a non-empty array');
  return { from, column, op, value };
}

function predicateMatches(value, predicate) {
  switch (predicate.op) {
    case 'eq': return value === predicate.value;
    case 'neq': return value !== predicate.value;
    case 'lt': return value < predicate.value;
    case 'lte': return value <= predicate.value;
    case 'gt': return value > predicate.value;
    case 'gte': return value >= predicate.value;
    case 'in': return predicate.value.some((candidate) => candidate === value);
    case 'isNull': return value === null;
    case 'notNull': return value !== null;
    default: return false;
  }
}

function normalizeSelect(rawSelect, baseRelation, joinRelation) {
  if (rawSelect === undefined) {
    return baseRelation.columns.map((column) => ({ from: 'base', column: column.name, as: column.name }));
  }
  if (!Array.isArray(rawSelect) || rawSelect.length === 0) fail('RCL_RELATIONAL_SELECT_INVALID', 'select must be a non-empty array');
  return rawSelect.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('RCL_RELATIONAL_SELECT_INVALID', 'select item must be an object');
    const from = raw.from ?? 'base';
    const relation = from === 'base' ? baseRelation : from === 'join' ? joinRelation : null;
    if (!relation) fail('RCL_RELATIONAL_SELECT_SOURCE_INVALID', 'select source must be base or join', { from });
    const column = text(raw.column, 'RCL_RELATIONAL_SELECT_COLUMN_INVALID', 'select column');
    if (!relation.columns.some((candidate) => candidate.name === column)) fail('RCL_RELATIONAL_SELECT_COLUMN_UNKNOWN', 'select references an unknown column', { from, column });
    const as = raw.as === undefined ? `${from}.${column}` : text(raw.as, 'RCL_RELATIONAL_SELECT_ALIAS_INVALID', 'select alias');
    return { from, column, as };
  });
}

function normalizeOrderBy(rawOrderBy, baseRelation, joinRelation, select) {
  if (rawOrderBy === undefined) return [];
  if (!Array.isArray(rawOrderBy)) fail('RCL_RELATIONAL_ORDER_BY_INVALID', 'orderBy must be an array');
  return rawOrderBy.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('RCL_RELATIONAL_ORDER_BY_INVALID', 'orderBy item must be an object');
    const from = raw.from ?? 'base';
    const relation = from === 'base' ? baseRelation : from === 'join' ? joinRelation : null;
    if (!relation) fail('RCL_RELATIONAL_ORDER_BY_SOURCE_INVALID', 'orderBy source must be base or join', { from });
    const column = text(raw.column, 'RCL_RELATIONAL_ORDER_BY_COLUMN_INVALID', 'orderBy column');
    if (!relation.columns.some((candidate) => candidate.name === column)) fail('RCL_RELATIONAL_ORDER_BY_COLUMN_UNKNOWN', 'orderBy references an unknown column', { from, column });
    const direction = raw.direction ?? 'asc';
    if (!['asc', 'desc'].includes(direction)) fail('RCL_RELATIONAL_ORDER_BY_DIRECTION_INVALID', 'orderBy direction must be asc or desc', { direction });
    return { from, column, direction };
  });
}

function normalizeAggregates(rawAggregates, baseRelation, joinRelation) {
  if (rawAggregates === undefined) return [];
  if (!Array.isArray(rawAggregates) || rawAggregates.length === 0) fail('RCL_RELATIONAL_AGGREGATES_INVALID', 'aggregates must be a non-empty array');
  return rawAggregates.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('RCL_RELATIONAL_AGGREGATE_INVALID', 'aggregate must be an object');
    const fn = raw.fn;
    if (!AGGREGATE_FUNCTIONS.has(fn)) fail('RCL_RELATIONAL_AGGREGATE_FUNCTION_INVALID', 'aggregate function is unsupported', { fn });
    const from = raw.from ?? 'base';
    const relation = from === 'base' ? baseRelation : from === 'join' ? joinRelation : null;
    if (!relation) fail('RCL_RELATIONAL_AGGREGATE_SOURCE_INVALID', 'aggregate source must be base or join', { from });
    const column = raw.column ?? '*';
    const definition = column === '*' ? null : relation.columns.find((candidate) => candidate.name === column);
    if (column !== '*' && !definition) fail('RCL_RELATIONAL_AGGREGATE_COLUMN_UNKNOWN', 'aggregate references an unknown column', { from, column });
    if (fn === 'count' && column !== '*' && column === '') fail('RCL_RELATIONAL_AGGREGATE_COLUMN_INVALID', 'count column is invalid');
    if (fn !== 'count' && column === '*') fail('RCL_RELATIONAL_AGGREGATE_COLUMN_REQUIRED', `${fn} requires a column`);
    if (fn !== 'count' && !['integer', 'number'].includes(definition.type)) fail('RCL_RELATIONAL_AGGREGATE_NUMERIC_COLUMN_REQUIRED', `${fn} requires an integer or number column`, { from, column, type: definition.type });
    const as = raw.as === undefined ? `${fn}_${from}_${column}` : text(raw.as, 'RCL_RELATIONAL_AGGREGATE_ALIAS_INVALID', 'aggregate alias');
    return { fn, from, column, as };
  });
}

function contextValue(context, from, column) {
  return context[from][column];
}

export function readRelationalQuery(schema, snapshot, input = {}) {
  assertSnapshot(schema, snapshot);
  const baseRelation = relationByName(schema, input.relation);
  const joinInput = input.join ?? null;
  const joinRelation = joinInput ? relationByName(schema, joinInput.relation) : null;
  let join = null;
  if (joinInput) {
    const leftColumn = text(joinInput.leftColumn, 'RCL_RELATIONAL_JOIN_LEFT_COLUMN_INVALID', 'join left column');
    const rightColumn = text(joinInput.rightColumn, 'RCL_RELATIONAL_JOIN_RIGHT_COLUMN_INVALID', 'join right column');
    if (!baseRelation.columns.some((column) => column.name === leftColumn)) fail('RCL_RELATIONAL_JOIN_LEFT_COLUMN_UNKNOWN', 'join left column is unknown', { leftColumn });
    if (!joinRelation.columns.some((column) => column.name === rightColumn)) fail('RCL_RELATIONAL_JOIN_RIGHT_COLUMN_UNKNOWN', 'join right column is unknown', { rightColumn });
    join = { relation: joinRelation.name, leftColumn, rightColumn, type: joinInput.type ?? 'inner' };
    if (join.type !== 'inner') fail('RCL_RELATIONAL_JOIN_TYPE_UNSUPPORTED', 'only inner joins are supported by this candidate', { type: join.type });
  }
  const where = (input.where ?? []).map((predicate) => normalizePredicate(predicate, schema, baseRelation, joinRelation));
  const select = normalizeSelect(input.select, baseRelation, joinRelation);
  const orderBy = normalizeOrderBy(input.orderBy, baseRelation, joinRelation, select);
  const aggregates = normalizeAggregates(input.aggregates, baseRelation, joinRelation);
  const limit = input.limit === undefined ? null : revision(input.limit, 'RCL_RELATIONAL_QUERY_LIMIT_INVALID');
  const query = { relation: baseRelation.name, join, where, select, orderBy, aggregates, limit };
  let contexts = snapshot.relations[baseRelation.name].map((row) => ({ base: row }));
  contexts = contexts.filter((context) => where.filter((predicate) => predicate.from === 'base').every((predicate) => predicateMatches(context.base[predicate.column], predicate)));
  if (join) {
    const rightRows = snapshot.relations[join.relation];
    contexts = contexts.flatMap((context) => rightRows
      .filter((row) => context.base[join.leftColumn] === row[join.rightColumn])
      .map((row) => ({ ...context, join: row })));
  }
  contexts = contexts.filter((context) => where.filter((predicate) => predicate.from === 'join').every((predicate) => predicateMatches(context.join?.[predicate.column], predicate)));
  const sortedContexts = [...contexts].sort((left, right) => {
    for (const ordering of orderBy) {
      const leftValue = contextValue(left, ordering.from, ordering.column);
      const rightValue = contextValue(right, ordering.from, ordering.column);
      if (leftValue === rightValue) continue;
      const result = leftValue < rightValue ? -1 : 1;
      return ordering.direction === 'asc' ? result : -result;
    }
    return compareText(realityRoot(left), realityRoot(right));
  });
  const selectedContexts = limit === null ? sortedContexts : sortedContexts.slice(0, limit);
  const rows = aggregates.length > 0
    ? [Object.fromEntries(aggregates.map((aggregate) => {
      const values = selectedContexts.map((context) => contextValue(context, aggregate.from, aggregate.column));
      const nonNull = values.filter((value) => value !== null);
      let value;
      if (aggregate.fn === 'count') value = aggregate.column === '*' ? values.length : nonNull.length;
      else if (aggregate.fn === 'sum') value = nonNull.reduce((sum, item) => sum + item, 0);
      else if (aggregate.fn === 'min') value = nonNull.length === 0 ? null : Math.min(...nonNull);
      else value = nonNull.length === 0 ? null : Math.max(...nonNull);
      return [aggregate.as, value];
    }))]
    : selectedContexts.map((context) => Object.fromEntries(select.map((item) => [item.as, contextValue(context, item.from, item.column)])));
  const core = {
    format: RCL_RELATIONAL_QUERY_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    schemaRoot: schema.schemaRoot,
    snapshotRoot: snapshot.snapshotRoot,
    query,
    rows: rows.map((row) => cloneCanonical(row, 'query.result')),
  };
  return deepFreeze({ ...core, queryRoot: realityRoot(core) });
}

function assertOpenTransaction(transaction) {
  if (!transaction || transaction.format !== RCL_RELATIONAL_TRANSACTION_FORMAT) fail('RCL_RELATIONAL_TRANSACTION_FORMAT_INVALID', 'invalid relational transaction');
  const supplied = root(transaction.transactionRoot, 'RCL_RELATIONAL_TRANSACTION_ROOT_INVALID', 'transactionRoot');
  const { transactionRoot, ...core } = transaction;
  if (supplied !== realityRoot(core)) fail('RCL_RELATIONAL_TRANSACTION_ROOT_MISMATCH', 'transaction root does not match its content');
  if (transaction.status !== 'OPEN') fail('RCL_RELATIONAL_TRANSACTION_NOT_OPEN', 'transaction is no longer open', { status: transaction.status });
  return transaction;
}

function normalizeDurability(input) {
  const durabilityIntent = input.durabilityIntent ?? 'ephemeral';
  if (!['ephemeral', 'provider-durable'].includes(durabilityIntent)) fail('RCL_RELATIONAL_DURABILITY_INTENT_INVALID', 'unsupported durability intent', { durabilityIntent });
  const providerId = input.providerId == null ? null : text(input.providerId, 'RCL_RELATIONAL_PROVIDER_ID_INVALID', 'providerId');
  if (durabilityIntent === 'provider-durable' && providerId === null) fail('RCL_RELATIONAL_PROVIDER_ID_REQUIRED', 'provider-durable transactions require a providerId');
  return { durabilityIntent, providerId };
}

export function beginRelationalTransaction(schema, snapshot, input = {}) {
  assertSnapshot(schema, snapshot);
  const transactionId = text(input.transactionId, 'RCL_RELATIONAL_TRANSACTION_ID_REQUIRED', 'transactionId');
  const { durabilityIntent, providerId } = normalizeDurability(input);
  const core = {
    format: RCL_RELATIONAL_TRANSACTION_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    transactionId,
    schemaRoot: schema.schemaRoot,
    baseSnapshotRoot: snapshot.snapshotRoot,
    baseRevision: snapshot.revision,
    isolationLevel: 'serializable-optimistic',
    durabilityIntent,
    providerId,
    idempotencyKey: text(input.idempotencyKey ?? transactionId, 'RCL_RELATIONAL_IDEMPOTENCY_KEY_INVALID', 'idempotencyKey'),
    readSetRoots: [],
    writes: [],
    status: 'OPEN',
  };
  return deepFreeze({ ...core, transactionRoot: realityRoot(core) });
}

export function bindRelationalRead(schema, transaction, queryResult) {
  assertOpenTransaction(transaction);
  assertSchema(schema);
  if (!queryResult || queryResult.format !== RCL_RELATIONAL_QUERY_FORMAT) fail('RCL_RELATIONAL_QUERY_RESULT_INVALID', 'invalid query result');
  if (queryResult.schemaRoot !== transaction.schemaRoot || queryResult.schemaRoot !== schema.schemaRoot) fail('RCL_RELATIONAL_QUERY_SCHEMA_MISMATCH', 'query result belongs to another schema');
  if (queryResult.snapshotRoot !== transaction.baseSnapshotRoot) fail('RCL_RELATIONAL_QUERY_SNAPSHOT_MISMATCH', 'query result is not from the transaction base snapshot');
  const readSetRoots = [...new Set([...transaction.readSetRoots, root(queryResult.queryRoot, 'RCL_RELATIONAL_QUERY_ROOT_INVALID', 'queryRoot')])].sort(compareText);
  const core = { ...transaction, readSetRoots, transactionRoot: undefined };
  delete core.transactionRoot;
  return deepFreeze({ ...core, transactionRoot: realityRoot(core) });
}

export function stageRelationalWrite(schema, transaction, input = {}) {
  assertSchema(schema);
  assertOpenTransaction(transaction);
  if (transaction.schemaRoot !== schema.schemaRoot) fail('RCL_RELATIONAL_TRANSACTION_SCHEMA_MISMATCH', 'transaction belongs to another schema');
  const relation = relationByName(schema, input.relation);
  const operation = input.operation ?? 'insert';
  if (!['insert', 'replace', 'delete'].includes(operation)) fail('RCL_RELATIONAL_WRITE_OPERATION_UNSUPPORTED', 'unsupported relational write operation', { operation });
  let normalized;
  if (operation === 'delete') {
    if (!input.key || typeof input.key !== 'object' || Array.isArray(input.key)) fail('RCL_RELATIONAL_DELETE_KEY_REQUIRED', 'delete requires a primary-key object');
    normalized = { relation: relation.name, operation, key: Object.fromEntries(relation.primaryKey.map((column) => {
      if (!Object.prototype.hasOwnProperty.call(input.key, column)) fail('RCL_RELATIONAL_DELETE_KEY_INCOMPLETE', 'delete key is missing a primary-key column', { relation: relation.name, column });
      const definition = relation.columns.find((candidate) => candidate.name === column);
      valueMatchesType(input.key[column], definition, `${relation.name}.delete.${column}`);
      if (input.key[column] === null) fail('RCL_RELATIONAL_DELETE_KEY_NULL', 'delete key cannot contain null', { relation: relation.name, column });
      return [column, cloneCanonical(input.key[column], `${relation.name}.delete.${column}`)];
    })) };
  } else {
    normalized = { relation: relation.name, operation, row: normalizeRow(relation, input.row, transaction.writes.length) };
  }
  const core = { ...transaction, writes: [...transaction.writes, normalized], transactionRoot: undefined };
  delete core.transactionRoot;
  return deepFreeze({ ...core, transactionRoot: realityRoot(core) });
}

function applyWrites(schema, snapshot, writes) {
  const relations = Object.fromEntries(schema.relations.map((relation) => [relation.name, snapshot.relations[relation.name].map((row) => cloneCanonical(row))]));
  for (const write of writes) {
    const relation = relationByName(schema, write.relation);
    const rows = relations[relation.name];
    if (write.operation === 'insert') {
      const key = primaryKeyToken(relation, write.row);
      if (rows.some((row) => primaryKeyToken(relation, row) === key)) fail('RCL_RELATIONAL_PRIMARY_KEY_DUPLICATE', 'insert would violate primary-key uniqueness', { relation: relation.name, key });
      rows.push(cloneCanonical(write.row));
    } else {
      const key = relation.primaryKey.map((column) => JSON.stringify(write.operation === 'delete' ? write.key[column] : write.row[column])).join('|');
      const index = rows.findIndex((row) => primaryKeyToken(relation, row) === key);
      if (index < 0) fail('RCL_RELATIONAL_WRITE_TARGET_MISSING', 'write target does not exist', { relation: relation.name, operation: write.operation, key });
      if (write.operation === 'delete') rows.splice(index, 1);
      else rows[index] = cloneCanonical(write.row);
    }
  }
  return createRelationalSnapshot(schema, { revision: snapshot.revision + 1, relations });
}

function assertTransactionBase(schema, transaction, currentSnapshot) {
  assertSchema(schema);
  assertOpenTransaction(transaction);
  assertSnapshot(schema, currentSnapshot);
  if (transaction.schemaRoot !== schema.schemaRoot || transaction.baseSnapshotRoot !== currentSnapshot.snapshotRoot || transaction.baseRevision !== currentSnapshot.revision) {
    fail('RCL_RELATIONAL_CONCURRENCY_CONFLICT', 'transaction base snapshot is stale; commit rejected without applying its write set', {
      transactionBaseSnapshotRoot: transaction.baseSnapshotRoot,
      currentSnapshotRoot: currentSnapshot.snapshotRoot,
      transactionBaseRevision: transaction.baseRevision,
      currentRevision: currentSnapshot.revision,
    });
  }
}

export function previewRelationalTransaction(schema, transaction, currentSnapshot) {
  assertTransactionBase(schema, transaction, currentSnapshot);
  return applyWrites(schema, currentSnapshot, transaction.writes);
}

function authorityFlagsClear(value) {
  return AUTHORITY_FLAGS.every((flag) => value?.[flag] !== true);
}

function assertProviderReceiptRoot(receipt) {
  const supplied = root(receipt.receiptRoot, 'RCL_RELATIONAL_PROVIDER_RECEIPT_ROOT_INVALID', 'provider receiptRoot');
  const { receiptRoot, ...core } = receipt;
  if (supplied !== realityRoot(core)) fail('RCL_RELATIONAL_PROVIDER_RECEIPT_ROOT_MISMATCH', 'provider receipt root does not match its content');
}

export function createRelationalProviderCommitReceipt(input = {}) {
  const core = {
    format: RCL_RELATIONAL_PROVIDER_COMMIT_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    providerId: text(input.providerId, 'RCL_RELATIONAL_PROVIDER_ID_REQUIRED', 'providerId'),
    transactionId: text(input.transactionId, 'RCL_RELATIONAL_TRANSACTION_ID_REQUIRED', 'transactionId'),
    transactionRoot: root(input.transactionRoot, 'RCL_RELATIONAL_TRANSACTION_ROOT_INVALID', 'transactionRoot'),
    idempotencyKey: text(input.idempotencyKey ?? input.transactionId, 'RCL_RELATIONAL_IDEMPOTENCY_KEY_REQUIRED', 'idempotencyKey'),
    baseSnapshotRoot: root(input.baseSnapshotRoot, 'RCL_RELATIONAL_BASE_SNAPSHOT_ROOT_INVALID', 'baseSnapshotRoot'),
    committedSnapshotRoot: root(input.committedSnapshotRoot, 'RCL_RELATIONAL_COMMITTED_SNAPSHOT_ROOT_INVALID', 'committedSnapshotRoot'),
    durableCommitPerformed: input.durableCommitPerformed === true,
    providerCommitPerformed: input.providerCommitPerformed !== false,
    rclExecutedCommit: false,
    canonicalPromotionPerformed: false,
    rclEvidenceCommitPerformed: false,
    worldFactPromoted: false,
    rncsRealityCommitPerformed: false,
  };
  return deepFreeze({ ...core, receiptRoot: realityRoot(core) });
}

export function verifyRelationalProviderCommitReceipt(receipt, expected = {}) {
  if (!receipt || receipt.format !== RCL_RELATIONAL_PROVIDER_COMMIT_FORMAT) fail('RCL_RELATIONAL_PROVIDER_RECEIPT_FORMAT_INVALID', 'invalid provider commit receipt');
  assertProviderReceiptRoot(receipt);
  if (receipt.providerCommitPerformed !== true || receipt.rclExecutedCommit !== false || !authorityFlagsClear(receipt)) fail('RCL_RELATIONAL_PROVIDER_RECEIPT_AUTHORITY_INVALID', 'provider receipt contains an invalid execution or authority claim');
  for (const [key, value] of Object.entries(expected)) if (value !== undefined && receipt[key] !== value) fail('RCL_RELATIONAL_PROVIDER_RECEIPT_BINDING_MISMATCH', 'provider receipt does not bind to the requested commit', { key, expected: value, actual: receipt[key] });
  return Object.freeze({ status: 'VERIFIED', receiptRoot: receipt.receiptRoot, providerId: receipt.providerId, durableCommitProven: receipt.durableCommitPerformed === true });
}

export function commitRelationalTransaction(schema, transaction, currentSnapshot, options = {}) {
  const nextSnapshot = previewRelationalTransaction(schema, transaction, currentSnapshot);
  const providerReceipt = options.providerReceipt ?? null;
  if (transaction.durabilityIntent === 'provider-durable') {
    if (!providerReceipt) fail('RCL_RELATIONAL_DURABILITY_RECEIPT_REQUIRED', 'provider-durable commit requires a provider receipt');
    verifyRelationalProviderCommitReceipt(providerReceipt, {
      providerId: transaction.providerId,
      transactionId: transaction.transactionId,
      transactionRoot: transaction.transactionRoot,
      idempotencyKey: transaction.idempotencyKey,
      baseSnapshotRoot: transaction.baseSnapshotRoot,
      committedSnapshotRoot: nextSnapshot.snapshotRoot,
      durableCommitPerformed: true,
    });
  } else if (providerReceipt) {
    verifyRelationalProviderCommitReceipt(providerReceipt, {
      transactionId: transaction.transactionId,
      transactionRoot: transaction.transactionRoot,
      idempotencyKey: transaction.idempotencyKey,
      baseSnapshotRoot: transaction.baseSnapshotRoot,
      committedSnapshotRoot: nextSnapshot.snapshotRoot,
    });
  }
  const core = {
    format: RCL_RELATIONAL_COMMIT_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    status: 'COMMITTED',
    transactionId: transaction.transactionId,
    transactionRoot: transaction.transactionRoot,
    idempotencyKey: transaction.idempotencyKey,
    schemaRoot: schema.schemaRoot,
    baseSnapshotRoot: transaction.baseSnapshotRoot,
    committedSnapshotRoot: nextSnapshot.snapshotRoot,
    committedRevision: nextSnapshot.revision,
    isolationLevel: transaction.isolationLevel,
    writeCount: transaction.writes.length,
    readSetRoots: transaction.readSetRoots,
    durability: {
      intent: transaction.durabilityIntent,
      providerId: providerReceipt?.providerId ?? transaction.providerId,
      providerReceiptRoot: providerReceipt?.receiptRoot ?? null,
      idempotencyKey: transaction.idempotencyKey,
      durableCommitProven: providerReceipt?.durableCommitPerformed === true,
    },
    rclExecutedCommit: true,
    canonicalPromotionPerformed: false,
    rclEvidenceCommitPerformed: false,
    worldFactPromoted: false,
  };
  return Object.freeze({ snapshot: nextSnapshot, receipt: deepFreeze({ ...core, receiptRoot: realityRoot(core) }) });
}

export function abortRelationalTransaction(transaction, reason = 'ABORTED') {
  assertOpenTransaction(transaction);
  const normalizedReason = text(reason, 'RCL_RELATIONAL_ABORT_REASON_INVALID', 'reason');
  const core = { ...transaction, status: 'ABORTED', abortReason: normalizedReason, writes: [], transactionRoot: undefined };
  delete core.transactionRoot;
  return deepFreeze({ ...core, transactionRoot: realityRoot(core) });
}

export function createRelationalRecoveryRequest(input = {}) {
  const core = {
    format: RCL_RELATIONAL_RECOVERY_REQUEST_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    requestId: text(input.requestId, 'RCL_RELATIONAL_RECOVERY_REQUEST_ID_REQUIRED', 'requestId'),
    providerId: text(input.providerId, 'RCL_RELATIONAL_PROVIDER_ID_REQUIRED', 'providerId'),
    schemaRoot: root(input.schemaRoot, 'RCL_RELATIONAL_SCHEMA_ROOT_INVALID', 'schemaRoot'),
    targetSnapshotRoot: root(input.targetSnapshotRoot, 'RCL_RELATIONAL_TARGET_SNAPSHOT_ROOT_INVALID', 'targetSnapshotRoot'),
    lastDurableTransactionRoot: input.lastDurableTransactionRoot == null ? null : root(input.lastDurableTransactionRoot, 'RCL_RELATIONAL_LAST_DURABLE_ROOT_INVALID', 'lastDurableTransactionRoot'),
    recoveryMode: 'provider-replay',
    rclRecoveryPerformed: false,
    canonicalPromotionPerformed: false,
    rclEvidenceCommitPerformed: false,
  };
  return deepFreeze({ ...core, requestRoot: realityRoot(core) });
}

export function createRelationalProviderRecoveryReceipt(input = {}) {
  const core = {
    format: RCL_RELATIONAL_PROVIDER_RECOVERY_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    providerId: text(input.providerId, 'RCL_RELATIONAL_PROVIDER_ID_REQUIRED', 'providerId'),
    requestRoot: root(input.requestRoot, 'RCL_RELATIONAL_RECOVERY_REQUEST_ROOT_INVALID', 'requestRoot'),
    schemaRoot: root(input.schemaRoot, 'RCL_RELATIONAL_SCHEMA_ROOT_INVALID', 'schemaRoot'),
    targetSnapshotRoot: root(input.targetSnapshotRoot, 'RCL_RELATIONAL_TARGET_SNAPSHOT_ROOT_INVALID', 'targetSnapshotRoot'),
    recoveredSnapshotRoot: root(input.recoveredSnapshotRoot, 'RCL_RELATIONAL_RECOVERED_SNAPSHOT_ROOT_INVALID', 'recoveredSnapshotRoot'),
    providerRecoveryPerformed: input.providerRecoveryPerformed === true,
    durableRecoveryPerformed: input.durableRecoveryPerformed === true,
    rclRecoveryPerformed: false,
    canonicalPromotionPerformed: false,
    rclEvidenceCommitPerformed: false,
    worldFactPromoted: false,
    rncsRealityCommitPerformed: false,
  };
  return deepFreeze({ ...core, receiptRoot: realityRoot(core) });
}

export function admitRelationalRecovery(schema, request, recoveredSnapshot, providerReceipt) {
  assertSchema(schema);
  if (!request || request.format !== RCL_RELATIONAL_RECOVERY_REQUEST_FORMAT) fail('RCL_RELATIONAL_RECOVERY_REQUEST_INVALID', 'invalid recovery request');
  const requestRoot = root(request.requestRoot, 'RCL_RELATIONAL_RECOVERY_REQUEST_ROOT_INVALID', 'requestRoot');
  const { requestRoot: ignored, ...requestCore } = request;
  if (requestRoot !== realityRoot(requestCore)) fail('RCL_RELATIONAL_RECOVERY_REQUEST_ROOT_MISMATCH', 'recovery request root does not match its content');
  assertSnapshot(schema, recoveredSnapshot);
  if (!providerReceipt || providerReceipt.format !== RCL_RELATIONAL_PROVIDER_RECOVERY_FORMAT) fail('RCL_RELATIONAL_RECOVERY_RECEIPT_REQUIRED', 'recovery admission requires a provider recovery receipt');
  assertProviderReceiptRoot(providerReceipt);
  if (!authorityFlagsClear(providerReceipt)
    || providerReceipt.rclRecoveryPerformed !== false
    || providerReceipt.providerRecoveryPerformed !== true
    || providerReceipt.durableRecoveryPerformed !== true) fail('RCL_RELATIONAL_RECOVERY_PROVIDER_INVALID', 'provider recovery receipt does not prove its bounded operation');
  const expected = {
    providerId: request.providerId,
    requestRoot,
    schemaRoot: schema.schemaRoot,
    targetSnapshotRoot: request.targetSnapshotRoot,
    recoveredSnapshotRoot: recoveredSnapshot.snapshotRoot,
  };
  for (const [key, value] of Object.entries(expected)) if (providerReceipt[key] !== value) fail('RCL_RELATIONAL_RECOVERY_BINDING_MISMATCH', 'provider recovery receipt does not bind to the request', { key, expected: value, actual: providerReceipt[key] });
  const core = {
    format: RCL_RELATIONAL_RECOVERY_ADMISSION_FORMAT,
    version: RCL_RELATIONAL_TRANSACTION_PROTOCOL_VERSION,
    status: 'ADMITTED_PROVIDER_RECOVERY',
    requestRoot,
    schemaRoot: schema.schemaRoot,
    targetSnapshotRoot: request.targetSnapshotRoot,
    recoveredSnapshotRoot: recoveredSnapshot.snapshotRoot,
    providerReceiptRoot: providerReceipt.receiptRoot,
    providerRecoveryProven: true,
    rclRecoveryPerformed: false,
    canonicalPromotionPerformed: false,
    rclEvidenceCommitPerformed: false,
    worldFactPromoted: false,
  };
  return deepFreeze({ ...core, admissionRoot: realityRoot(core) });
}
