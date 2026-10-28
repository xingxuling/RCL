import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { compileReality } from './compiler.mjs';
import { compileRealitySessionBytecode } from './bytecode.mjs';
import { compileRealitySessionNative } from './session-compiler.mjs';
import { createNativeRealitySession } from './native-session.mjs';
import { createRealitySession } from './runtime.mjs';
import { semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';
import { normalizeSessionCommand, sessionError } from './session-contract.mjs';

export const RCL_DURABLE_SESSION_VERSION = '1.0.0';
export const RCL_SESSION_JOURNAL_FORMAT = 'rcl.session-journal.v1';
export const RCL_SESSION_BACKUP_FORMAT = 'rcl.session-backup.v1';
export const RCL_SESSION_HISTORY_FORMAT = 'rcl.session-history-page.v1';
const BACKUP_FILES = ['source.rcl', 'session.rbc', 'journal.jsonl'];
const GENESIS = 'rcl.session-journal-genesis.v1';
const COMMAND = 'rcl.session-journal-command.v1';
const MAX_JOURNAL_BYTES = 64 * 1024 * 1024;
const MAX_COMMANDS = 10000;
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const root = semanticStateRootV2Stable;

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
}

function readJournal(file) {
  regularFile(file);
  if (fs.statSync(file).size > MAX_JOURNAL_BYTES) throw sessionError('RCL_SESSION_JOURNAL_LIMIT');
  const bytes = fs.readFileSync(file);
  const completeLength = bytes.lastIndexOf(10) + 1;
  const prefix = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, completeLength));
  const records = prefix.split('\n').slice(0, -1).map(line => {
    try { return JSON.parse(line); }
    catch { throw sessionError('RCL_SESSION_JOURNAL_JSON_INVALID'); }
  });
  if (!records.length || records.length > MAX_COMMANDS + 1) throw sessionError('RCL_SESSION_JOURNAL_GENESIS_OR_LIMIT_INVALID');
  return { records, completeLength, tail: bytes.subarray(completeLength), bytes };
}

function requestKey(value) {
  if (typeof value !== 'string' || !value.length || value.length > 256 || value.includes('\0')) throw sessionError('RCL_SESSION_REQUEST_ID_REQUIRED');
  return value;
}

function commandIdentity(programRoot, command, expectedRevision) {
  return root({ programRoot, command, expectedRevision });
}

