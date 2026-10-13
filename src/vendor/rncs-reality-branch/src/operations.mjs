import {clone, rootHash, BranchError} from './canonical.mjs';

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function splitPath(path) {
  if (typeof path !== 'string' || !path.trim()) throw new BranchError('RBF_PATH_INVALID', String(path));
  const parts = path.split('.').filter(Boolean);
  if (!parts.length || parts.some(part => BLOCKED_KEYS.has(part))) throw new BranchError('RBF_PATH_UNSAFE', path);
  return parts;
}

export function getPath(object, path) {
  return splitPath(path).reduce((value, key) => value?.[key], object);
}

export function hasPath(object, path) {
  const parts = splitPath(path);
  let cursor = object;
  for (const key of parts) {
    if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, key)) return false;
    cursor = cursor[key];
  }
  return true;
}

function parentAt(object, path, {create = true} = {}) {
  const parts = splitPath(path);
  const key = parts.pop();
  let cursor = object;
  for (const part of parts) {
    if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      if (!create) return [null, key];
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  return [cursor, key];
}

function equal(a, b) {
  return rootHash(a) === rootHash(b);
}

export function evaluatePredicate(state, predicate = {}) {
  const actual = predicate.path ? getPath(state, predicate.path) : state;
  const exists = predicate.path ? hasPath(state, predicate.path) : true;
  const operator = predicate.operator ?? 'equals';
  let passed = false;
  if (operator === 'exists') passed = exists === Boolean(predicate.value ?? true);
  else if (operator === 'equals') passed = exists && equal(actual, predicate.value);
  else if (operator === 'not_equals') passed = !exists || !equal(actual, predicate.value);
  else if (operator === 'in') passed = Array.isArray(predicate.value) && predicate.value.some(item => equal(actual, item));
  else if (operator === 'gte') passed = Number(actual) >= Number(predicate.value);
  else if (operator === 'lte') passed = Number(actual) <= Number(predicate.value);
  else if (operator === 'contains') passed = Array.isArray(actual) ? actual.some(item => equal(item, predicate.value)) : String(actual ?? '').includes(String(predicate.value ?? ''));
  else throw new BranchError('RBF_PREDICATE_UNSUPPORTED', operator);
  return {passed, path: predicate.path ?? '', operator, expected: predicate.value === undefined ? null : clone(predicate.value), actual: actual === undefined ? null : clone(actual)};
}

export function assertPreconditions(state, preconditions = [], context = '') {
  const failures = preconditions.map(item => evaluatePredicate(state, item)).filter(item => !item.passed);
  if (failures.length) throw new BranchError('RBF_PRECONDITION_FAILED', context, {failures});
  return true;
}

export function inverseForOperation(state, operation) {
  const existed = hasPath(state, operation.path);
  const before = existed ? clone(getPath(state, operation.path)) : undefined;
  if (!existed) return {op: 'remove', path: operation.path, operation_id: `rollback:${operation.operation_id ?? operation.path}`};
  return {op: 'set', path: operation.path, value: before, operation_id: `rollback:${operation.operation_id ?? operation.path}`};
}

export function applyOperation(state, operation, {capture = false} = {}) {
  const out = clone(state);
  const op = clone(operation);
  assertPreconditions(out, op.preconditions ?? [], op.operation_id ?? op.path);
  const beforeRoot = rootHash(out);
  const inverse = inverseForOperation(out, op);
  const [parent, key] = parentAt(out, op.path, {create: op.op !== 'remove'});

  if (op.op === 'set') parent[key] = clone(op.value);
  else if (op.op === 'remove') {
    if (parent) delete parent[key];
  } else if (op.op === 'append') {
    if (!Array.isArray(parent[key])) parent[key] = [];
    parent[key].push(clone(op.value));
  } else if (op.op === 'increment') {
    const value = Number(parent[key] ?? 0) + Number(op.value ?? 1);
    if (!Number.isSafeInteger(value)) throw new BranchError('RBF_INCREMENT_NOT_INTEGER', op.path);
    parent[key] = value;
  } else if (op.op === 'merge') {
    if (!op.value || typeof op.value !== 'object' || Array.isArray(op.value)) throw new BranchError('RBF_MERGE_VALUE_INVALID', op.path);
    const current = parent[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key]) ? parent[key] : {};
    parent[key] = {...clone(current), ...clone(op.value)};
  } else throw new BranchError('RBF_OPERATION_UNSUPPORTED', op.op);

  const afterRoot = rootHash(out);
  if (!capture) return out;
  return {
    state: out,
    receipt: {
      operation_id: op.operation_id ?? `operation:${rootHash(op).slice(0, 16)}`,
      op: op.op,
      path: op.path,
      before_state_root: beforeRoot,
      after_state_root: afterRoot,
      inverse,
      changed: beforeRoot !== afterRoot,
    },
  };
}

export function applyOperations(state, operations = [], {capture = false} = {}) {
  let current = clone(state);
  const receipts = [];
  for (const operation of operations) {
    const result = applyOperation(current, operation, {capture});
    if (capture) {
      current = result.state;
      receipts.push(result.receipt);
    } else current = result;
  }
  return capture ? {state: current, receipts} : current;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function diffStates(before, after, prefix = '') {
  if (equal(before, after)) return [];
  if (!isObject(before) || !isObject(after)) return [{path: prefix || '$', before: before === undefined ? null : clone(before), after: after === undefined ? null : clone(after), before_exists: before !== undefined, after_exists: after !== undefined, kind: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed'}];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes = [];
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!Object.prototype.hasOwnProperty.call(before, key)) changes.push({path, before: null, after: clone(after[key]), before_exists: false, after_exists: true, kind: 'added'});
    else if (!Object.prototype.hasOwnProperty.call(after, key)) changes.push({path, before: clone(before[key]), after: null, before_exists: true, after_exists: false, kind: 'removed'});
    else changes.push(...diffStates(before[key], after[key], path));
  }
  return changes;
}

export function pathsOverlap(a, b) {
  return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}
