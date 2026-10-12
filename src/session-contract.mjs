import { RCLRuntimeError } from './errors.mjs';
import { semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';

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

export function sessionResult(program, command, before, after, record) {
  // Both runtimes evaluate alterations against the decision state. The native
  // transaction retains one change per target, with the last proposed value.
  // Keep that existing receipt shape in the reference session as well.
  const changes = new Map();
  if (record && record.status !== 'not-triggered') {
    for (const item of record.changes) {
      const change = structuredClone(item), previous = changes.get(change.target);
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
    beforeRoot: semanticStateRootV2Stable(before),
    afterRoot: semanticStateRootV2Stable(after),
    stateRootAlgorithm: 'rcl.semantic-state-root.v2',
    state: structuredClone(after),
    transition,
  };
}
