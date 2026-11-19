import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { compileReality } from './compiler.mjs';
import { compileRealitySessionBytecode } from './bytecode.mjs';
import { compileRealitySessionNative } from './session-compiler.mjs';
import { createNativeRealitySession, createNativeRealitySessionFromScalarCheckpoint, createNativeRealitySessionFromSequenceCheckpoint, encodeSessionInputs } from './native-session.mjs';
import { createRealitySession, createRealitySessionFromScalarCheckpoint, createRealitySessionFromSequenceCheckpoint } from './runtime.mjs';
import { semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';
import { semanticStateRootForAlgorithm, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE } from './semantic-state-root.mjs';
import {
  captureScalarSessionCheckpoint, applyScalarCheckpointNumberSigns, scalarCheckpointNegativeZeroFacets,
  normalizeSessionCommand, sessionError, RCL_SESSION_COMMAND_FORMAT, RCL_SESSION_RESULT_FORMAT,
} from './session-contract.mjs';
import { captureSequenceSessionCheckpoint, encodeSequenceCheckpointState, hasSequenceCheckpointState } from './session-checkpoint-state.mjs';

export const RCL_DURABLE_SESSION_VERSION = '1.0.0';
export const RCL_SESSION_JOURNAL_FORMAT = 'rcl.session-journal.v2';
export const RCL_SESSION_JOURNAL_V3_CANDIDATE_FORMAT = 'rcl.session-journal.v3-candidate';
export const RCL_SESSION_COMMAND_IDENTITY_FORMAT = 'rcl.session-command-identity.v2';
export const RCL_SESSION_COMMAND_IDENTITY_V3_CANDIDATE_FORMAT = 'rcl.session-command-identity.v3-candidate';
export const RCL_SESSION_BACKUP_FORMAT = 'rcl.session-backup.v1';
export const RCL_SESSION_BACKUP_V3_CANDIDATE_FORMAT = 'rcl.session-backup.v3-candidate';
export const RCL_SESSION_HISTORY_FORMAT = 'rcl.session-history-page.v1';
export const RCL_SESSION_HISTORY_V3_CANDIDATE_FORMAT = 'rcl.session-history-page.v3-candidate';
export const RCL_SESSION_HISTORY_VERIFICATION_FORMAT = 'rcl.session-history-verification.v1';
export const RCL_SESSION_CHECKPOINT_FORMAT = 'rcl.session-checkpoint.v2-candidate';
export const RCL_SESSION_CHECKPOINT_BACKUP_FORMAT = 'rcl.session-checkpoint-backup.v1-candidate';
export const RCL_SESSION_CHECKPOINT_HISTORY_FORMAT = 'rcl.session-checkpoint-history-page.v1-candidate';
export const RCL_SESSION_CHECKPOINT_CHAIN_FORMAT = 'rcl.session-checkpoint.v3-candidate';
export const RCL_SESSION_CHECKPOINT_CHAIN_BACKUP_FORMAT = 'rcl.session-checkpoint-backup.v2-candidate';
export const RCL_SESSION_CHECKPOINT_CHAIN_HISTORY_FORMAT = 'rcl.session-checkpoint-history-page.v2-candidate';
export const RCL_SESSION_CHECKPOINT_SEQUENCE_FORMAT = 'rcl.session-checkpoint.v4-candidate';
const BACKUP_FILES = ['source.rcl', 'session.rbc', 'journal.jsonl'];
const CHECKPOINT_MANIFEST = 'checkpoint.json';
const CHECKPOINT_PREFIX = 'checkpoint-prefix.jsonl';
const LEGACY_CHECKPOINT_MANIFEST_FORMAT = 'rcl.session-checkpoint.v1-candidate';
const CHECKPOINT_RESUME = 'rcl.session-journal-checkpoint-resume.v1-candidate';
const GENESIS = 'rcl.session-journal-genesis.v2';
const COMMAND = 'rcl.session-journal-command.v2';
const GENESIS_V3 = 'rcl.session-journal-genesis.v3-candidate';
const COMMAND_V3 = 'rcl.session-journal-command.v3-candidate';
const LEGACY_GENESIS = 'rcl.session-journal-genesis.v1';
const LEGACY_COMMAND = 'rcl.session-journal-command.v1';
const MAX_JOURNAL_BYTES = 64 * 1024 * 1024;
const MAX_COMMANDS = 10000;
const MAX_CHECKPOINT_ARCHIVES = 4;
const MAX_CHECKPOINT_MANIFEST_BYTES = 16 * 1024 * 1024;
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const root = semanticStateRootV2Stable;
const isRoot = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);

function rooted(core) { return { ...core, root: root(core) }; }
function verifyRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw sessionError('RCL_SESSION_JOURNAL_RECORD_INVALID');
  const { root: supplied, ...core } = record;
  if (supplied !== root(core)) throw sessionError('RCL_SESSION_JOURNAL_ROOT_MISMATCH');
}

function regularFile(file) {
  if (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile()) throw sessionError('RCL_SESSION_STORAGE_FILE_INVALID');
}

function immutableAsset(file, bytes) {
  if (fs.existsSync(file)) {
    regularFile(file);
    if (!fs.readFileSync(file).equals(bytes)) throw sessionError('RCL_SESSION_ASSET_MISMATCH', `Session asset differs: ${path.basename(file)}`);
    return;
  }
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}

