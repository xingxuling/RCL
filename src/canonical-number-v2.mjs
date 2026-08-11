import { Buffer } from 'node:buffer';

export const RCL_CANONICAL_NUMBER_ENCODING_V2 = 'rcl.canonical-number.v2';
export const RCL_CANONICAL_NUMBER_V2_BYTES = 8;
export const RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH = 18;

const EXPONENT_MASK = 0x7ff0000000000000n;
const FRACTION_MASK = 0x000fffffffffffffn;
const SIGN_MASK = 0x8000000000000000n;
const ZERO_MASK = EXPONENT_MASK | FRACTION_MASK;
const BUFFER = new ArrayBuffer(RCL_CANONICAL_NUMBER_V2_BYTES);
const VIEW = new DataView(BUFFER);

export class RCLCanonicalNumberV2Error extends TypeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLCanonicalNumberV2Error';
    this.code = code;
    this.details = details;
  }
}

function assertFiniteNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RCLCanonicalNumberV2Error(
      'RCL_CANONICAL_NUMBER_V2_NONFINITE',
      'RCL canonical Number v2 accepts finite IEEE-754 binary64 Numbers only',
      { valueType: typeof value, value: Number.isNaN(value) ? 'NaN' : String(value) },
    );
  }
}

export function float64RawBits(value) {
  assertFiniteNumber(value);
  VIEW.setFloat64(0, value, false);
  return VIEW.getBigUint64(0, false);
}

export function numberFromRawBits(rawBits) {
  const bits = typeof rawBits === 'bigint' ? rawBits : BigInt(rawBits);
  if (bits < 0n || bits > 0xffffffffffffffffn) {
    throw new RCLCanonicalNumberV2Error('RCL_CANONICAL_NUMBER_V2_BITS_RANGE', 'Raw binary64 bits are outside uint64', { rawBits: String(rawBits) });
  }
  VIEW.setBigUint64(0, bits, false);
  const value = VIEW.getFloat64(0, false);
  if (!Number.isFinite(value)) {
    throw new RCLCanonicalNumberV2Error('RCL_CANONICAL_NUMBER_V2_NONFINITE_BITS', 'Raw binary64 bits encode a non-finite Number', { rawBits: `0x${bits.toString(16).padStart(16, '0')}` });
  }
  return value;
}

export function canonicalNumberV2BitsFromRaw(rawBits) {
  const bits = typeof rawBits === 'bigint' ? rawBits : BigInt(rawBits);
  if (bits < 0n || bits > 0xffffffffffffffffn) {
    throw new RCLCanonicalNumberV2Error('RCL_CANONICAL_NUMBER_V2_BITS_RANGE', 'Raw binary64 bits are outside uint64', { rawBits: String(rawBits) });
  }
  if ((bits & EXPONENT_MASK) === EXPONENT_MASK) {
    throw new RCLCanonicalNumberV2Error('RCL_CANONICAL_NUMBER_V2_NONFINITE_BITS', 'Raw binary64 bits encode a non-finite Number', { rawBits: `0x${bits.toString(16).padStart(16, '0')}` });
  }
  return (bits & ZERO_MASK) === 0n ? 0n : bits;
}

export function canonicalNumberV2Bits(value) {
  return canonicalNumberV2BitsFromRaw(float64RawBits(value));
}

export function canonicalNumberV2TokenFromBits(bits) {
  const canonicalBits = canonicalNumberV2BitsFromRaw(bits);
  return `0x${canonicalBits.toString(16).padStart(16, '0')}`;
}

export function canonicalNumberV2(value) {
  return canonicalNumberV2TokenFromBits(canonicalNumberV2Bits(value));
}

export function canonicalNumberV2Bytes(value) {
  const bits = canonicalNumberV2Bits(value);
  const bytes = Buffer.alloc(RCL_CANONICAL_NUMBER_V2_BYTES);
  bytes.writeBigUInt64BE(bits, 0);
  return bytes;
}

export function canonicalNumberV2Record(value) {
  const rawBits = float64RawBits(value);
  const bits = canonicalNumberV2BitsFromRaw(rawBits);
  return Object.freeze({
    encoding: RCL_CANONICAL_NUMBER_ENCODING_V2,
    bytes: RCL_CANONICAL_NUMBER_V2_BYTES,
    rawBits: `0x${rawBits.toString(16).padStart(16, '0')}`,
    bits: `0x${bits.toString(16).padStart(16, '0')}`,
    token: canonicalNumberV2TokenFromBits(bits),
    negativeZeroCanonicalized: rawBits === SIGN_MASK,
  });
}

export function decodeCanonicalNumberV2(token) {
  if (typeof token !== 'string' || !/^0x[0-9a-f]{16}$/.test(token)) {
    throw new RCLCanonicalNumberV2Error('RCL_CANONICAL_NUMBER_V2_TOKEN', 'Canonical Number v2 token must be lowercase 0x followed by 16 hexadecimal digits', { token });
  }
  const bits = BigInt(token);
  if ((bits & ZERO_MASK) === 0n && bits !== 0n) {
    throw new RCLCanonicalNumberV2Error('RCL_CANONICAL_NUMBER_V2_NEGATIVE_ZERO', 'Negative zero is not a canonical Number v2 token', { token });
  }
  if ((bits & EXPONENT_MASK) === EXPONENT_MASK) {
    throw new RCLCanonicalNumberV2Error('RCL_CANONICAL_NUMBER_V2_NONFINITE_TOKEN', 'Canonical Number v2 token cannot encode NaN or Infinity', { token });
  }
  VIEW.setBigUint64(0, bits, false);
  return VIEW.getFloat64(0, false);
}

export function canonicalNumberV2BytesFromToken(token) {
  const value = decodeCanonicalNumberV2(token);
  return canonicalNumberV2Bytes(value);
}
