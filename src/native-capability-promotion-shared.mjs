import fs from 'node:fs';
import crypto from 'node:crypto';

export const RCL_NATIVE_CAPABILITY_PROMOTION_VERSION = '0.1.0-alpha.1';
export const RCL_NATIVE_IMPLEMENTATION_MANIFEST_FORMAT = 'rcl.native-capability-implementation-manifest.v0.1';
export const RCL_NATIVE_PROMOTION_REPORT_FORMAT = 'rcl.native-capability-promotion-report.v0.1';
export const RCL_NATIVE_PROMOTION_STATUSES = Object.freeze(['native-verified', 'native-rejected', 'native-blocked']);

export class RCLNativeCapabilityPromotionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLNativeCapabilityPromotionError';
    this.code = code;
    this.details = details;
  }
}

export function assertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLNativeCapabilityPromotionError(code, message, { value });
  }
  return value;
}

export function nonEmptyString(value, code, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RCLNativeCapabilityPromotionError(code, message, { value });
  }
  return value.trim();
}

export function safeIdentifier(value, fallback = 'case') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^([^A-Za-z_])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function executableFormat(filePath) {
  if (!fs.existsSync(filePath)) {
    return Object.freeze({ exists: false, bytes: 0, kind: 'missing', sha256: null });
  }
  const buffer = fs.readFileSync(filePath);
  const mz = buffer.length >= 2 && buffer.toString('ascii', 0, 2) === 'MZ';
  const elf = buffer.length >= 4 && buffer[0] === 0x7f && buffer.toString('ascii', 1, 4) === 'ELF';
  const machO = buffer.length >= 4 && [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe]
    .includes(buffer.readUInt32BE(0));
  return Object.freeze({
    exists: true,
    bytes: buffer.length,
    kind: mz ? 'pe' : (elf ? 'elf' : (machO ? 'mach-o' : 'unknown')),
    sha256: sha256(buffer),
  });
}

export function withoutRoot(value) {
  const { root: _root, ...rest } = value;
  return rest;
}

export function assertRoot(actual, expected, code, message, details = {}) {
  if (actual !== expected) {
    throw new RCLNativeCapabilityPromotionError(code, message, {
      ...details,
      expectedRoot: expected,
      actualRoot: actual,
    });
  }
}