function syncDirectory(directory) {
  let fd;
  try { fd = fs.openSync(directory, 'r'); fs.fsyncSync(fd); }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM', 'EACCES'].includes(error.code)) throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

function appendRecord(file, record, create = false) {
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
  const currentBytes = create ? 0 : fs.statSync(file).size;
  if (currentBytes + bytes.length > MAX_JOURNAL_BYTES) throw sessionError('RCL_SESSION_JOURNAL_LIMIT');
  const fd = fs.openSync(file, create ? 'wx' : 'a', 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (written <= 0) throw sessionError('RCL_SESSION_JOURNAL_WRITE_FAILED');
      offset += written;
    }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  if (create) syncDirectory(path.dirname(file));
  return bytes;
}

function readBackupAsset(file, expected, maxBytes = Infinity) {
  regularFile(file);
  const mismatch = () => sessionError('RCL_SESSION_BACKUP_ASSET_MISMATCH', `Backup asset differs: ${path.basename(file)}`);
  if (!expected || !Number.isSafeInteger(expected.bytes) || expected.bytes < 0 || expected.bytes > maxBytes
      || typeof expected.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(expected.sha256)
      || fs.statSync(file).size !== expected.bytes) throw mismatch();
  const bytes = fs.readFileSync(file);
  if (bytes.length !== expected.bytes || hashBytes(bytes) !== expected.sha256) throw mismatch();
  return bytes;
}

function readJournalSnapshot(fd) {
  const stat = fs.fstatSync(fd);
  if (!stat.isFile()) throw sessionError('RCL_SESSION_STORAGE_FILE_INVALID');
  if (stat.size > MAX_JOURNAL_BYTES) throw sessionError('RCL_SESSION_JOURNAL_LIMIT');
  const bytes = Buffer.allocUnsafe(stat.size);
  let offset = 0;
  while (offset < bytes.length) {
    const read = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
    if (read === 0) throw sessionError('RCL_SESSION_JOURNAL_SOURCE_CHANGED');
    offset += read;
  }
  if (fs.fstatSync(fd).size !== bytes.length) throw sessionError('RCL_SESSION_JOURNAL_SOURCE_CHANGED');
  return bytes;
}

function readJournalBytes(file) {
  regularFile(file);
  const fd = fs.openSync(file, 'r');
  try { return readJournalSnapshot(fd); }
  finally { fs.closeSync(fd); }
}

function readJournal(file, backupAsset) {
  const bytes = backupAsset ? readBackupAsset(file, backupAsset, MAX_JOURNAL_BYTES) : readJournalBytes(file);
  const records = [];
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let completeLength = 0;
  for (;;) {
    const end = bytes.indexOf(10, completeLength);
    if (end === -1) break;
    if (records.length > MAX_COMMANDS) throw sessionError('RCL_SESSION_JOURNAL_GENESIS_OR_LIMIT_INVALID');
    let line;
    try { line = decoder.decode(bytes.subarray(completeLength, end)); }
    catch { throw sessionError('RCL_SESSION_JOURNAL_UTF8_INVALID'); }
    // Older readers accepted one UTF-8 BOM at the start of the file.
    if (completeLength === 0 && line.charCodeAt(0) === 0xfeff) line = line.slice(1);
    try { records.push(JSON.parse(line)); }
    catch { throw sessionError('RCL_SESSION_JOURNAL_JSON_INVALID'); }
    completeLength = end + 1;
  }
  if (!records.length) throw sessionError('RCL_SESSION_JOURNAL_GENESIS_OR_LIMIT_INVALID');
  return { records, completeLength, tail: bytes.subarray(completeLength), bytes };
}

function checkpointArchiveName(index) {
  return index === 0 ? CHECKPOINT_PREFIX : `checkpoint-prefix-${index}.jsonl`;
}

function validArchiveAsset(asset) {
  return asset && Object.hasOwn(asset, 'sha256') && Object.hasOwn(asset, 'bytes')
    && isRoot(asset.sha256) && Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= MAX_JOURNAL_BYTES;
}

function readCheckpoint(storage, expectedRoot, algorithm) {
  const file = path.join(storage, CHECKPOINT_MANIFEST);
  if (!fs.existsSync(file)) {
    if (expectedRoot !== undefined || fs.existsSync(path.join(storage, CHECKPOINT_PREFIX))) {
      throw sessionError('RCL_SESSION_CHECKPOINT_NOT_FOUND');
    }
    return null;
  }
  if (!isRoot(expectedRoot)) throw sessionError('RCL_SESSION_CHECKPOINT_TRUSTED_ROOT_REQUIRED');
  regularFile(file);
  if (fs.statSync(file).size > MAX_CHECKPOINT_MANIFEST_BYTES) throw sessionError('RCL_SESSION_CHECKPOINT_MANIFEST_INVALID');
  const bytes = fs.readFileSync(file);
  if (bytes.length > MAX_CHECKPOINT_MANIFEST_BYTES) throw sessionError('RCL_SESSION_CHECKPOINT_MANIFEST_INVALID');
  if (hashBytes(bytes) !== expectedRoot) throw sessionError('RCL_SESSION_CHECKPOINT_EXPECTED_ROOT_MISMATCH');
  let manifest;
  try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw sessionError('RCL_SESSION_CHECKPOINT_MANIFEST_INVALID'); }
  const required = ['format', 'sessionId', 'revision', 'programRoot', 'genesisRoot', 'journalRoot', 'initialStateRoot', 'stateRoot', 'stateRootAlgorithm', 'sourceHash', 'bytecodeHash'];
  const scalarChain = manifest?.format === RCL_SESSION_CHECKPOINT_CHAIN_FORMAT;
  const sequence = manifest?.format === RCL_SESSION_CHECKPOINT_SEQUENCE_FORMAT;
  const exactNumberSigns = scalarChain || manifest?.format === RCL_SESSION_CHECKPOINT_FORMAT;
  const hasArchiveList = scalarChain || sequence;
  required.push(sequence ? 'stateWireHex' : 'state', hasArchiveList ? 'archives' : 'prefix');
  if (exactNumberSigns) required.push('negativeZeroFacets');
  const archives = hasArchiveList ? manifest.archives : [{ ...manifest?.prefix, checkpointRoot: null }];
  if (!manifest || typeof manifest !== 'object' || Object.keys(manifest).length !== required.length || !required.every(key => Object.hasOwn(manifest, key))
      || (!sequence && !exactNumberSigns && manifest.format !== LEGACY_CHECKPOINT_MANIFEST_FORMAT) || typeof manifest.sessionId !== 'string' || !manifest.sessionId
      || !Array.isArray(archives) || archives.length < (scalarChain ? 2 : 1) || archives.length > MAX_CHECKPOINT_ARCHIVES
      || !Number.isSafeInteger(manifest.revision) || manifest.revision < 0 || manifest.revision > archives.length * MAX_COMMANDS
      || !['programRoot', 'genesisRoot', 'journalRoot', 'initialStateRoot', 'stateRoot', 'sourceHash', 'bytecodeHash'].every(key => isRoot(manifest[key]))
      || (!hasArchiveList && (!manifest.prefix || Object.keys(manifest.prefix).length !== 2))
      || archives.some((asset, index) => !validArchiveAsset(asset) || Object.keys(asset).length !== 3 || !Object.hasOwn(asset, 'checkpointRoot')
        || (index === 0 ? asset.checkpointRoot !== null : !isRoot(asset.checkpointRoot)))) {
    throw sessionError('RCL_SESSION_CHECKPOINT_MANIFEST_INVALID');
  }
  if (manifest.stateRootAlgorithm !== algorithm) throw sessionError('RCL_SESSION_JOURNAL_STATE_ROOT_ALGORITHM_UNSUPPORTED');
  return { manifest, bytes, root: expectedRoot, exactNumberSigns, sequence, archives, chained: archives.length > 1 };
}

function checkpointResume(checkpoint) {
  const { manifest } = checkpoint;
  return rooted({
    format: CHECKPOINT_RESUME, checkpointRoot: checkpoint.root, sequence: manifest.revision, previousRoot: manifest.journalRoot,
    sessionId: manifest.sessionId, programRoot: manifest.programRoot, stateRoot: manifest.stateRoot, stateRootAlgorithm: manifest.stateRootAlgorithm,
  });
}

function exportDestination(storage, destination, operation) {
  if (typeof destination !== 'string' || !destination) throw sessionError(`RCL_SESSION_${operation}_DIRECTORY_REQUIRED`);
  const resolved = path.resolve(destination);
  const target = path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
  const relative = path.relative(fs.realpathSync(storage), target);
  if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) {
    throw sessionError(`RCL_SESSION_${operation}_INSIDE_SOURCE`);
  }
  return target;
}

