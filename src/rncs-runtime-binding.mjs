import { realityRoot } from './canonical.mjs';

export const RCL_RNCS_RUNTIME_BINDING_FORMAT = 'rncs.authority-presentation-binding.v0.1';
export const RCL_RNCS_RUNTIME_BINDING_VERSION = '0.1.0';

export function createRclRncsRuntimeBinding(input = {}) {
  const payload = normalizeRclRncsRuntimeBinding(input);
  const binding = {
    ...payload,
    bindingRoot: input.bindingRoot ?? realityRoot(payload),
  };
  const verification = verifyRclRncsRuntimeBinding(binding);
  if (!verification.ok) throw new TypeError(`invalid RNCS runtime binding: ${verification.reason ?? verification.errors.join(',')}`);
  return Object.freeze(binding);
}

export function normalizeRclRncsRuntimeBinding(input = {}) {
  assertObject(input, 'runtime binding');
  const authorityFrame = input.authorityFrame;
  const temporalPacket = input.temporalPacket;
  assertObject(authorityFrame, 'runtime binding authorityFrame');
  assertObject(temporalPacket, 'runtime binding temporalPacket');
  return {
    format: input.format ?? RCL_RNCS_RUNTIME_BINDING_FORMAT,
    version: input.version ?? RCL_RNCS_RUNTIME_BINDING_VERSION,
    worldId: nonEmptyString(input.worldId, 'runtime binding worldId'),
    tick: safeTick(input.tick, 'runtime binding tick'),
    stepHz: positiveNumber(input.stepHz, 'runtime binding stepHz'),
    stateRoot: nonEmptyString(input.stateRoot, 'runtime binding stateRoot'),
    previousStateRoot: nonEmptyString(input.previousStateRoot, 'runtime binding previousStateRoot'),
    authorityFrame: {
      format: nonEmptyString(authorityFrame.format, 'authorityFrame.format'),
      protocol: nonEmptyString(authorityFrame.protocol, 'authorityFrame.protocol'),
      frameRoot: nonEmptyString(authorityFrame.frameRoot, 'authorityFrame.frameRoot'),
      sourceStateRoot: nonEmptyString(authorityFrame.sourceStateRoot, 'authorityFrame.sourceStateRoot'),
      previousStateRoot: nonEmptyString(authorityFrame.previousStateRoot, 'authorityFrame.previousStateRoot'),
      objectIds: stringArray(authorityFrame.objectIds, 'authorityFrame.objectIds'),
      bodyRoots: stringArray(authorityFrame.bodyRoots, 'authorityFrame.bodyRoots'),
    },
    temporalPacket: {
      format: nonEmptyString(temporalPacket.format, 'temporalPacket.format'),
      protocol: nonEmptyString(temporalPacket.protocol, 'temporalPacket.protocol'),
      packetRoot: nonEmptyString(temporalPacket.packetRoot, 'temporalPacket.packetRoot'),
      sourceStateRoot: nonEmptyString(temporalPacket.sourceStateRoot, 'temporalPacket.sourceStateRoot'),
      sourcePacketRoot: nonEmptyString(temporalPacket.sourcePacketRoot, 'temporalPacket.sourcePacketRoot'),
      objectIds: stringArray(temporalPacket.objectIds, 'temporalPacket.objectIds'),
      authorityBodyRoots: nullableStringArray(temporalPacket.authorityBodyRoots, 'temporalPacket.authorityBodyRoots'),
    },
  };
}

export function verifyRclRncsRuntimeBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    return { ok: false, reason: 'runtime binding must be an object' };
  }
  try {
    const { bindingRoot, ...payload } = binding;
    const normalized = normalizeRclRncsRuntimeBinding(payload);
    const checks = {
      format: normalized.format === RCL_RNCS_RUNTIME_BINDING_FORMAT,
      version: normalized.version === RCL_RNCS_RUNTIME_BINDING_VERSION,
      root: typeof bindingRoot === 'string' && realityRoot(payload) === bindingRoot,
      stateRoot: normalized.authorityFrame.sourceStateRoot === normalized.stateRoot
        && normalized.temporalPacket.sourceStateRoot === normalized.stateRoot,
      authorityRoot: normalized.temporalPacket.sourcePacketRoot === normalized.authorityFrame.frameRoot,
      timeDomain: normalized.authorityFrame.objectIds.length === normalized.temporalPacket.objectIds.length
        && normalized.authorityFrame.objectIds.every((id, index) => id === normalized.temporalPacket.objectIds[index]),
      bodyRoots: normalized.authorityFrame.bodyRoots.length === normalized.authorityFrame.objectIds.length
        && normalized.temporalPacket.authorityBodyRoots.every((root, index) => root == null || root === normalized.authorityFrame.bodyRoots[index]),
    };
    return {
      ok: Object.values(checks).every(Boolean),
      checks,
      expectedRoot: realityRoot(payload),
      actualRoot: bindingRoot ?? null,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value.map((item, index) => nonEmptyString(item, `${label}[${index}]`));
}

function nullableStringArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value.map((item, index) => item == null ? null : nonEmptyString(item, `${label}[${index}]`));
}

function safeTick(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
  return value;
}

function positiveNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be a positive finite number`);
  return value;
}
