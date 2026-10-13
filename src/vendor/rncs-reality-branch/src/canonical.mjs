import {createHash, randomUUID} from 'node:crypto';

export class BranchError extends Error {
  constructor(code, message = '', details = {}) {
    super(`${code}${message ? `: ${message}` : ''}`);
    this.name = 'BranchError';
    this.code = code;
    this.details = details;
  }
}

const cmp = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

export function canonicalJson(value) {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new BranchError('RBF_FLOAT_FORBIDDEN', 'Use integer or decimal string');
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort(cmp).map(key => `${canonicalJson(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  throw new BranchError('RBF_CANONICAL_UNSUPPORTED', typeof value);
}

export const rootHash = value => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
export const clone = value => structuredClone(value);
export const now = () => new Date().toISOString();
export const uid = (prefix = 'id') => `${prefix}:${randomUUID()}`;

export function seal(value, field) {
  const out = clone(value);
  delete out[field];
  out[field] = rootHash(out);
  return out;
}

export function verifySeal(value, field) {
  if (!value || typeof value !== 'object') return false;
  const copy = clone(value);
  const actual = copy[field];
  delete copy[field];
  return actual === rootHash(copy);
}

export function sealContent(value, field, volatileFields = []) {
  const payload = clone(value);
  delete payload[field];
  for (const volatile of volatileFields) delete payload[volatile];
  const out = clone(value);
  out[field] = rootHash(payload);
  return out;
}

export function verifyContentSeal(value, field, volatileFields = []) {
  if (!value || typeof value !== 'object') return false;
  const payload = clone(value);
  const actual = payload[field];
  delete payload[field];
  for (const volatile of volatileFields) delete payload[volatile];
  return actual === rootHash(payload);
}

export function assertHexRoot(value, code = 'RBF_ROOT_INVALID') {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new BranchError(code, String(value));
  return value;
}