function reserveExport(target, operation) {
  try { fs.mkdirSync(target, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') throw sessionError(`RCL_SESSION_${operation}_TARGET_EXISTS`); throw error; }
}

function requestKey(value) {
  if (typeof value !== 'string' || !value.length || value.length > 256 || value.includes('\0')) throw sessionError('RCL_SESSION_REQUEST_ID_REQUIRED');
  return value;
}

function commandIdentity(programRoot, command, expectedRevision, format = COMMAND) {
  if (format === LEGACY_COMMAND) return root({ programRoot, command, expectedRevision });
  if (format !== COMMAND && format !== COMMAND_V3) throw sessionError('RCL_SESSION_COMMAND_IDENTITY_UNSUPPORTED');
  return root({ format: format === COMMAND_V3 ? RCL_SESSION_COMMAND_IDENTITY_V3_CANDIDATE_FORMAT : RCL_SESSION_COMMAND_IDENTITY_FORMAT, programRoot, commandFormat: command.format,
    rule: command.rule, mode: command.mode, inputsRoot: root(command.inputs), expectedRevision });
}

function resultIdentity(programRoot, result, expectedRevision, format = COMMAND) {
  if (format === LEGACY_COMMAND) return root(result);
  if (format !== COMMAND && format !== COMMAND_V3) throw sessionError('RCL_SESSION_COMMAND_IDENTITY_UNSUPPORTED');
  return root({ format: format === COMMAND_V3 ? 'rcl.session-result-identity.v3-candidate' : 'rcl.session-result-identity.v2', payloadRoot: root(result),
    commandRoot: commandIdentity(programRoot, result.command, expectedRevision, format), stateRoot: format === COMMAND_V3 ? semanticStateRootForAlgorithm(result.state, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE) : root(result.state) });
}

function historyVerificationOptions(options) {
  const allowed = ['expectedJournalRoot', 'expectedPageRoot', 'expectedPreviousRoot', 'expectedSessionId', 'expectedProgramRoot', 'expectedCheckpointRoot', 'minimumRevision'];
  if (!options || typeof options !== 'object' || Array.isArray(options)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
      || Reflect.ownKeys(options).some(key => !allowed.includes(key))
      || Object.values(Object.getOwnPropertyDescriptors(options)).some(item => !item.enumerable || !('value' in item))) throw sessionError('RCL_SESSION_HISTORY_OPTIONS_INVALID');
  const pins = Object.fromEntries(Object.entries(structuredClone(options)).filter(([, value]) => value !== undefined));
  for (const key of ['expectedJournalRoot', 'expectedPageRoot', 'expectedPreviousRoot', 'expectedProgramRoot', 'expectedCheckpointRoot']) {
    if (pins[key] !== undefined && (typeof pins[key] !== 'string' || !/^[0-9a-f]{64}$/u.test(pins[key]))) throw sessionError('RCL_SESSION_HISTORY_OPTIONS_INVALID');
  }
  if (pins.expectedSessionId !== undefined && (typeof pins.expectedSessionId !== 'string' || !pins.expectedSessionId || pins.expectedSessionId.includes('\0'))) throw sessionError('RCL_SESSION_HISTORY_OPTIONS_INVALID');
  if (pins.minimumRevision !== undefined && (!Number.isSafeInteger(pins.minimumRevision) || pins.minimumRevision < 0)) throw sessionError('RCL_SESSION_HISTORY_OPTIONS_INVALID');
  return pins;
}

function verifyHistoryPage(captured, pins) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const keysAre = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
  const check = (condition, code = 'RCL_SESSION_HISTORY_PAGE_INVALID') => { if (!condition) throw sessionError(code); };
  const page = structuredClone(captured);
  check(object(page));
  if (Object.hasOwn(page, 'ok')) { check(page.ok === true); delete page.ok; }
  const keys = ['format', 'sessionId', 'programRoot', 'revision', 'journalRoot', 'stateRoot', 'stateRootAlgorithm', 'fromRevision', 'limit', 'previousRoot', 'nextRevision', 'entries', 'pageRoot'];
  const chained = page.format === RCL_SESSION_CHECKPOINT_CHAIN_HISTORY_FORMAT;
  const checkpoint = chained || page.format === RCL_SESSION_CHECKPOINT_HISTORY_FORMAT;
  if (checkpoint) keys.push('checkpointRoot', 'checkpointRevision');
  if (chained) keys.push('checkpointArchiveSegments');
  check(Object.keys(page).length === keys.length && keys.every(key => Object.hasOwn(page, key)));
  const candidate = page.stateRootAlgorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE;
  const archiveSegments = chained ? page.checkpointArchiveSegments : 1;
  check(!chained || Number.isSafeInteger(archiveSegments) && archiveSegments >= 2 && archiveSegments <= MAX_CHECKPOINT_ARCHIVES);
  const stateRoot = value => semanticStateRootForAlgorithm(value, page.stateRootAlgorithm);
  check((candidate || page.stateRootAlgorithm === 'rcl.semantic-state-root.v2')
    && (checkpoint
      ? hash(page.checkpointRoot) && Number.isSafeInteger(page.checkpointRevision) && page.checkpointRevision >= 0
        && page.checkpointRevision <= archiveSegments * MAX_COMMANDS && page.checkpointRevision <= page.revision
      : page.format === (candidate ? RCL_SESSION_HISTORY_V3_CANDIDATE_FORMAT : RCL_SESSION_HISTORY_FORMAT))
    && typeof page.sessionId === 'string' && page.sessionId.length > 0 && !page.sessionId.includes('\0')
    && ['programRoot', 'journalRoot', 'stateRoot', 'previousRoot', 'pageRoot'].every(key => hash(page[key]))
    && Number.isSafeInteger(page.revision) && page.revision >= 0 && page.revision <= MAX_COMMANDS + (checkpoint ? page.checkpointRevision : 0)
    && Number.isSafeInteger(page.fromRevision) && page.fromRevision >= 1 && page.fromRevision <= page.revision + 1
    && Number.isSafeInteger(page.limit) && page.limit >= 1 && page.limit <= 1000 && Array.isArray(page.entries));
  const { pageRoot, ...core } = page;
  check(root(core) === pageRoot, 'RCL_SESSION_HISTORY_PAGE_ROOT_MISMATCH');
  const count = Math.min(page.limit, page.revision - page.fromRevision + 1), next = page.fromRevision + count;
  check(page.entries.length === count && page.nextRevision === (next <= page.revision ? next : null));
  for (const [option, field] of [['expectedJournalRoot', 'journalRoot'], ['expectedPageRoot', 'pageRoot'], ['expectedPreviousRoot', 'previousRoot'], ['expectedSessionId', 'sessionId'], ['expectedProgramRoot', 'programRoot'], ['expectedCheckpointRoot', 'checkpointRoot']]) {
    if (pins[option] !== undefined) check(pins[option] === page[field], 'RCL_SESSION_HISTORY_PIN_MISMATCH');
  }
  if (pins.minimumRevision !== undefined) check(page.revision >= pins.minimumRevision, 'RCL_SESSION_REVISION_ROLLBACK');
  const requests = new Set();
  let previousRoot = page.previousRoot, previousStateRoot = null, programName = null, versionFloor = checkpoint ? 2 : 1, firstVersion = null, legacyEntries = 0;
  for (const [index, record] of page.entries.entries()) {
    check(keysAre(record, ['format', 'sessionId', 'sequence', 'previousRoot', 'programRoot', 'requestId', 'expectedRevision', 'command', 'commandRoot', 'beforeStateRoot', 'afterStateRoot', 'resultRoot', 'result', 'stateRootAlgorithm', 'root']));
    verifyRecord(record);
    const version = record.format === COMMAND_V3 && candidate ? 3 : record.format === COMMAND && !candidate ? 2 : record.format === LEGACY_COMMAND && !candidate ? 1 : 0;
    check(version >= versionFloor, 'RCL_SESSION_HISTORY_CONTINUITY_MISMATCH');
    firstVersion ??= version; versionFloor = version; if (version === 1) legacyEntries++;
    check(record.sequence === page.fromRevision + index && record.expectedRevision === record.sequence - 1
      && record.previousRoot === previousRoot && record.sessionId === page.sessionId && record.programRoot === page.programRoot
      && record.stateRootAlgorithm === page.stateRootAlgorithm && hash(record.beforeStateRoot) && hash(record.afterStateRoot), 'RCL_SESSION_HISTORY_CONTINUITY_MISMATCH');
    const requestId = requestKey(record.requestId);
    check(!requests.has(requestId), 'RCL_SESSION_HISTORY_DUPLICATE_REQUEST'); requests.add(requestId);
    if (previousStateRoot !== null) check(record.beforeStateRoot === previousStateRoot, 'RCL_SESSION_HISTORY_STATE_CONTINUITY_MISMATCH');
    const command = record.command, result = record.result;
    check(object(command) && Object.keys(command).length === 4 && command.format === RCL_SESSION_COMMAND_FORMAT
      && typeof command.rule === 'string' && command.rule.length > 0 && ['realize', 'foresee'].includes(command.mode) && object(command.inputs), 'RCL_SESSION_HISTORY_COMMAND_INVALID');
    for (const [name, value] of Object.entries(command.inputs)) {
      check(name.length > 0 && !name.includes('\0') && (typeof value === 'boolean'
        || (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0))
        || (typeof value === 'string' && !value.includes('\0') && Buffer.byteLength(value, 'utf8') <= 1024 * 1024)), 'RCL_SESSION_HISTORY_COMMAND_INVALID');
    }
    check(record.commandRoot === commandIdentity(page.programRoot, command, record.expectedRevision, record.format), 'RCL_SESSION_HISTORY_COMMAND_INVALID');
    check(keysAre(result, ['format', 'program', 'programRoot', 'command', 'status', 'beforeRoot', 'afterRoot', 'stateRootAlgorithm', 'state', 'transition']) && result.format === RCL_SESSION_RESULT_FORMAT && result.programRoot === page.programRoot
      && typeof result.program === 'string' && result.program.length > 0 && (programName === null || result.program === programName)
      && keysAre(result.command, ['format', 'rule', 'mode', 'inputs'])
      && commandIdentity(page.programRoot, result.command, record.expectedRevision) === commandIdentity(page.programRoot, command, record.expectedRevision)
      && result.beforeRoot === record.beforeStateRoot && result.afterRoot === record.afterStateRoot
      && result.stateRootAlgorithm === page.stateRootAlgorithm && object(result.state) && stateRoot(result.state) === result.afterRoot
      && record.resultRoot === resultIdentity(page.programRoot, result, record.expectedRevision, record.format), 'RCL_SESSION_HISTORY_RESULT_INVALID');
    programName = result.program;
    if (result.status === 'not-triggered') check(result.transition === null && result.afterRoot === result.beforeRoot, 'RCL_SESSION_HISTORY_RESULT_INVALID');
    else {
      const transition = result.transition, projected = command.mode === 'foresee';
      check(result.status === (projected ? 'projected' : 'realized') && keysAre(transition, ['rule', 'mode', 'status', 'actor', 'beforeRoot', 'afterRoot', 'stateRootAlgorithm', 'changes', 'witnesses', 'authority'])
        && transition.rule === command.rule && transition.mode === command.mode && transition.status === result.status
        && transition.stateRootAlgorithm === page.stateRootAlgorithm && hash(transition.beforeRoot) && hash(transition.afterRoot)
        && Array.isArray(transition.changes) && Array.isArray(transition.witnesses) && transition.witnesses.every(item => typeof item === 'string')
        && object(transition.authority) && Array.isArray(transition.authority.needs) && Array.isArray(transition.authority.activeWarrants)
        && (projected ? result.afterRoot === result.beforeRoot : transition.afterRoot === result.afterRoot), 'RCL_SESSION_HISTORY_RESULT_INVALID');
      const decision = Object.assign(Object.create(null), result.state, projected ? command.inputs : {}), targets = new Set();
      for (const change of transition.changes) {
        check(keysAre(change, ['target', 'before', 'after', 'source']) && typeof change.target === 'string' && Object.hasOwn(result.state, change.target)
          && typeof change.source === 'string' && !targets.has(change.target), 'RCL_SESSION_HISTORY_RESULT_INVALID');
        targets.add(change.target);
        if (!projected) {
          check(root(change.after) === root(result.state[change.target]), 'RCL_SESSION_HISTORY_RESULT_INVALID');
          decision[change.target] = change.before;
        }
      }
      for (const [name, value] of Object.entries(command.inputs)) check(Object.hasOwn(decision, name) && root(decision[name]) === root(value), 'RCL_SESSION_HISTORY_RESULT_INVALID');
      check(stateRoot(decision) === transition.beforeRoot, 'RCL_SESSION_HISTORY_RESULT_INVALID');
      const proposed = structuredClone(decision);
      for (const change of transition.changes) {
        check(root(change.before) === root(decision[change.target]), 'RCL_SESSION_HISTORY_RESULT_INVALID');
        proposed[change.target] = change.after;
      }
      check(stateRoot(proposed) === transition.afterRoot, 'RCL_SESSION_HISTORY_RESULT_INVALID');
    }
    previousRoot = record.root; previousStateRoot = record.afterStateRoot;
  }
  const terminal = page.nextRevision === null;
  if (terminal) {
    check(previousRoot === page.journalRoot, 'RCL_SESSION_HISTORY_HEAD_MISMATCH');
    if (previousStateRoot !== null) check(previousStateRoot === page.stateRoot, 'RCL_SESSION_HISTORY_HEAD_MISMATCH');
  }
  return { page, requests, previousRoot, previousStateRoot, programName, terminal, firstVersion, versionFloor, legacyEntries };
}

