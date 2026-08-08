import { createHash } from 'node:crypto';
import {
  RCL_CANONICAL_NUMBER_ENCODING_V2,
  canonicalNumberV2,
  canonicalNumberV2BitsFromRaw,
  float64RawBits,
  numberFromRawBits,
} from './canonical-number-v2.mjs';

export const RBC13_NUMBER_ENCODING_V2_CORPUS_FORMAT = 'rcl.rbc13-number-encoding-v2-corpus.v0.1';
export const RBC13_NUMBER_ENCODING_V2_FIXED_SEED = 0x52424331335f4e31n;
export const RBC13_NUMBER_ENCODING_V2_GENERATED_SEED = 0x52424331335f4731n;
export const RBC13_NUMBER_ENCODING_V2_FIXED_COUNT = 1000;
export const RBC13_NUMBER_ENCODING_V2_GENERATED_COUNT = 10000;

const MASK_64 = 0xffffffffffffffffn;
const EXPONENT_MASK = 0x7ff0000000000000n;
const FINITE_MAX_EXPONENT = 0x7fe0000000000000n;

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function hexBits(bits) {
  return `0x${bits.toString(16).padStart(16, '0')}`;
}

function nextSplitMix64(state) {
  let value = (state.value + 0x9e3779b97f4a7c15n) & MASK_64;
  state.value = value;
  value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return (value ^ (value >> 31n)) & MASK_64;
}

function finiteRawBits(bits) {
  if ((bits & EXPONENT_MASK) === EXPONENT_MASK) {
    return (bits & ~EXPONENT_MASK) | FINITE_MAX_EXPONENT;
  }
  return bits;
}

function sourceBits(source) {
  return float64RawBits(Number(source));
}

const EDGE_CASES = Object.freeze([
  ['zero', 'zero', '0x0000000000000000', '0'],
  ['negative-zero', 'zero', '0x8000000000000000', '-0'],
  ['one', 'integer', '0x3ff0000000000000', '1'],
  ['negative-one', 'integer', '0xbff0000000000000', '-1'],
  ['min-positive-subnormal', 'subnormal', '0x0000000000000001', 'Number.MIN_VALUE'],
  ['max-positive-subnormal', 'subnormal', '0x000fffffffffffff', '0x000fffffffffffff'],
  ['min-positive-normal', 'normal', '0x0010000000000000', '0x0010000000000000'],
  ['max-finite', 'finite-boundary', '0x7fefffffffffffff', 'Number.MAX_VALUE'],
  ['min-negative-subnormal', 'subnormal', '0x8000000000000001', '-Number.MIN_VALUE'],
  ['max-negative-finite', 'finite-boundary', '0xffefffffffffffff', '-Number.MAX_VALUE'],
  ['max-safe-integer', 'safe-integer', null, '9007199254740991'],
  ['max-safe-minus-one', 'safe-integer', null, '9007199254740990'],
  ['min-safe-integer', 'safe-integer', null, '-9007199254740991'],
  ['one-tenth', 'decimal', null, '0.1'],
  ['binary-rounding', 'decimal', null, '0.30000000000000004'],
  ['fifteen-significant', 'decimal', null, '1.23456789012345'],
  ['seventeen-significant', 'decimal', null, '1.2345678901234567'],
  ['large-decimal', 'large-decimal', null, '1234567890123456'],
  ['small-decimal', 'small-decimal', null, '0.000000000000001'],
  ['negative-large-decimal', 'large-decimal', null, '-1234567890123456'],
  ['negative-small-decimal', 'small-decimal', null, '-0.000000000000001'],
  ['positive-power-308', 'exponent', null, '1e308'],
  ['negative-power-308', 'exponent', null, '-1e308'],
  ['positive-power-minus-308', 'exponent', null, '1e-308'],
  ['negative-power-minus-308', 'exponent', null, '-1e-308'],
]);

function edgeRawBits(rawBits, source) {
  if (rawBits) return BigInt(rawBits);
  if (source === 'Number.MIN_VALUE') return float64RawBits(Number.MIN_VALUE);
  if (source === '-Number.MIN_VALUE') return float64RawBits(-Number.MIN_VALUE);
  if (source === 'Number.MAX_VALUE') return float64RawBits(Number.MAX_VALUE);
  if (source === '-Number.MAX_VALUE') return float64RawBits(-Number.MAX_VALUE);
  if (source.startsWith('0x') && source.length === 18) return BigInt(source);
  return sourceBits(source);
}

