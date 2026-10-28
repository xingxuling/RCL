import { semanticStateRootV2Stable as root } from '../../src/semantic-state-root-v2.mjs';

// Independent encoding of the documented v1/v2 receipt profiles for corruption
// and migration controls; these helpers do not call the implementation owner.
export function commandIdentityForRecord(record, command = record.command, legacy = record.format === 'rcl.session-journal-command.v1') {
  const { programRoot, expectedRevision } = record;
  return legacy ? root({ programRoot, command, expectedRevision }) : root({
    format: 'rcl.session-command-identity.v2', programRoot, expectedRevision,
    commandFormat: command.format, rule: command.rule, mode: command.mode, inputsRoot: root(command.inputs),
  });
}
export function resultIdentityForRecord(record) {
  return record.format === 'rcl.session-journal-command.v1' ? root(record.result) : root({
    format: 'rcl.session-result-identity.v2', payloadRoot: root(record.result),
    commandRoot: commandIdentityForRecord(record, record.result.command, false), stateRoot: root(record.result.state),
  });
}
