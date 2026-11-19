import { RCLRuntimeError } from './errors.mjs';
import { semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';
import { semanticStateRootForAlgorithm, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE } from './semantic-state-root.mjs';
import { cloneRuntimeValue, projectAstLiterals } from './compiler-primitives.mjs';

export const RCL_SESSION_VERSION = '1.0.0';
export const RCL_SESSION_FORMAT = 'rcl.governed-session.v1';
export const RCL_SESSION_COMMAND_FORMAT = 'rcl.session-command.v1';
export const RCL_SESSION_RESULT_FORMAT = 'rcl.session-result.v1';
export const RCL_SESSION_INPUT_TYPES = Object.freeze({ Number: 1, Truth: 2, Text: 3 });

export function sessionError(code, message = code, details = {}) {
  return new RCLRuntimeError(code, message, details);
}

export function validateSessionProgram(program) {
  // Replay is pure. Providers/effects need a separate durable settlement protocol.
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'CallExpr' && ['provider_call', 'typed_ref', 'typed_deref', 'typed_ref_id'].includes(node.name)) {
      throw sessionError(node.name === 'provider_call' ? 'RCL_SESSION_EXTERNAL_EFFECT_UNSUPPORTED' : 'RCL_SESSION_REF_OPERATION_UNSUPPORTED');
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(program);
  for (const rule of program.rules) {
    if (rule.calls?.length) throw sessionError('RCL_SESSION_EXTERNAL_EFFECT_UNSUPPORTED');
  }
  for (const facet of program.facets) {
    if (!['Number', 'Truth', 'Text', 'Sequence'].includes(facet.valueType)) {
      throw sessionError('RCL_SESSION_FACET_TYPE_UNSUPPORTED', `Unsupported session type ${facet.valueType}`, { path: facet.path });
    }
    if (facet.input && !Object.hasOwn(RCL_SESSION_INPUT_TYPES, facet.valueType)) {
      throw sessionError('RCL_SESSION_INPUT_TYPE_UNSUPPORTED', 'Session inputs require Number, Truth or Text', { path: facet.path });
    }
  }
  return program;
}

export function normalizeSessionCommand(program, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw sessionError('RCL_SESSION_COMMAND_REQUIRED');
  const { rule, mode = 'realize', inputs = {} } = input;
  if (typeof rule !== 'string' || !program.rules.some(item => item.name === rule)) throw sessionError('RCL_RULE_UNKNOWN', `Unknown rule '${rule}'`);
  if (!['realize', 'foresee'].includes(mode)) throw sessionError('RCL_SESSION_MODE_INVALID');
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw sessionError('RCL_SESSION_INPUTS_REQUIRED');
  if (Object.getOwnPropertySymbols(inputs).length) throw sessionError('RCL_SESSION_INPUTS_INVALID');
  const observations = Object.create(null);
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(inputs))) {
    if (!('value' in descriptor) || !descriptor.enumerable) throw sessionError('RCL_SESSION_INPUTS_INVALID');
    const facet = program.facets.find(item => item.path === name && item.input === true);
    if (!facet) throw sessionError('RCL_SESSION_INPUT_NOT_DECLARED', `Facet '${name}' is not a declared input`);
    const value = descriptor.value;
    const valid = facet.valueType === 'Number' ? typeof value === 'number' && Number.isFinite(value)
      : facet.valueType === 'Truth' ? typeof value === 'boolean'
        : typeof value === 'string' && !value.includes('\0') && Buffer.byteLength(value, 'utf8') <= 1024 * 1024;
    if (!valid) throw sessionError('RCL_SESSION_INPUT_TYPE_MISMATCH', `Invalid ${facet.valueType} input '${name}'`);
    semanticStateRootV2Stable({ [name]: value });
    observations[name] = Object.is(value, -0) ? 0 : value;
  }
  return { format: RCL_SESSION_COMMAND_FORMAT, rule, mode, inputs: observations };
}