function makeCase(id, family, rawBits, source = null, origin = 'generated') {
  const raw = typeof rawBits === 'bigint' ? rawBits : BigInt(rawBits);
  const value = numberFromRawBits(raw);
  const canonicalBits = canonicalNumberV2BitsFromRaw(raw);
  return Object.freeze({
    id,
    family,
    origin,
    source,
    sourceRepresentation: source ?? `raw-bits:${hexBits(raw)}`,
    rawBits: hexBits(raw),
    canonicalBits: hexBits(canonicalBits),
    token: canonicalNumberV2(value),
  });
}

function classifyRandomBits(bits) {
  const magnitude = bits & 0x7fffffffffffffffn;
  if (magnitude === 0n) return 'zero';
  if ((magnitude & EXPONENT_MASK) === 0n) return 'subnormal';
  if ((magnitude >> 52n) <= 0x3ffn) return 'low-magnitude';
  if ((magnitude >> 52n) >= 0x7fen) return 'high-magnitude';
  return 'finite-random';
}

export function buildRbc13NumberEncodingV2Corpus(options = {}) {
  const fixedCount = Number(options.fixedCount ?? RBC13_NUMBER_ENCODING_V2_FIXED_COUNT);
  const generatedCount = Number(options.generatedCount ?? RBC13_NUMBER_ENCODING_V2_GENERATED_COUNT);
  if (!Number.isInteger(fixedCount) || fixedCount < EDGE_CASES.length) throw new Error(`fixedCount must be at least ${EDGE_CASES.length}`);
  if (!Number.isInteger(generatedCount) || generatedCount < 1) throw new Error('generatedCount must be a positive integer');

  const fixed = [];
  for (const [id, family, rawBits, source] of EDGE_CASES) {
    fixed.push(makeCase(`fixed-${id}`, family, edgeRawBits(rawBits, source), source, 'fixed-edge'));
  }
  const fixedState = { value: RBC13_NUMBER_ENCODING_V2_FIXED_SEED };
  while (fixed.length < fixedCount) {
    const index = fixed.length;
    const rawBits = finiteRawBits(nextSplitMix64(fixedState));
    fixed.push(makeCase(`fixed-${String(index).padStart(4, '0')}`, classifyRandomBits(rawBits), rawBits, null, 'fixed-seed'));
  }

  const generated = [];
  const generatedState = { value: RBC13_NUMBER_ENCODING_V2_GENERATED_SEED };
  while (generated.length < generatedCount) {
    const index = generated.length;
    const rawBits = finiteRawBits(nextSplitMix64(generatedState));
    generated.push(makeCase(`generated-${String(index).padStart(5, '0')}`, classifyRandomBits(rawBits), rawBits, null, 'generated-seed'));
  }

  const fixedRoot = sha256({
    format: RBC13_NUMBER_ENCODING_V2_CORPUS_FORMAT,
    encoding: RCL_CANONICAL_NUMBER_ENCODING_V2,
    seed: `0x${RBC13_NUMBER_ENCODING_V2_FIXED_SEED.toString(16)}`,
    count: fixed.length,
    cases: fixed.map(({ id, family, source, rawBits }) => ({ id, family, source, rawBits })),
  });
  const generatedRoot = sha256({
    format: RBC13_NUMBER_ENCODING_V2_CORPUS_FORMAT,
    encoding: RCL_CANONICAL_NUMBER_ENCODING_V2,
    seed: `0x${RBC13_NUMBER_ENCODING_V2_GENERATED_SEED.toString(16)}`,
    count: generated.length,
    cases: generated.map(({ id, family, rawBits }) => ({ id, family, rawBits })),
  });
  const corpusRoot = sha256({
    format: RBC13_NUMBER_ENCODING_V2_CORPUS_FORMAT,
    encoding: RCL_CANONICAL_NUMBER_ENCODING_V2,
    fixedRoot,
    generatedRoot,
    fixedCount: fixed.length,
    generatedCount: generated.length,
  });
  return Object.freeze({
    format: RBC13_NUMBER_ENCODING_V2_CORPUS_FORMAT,
    encoding: RCL_CANONICAL_NUMBER_ENCODING_V2,
    fixedSeed: `0x${RBC13_NUMBER_ENCODING_V2_FIXED_SEED.toString(16)}`,
    generatedSeed: `0x${RBC13_NUMBER_ENCODING_V2_GENERATED_SEED.toString(16)}`,
    fixed,
    generated,
    fixedRoot,
    generatedRoot,
    root: corpusRoot,
    caseCount: fixed.length + generated.length,
    finiteOnly: true,
    negativeZeroPolicy: 'canonicalize-to-positive-zero',
  });
}
