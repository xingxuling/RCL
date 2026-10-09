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
  return { records, completeLength, tail: bytes.subarray(completeLength) };
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
  let head, revision = 0, sessionId, recovery = null, closing = false, poisoned = false;
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
    head = genesis; sessionId = genesis.sessionId;
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
    invoke(input) {
      if (poisoned || closing) return Promise.reject(sessionError('RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN'));
      const operation = pending.then(async () => {
        if (poisoned) throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN');
        const requestId = requestKey(input?.requestId);
        const expectedRevision = input?.expectedRevision;
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw sessionError('RCL_SESSION_EXPECTED_REVISION_REQUIRED');
        const command = normalizeSessionCommand(program, input);
        const commandRoot = commandIdentity(program.programRoot, command, expectedRevision);
        const existing = requests.get(requestId);
        if (existing) {
          if (existing.commandRoot !== commandRoot) throw sessionError('RCL_SESSION_IDEMPOTENCY_CONFLICT');
          return { receipt: structuredClone(existing), result: structuredClone(existing.result), replayed: true };
        }
        if (expectedRevision !== revision) throw sessionError('RCL_SESSION_REVISION_CONFLICT');
        if (revision >= MAX_COMMANDS) throw sessionError('RCL_SESSION_JOURNAL_LIMIT');
        const beforeStateRoot = engine.snapshot().stateRoot;
        const result = await engine.invoke(command);
        const record = rooted({
          format: COMMAND, sessionId, sequence: revision + 1, previousRoot: head.root,
          programRoot: program.programRoot, requestId, expectedRevision, command, commandRoot,
          beforeStateRoot, afterStateRoot: result.afterRoot, resultRoot: root(result), result,
          stateRootAlgorithm: 'rcl.semantic-state-root.v2',
        });
        try {
          if (reference && root(await reference.invoke(command)) !== record.resultRoot) throw sessionError('RCL_SESSION_REFERENCE_REPLAY_MISMATCH');
          appendRecord(journalPath, record);
        } catch (error) {
          // An unacknowledged write may be complete, partial or absent. Stop this
          // writer; reopening verifies/replays the durable prefix before a retry.
          poisoned = true; await engine.close();
          throw sessionError('RCL_SESSION_DURABILITY_UNCERTAIN', error.message, { cause: error.code });
        }
        head = record; revision++; requests.set(requestId, record);
        return { receipt: structuredClone(record), result: structuredClone(result), replayed: false };
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