export async function openDurableRealitySession(directory, options = {}) {
  if (typeof directory !== 'string' || !directory) throw sessionError('RCL_SESSION_DIRECTORY_REQUIRED');
  const storage = path.resolve(directory);
  const sourcePath = path.join(storage, 'source.rcl');
  const bytecodePath = path.join(storage, 'session.rbc');
  const journalPath = path.join(storage, 'journal.jsonl');
  const exists = fs.existsSync(journalPath);
  if (!exists && options.source === undefined) throw sessionError('RCL_SESSION_SOURCE_REQUIRED_FOR_CREATE');
  if (options.requireExisting && !exists) throw sessionError('RCL_SESSION_NOT_FOUND');
  let source = options.source;
  if (source === undefined) {
    regularFile(sourcePath);
    source = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(sourcePath));
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
  fs.mkdirSync(storage, { recursive: true, mode: 0o700 });
  if (!fs.statSync(storage).isDirectory() || fs.lstatSync(storage).isSymbolicLink()) throw sessionError('RCL_SESSION_DIRECTORY_INVALID');
  // The daemon owns an OS lock for the entire read/replay/append lifetime.
  const engine = await createNativeRealitySession(program, { ...options.native, bytecode, lockPath: path.join(storage, '.writer.lock') });
  const reference = options.verifyReference === true ? createRealitySession(program) : null;
  const requests = new Map();
  let head, genesisRoot, revision = 0, sessionId, recovery = null, closing = false, poisoned = false;
  let pending = Promise.resolve();
  try {
    immutableAsset(sourcePath, sourceBytes);
    immutableAsset(bytecodePath, bytecode);
    if (!fs.existsSync(journalPath)) {
      head = rooted({
        format: GENESIS, journalFormat: RCL_SESSION_JOURNAL_FORMAT, sessionId: randomUUID(),
        sequence: 0, previousRoot: null, sourceHash, programRoot: program.programRoot, bytecodeHash,
        initialStateRoot: engine.snapshot().stateRoot, stateRootAlgorithm: 'rcl.semantic-state-root.v2',
        compilation: compilation.evidence,
      });
      appendRecord(journalPath, head, true);
    }
    const journal = readJournal(journalPath);
    const genesis = journal.records[0];
    verifyRecord(genesis);
    if (genesis.format !== GENESIS || genesis.journalFormat !== RCL_SESSION_JOURNAL_FORMAT
        || genesis.sequence !== 0 || genesis.previousRoot !== null || typeof genesis.sessionId !== 'string'
        || genesis.sourceHash !== sourceHash || genesis.programRoot !== program.programRoot || genesis.bytecodeHash !== bytecodeHash
        || genesis.initialStateRoot !== engine.snapshot().stateRoot || genesis.stateRootAlgorithm !== 'rcl.semantic-state-root.v2') {
      throw sessionError('RCL_SESSION_GENESIS_BINDING_MISMATCH');
    }
    head = genesis; genesisRoot = genesis.root; sessionId = genesis.sessionId;
    for (const record of journal.records.slice(1)) {
      verifyRecord(record);
      if (record.format !== COMMAND || record.sequence !== revision + 1 || record.previousRoot !== head.root
          || record.sessionId !== sessionId || record.programRoot !== program.programRoot
          || record.expectedRevision !== revision || record.stateRootAlgorithm !== 'rcl.semantic-state-root.v2') {
        throw sessionError('RCL_SESSION_JOURNAL_CONTINUITY_MISMATCH');
      }
      const requestId = requestKey(record.requestId);
      if (requests.has(requestId)) throw sessionError('RCL_SESSION_JOURNAL_DUPLICATE_REQUEST');
      const command = normalizeSessionCommand(program, record.command);
      if (record.commandRoot !== commandIdentity(program.programRoot, command, revision)
          || record.resultRoot !== root(record.result) || record.beforeStateRoot !== engine.snapshot().stateRoot) {
        throw sessionError('RCL_SESSION_JOURNAL_COMMAND_BINDING_MISMATCH');
      }
      const result = await engine.invoke(command);
      if (root(result) !== record.resultRoot || record.afterStateRoot !== result.afterRoot) throw sessionError('RCL_SESSION_REPLAY_MISMATCH');
      if (reference && root(await reference.invoke(command)) !== record.resultRoot) throw sessionError('RCL_SESSION_REFERENCE_REPLAY_MISMATCH');
      revision++; head = record; requests.set(requestId, record);
    }
    if (options.expectedJournalRoot !== undefined && options.expectedJournalRoot !== head.root) throw sessionError('RCL_SESSION_EXPECTED_HEAD_MISMATCH');
    if (options.minimumRevision !== undefined && (!Number.isSafeInteger(options.minimumRevision) || options.minimumRevision < 0 || revision < options.minimumRevision)) throw sessionError('RCL_SESSION_REVISION_ROLLBACK');
    if (journal.tail.length) {
      if (options.repairIncompleteTail !== true) throw sessionError('RCL_SESSION_INCOMPLETE_TAIL', 'Explicit incomplete-tail recovery is required');
      const backupPath = path.join(storage, `recovery-tail-${randomUUID()}.bin`);
      immutableAsset(backupPath, journal.tail);
      const fd = fs.openSync(journalPath, 'r+');
      try { fs.ftruncateSync(fd, journal.completeLength); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      syncDirectory(storage);
      recovery = { discardedIncompleteBytes: journal.tail.length, backupPath, verifiedPrefixRoot: head.root };
    }
  } catch (error) { await engine.close(); throw error; }

  const snapshot = () => {
    if (poisoned || closing) throw sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN');
    return { ...engine.snapshot(), revision, journalRoot: head.root, sessionId, directory: storage, recovery };
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
          format: RCL_SESSION_HISTORY_FORMAT, sessionId, programRoot: program.programRoot,
          revision, journalRoot: head.root, stateRoot: engine.snapshot().stateRoot,
          stateRootAlgorithm: 'rcl.semantic-state-root.v2', fromRevision, limit,
          previousRoot: fromRevision === 1 ? genesisRoot : records[fromRevision - 2].root,
          nextRevision: next <= revision ? next : null, entries,
        };
        return { ...core, pageRoot: root(core) };
      });
      pending = operation.catch(() => {});
      return operation;
    },
    backup(destination) {
      if (poisoned || closing) return Promise.reject(sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN'));
      let target;
      try {
        if (typeof destination !== 'string' || !destination) throw sessionError('RCL_SESSION_BACKUP_DIRECTORY_REQUIRED');
        const resolved = path.resolve(destination);
        target = path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
        const relative = path.relative(fs.realpathSync(storage), target);
        if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) throw sessionError('RCL_SESSION_BACKUP_INSIDE_SOURCE');
      } catch (error) { return Promise.reject(error); }
      const operation = pending.then(() => {
        if (poisoned) throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN');
        const captured = engine.snapshot();
        const journal = readJournal(journalPath);
        if (journal.tail.length || journal.records.length !== revision + 1 || journal.records.at(-1).root !== head.root) throw sessionError('RCL_SESSION_BACKUP_SOURCE_CHANGED');
        for (let index = 0; index < journal.records.length; index++) {
          const record = journal.records[index];
          verifyRecord(record);
          if (record.previousRoot !== (index === 0 ? null : journal.records[index - 1].root)) throw sessionError('RCL_SESSION_BACKUP_SOURCE_CHANGED');
        }
        regularFile(sourcePath); regularFile(bytecodePath);
        const assets = [fs.readFileSync(sourcePath), fs.readFileSync(bytecodePath), journal.bytes];
        if (!assets[0].equals(sourceBytes) || !assets[1].equals(bytecode)) throw sessionError('RCL_SESSION_BACKUP_SOURCE_CHANGED');
        const core = {
          format: RCL_SESSION_BACKUP_FORMAT, sessionId, revision, programRoot: program.programRoot,
          journalRoot: head.root, stateRoot: captured.stateRoot, stateRootAlgorithm: captured.stateRootAlgorithm,
          files: Object.fromEntries(BACKUP_FILES.map((name, index) => [name, { bytes: assets[index].length, sha256: hashBytes(assets[index]) }])),
        };
        const manifest = { ...core, backupRoot: root(core) };
        // Reserve a fresh directory. A failed export remains incomplete and is never
        // acknowledged as a backup; an existing destination is never overwritten.
        try { fs.mkdirSync(target, { mode: 0o700 }); }
        catch (error) { if (error.code === 'EEXIST') throw sessionError('RCL_SESSION_BACKUP_TARGET_EXISTS'); throw error; }
        for (let index = 0; index < BACKUP_FILES.length; index++) immutableAsset(path.join(target, BACKUP_FILES[index]), assets[index]);
        immutableAsset(path.join(target, 'backup.json'), Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
        syncDirectory(target); syncDirectory(path.dirname(target));
        return { ...manifest, directory: target, nativeReplayVerified: false };
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
        commandRoot = commandIdentity(program.programRoot, command, expectedRevision);
      } catch (error) { return Promise.reject(error); }
      const operation = pending.then(async () => {
        if (poisoned) throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN');
        const existing = requests.get(requestId);
        if (existing) {
          if (existing.commandRoot !== commandRoot) throw sessionError('RCL_SESSION_IDEMPOTENCY_CONFLICT');
          return { receipt: structuredClone(existing), result: structuredClone(existing.result), replayed: true };
        }
        if (expectedRevision !== revision) throw sessionError('RCL_SESSION_REVISION_CONFLICT');
        if (revision >= MAX_COMMANDS) throw sessionError('RCL_SESSION_JOURNAL_LIMIT');
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
            format: COMMAND, sessionId, sequence: revision + 1, previousRoot: head.root,
            programRoot: program.programRoot, requestId, expectedRevision, command, commandRoot,
            beforeStateRoot, afterStateRoot: result.afterRoot, resultRoot: root(result), result,
            stateRootAlgorithm: 'rcl.semantic-state-root.v2',
          });
          if (reference && root(await reference.invoke(command)) !== record.resultRoot) throw sessionError('RCL_SESSION_REFERENCE_REPLAY_MISMATCH');
          appendRecord(journalPath, record);
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
  const session = await openDurableRealitySession(directory, { ...options, requireExisting: true });
  try {
    const snapshot = session.snapshot();
    return {
      format: 'rcl.session-verification.v1', status: 'PASS', programRoot: snapshot.programRoot,
      sessionId: snapshot.sessionId, revision: snapshot.revision, journalRoot: snapshot.journalRoot,
      stateRoot: snapshot.stateRoot, stateRootAlgorithm: snapshot.stateRootAlgorithm,
      nativeReplayVerified: true, referenceReplayVerified: options.verifyReference === true,
      externalEffectsReplayed: false, osWriterLock: true, recovery: snapshot.recovery,
      externalHistoryAnchorChecked: options.expectedJournalRoot !== undefined || options.minimumRevision !== undefined,
    };
  } finally { await session.close(); }
}

export async function verifyDurableRealitySessionBackup(directory, options = {}) {
  if (typeof directory !== 'string' || !directory) throw sessionError('RCL_SESSION_BACKUP_DIRECTORY_REQUIRED');
  const storage = path.resolve(directory), manifestPath = path.join(storage, 'backup.json');
  if (fs.lstatSync(storage).isSymbolicLink() || !fs.statSync(storage).isDirectory()) throw sessionError('RCL_SESSION_DIRECTORY_INVALID');
  regularFile(manifestPath);
  if (fs.statSync(manifestPath).size > 64 * 1024) throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID'); }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID');
  const { backupRoot, ...core } = manifest;
  if (manifest.format !== RCL_SESSION_BACKUP_FORMAT || !/^[0-9a-f]{64}$/u.test(backupRoot ?? '') || root(core) !== backupRoot
      || !Number.isSafeInteger(manifest.revision) || manifest.revision < 0 || manifest.revision > MAX_COMMANDS
      || typeof manifest.sessionId !== 'string' || !manifest.sessionId
      || manifest.stateRootAlgorithm !== 'rcl.semantic-state-root.v2'
      || !['programRoot', 'journalRoot', 'stateRoot'].every(key => typeof manifest[key] === 'string' && /^[0-9a-f]{64}$/u.test(manifest[key]))
      || !manifest.files || Object.keys(manifest.files).sort().join(',') !== [...BACKUP_FILES].sort().join(',')) throw sessionError('RCL_SESSION_BACKUP_MANIFEST_INVALID');
  if (options.expectedBackupRoot !== undefined && options.expectedBackupRoot !== backupRoot) throw sessionError('RCL_SESSION_BACKUP_EXPECTED_ROOT_MISMATCH');
  for (const name of BACKUP_FILES) {
    const file = path.join(storage, name), expected = manifest.files[name];
    regularFile(file);
    if (!expected || !Number.isSafeInteger(expected.bytes) || expected.bytes < 0 || typeof expected.sha256 !== 'string'
        || !/^[0-9a-f]{64}$/u.test(expected.sha256) || fs.statSync(file).size !== expected.bytes
        || (name === 'journal.jsonl' && expected.bytes > MAX_JOURNAL_BYTES)
        || hashBytes(fs.readFileSync(file)) !== expected.sha256) throw sessionError('RCL_SESSION_BACKUP_ASSET_MISMATCH', `Backup asset differs: ${name}`);
  }
  if (options.expectedJournalRoot !== undefined && options.expectedJournalRoot !== manifest.journalRoot) throw sessionError('RCL_SESSION_EXPECTED_HEAD_MISMATCH');
  const verified = await verifyDurableRealitySession(storage, { ...options, repairIncompleteTail: false, expectedJournalRoot: manifest.journalRoot });
  if (verified.sessionId !== manifest.sessionId || verified.revision !== manifest.revision || verified.programRoot !== manifest.programRoot || verified.stateRoot !== manifest.stateRoot) throw sessionError('RCL_SESSION_BACKUP_REPLAY_MISMATCH');
  return { ...verified, format: 'rcl.session-backup-verification.v1', backupRoot,
    externalHistoryAnchorChecked: options.expectedJournalRoot !== undefined || options.minimumRevision !== undefined,
    externalBackupAnchorChecked: options.expectedBackupRoot !== undefined };
}