function historyVerificationReport(verified, pins) {
  const first = verified[0], last = verified.at(-1), entries = verified.reduce((count, item) => count + item.page.entries.length, 0);
  const pagePinned = verified.length === 1 && pins.expectedPageRoot !== undefined;
  // A copied head field on an interior/empty page does not bind its content.
  const headAnchored = pins.expectedJournalRoot !== undefined && last.terminal && last.page.entries.length > 0;
  const legacyEntries = verified.reduce((count, item) => count + item.legacyEntries, 0), contentAnchored = (pagePinned || headAnchored) && legacyEntries === 0;
  const report = {
    ok: true, format: RCL_SESSION_HISTORY_VERIFICATION_FORMAT,
    status: legacyEntries ? 'LEGACY_IDENTITY_LIMITED' : contentAnchored ? 'VERIFIED_AGAINST_PIN' : 'CONSISTENT_UNANCHORED',
    contentAnchored, pagePinned, headAnchored, legacyCommandEntries: legacyEntries,
    sessionId: first.page.sessionId, programRoot: first.page.programRoot, revision: first.page.revision,
    journalRoot: first.page.journalRoot, stateRoot: first.page.stateRoot, stateRootAlgorithm: first.page.stateRootAlgorithm,
    ...(first.page.checkpointRoot !== undefined ? { checkpointRoot: first.page.checkpointRoot, checkpointRevision: first.page.checkpointRevision } : {}),
    ...(first.page.checkpointArchiveSegments !== undefined ? { checkpointArchiveSegments: first.page.checkpointArchiveSegments } : {}),
    fromRevision: first.page.fromRevision, nextRevision: last.page.nextRevision,
    verifiedPages: verified.length, verifiedEntries: entries, previousRoot: first.page.previousRoot,
    lastRecordRoot: last.previousRoot, coversReportedHistory: first.page.fromRevision === 1 && last.terminal,
    completeHistory: first.page.fromRevision === 1 && last.terminal && contentAnchored,
    pageRoots: verified.map(item => item.page.pageRoot), pins,
    commandReplay: false, sourceExecution: false, publisherAuthenticated: false,
    boundary: 'Receipt, result, state-root and supplied-page continuity checks only. Nonterminal or empty pages require their own trusted page pin. Legacy v1 input identities do not establish exact input-map binding. No command replay, source execution, publisher authentication or authority grant.',
  };
  return { ...report, verificationRoot: root(report) };
}

export function verifyDurableRealitySessionHistoryPage(page, options = {}) {
  const pins = historyVerificationOptions(options);
  return historyVerificationReport([verifyHistoryPage(page, pins)], pins);
}

export function verifyDurableRealitySessionHistoryPages(pages, options = {}) {
  const pins = historyVerificationOptions(options);
  if (!Array.isArray(pages) || !pages.length || pages.length > (MAX_CHECKPOINT_ARCHIVES + 1) * MAX_COMMANDS + 1
      || (pins.expectedPageRoot !== undefined && pages.length !== 1)) throw sessionError('RCL_SESSION_HISTORY_PAGES_INVALID');
  const verified = [], requests = new Set();
  for (const page of pages) {
    const item = verifyHistoryPage(page, verified.length ? { ...pins, expectedPreviousRoot: undefined } : pins), previous = verified.at(-1);
    if (previous && (previous.page.nextRevision === null || item.page.fromRevision !== previous.page.nextRevision
        || item.page.previousRoot !== previous.previousRoot || item.page.sessionId !== previous.page.sessionId
        || item.page.programRoot !== previous.page.programRoot || item.page.revision !== previous.page.revision
        || item.page.journalRoot !== previous.page.journalRoot || item.page.stateRoot !== previous.page.stateRoot
        || item.page.format !== previous.page.format || item.page.stateRootAlgorithm !== previous.page.stateRootAlgorithm
        || item.page.checkpointRoot !== previous.page.checkpointRoot || item.page.checkpointRevision !== previous.page.checkpointRevision
        || item.page.checkpointArchiveSegments !== previous.page.checkpointArchiveSegments
        || (item.firstVersion !== null && item.firstVersion < previous.versionFloor)
        || (item.page.entries.length && item.page.entries[0].beforeStateRoot !== previous.previousStateRoot)
        || (item.programName !== null && previous.programName !== null && item.programName !== previous.programName))) throw sessionError('RCL_SESSION_HISTORY_PAGES_CONTINUITY_MISMATCH');
    for (const request of item.requests) {
      if (requests.has(request)) throw sessionError('RCL_SESSION_HISTORY_DUPLICATE_REQUEST'); requests.add(request);
    }
    verified.push(item);
  }
  if (!verified.at(-1).terminal) throw sessionError('RCL_SESSION_HISTORY_PAGES_INCOMPLETE');
  return historyVerificationReport(verified, pins);
}

export async function openDurableRealitySession(directory, options = {}) {
  return openDurableSession(directory, options);
}

