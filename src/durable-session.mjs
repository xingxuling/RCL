import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { compileReality } from './compiler.mjs';
import { compileRealitySessionBytecode } from './bytecode.mjs';
import { compileRealitySessionNative } from './session-compiler.mjs';
import { createNativeRealitySession } from './native-session.mjs';
import { createRealitySession } from './runtime.mjs';
import { semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';
import { normalizeSessionCommand, sessionError, RCL_SESSION_COMMAND_FORMAT, RCL_SESSION_RESULT_FORMAT } from './session-contract.mjs';

export const RCL_DURABLE_SESSION_VERSION = '1.0.0';
export const RCL_SESSION_JOURNAL_FORMAT = 'rcl.session-journal.v2';
export const RCL_SESSION_COMMAND_IDENTITY_FORMAT = 'rcl.session-command-identity.v2';
export const RCL_SESSION_BACKUP_FORMAT = 'rcl.session-backup.v1';
export const RCL_SESSION_HISTORY_FORMAT = 'rcl.session-history-page.v1';
export const RCL_SESSION_HISTORY_VERIFICATION_FORMAT = 'rcl.session-history-verification.v1';
const BACKUP_FILES = ['source.rcl', 'session.rbc', 'journal.jsonl'];
const GENESIS = 'rcl.session-journal-genesis.v2';
const COMMAND = 'rcl.session-journal-command.v2';
const LEGACY_GENESIS = 'rcl.session-journal-genesis.v1';
const LEGACY_COMMAND = 'rcl.session-journal-command.v1';
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

function commandIdentity(programRoot, command, expectedRevision, format = COMMAND) {
  if (format === LEGACY_COMMAND) return root({ programRoot, command, expectedRevision });
  if (format !== COMMAND) throw sessionError('RCL_SESSION_COMMAND_IDENTITY_UNSUPPORTED');
  return root({ format: RCL_SESSION_COMMAND_IDENTITY_FORMAT, programRoot, commandFormat: command.format,
    rule: command.rule, mode: command.mode, inputsRoot: root(command.inputs), expectedRevision });
}

function resultIdentity(programRoot, result, expectedRevision, format = COMMAND) {
  if (format === LEGACY_COMMAND) return root(result);
  if (format !== COMMAND) throw sessionError('RCL_SESSION_COMMAND_IDENTITY_UNSUPPORTED');
  return root({ format: 'rcl.session-result-identity.v2', payloadRoot: root(result),
    commandRoot: commandIdentity(programRoot, result.command, expectedRevision), stateRoot: root(result.state) });
}

function historyVerificationOptions(options) {
  const allowed = ['expectedJournalRoot', 'expectedPageRoot', 'expectedPreviousRoot', 'expectedSessionId', 'expectedProgramRoot', 'minimumRevision'];
  if (!options || typeof options !== 'object' || Array.isArray(options)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
      || Reflect.ownKeys(options).some(key => !allowed.includes(key))
      || Object.values(Object.getOwnPropertyDescriptors(options)).some(item => !item.enumerable || !('value' in item))) throw sessionError('RCL_SESSION_HISTORY_OPTIONS_INVALID');
  const pins = Object.fromEntries(Object.entries(structuredClone(options)).filter(([, value]) => value !== undefined));
  for (const key of ['expectedJournalRoot', 'expectedPageRoot', 'expectedPreviousRoot', 'expectedProgramRoot']) {
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
  check(Object.keys(page).length === keys.length && keys.every(key => Object.hasOwn(page, key)));
  check(page.format === RCL_SESSION_HISTORY_FORMAT && page.stateRootAlgorithm === 'rcl.semantic-state-root.v2'
    && typeof page.sessionId === 'string' && page.sessionId.length > 0 && !page.sessionId.includes('\0')
    && ['programRoot', 'journalRoot', 'stateRoot', 'previousRoot', 'pageRoot'].every(key => hash(page[key]))
    && Number.isSafeInteger(page.revision) && page.revision >= 0 && page.revision <= MAX_COMMANDS
    && Number.isSafeInteger(page.fromRevision) && page.fromRevision >= 1 && page.fromRevision <= page.revision + 1
    && Number.isSafeInteger(page.limit) && page.limit >= 1 && page.limit <= 1000 && Array.isArray(page.entries));
  const { pageRoot, ...core } = page;
  check(root(core) === pageRoot, 'RCL_SESSION_HISTORY_PAGE_ROOT_MISMATCH');
  const count = Math.min(page.limit, page.revision - page.fromRevision + 1), next = page.fromRevision + count;
  check(page.entries.length === count && page.nextRevision === (next <= page.revision ? next : null));
  for (const [option, field] of [['expectedJournalRoot', 'journalRoot'], ['expectedPageRoot', 'pageRoot'], ['expectedPreviousRoot', 'previousRoot'], ['expectedSessionId', 'sessionId'], ['expectedProgramRoot', 'programRoot']]) {
    if (pins[option] !== undefined) check(pins[option] === page[field], 'RCL_SESSION_HISTORY_PIN_MISMATCH');
  }
  if (pins.minimumRevision !== undefined) check(page.revision >= pins.minimumRevision, 'RCL_SESSION_REVISION_ROLLBACK');
  const requests = new Set();
  let previousRoot = page.previousRoot, previousStateRoot = null, programName = null, versionFloor = 1, firstVersion = null, legacyEntries = 0;
  for (const [index, record] of page.entries.entries()) {
    check(keysAre(record, ['format', 'sessionId', 'sequence', 'previousRoot', 'programRoot', 'requestId', 'expectedRevision', 'command', 'commandRoot', 'beforeStateRoot', 'afterStateRoot', 'resultRoot', 'result', 'stateRootAlgorithm', 'root']));
    verifyRecord(record);
    const version = record.format === COMMAND ? 2 : record.format === LEGACY_COMMAND ? 1 : 0;
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
      && result.stateRootAlgorithm === page.stateRootAlgorithm && object(result.state) && root(result.state) === result.afterRoot
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
      check(root(decision) === transition.beforeRoot, 'RCL_SESSION_HISTORY_RESULT_INVALID');
      const proposed = structuredClone(decision);
      for (const change of transition.changes) {
        check(root(change.before) === root(decision[change.target]), 'RCL_SESSION_HISTORY_RESULT_INVALID');
        proposed[change.target] = change.after;
      }
      check(root(proposed) === transition.afterRoot, 'RCL_SESSION_HISTORY_RESULT_INVALID');
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
  if (!Array.isArray(pages) || !pages.length || pages.length > MAX_COMMANDS + 1 || (pins.expectedPageRoot !== undefined && pages.length !== 1)) throw sessionError('RCL_SESSION_HISTORY_PAGES_INVALID');
  const verified = [], requests = new Set();
  for (const page of pages) {
    const item = verifyHistoryPage(page, verified.length ? { ...pins, expectedPreviousRoot: undefined } : pins), previous = verified.at(-1);
    if (previous && (previous.page.nextRevision === null || item.page.fromRevision !== previous.page.nextRevision
        || item.page.previousRoot !== previous.previousRoot || item.page.sessionId !== previous.page.sessionId
        || item.page.programRoot !== previous.page.programRoot || item.page.revision !== previous.page.revision
        || item.page.journalRoot !== previous.page.journalRoot || item.page.stateRoot !== previous.page.stateRoot
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
    const legacyGenesis = genesis.format === LEGACY_GENESIS && genesis.journalFormat === 'rcl.session-journal.v1';
    if ((!legacyGenesis && !(genesis.format === GENESIS && genesis.journalFormat === RCL_SESSION_JOURNAL_FORMAT))
        || genesis.sequence !== 0 || genesis.previousRoot !== null || typeof genesis.sessionId !== 'string'
        || genesis.sourceHash !== sourceHash || genesis.programRoot !== program.programRoot || genesis.bytecodeHash !== bytecodeHash
        || genesis.initialStateRoot !== engine.snapshot().stateRoot || genesis.stateRootAlgorithm !== 'rcl.semantic-state-root.v2') {
      throw sessionError('RCL_SESSION_GENESIS_BINDING_MISMATCH');
    }
    head = genesis; genesisRoot = genesis.root; sessionId = genesis.sessionId;
    let versionFloor = legacyGenesis ? 1 : 2;
    for (const record of journal.records.slice(1)) {
      verifyRecord(record);
      const version = record.format === COMMAND ? 2 : record.format === LEGACY_COMMAND ? 1 : 0;
      if (version < versionFloor || record.sequence !== revision + 1 || record.previousRoot !== head.root
          || record.sessionId !== sessionId || record.programRoot !== program.programRoot
          || record.expectedRevision !== revision || record.stateRootAlgorithm !== 'rcl.semantic-state-root.v2') {
        throw sessionError('RCL_SESSION_JOURNAL_CONTINUITY_MISMATCH');
      }
      versionFloor = version;
      const requestId = requestKey(record.requestId);
      if (requests.has(requestId)) throw sessionError('RCL_SESSION_JOURNAL_DUPLICATE_REQUEST');
      const command = normalizeSessionCommand(program, record.command);
      if (record.commandRoot !== commandIdentity(program.programRoot, command, revision, record.format)
          || record.resultRoot !== resultIdentity(program.programRoot, record.result, revision, record.format)
          || commandIdentity(program.programRoot, record.result.command, revision) !== commandIdentity(program.programRoot, command, revision)
          || root(record.result.state) !== record.afterStateRoot || record.beforeStateRoot !== engine.snapshot().stateRoot) {
        throw sessionError('RCL_SESSION_JOURNAL_COMMAND_BINDING_MISMATCH');
      }
      const result = await engine.invoke(command);
      if (resultIdentity(program.programRoot, result, revision, record.format) !== record.resultRoot || record.afterStateRoot !== result.afterRoot) throw sessionError('RCL_SESSION_REPLAY_MISMATCH');
      if (reference && resultIdentity(program.programRoot, await reference.invoke(command), revision, record.format) !== record.resultRoot) throw sessionError('RCL_SESSION_REFERENCE_REPLAY_MISMATCH');
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
          if (commandIdentity(program.programRoot, existing.command, existing.expectedRevision) !== commandRoot) throw sessionError('RCL_SESSION_IDEMPOTENCY_CONFLICT');
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
            beforeStateRoot, afterStateRoot: result.afterRoot, resultRoot: resultIdentity(program.programRoot, result, revision), result,
            stateRootAlgorithm: 'rcl.semantic-state-root.v2',
          });
          if (reference && resultIdentity(program.programRoot, await reference.invoke(command), revision) !== record.resultRoot) throw sessionError('RCL_SESSION_REFERENCE_REPLAY_MISMATCH');
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