export function captureScalarSessionCheckpoint(program, checkpoint, stateRootAlgorithm) {
  const validObject = value => value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  if (!validObject(checkpoint)) throw sessionError('RCL_SESSION_CHECKPOINT_STATE_INVALID');
  const properties = Object.getOwnPropertyDescriptors(checkpoint);
  const stateRoot = properties.stateRoot?.value, state = properties.state?.value;
  if (Reflect.ownKeys(properties).length !== 2 || !properties.stateRoot?.enumerable || !properties.state?.enumerable
      || typeof stateRoot !== 'string' || !/^[0-9a-f]{64}$/u.test(stateRoot) || !validObject(state)) {
    throw sessionError('RCL_SESSION_CHECKPOINT_STATE_INVALID');
  }
  const fields = Object.getOwnPropertyDescriptors(state);
  if (Reflect.ownKeys(fields).length !== program.facets.length) throw sessionError('RCL_SESSION_CHECKPOINT_STATE_INVALID');
  const captured = Object.create(null);
  for (const facet of program.facets) {
    if (!Object.hasOwn(RCL_SESSION_INPUT_TYPES, facet.valueType)) {
      throw sessionError('RCL_SESSION_CHECKPOINT_FACET_UNSUPPORTED', `Checkpoint requires scalar facets: ${facet.path}`);
    }
    const field = Object.hasOwn(fields, facet.path) ? fields[facet.path] : null;
    if (!field?.enumerable || !('value' in field)) throw sessionError('RCL_SESSION_CHECKPOINT_STATE_INVALID');
    const value = field.value;
    const valid = facet.valueType === 'Number' ? typeof value === 'number' && Number.isFinite(value)
      : facet.valueType === 'Truth' ? typeof value === 'boolean'
        : typeof value === 'string' && !value.includes('\0') && Buffer.byteLength(value, 'utf8') <= 1024 * 1024
          && Buffer.from(value, 'utf8').toString('utf8') === value;
    if (!valid) throw sessionError('RCL_SESSION_CHECKPOINT_STATE_INVALID', `Invalid checkpoint facet: ${facet.path}`);
    captured[facet.path] = value;
  }
  if (semanticStateRootForAlgorithm(captured, stateRootAlgorithm) !== stateRoot) throw sessionError('RCL_SESSION_CHECKPOINT_STATE_ROOT_MISMATCH');
  return Object.freeze({ stateRoot, state: Object.freeze(captured) });
}

export function scalarCheckpointNegativeZeroFacets(state) {
  return Object.keys(state).filter(name => Object.is(state[name], -0)).sort();
}

export function applyScalarCheckpointNumberSigns(state, negativeZeroFacets) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || !Array.isArray(negativeZeroFacets)
      || negativeZeroFacets.length > Object.keys(state).length) throw sessionError('RCL_SESSION_CHECKPOINT_NUMBER_SIGNS_INVALID');
  const captured = Object.assign(Object.create(null), state);
  const seen = new Set();
  for (const name of negativeZeroFacets) {
    if (typeof name !== 'string' || !Object.hasOwn(captured, name) || captured[name] !== 0 || seen.has(name)) {
      throw sessionError('RCL_SESSION_CHECKPOINT_NUMBER_SIGNS_INVALID');
    }
    seen.add(name);
    captured[name] = -0;
  }
  if (scalarCheckpointNegativeZeroFacets(captured).some(name => !seen.has(name))) {
    throw sessionError('RCL_SESSION_CHECKPOINT_NUMBER_SIGNS_INVALID');
  }
  return captured;
}

export function sessionResult(program, command, before, after, record, stateRootAlgorithm = 'rcl.semantic-state-root.v2') {
  // Both runtimes evaluate alterations against the decision state. The native
  // transaction retains one change per target, with the last proposed value.
  // Keep that existing receipt shape in the reference session as well.
  const changes = new Map();
  if (record && record.status !== 'not-triggered') {
    for (const item of record.changes) {
      const change = cloneRuntimeValue(item), previous = changes.get(change.target);
      if (previous) change.before = previous.before;
      changes.set(change.target, change);
    }
  }
  const transition = record && record.status !== 'not-triggered' ? {
    rule: command.rule, mode: command.mode, status: record.status, actor: record.actor,
    beforeRoot: record.beforeRoot, afterRoot: record.afterRoot,
    stateRootAlgorithm: record.stateRootAlgorithm,
    changes: [...changes.values()], witnesses: [...record.witnesses],
    authority: structuredClone(record.authority),
  } : null;
  return {
    format: RCL_SESSION_RESULT_FORMAT,
    program: program.name,
    programRoot: program.programRoot,
    command: structuredClone(command),
    status: record?.status ?? 'not-triggered',
    beforeRoot: semanticStateRootForAlgorithm(before, stateRootAlgorithm),
    afterRoot: semanticStateRootForAlgorithm(after, stateRootAlgorithm),
    stateRootAlgorithm,
    state: stateRootAlgorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE ? projectAstLiterals(after) : structuredClone(after),
    transition: stateRootAlgorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE ? projectAstLiterals(transition) : transition,
  };
}