async function openDurableSession(directory, options, backupFiles) {
  if (typeof directory !== 'string' || !directory) throw sessionError('RCL_SESSION_DIRECTORY_REQUIRED');
  const { expectedJournalRoot, expectedCheckpointRoot, minimumRevision, repairIncompleteTail, requireExisting } = options;
  const algorithm = options.native?.stateRootAlgorithm ?? 'rcl.semantic-state-root.v2';
  if (!['rcl.semantic-state-root.v2', RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE].includes(algorithm)) throw sessionError('RCL_SESSION_JOURNAL_STATE_ROOT_ALGORITHM_UNSUPPORTED');
  const candidate = algorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE;
  const commandFormat = candidate ? COMMAND_V3 : COMMAND;
  const storage = path.resolve(directory);
  const sourcePath = path.join(storage, 'source.rcl');
  const bytecodePath = path.join(storage, 'session.rbc');
  const journalPath = path.join(storage, 'journal.jsonl');
  const checkpoint = readCheckpoint(storage, expectedCheckpointRoot, algorithm);
  const exists = fs.existsSync(journalPath);
  if (checkpoint && !exists) throw sessionError('RCL_SESSION_CHECKPOINT_SUFFIX_MISSING');
  if (!exists && options.source === undefined) throw sessionError('RCL_SESSION_SOURCE_REQUIRED_FOR_CREATE');
  if (requireExisting && !exists) throw sessionError('RCL_SESSION_NOT_FOUND');
  let source = options.source;
  if (source === undefined) {
    regularFile(sourcePath);
    // Source provenance binds the original UTF-8 bytes, including any BOM.
    source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(sourcePath));
  }
  if (typeof source !== 'string') throw sessionError('RCL_SESSION_SOURCE_REQUIRED_FOR_CREATE');
  const sourceBytes = Buffer.from(source, 'utf8');
  const sourceHash = hashBytes(sourceBytes);
  const program = compileReality(source);
  const compilation = options.compiler === 'bootstrap'
    ? { bytecode: compileRealitySessionBytecode(program), evidence: { compilerOwner: 'JavaScript bootstrap', targetByteParity: null } }
    : compileRealitySessionNative(source);
  const bytecode = compilation.bytecode;
  const bytecodeHash = hashBytes(bytecode);
  if (checkpoint && (checkpoint.manifest.sourceHash !== sourceHash || checkpoint.manifest.bytecodeHash !== bytecodeHash
      || checkpoint.manifest.programRoot !== program.programRoot)) throw sessionError('RCL_SESSION_CHECKPOINT_SOURCE_BINDING_MISMATCH');
  const sequenceProfile = hasSequenceCheckpointState(program);
  let restored = null;
  if (checkpoint?.sequence) {
    if (!sequenceProfile) throw sessionError('RCL_SESSION_CHECKPOINT_FACET_UNSUPPORTED');
    restored = captureSequenceSessionCheckpoint(program, checkpoint.manifest, algorithm);
  } else if (checkpoint) {
    const checkpointState = captureScalarSessionCheckpoint(program, {
      state: checkpoint.exactNumberSigns ? applyScalarCheckpointNumberSigns(checkpoint.manifest.state, checkpoint.manifest.negativeZeroFacets)
        : checkpoint.manifest.state,
      stateRoot: checkpoint.manifest.stateRoot,
    }, algorithm);
    if (checkpoint.exactNumberSigns) restored = checkpointState;
  }
  fs.mkdirSync(storage, { recursive: true, mode: 0o700 });
  if (!fs.statSync(storage).isDirectory() || fs.lstatSync(storage).isSymbolicLink()) throw sessionError('RCL_SESSION_DIRECTORY_INVALID');
  const restoreReference = checkpoint?.sequence ? createRealitySessionFromSequenceCheckpoint : createRealitySessionFromScalarCheckpoint;
  const reference = options.verifyReference !== true ? null : restored
    ? restoreReference(program, restored, { stateRootAlgorithm: algorithm })
    : createRealitySession(program, { stateRootAlgorithm: algorithm });
  // The daemon owns an OS lock for the entire read/replay/append lifetime.
  const nativeOptions = { ...options.native, bytecode, lockPath: path.join(storage, '.writer.lock') };
  const requests = new Map();
  const journalHash = createHash('sha256');
  let engine, journal, head, genesisRoot, initialStateRoot, revision = 0, sessionId, recovery = null, closing = false, poisoned = false;
  let legacyGenesis = false, baseRevision = 0;
  let pending = Promise.resolve();
  const admitJournal = nativeInitialStateRoot => {
    initialStateRoot = nativeInitialStateRoot;
    if (backupFiles) {
      // Check the bytes again under the writer lock. The journal reader below
      // parses the same buffer that it hashes against the backup manifest.
      if (!readBackupAsset(sourcePath, backupFiles['source.rcl']).equals(sourceBytes)
          || !readBackupAsset(bytecodePath, backupFiles['session.rbc']).equals(bytecode)) {
        throw sessionError('RCL_SESSION_BACKUP_REPLAY_MISMATCH');
      }
    } else if (checkpoint) {
      if (!readBackupAsset(sourcePath, { bytes: sourceBytes.length, sha256: sourceHash }).equals(sourceBytes)
          || !readBackupAsset(bytecodePath, { bytes: bytecode.length, sha256: bytecodeHash }).equals(bytecode)) {
        throw sessionError('RCL_SESSION_CHECKPOINT_SOURCE_BINDING_MISMATCH');
      }
    } else {
      immutableAsset(sourcePath, sourceBytes);
      immutableAsset(bytecodePath, bytecode);
    }
    if (!checkpoint && !fs.existsSync(journalPath) && !requireExisting) {
      head = rooted({
        format: candidate ? GENESIS_V3 : GENESIS, journalFormat: candidate ? RCL_SESSION_JOURNAL_V3_CANDIDATE_FORMAT : RCL_SESSION_JOURNAL_FORMAT, sessionId: randomUUID(),
        sequence: 0, previousRoot: null, sourceHash, programRoot: program.programRoot, bytecodeHash,
        initialStateRoot, stateRootAlgorithm: algorithm,
        compilation: compilation.evidence,
      });
      appendRecord(journalPath, head, true);
    }
    journal = readJournal(journalPath, backupFiles?.['journal.jsonl']);
    if (checkpoint) {
      const expected = backupFiles?.[CHECKPOINT_MANIFEST] ?? { bytes: checkpoint.bytes.length, sha256: checkpoint.root };
      if (!readBackupAsset(path.join(storage, CHECKPOINT_MANIFEST), expected, MAX_CHECKPOINT_MANIFEST_BYTES).equals(checkpoint.bytes)) {
        throw sessionError('RCL_SESSION_CHECKPOINT_EXPECTED_ROOT_MISMATCH');
      }
      const resume = journal.records[0], expectedResume = checkpointResume(checkpoint);
      verifyRecord(resume);
      if (resume.root !== expectedResume.root) throw sessionError('RCL_SESSION_CHECKPOINT_SUFFIX_BINDING_MISMATCH');
    }
    const readArchive = index => {
      const descriptor = checkpoint.archives[index], name = checkpointArchiveName(index);
      const copied = backupFiles?.[name];
      if (backupFiles && (copied?.bytes !== descriptor.bytes || copied?.sha256 !== descriptor.sha256)) {
        throw sessionError('RCL_SESSION_CHECKPOINT_PREFIX_BINDING_MISMATCH');
      }
      const segment = readJournal(path.join(storage, name), descriptor);
      if (segment.tail.length) throw sessionError('RCL_SESSION_CHECKPOINT_PREFIX_BINDING_MISMATCH');
      return segment.records;
    };
    const prefix = checkpoint ? readArchive(0) : journal.records;
    const genesis = prefix[0];
    verifyRecord(genesis);
    legacyGenesis = genesis.format === LEGACY_GENESIS && genesis.journalFormat === 'rcl.session-journal.v1';
    if ((candidate ? !(genesis.format === GENESIS_V3 && genesis.journalFormat === RCL_SESSION_JOURNAL_V3_CANDIDATE_FORMAT) : (!legacyGenesis && !(genesis.format === GENESIS && genesis.journalFormat === RCL_SESSION_JOURNAL_FORMAT)))
        || genesis.sequence !== 0 || genesis.previousRoot !== null || typeof genesis.sessionId !== 'string'
        || genesis.sourceHash !== sourceHash || genesis.programRoot !== program.programRoot || genesis.bytecodeHash !== bytecodeHash
        || genesis.initialStateRoot !== initialStateRoot || genesis.stateRootAlgorithm !== algorithm) {
      throw sessionError('RCL_SESSION_GENESIS_BINDING_MISMATCH');
    }
    head = genesis; genesisRoot = genesis.root; sessionId = genesis.sessionId;
    let versionFloor = candidate ? 3 : legacyGenesis ? 1 : 2;
    const admit = record => {
      verifyRecord(record);
      const version = record.format === COMMAND_V3 && candidate ? 3 : record.format === COMMAND && !candidate ? 2 : record.format === LEGACY_COMMAND && !candidate ? 1 : 0;
      if (version < versionFloor || record.sequence !== revision + 1 || record.previousRoot !== head.root
          || record.sessionId !== sessionId || record.programRoot !== program.programRoot
          || record.expectedRevision !== revision || record.stateRootAlgorithm !== algorithm) {
        throw sessionError('RCL_SESSION_JOURNAL_CONTINUITY_MISMATCH');
      }
      versionFloor = version;
      const requestId = requestKey(record.requestId);
      if (requests.has(requestId)) throw sessionError('RCL_SESSION_JOURNAL_DUPLICATE_REQUEST');
      const command = normalizeSessionCommand(program, record.command);
      if (record.commandRoot !== commandIdentity(program.programRoot, command, revision, record.format)
          || record.resultRoot !== resultIdentity(program.programRoot, record.result, revision, record.format)
          || commandIdentity(program.programRoot, record.result.command, revision) !== commandIdentity(program.programRoot, command, revision)
          || semanticStateRootForAlgorithm(record.result.state, algorithm) !== record.afterStateRoot
          || record.beforeStateRoot !== (revision === 0 ? genesis.initialStateRoot : head.afterStateRoot)) {
        throw sessionError('RCL_SESSION_JOURNAL_COMMAND_BINDING_MISMATCH');
      }
      revision++; head = record; requests.set(requestId, record);
    };
    for (let index = 1; index < prefix.length; index++) admit(prefix[index]);
    if (checkpoint) {
      for (let index = 1; index < checkpoint.archives.length; index++) {
        const segment = readArchive(index);
        const expected = checkpointResume({ root: checkpoint.archives[index].checkpointRoot, manifest: {
          revision, journalRoot: head.root, sessionId, programRoot: program.programRoot,
          stateRoot: revision === 0 ? initialStateRoot : head.afterStateRoot, stateRootAlgorithm: algorithm,
        } });
        verifyRecord(segment[0]);
        if (segment[0].root !== expected.root) throw sessionError('RCL_SESSION_CHECKPOINT_ARCHIVE_BOUNDARY_MISMATCH');
        for (let entry = 1; entry < segment.length; entry++) admit(segment[entry]);
      }
      const admittedState = revision === 0 ? initialStateRoot : head.afterStateRoot;
      if (legacyGenesis || checkpoint.manifest.revision !== revision
          || checkpoint.manifest.genesisRoot !== genesisRoot || checkpoint.manifest.initialStateRoot !== initialStateRoot
          || checkpoint.manifest.journalRoot !== head.root || checkpoint.manifest.sessionId !== sessionId
          || checkpoint.manifest.stateRoot !== admittedState) throw sessionError('RCL_SESSION_CHECKPOINT_PREFIX_BINDING_MISMATCH');
      baseRevision = revision;
      for (let index = 1; index < journal.records.length; index++) admit(journal.records[index]);
    }
    if (expectedJournalRoot !== undefined && expectedJournalRoot !== head.root) throw sessionError('RCL_SESSION_EXPECTED_HEAD_MISMATCH');
    if (minimumRevision !== undefined && (!Number.isSafeInteger(minimumRevision) || minimumRevision < 0 || revision < minimumRevision)) throw sessionError('RCL_SESSION_REVISION_ROLLBACK');
    if (journal.tail.length && repairIncompleteTail !== true) {
      throw sessionError('RCL_SESSION_INCOMPLETE_TAIL', 'Explicit incomplete-tail recovery is required');
    }
  };
  try {
    if (restored) {
      // The restore-capable peer initializes and acquires its OS lock first.
      // Admit the pinned archive and suffix before sending the restore frame.
      const restoreNative = checkpoint.sequence ? createNativeRealitySessionFromSequenceCheckpoint : createNativeRealitySessionFromScalarCheckpoint;
      engine = await restoreNative(program, restored, nativeOptions, admitJournal);
    } else {
      engine = await createNativeRealitySession(program, nativeOptions);
      admitJournal(engine.snapshot().stateRoot);
    }
    // The locked journal prefix and caller pins are admitted before executing
    // commands. Each replayed result must still independently reproduce its
    // receipt and after-state root.
    for (const record of requests.values()) {
      if (restored && record.sequence <= baseRevision) continue;
      const result = await engine.invoke(record.command);
      if (resultIdentity(program.programRoot, result, record.expectedRevision, record.format) !== record.resultRoot
          || record.afterStateRoot !== result.afterRoot) throw sessionError('RCL_SESSION_REPLAY_MISMATCH');
      if (reference && resultIdentity(program.programRoot, await reference.invoke(record.command), record.expectedRevision, record.format) !== record.resultRoot) {
        throw sessionError('RCL_SESSION_REFERENCE_REPLAY_MISMATCH');
      }
    }
    if (journal.tail.length) {
      const backupPath = path.join(storage, `recovery-tail-${randomUUID()}.bin`);
      regularFile(journalPath);
      const fd = fs.openSync(journalPath, 'r+');
      try {
        // Verify the same file descriptor used for truncation after the
        // asynchronous replay. The saved tail belongs to this exact snapshot.
        if (!readJournalSnapshot(fd).equals(journal.bytes)) throw sessionError('RCL_SESSION_RECOVERY_SOURCE_CHANGED');
        immutableAsset(backupPath, journal.tail);
        syncDirectory(storage);
        fs.ftruncateSync(fd, journal.completeLength);
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      recovery = { discardedIncompleteBytes: journal.tail.length, backupPath, verifiedPrefixRoot: head.root };
    }
    journalHash.update(journal.bytes.subarray(0, journal.completeLength));
    journal = null;
  } catch (error) { await engine?.close(); throw error; }

  const snapshot = () => {
    if (poisoned || closing) throw sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN');
    return {
      ...engine.snapshot(), revision, journalRoot: head.root, sessionId, directory: storage, recovery,
      ...(checkpoint ? {
        checkpointRoot: checkpoint.root, checkpointRevision: baseRevision,
        checkpointArchiveSegments: checkpoint.archives.length, checkpointRestored: restored !== null,
      } : {}),
    };
  };
  const captureExport = () => {
    const journal = readJournalBytes(journalPath);
    const journalSha256 = journalHash.copy().digest('hex');
    if (hashBytes(journal) !== journalSha256) throw sessionError('RCL_SESSION_BACKUP_SOURCE_CHANGED');
    regularFile(sourcePath); regularFile(bytecodePath);
    const assets = { 'source.rcl': fs.readFileSync(sourcePath), 'session.rbc': fs.readFileSync(bytecodePath), 'journal.jsonl': journal };
    if (!assets['source.rcl'].equals(sourceBytes) || !assets['session.rbc'].equals(bytecode)) throw sessionError('RCL_SESSION_BACKUP_SOURCE_CHANGED');
    const files = {
      'source.rcl': { bytes: sourceBytes.length, sha256: sourceHash },
      'session.rbc': { bytes: bytecode.length, sha256: bytecodeHash },
      'journal.jsonl': { bytes: journal.length, sha256: journalSha256 },
    };
    if (checkpoint) {
      files[CHECKPOINT_MANIFEST] = { bytes: checkpoint.bytes.length, sha256: checkpoint.root };
      assets[CHECKPOINT_MANIFEST] = readBackupAsset(path.join(storage, CHECKPOINT_MANIFEST), files[CHECKPOINT_MANIFEST], MAX_CHECKPOINT_MANIFEST_BYTES);
      checkpoint.archives.forEach(({bytes, sha256}, index) => {
        const name = checkpointArchiveName(index);
        files[name] = { bytes, sha256 };
        assets[name] = readBackupAsset(path.join(storage, name), files[name], MAX_JOURNAL_BYTES);
      });
    }
    return { assets, files };
  };
  return Object.freeze({
    snapshot,
    history(options = {}) {
      if (poisoned || closing) return Promise.reject(sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN'));
      let fromRevision, limit, expectedJournalRoot;
      try {
        if (!options || typeof options !== 'object' || Array.isArray(options)
            || Reflect.ownKeys(options).some(key => !['fromRevision', 'limit', 'expectedJournalRoot'].includes(key))) throw sessionError('RCL_SESSION_HISTORY_OPTIONS_INVALID');
        ({ fromRevision = 1, limit = 100, expectedJournalRoot } = options);
        if (!Number.isSafeInteger(fromRevision) || fromRevision < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw sessionError('RCL_SESSION_HISTORY_RANGE_INVALID');
        if (expectedJournalRoot !== undefined && !/^[0-9a-f]{64}$/u.test(expectedJournalRoot)) throw sessionError('RCL_SESSION_HISTORY_OPTIONS_INVALID');
      } catch (error) { return Promise.reject(error); }
      const operation = pending.then(() => {
        if (poisoned) throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN');
        if (expectedJournalRoot !== undefined && expectedJournalRoot !== head.root) throw sessionError('RCL_SESSION_EXPECTED_HEAD_MISMATCH');
        if (fromRevision > revision + 1) throw sessionError('RCL_SESSION_HISTORY_RANGE_INVALID');
        const records = [...requests.values()];
        const entries = structuredClone(records.slice(fromRevision - 1, fromRevision - 1 + limit));
        const next = fromRevision + entries.length;
        const core = {
          format: checkpoint?.chained ? RCL_SESSION_CHECKPOINT_CHAIN_HISTORY_FORMAT
            : checkpoint ? RCL_SESSION_CHECKPOINT_HISTORY_FORMAT : candidate ? RCL_SESSION_HISTORY_V3_CANDIDATE_FORMAT : RCL_SESSION_HISTORY_FORMAT,
          sessionId, programRoot: program.programRoot,
          revision, journalRoot: head.root, stateRoot: engine.snapshot().stateRoot,
          stateRootAlgorithm: algorithm, fromRevision, limit,
          previousRoot: fromRevision === 1 ? genesisRoot : records[fromRevision - 2].root,
          nextRevision: next <= revision ? next : null, entries,
          ...(checkpoint ? { checkpointRoot: checkpoint.root, checkpointRevision: baseRevision } : {}),
          ...(checkpoint?.chained ? { checkpointArchiveSegments: checkpoint.archives.length } : {}),
        };
        return { ...core, pageRoot: root(core) };
      });
      pending = operation.catch(() => {});
      return operation;
    },
    backup(destination) {
      if (poisoned || closing) return Promise.reject(sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN'));
      let target;
      try { target = exportDestination(storage, destination, 'BACKUP'); }
      catch (error) { return Promise.reject(error); }
      const operation = pending.then(() => {
        if (poisoned) throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN');
        const captured = engine.snapshot();
        const { assets, files } = captureExport();
        const core = {
          format: checkpoint?.chained ? RCL_SESSION_CHECKPOINT_CHAIN_BACKUP_FORMAT
            : checkpoint ? RCL_SESSION_CHECKPOINT_BACKUP_FORMAT : candidate ? RCL_SESSION_BACKUP_V3_CANDIDATE_FORMAT : RCL_SESSION_BACKUP_FORMAT,
          sessionId, revision, programRoot: program.programRoot,
          journalRoot: head.root, stateRoot: captured.stateRoot, stateRootAlgorithm: captured.stateRootAlgorithm,
          files,
          ...(checkpoint ? { checkpointRoot: checkpoint.root, checkpointRevision: baseRevision } : {}),
          ...(checkpoint?.chained ? { checkpointArchiveSegments: checkpoint.archives.length } : {}),
        };
        const manifest = { ...core, backupRoot: root(core) };
        // Reserve a fresh directory. A failed export remains incomplete and is never
        // acknowledged as a backup; an existing destination is never overwritten.
        reserveExport(target, 'BACKUP');
        for (const [name, bytes] of Object.entries(assets)) immutableAsset(path.join(target, name), bytes);
        immutableAsset(path.join(target, 'backup.json'), Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
        syncDirectory(target); syncDirectory(path.dirname(target));
        return { ...manifest, directory: target, nativeReplayVerified: false };
      });
      pending = operation.catch(() => {});
      return operation;
    },
    checkpoint(destination, expectedHead) {
      if (poisoned || closing) return Promise.reject(sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN'));
      if (!isRoot(expectedHead)) return Promise.reject(sessionError('RCL_SESSION_CHECKPOINT_TRUSTED_HEAD_REQUIRED'));
      let target;
      try { target = exportDestination(storage, destination, 'CHECKPOINT'); }
      catch (error) { return Promise.reject(error); }
      const operation = pending.then(async () => {
        if (poisoned) throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN');
        if (expectedHead !== head.root) throw sessionError('RCL_SESSION_EXPECTED_HEAD_MISMATCH');
        if (legacyGenesis) throw sessionError('RCL_SESSION_CHECKPOINT_PREFIX_UNSUPPORTED');
        if (checkpoint && checkpoint.archives.length >= MAX_CHECKPOINT_ARCHIVES) throw sessionError('RCL_SESSION_CHECKPOINT_ARCHIVE_LIMIT');
        if (!sequenceProfile) {
          const { state, stateRoot } = engine.snapshot();
          captureScalarSessionCheckpoint(program, { state, stateRoot }, algorithm);
        }
        let evidence;
        try { evidence = await (sequenceProfile ? engine.readSequenceCheckpoint() : engine.readScalarCheckpoint()); }
        catch (error) {
          if (/^RCL_SESSION_NATIVE_/u.test(error.code ?? '')) { poisoned = true; await engine.close(); }
          throw error;
        }
        let checkpointValues;
        if (sequenceProfile) {
          if (reference && encodeSequenceCheckpointState(program, reference.snapshot().state) !== evidence.stateWireHex) {
            throw sessionError('RCL_SESSION_CHECKPOINT_REFERENCE_EXACT_STATE_MISMATCH');
          }
          checkpointValues = { stateWireHex: evidence.stateWireHex };
        } else {
          const negativeZeroFacets = scalarCheckpointNegativeZeroFacets(evidence.state);
          if (reference && JSON.stringify(negativeZeroFacets) !== JSON.stringify(scalarCheckpointNegativeZeroFacets(reference.snapshot().state))) {
            throw sessionError('RCL_SESSION_CHECKPOINT_REFERENCE_NUMBER_SIGNS_MISMATCH');
          }
          encodeSessionInputs(program, evidence.state);
          checkpointValues = { state: evidence.state, negativeZeroFacets };
        }
        const { assets, files } = captureExport();
        const active = files['journal.jsonl'];
        const archives = checkpoint ? [...checkpoint.archives, { ...active, checkpointRoot: checkpoint.root }]
          : sequenceProfile ? [{ ...active, checkpointRoot: null }] : null;
        const format = sequenceProfile ? RCL_SESSION_CHECKPOINT_SEQUENCE_FORMAT
          : archives ? RCL_SESSION_CHECKPOINT_CHAIN_FORMAT : RCL_SESSION_CHECKPOINT_FORMAT;
        const manifest = {
          format, sessionId, revision, programRoot: program.programRoot,
          genesisRoot, journalRoot: head.root, initialStateRoot, stateRoot: evidence.stateRoot, stateRootAlgorithm: algorithm,
          sourceHash, bytecodeHash, ...checkpointValues,
          ...(archives ? { archives } : { prefix: active }),
        };
        const bytes = Buffer.from(JSON.stringify(manifest) + '\n', 'utf8');
        if (bytes.length > MAX_CHECKPOINT_MANIFEST_BYTES) throw sessionError('RCL_SESSION_CHECKPOINT_MANIFEST_INVALID');
        const checkpointRoot = hashBytes(bytes);
        const resume = checkpointResume({ manifest, root: checkpointRoot });
        reserveExport(target, 'CHECKPOINT');
        for (const [name, content] of Object.entries(assets)) {
          if (name !== 'journal.jsonl' && name !== CHECKPOINT_MANIFEST) immutableAsset(path.join(target, name), content);
        }
        immutableAsset(path.join(target, checkpointArchiveName(archives ? archives.length - 1 : 0)), assets['journal.jsonl']);
        appendRecord(path.join(target, 'journal.jsonl'), resume, true);
        immutableAsset(path.join(target, CHECKPOINT_MANIFEST), bytes);
        syncDirectory(target); syncDirectory(path.dirname(target));
        return {
          format, checkpointRoot, sessionId, revision,
          programRoot: program.programRoot, journalRoot: head.root, stateRoot: evidence.stateRoot,
          stateRootAlgorithm: algorithm, directory: target,
          ...(archives ? { archiveSha256s: archives.map(asset => asset.sha256) } : { prefixSha256: active.sha256 }),
        };
      });
      pending = operation.catch(() => {});
      return operation;
    },
    invoke(input) {
      if (poisoned || closing) return Promise.reject(sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN'));
      let requestId, expectedRevision, command, commandRoot;
      try {
        requestId = requestKey(input?.requestId);
        expectedRevision = input?.expectedRevision;
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw sessionError('RCL_SESSION_EXPECTED_REVISION_REQUIRED');
        command = normalizeSessionCommand(program, input);
        commandRoot = commandIdentity(program.programRoot, command, expectedRevision, commandFormat);
      } catch (error) { return Promise.reject(error); }
      const operation = pending.then(async () => {
        if (poisoned) throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN');
        const existing = requests.get(requestId);
        if (existing) {
          if (commandIdentity(program.programRoot, existing.command, existing.expectedRevision, commandFormat) !== commandRoot) throw sessionError('RCL_SESSION_IDEMPOTENCY_CONFLICT');
          return { receipt: structuredClone(existing), result: structuredClone(existing.result), replayed: true };
        }
        if (expectedRevision !== revision) throw sessionError('RCL_SESSION_REVISION_CONFLICT');
        if (revision - baseRevision >= MAX_COMMANDS) throw sessionError('RCL_SESSION_JOURNAL_LIMIT');
        const beforeStateRoot = engine.snapshot().stateRoot;
        let result, record, uncertain = false;
        try {
          try { result = await engine.invoke(command); }
          catch (error) {
            if (!/^RCL_SESSION_NATIVE_/u.test(error.code ?? '')) throw error;
            uncertain = true; throw error;
          }
          // Once execution succeeds, failures in evidence construction or storage
          // leave the commit's durability uncertain and must also close the writer.
          uncertain = true;
          record = rooted({
            format: commandFormat, sessionId, sequence: revision + 1, previousRoot: head.root,
            programRoot: program.programRoot, requestId, expectedRevision, command, commandRoot,
            beforeStateRoot, afterStateRoot: result.afterRoot, resultRoot: resultIdentity(program.programRoot, result, revision, commandFormat), result,
            stateRootAlgorithm: algorithm,
          });
          if (reference && resultIdentity(program.programRoot, await reference.invoke(command), revision, commandFormat) !== record.resultRoot) throw sessionError('RCL_SESSION_REFERENCE_REPLAY_MISMATCH');
          journalHash.update(appendRecord(journalPath, record));
          head = record; revision++; requests.set(requestId, record);
          const acknowledged = { receipt: structuredClone(record), result: structuredClone(result), replayed: false };
          return acknowledged;
        } catch (error) {
          if (!uncertain) throw error;
          // An unacknowledged write may be complete, partial or absent. Stop this
          // writer; reopening verifies/replays the durable prefix before a retry.
          poisoned = true; await engine.close();
          throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN', error.message, { cause: error.code });
        }
      });
      pending = operation.catch(() => {});
      return operation;
    },
    async close() { closing = true; await pending; await engine.close(); },
  });
}

export async function verifyDurableRealitySession(directory, options = {}) {
  return verifyDurableSession(directory, options);
}

async function verifyDurableSession(directory, options, backupFiles) {
  const captured = { ...options, requireExisting: true };
  const session = await openDurableSession(directory, captured, backupFiles);
  try {
    const snapshot = session.snapshot();
    return {
      format: 'rcl.session-verification.v1', status: 'PASS', programRoot: snapshot.programRoot,
      sessionId: snapshot.sessionId, revision: snapshot.revision, journalRoot: snapshot.journalRoot,
      stateRoot: snapshot.stateRoot, stateRootAlgorithm: snapshot.stateRootAlgorithm,
      nativeReplayVerified: snapshot.checkpointRestored !== true,
      referenceReplayVerified: snapshot.checkpointRestored !== true && captured.verifyReference === true,
      ...(snapshot.checkpointRoot !== undefined ? {
        checkpointRoot: snapshot.checkpointRoot, checkpointRevision: snapshot.checkpointRevision,
        checkpointArchiveSegments: snapshot.checkpointArchiveSegments,
        checkpointRestored: snapshot.checkpointRestored, archivedPrefixBindingVerified: true, externalCheckpointAnchorChecked: true,
        nativeSuffixReplayVerified: true, referenceSuffixReplayVerified: captured.verifyReference === true,
        replayedArchiveCommands: snapshot.checkpointRestored ? 0 : snapshot.checkpointRevision,
        replayedSuffixCommands: snapshot.revision - snapshot.checkpointRevision,
      } : {}),
      externalEffectsReplayed: false, osWriterLock: true, recovery: snapshot.recovery,
      externalHistoryAnchorChecked: captured.expectedJournalRoot !== undefined || captured.minimumRevision !== undefined,
    };
  } finally { await session.close(); }
}

export async function verifyDurableRealitySessionBackup(directory, options = {}) {
  if (typeof directory !== 'string' || !directory) throw sessionError('RCL_SESSION_BACKUP_DIRECTORY_REQUIRED');
  const { expectedBackupRoot, expectedJournalRoot, expectedCheckpointRoot, minimumRevision } = options;
  const storage = path.resolve(directory), manifestPath = path.join(storage, 'backup.json');
  if (fs.lstatSync(storage).isSymbolicLink() || !fs.statSync(storage).isDirectory()) throw sessionError('RCL_SESSION_DIRECTORY_INVALID');
  regularFile(manifestPath);
  if (fs.statSync(manifestPath).size > 64 * 1024) throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID'); }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID');
  const { backupRoot, ...core } = manifest;
  const chained = manifest.format === RCL_SESSION_CHECKPOINT_CHAIN_BACKUP_FORMAT;
  const checkpoint = chained || manifest.format === RCL_SESSION_CHECKPOINT_BACKUP_FORMAT;
  const candidate = manifest.stateRootAlgorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE;
  const archiveSegments = chained ? manifest.checkpointArchiveSegments : 1;
  if (chained && (!Number.isSafeInteger(archiveSegments) || archiveSegments < 2 || archiveSegments > MAX_CHECKPOINT_ARCHIVES)) {
    throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID');
  }
  const files = checkpoint ? [...BACKUP_FILES, CHECKPOINT_MANIFEST,
    ...Array.from({ length: archiveSegments }, (_, index) => checkpointArchiveName(index))] : BACKUP_FILES;
  if ((!checkpoint && manifest.format !== (candidate ? RCL_SESSION_BACKUP_V3_CANDIDATE_FORMAT : RCL_SESSION_BACKUP_FORMAT))
      || !isRoot(backupRoot) || root(core) !== backupRoot
      || checkpoint && (!isRoot(manifest.checkpointRoot) || !Number.isSafeInteger(manifest.checkpointRevision)
        || manifest.checkpointRevision < 0 || manifest.checkpointRevision > archiveSegments * MAX_COMMANDS || manifest.checkpointRevision > manifest.revision)
      || !Number.isSafeInteger(manifest.revision) || manifest.revision < 0 || manifest.revision > MAX_COMMANDS + (checkpoint ? manifest.checkpointRevision : 0)
      || typeof manifest.sessionId !== 'string' || !manifest.sessionId
      || manifest.stateRootAlgorithm !== (candidate ? RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE : 'rcl.semantic-state-root.v2')
      || !['programRoot', 'journalRoot', 'stateRoot'].every(key => isRoot(manifest[key]))
      || !manifest.files || Object.keys(manifest.files).sort().join(',') !== [...files].sort().join(',')) throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID');
  if (candidate && options.native?.stateRootAlgorithm !== RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE) throw sessionError('RCL_SESSION_JOURNAL_STATE_ROOT_ALGORITHM_UNSUPPORTED');
  if (expectedBackupRoot !== undefined && expectedBackupRoot !== backupRoot) throw sessionError('RCL_SESSION_BACKUP_EXPECTED_ROOT_MISMATCH');
  if (checkpoint) {
    if (!isRoot(expectedCheckpointRoot)) throw sessionError('RCL_SESSION_CHECKPOINT_TRUSTED_ROOT_REQUIRED');
    if (expectedCheckpointRoot !== manifest.checkpointRoot || manifest.files[CHECKPOINT_MANIFEST]?.sha256 !== manifest.checkpointRoot) {
      throw sessionError('RCL_SESSION_CHECKPOINT_EXPECTED_ROOT_MISMATCH');
    }
  }
  for (const name of files) {
    const cap = name === CHECKPOINT_MANIFEST ? MAX_CHECKPOINT_MANIFEST_BYTES : name.endsWith('.jsonl') ? MAX_JOURNAL_BYTES : Infinity;
    readBackupAsset(path.join(storage, name), manifest.files[name], cap);
  }
  if (expectedJournalRoot !== undefined && expectedJournalRoot !== manifest.journalRoot) throw sessionError('RCL_SESSION_EXPECTED_HEAD_MISMATCH');
  const verified = await verifyDurableSession(storage, { ...options, repairIncompleteTail: false, expectedJournalRoot: manifest.journalRoot }, manifest.files);
  if (verified.sessionId !== manifest.sessionId || verified.revision !== manifest.revision || verified.programRoot !== manifest.programRoot || verified.stateRoot !== manifest.stateRoot
      || checkpoint !== (verified.checkpointRoot !== undefined)
      || checkpoint && (verified.checkpointRoot !== manifest.checkpointRoot || verified.checkpointRevision !== manifest.checkpointRevision
        || verified.checkpointArchiveSegments !== archiveSegments)) throw sessionError('RCL_SESSION_BACKUP_REPLAY_MISMATCH');
  return { ...verified, format: chained ? 'rcl.session-checkpoint-backup-verification.v2-candidate'
    : checkpoint ? 'rcl.session-checkpoint-backup-verification.v1-candidate'
    : candidate ? 'rcl.session-backup-verification.v3-candidate' : 'rcl.session-backup-verification.v1', backupRoot,
    externalHistoryAnchorChecked: expectedJournalRoot !== undefined || minimumRevision !== undefined,
    externalBackupAnchorChecked: expectedBackupRoot !== undefined };
}
