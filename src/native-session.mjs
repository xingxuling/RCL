import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileReality } from './compiler.mjs';
import { compileRealitySessionBytecode } from './bytecode.mjs';
import { verifyNativeSemanticStateRoot, semanticStateRootForAlgorithm, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE } from './semantic-state-root.mjs';
import {
  RCL_SESSION_FORMAT, RCL_SESSION_INPUT_TYPES, normalizeSessionCommand, captureScalarSessionCheckpoint,
  applyScalarCheckpointNumberSigns, scalarCheckpointNegativeZeroFacets, sessionResult, sessionError,
} from './session-contract.mjs';
import { captureSequenceSessionCheckpoint, encodeSequenceCheckpointState } from './session-checkpoint-state.mjs';
import { defaultNativeExecutablePath } from './native-vm-materialization.mjs';
import { nativeLinuxArtifactBinding } from './native-linux-build-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const evidence = (condition, code) => { if (!condition) throw sessionError(code); };

function verifySessionReply(program, payload, before, command, options = {}) {
  const algorithm = options.stateRootAlgorithm ?? 'rcl.semantic-state-root.v2';
  const root = value => semanticStateRootForAlgorithm(value, algorithm);
  evidence(payload.status === 'ok' && payload.program === program.name
    && payload.sourceRoot === program.programRoot, 'RCL_SESSION_NATIVE_SOURCE_ROOT_MISMATCH');
  evidence(Array.isArray(payload.history) && Array.isArray(payload.projections), 'RCL_SESSION_NATIVE_RECORDS_INVALID');
  const result = verifyNativeSemanticStateRoot(payload, { requireNativeRoot: true, expectedAlgorithm: algorithm,
    rejectProjectedAst: options.rejectProjectedAst === true });
  if (!command) {
    evidence(!result.history.length && !result.projections.length, 'RCL_SESSION_NATIVE_INITIAL_RECORDS_INVALID');
    return result;
  }
  const records = command.mode === 'realize' ? result.history : result.projections;
  const other = command.mode === 'realize' ? result.projections : result.history;
  evidence(records.length <= 1 && !other.length, 'RCL_SESSION_NATIVE_RECORDS_INVALID');
  const record = records[0];
  if (!record) {
    evidence(result.stateRoot === root(before), 'RCL_SESSION_NATIVE_UNRECORDED_STATE_CHANGE');
    return sessionResult(program, command, before, result.state, null, algorithm);
  }
  const rule = program.rules.find(item => item.name === command.rule);
  const targets = [...new Set(rule.alters.map(alter => alter.target))];
  const actor = rule.kind === 'Emergence' ? rule.cause : rule.from;
  const decision = Object.assign(Object.create(null), before, command.inputs);
  evidence(record.rule === rule.name && record.ruleKind === rule.kind && record.mode === command.mode
    && record.kind === (command.mode === 'realize' ? 'Transition' : 'Projection')
    && record.status === (command.mode === 'realize' ? 'realized' : 'projected')
    && record.actor === actor && record.beforeRoot === root(decision), 'RCL_SESSION_NATIVE_TRANSITION_BINDING_MISMATCH');
  evidence(Array.isArray(record.changes) && record.changes.length === targets.length
    && Array.isArray(record.witnesses) && root(record.witnesses) === root(rule.witnesses)
    && Array.isArray(record.hostCalls) && !record.hostCalls.length
    && object(record.authority) && Array.isArray(record.authority.needs)
    && root(record.authority.needs) === root(rule.needs)
    && Array.isArray(record.authority.activeWarrants), 'RCL_SESSION_NATIVE_TRANSITION_SHAPE_INVALID');
  for (const grant of record.authority.activeWarrants) {
    evidence(object(grant) && grant.subject === actor && program.warrants.some(warrant =>
      warrant.subject === grant.subject && warrant.capability === grant.capability && warrant.target === grant.target),
    'RCL_SESSION_NATIVE_TRANSITION_AUTHORITY_INVALID');
  }
  const proposed = structuredClone(decision);
  record.changes.forEach((change, index) => {
    evidence(object(change) && change.target === targets[index] && typeof change.source === 'string'
      && root(change.before) === root(decision[change.target]), 'RCL_SESSION_NATIVE_TRANSITION_CHANGES_INVALID');
    proposed[change.target] = change.after;
  });
  evidence(record.afterRoot === root(proposed), 'RCL_SESSION_NATIVE_TRANSITION_ROOT_MISMATCH');
  if (command.mode === 'foresee') {
    evidence(object(record.projectedState) && root(record.projectedState) === record.afterRoot
      && result.stateRoot === root(before), 'RCL_SESSION_NATIVE_PROJECTION_STATE_MISMATCH');
  } else evidence(result.stateRoot === record.afterRoot, 'RCL_SESSION_NATIVE_COMMITTED_STATE_MISMATCH');
  return sessionResult(program, command, before, result.state, record, algorithm);
}

function daemonBinding(daemonPath, custom) {
  if (!custom && process.platform === 'linux' && daemonPath === path.join(ROOT, 'native', 'linux', 'rclvmd')) {
    try {
      const binding = nativeLinuxArtifactBinding(ROOT, 'daemon');
      return { daemonRoot: binding.binarySha256, sourceRoot: binding.sourceRoot, sourceBound: true };
    } catch (error) {
      throw sessionError(error.code === 'RCL_NATIVE_LINUX_MANIFEST_INVALID'
        ? 'RCL_SESSION_NATIVE_MANIFEST_INVALID' : 'RCL_SESSION_NATIVE_SOURCE_BINDING_MISMATCH');
    }
  }
  const daemonRoot = sha256(fs.readFileSync(daemonPath));
  if (custom || process.platform !== 'win32') return { daemonRoot, sourceBound: false };
  const manifestPath = path.join(ROOT, 'native/native-windows-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expected = ['native/rclvm.c', 'native/rclvm.h', 'native/semantic_state_v2.h', 'native/identifier_profile.h', 'native/number_format_ryu.h', 'native/rclc.c', 'native/rclvmd.c', 'native/provider_demo.c', 'native/foundation_provider.c', 'scripts/build-native-windows.mjs'];
  if (manifest.format !== 'rcl.native-windows-prebuilt.v1' || JSON.stringify(manifest.sources) !== JSON.stringify(expected)) throw sessionError('RCL_SESSION_NATIVE_MANIFEST_INVALID');
  const hash = createHash('sha256');
  for (const name of expected) { hash.update(name); hash.update('\0'); hash.update(fs.readFileSync(path.join(ROOT, name))); hash.update('\0'); }
  const sourceRoot = hash.digest('hex');
  const daemon = manifest.artifacts?.find(artifact => artifact.path === 'native/rclvmd.exe');
  if (manifest.sourceSha256 !== sourceRoot || daemon?.sha256 !== daemonRoot || daemon.bytes !== fs.statSync(daemonPath).size) throw sessionError('RCL_SESSION_NATIVE_SOURCE_BINDING_MISMATCH');
  return { daemonRoot, sourceRoot, sourceBound: true };
}

export function encodeSessionInputs(program, observations) {
  const fields = Object.entries(observations);
  const types = new Map(program.facets.map(facet => [facet.path, RCL_SESSION_INPUT_TYPES[facet.valueType]]));
  const header = Buffer.alloc(8);
  header.write('RCI1'); header.writeUInt32LE(fields.length, 4);
  const text = value => {
    const bytes = Buffer.from(value, 'utf8'), count = Buffer.alloc(4);
    count.writeUInt32LE(bytes.length); return Buffer.concat([count, bytes]);
  };
  const values = fields.map(([name, value]) => {
    const type = types.get(name);
    let payload;
    if (type === 1) { payload = Buffer.alloc(8); payload.writeDoubleLE(value); }
    else if (type === 2) payload = Buffer.from([value ? 1 : 0]);
    else payload = text(value);
    return Buffer.concat([text(name), Buffer.from([type]), payload]);
  });
  const wire = Buffer.concat([header, ...values]);
  if (wire.length > 2 * 1024 * 1024) throw sessionError('RCL_SESSION_PROTOCOL_LIMIT');
  return wire;
}

export async function createNativeRealitySession(sourceOrProgram, options = {}) {
  return openNativeRealitySession(sourceOrProgram, options);
}

export async function createNativeRealitySessionFromScalarCheckpoint(sourceOrProgram, checkpoint, options = {}, admitCheckpoint) {
  return openNativeRealitySession(sourceOrProgram, options, checkpoint ?? null, admitCheckpoint);
}

export async function createNativeRealitySessionFromSequenceCheckpoint(sourceOrProgram, checkpoint, options = {}, admitCheckpoint) {
  return openNativeRealitySession(sourceOrProgram, options, checkpoint ?? null, admitCheckpoint, true);
}

async function openNativeRealitySession(sourceOrProgram, options, checkpoint, admitCheckpoint, sequenceRestore = false) {
  const stateRootAlgorithm = options.stateRootAlgorithm ?? 'rcl.semantic-state-root.v2';
  if (!['rcl.semantic-state-root.v2', RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE].includes(stateRootAlgorithm)) {
    throw sessionError('RCL_SESSION_STATE_ROOT_ALGORITHM_UNSUPPORTED');
  }
  const verification = { stateRootAlgorithm, rejectProjectedAst: options.rejectProjectedAst === true };
  const program = structuredClone(typeof sourceOrProgram === 'string' ? compileReality(sourceOrProgram) : sourceOrProgram);
  const captureCheckpoint = sequenceRestore ? captureSequenceSessionCheckpoint : captureScalarSessionCheckpoint;
  const restored = checkpoint === undefined ? null : captureCheckpoint(program, checkpoint, stateRootAlgorithm);
  const wireCheckpoint = restored && (sequenceRestore ? restored.stateWireHex : encodeSessionInputs(program, restored.state).toString('hex'));
  const bytecode = options.bytecode === undefined ? compileRealitySessionBytecode(program) : Buffer.from(options.bytecode);
  // A supplied artifact must match bootstrap lowering before it can acquire inputs.
  if (options.bytecode !== undefined && !bytecode.equals(compileRealitySessionBytecode(program))) {
    throw sessionError('RCL_SESSION_BYTECODE_SOURCE_MISMATCH');
  }
  const daemonPath = options.daemonPath ?? defaultNativeExecutablePath(ROOT, 'rclvmd');
  if (!fs.existsSync(daemonPath)) throw sessionError('RCL_SESSION_NATIVE_DAEMON_MISSING');
  const binding = daemonBinding(daemonPath, options.daemonPath !== undefined);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-'));
  const bytecodePath = path.join(directory, 'session.rbc');
  let child;
  try {
    fs.writeFileSync(bytecodePath, bytecode);
    const args = [bytecodePath];
    if (options.lockPath) args.push(path.resolve(options.lockPath));
    if (restored) args.push(sequenceRestore ? '--restore-sequence-checkpoint' : '--restore-scalar-checkpoint');
    child = spawn(daemonPath, args, {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env ?? {}), RCL_SEMANTIC_STATE_ROOT_ALGORITHM: stateRootAlgorithm },
    });
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    if (error.syscall === 'spawn') throw sessionError('RCL_SESSION_NATIVE_PROCESS', error.message);
    throw error;
  }
  // A failed spawn emits close without exit. Subscribe before awaiting readiness.
  const processClosed = new Promise(resolve => child.once('close', resolve));
  let buffer = '', stderr = '', closed = false, state, initialStateRoot;
  const waiters = [];
  const timeout = options.timeout ?? 30_000;
  const fail = error => {
    closed = true;
    for (const waiter of waiters.splice(0)) { clearTimeout(waiter.timer); waiter.reject(error); }
  };
  const next = () => new Promise((resolve, reject) => {
    if (closed) { reject(sessionError('RCL_SESSION_NATIVE_CLOSED', stderr)); return; }
    const waiter = { resolve, reject, timer: null };
    waiter.timer = setTimeout(() => { fail(sessionError('RCL_SESSION_NATIVE_TIMEOUT')); child.kill(); }, timeout);
    waiters.push(waiter);
  });
  const ready = next();
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdin.on('error', error => fail(sessionError('RCL_SESSION_NATIVE_PROCESS', error.message)));
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
  child.on('error', error => fail(sessionError('RCL_SESSION_NATIVE_PROCESS', error.message)));
  child.on('close', (code, signal) => fail(sessionError(stderr.includes('RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID')
    ? 'RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID' : 'RCL_SESSION_NATIVE_CLOSED', `Native daemon exited ${code ?? signal}: ${stderr}`)));
  child.stdout.on('data', chunk => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 16 * 1024 * 1024) { fail(sessionError('RCL_SESSION_NATIVE_OUTPUT_LIMIT')); child.kill(); return; }
    let boundary;
    while ((boundary = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
      const waiter = waiters.shift();
      if (!waiter) { fail(sessionError('RCL_SESSION_NATIVE_UNEXPECTED_OUTPUT')); child.kill(); return; }
      clearTimeout(waiter.timer);
      try { waiter.resolve(JSON.parse(line)); }
      catch { waiter.reject(sessionError('RCL_SESSION_NATIVE_OUTPUT_INVALID')); fail(sessionError('RCL_SESSION_NATIVE_OUTPUT_INVALID')); child.kill(); }
    }
  });
  const invalidEvidence = error => {
    const failure = sessionError('RCL_SESSION_NATIVE_EVIDENCE_INVALID', error.message, { cause: error.code ?? 'RCL_SESSION_NATIVE_REPLY_INVALID' });
    fail(failure); child.kill();
    return failure;
  };
  const send = async (command, accept) => {
    if (closed) throw sessionError('RCL_SESSION_NATIVE_CLOSED', stderr);
    const response = next();
    child.stdin.write(`${command}\n`, error => { if (error) fail(sessionError('RCL_SESSION_NATIVE_PROCESS', error.message)); });
    const envelope = await response;
    let payload;
    try {
      evidence(object(envelope), 'RCL_SESSION_NATIVE_ENVELOPE_INVALID');
      payload = Object.hasOwn(envelope, 'result') ? envelope.result : envelope;
      evidence(object(payload), 'RCL_SESSION_NATIVE_PAYLOAD_INVALID');
    } catch (error) { throw invalidEvidence(error); }
    if (payload.status === 'error') {
      // Only structured VM failures have the session-step rollback contract.
      if (typeof payload.code !== 'string' || !/^RCL_[A-Z0-9_]+$/u.test(payload.code) || typeof payload.message !== 'string') {
        throw invalidEvidence(sessionError('RCL_SESSION_NATIVE_FAILURE', payload.message));
      }
      throw sessionError(payload.code, payload.message);
    }
    try { return accept(payload); }
    catch (error) { throw invalidEvidence(error); }
  };
  const close = async () => {
    if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
      if (closed) child.kill();
      else child.stdin.end('QUIT\n');
    }
    const timer = setTimeout(() => child.kill(), 1000);
    try { await processClosed; }
    finally {
      clearTimeout(timer);
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };
  const readScalarEvidence = () => send('SCALAR_EVIDENCE', payload => {
    const stateRoot = semanticStateRootForAlgorithm(state, stateRootAlgorithm);
    evidence(payload.status === 'ok' && payload.format === 'rcl.session-scalar-evidence.v1'
      && payload.sourceRoot === program.programRoot && payload.stateRootAlgorithm === stateRootAlgorithm
      && payload.stateRoot === stateRoot, 'RCL_SESSION_NATIVE_CHECKPOINT_EVIDENCE_INVALID');
    const exact = applyScalarCheckpointNumberSigns(state, payload.negativeZeroFacets);
    return captureScalarSessionCheckpoint(program, { state: exact, stateRoot }, stateRootAlgorithm);
  });
  let sequenceEvidenceSupported = false;
  function readSequenceEvidence() {
    if (!sequenceEvidenceSupported) throw sessionError('RCL_SESSION_CHECKPOINT_SEQUENCE_PEER_UNSUPPORTED');
    // Check the projection's value profile before asking the peer for its exact bytes.
    encodeSequenceCheckpointState(program, state);
    const stateRoot = semanticStateRootForAlgorithm(state, stateRootAlgorithm);
    return send('SEQUENCE_EVIDENCE', payload => {
      evidence(payload.status === 'ok' && payload.format === 'rcl.session-sequence-evidence.v1'
        && payload.sourceRoot === program.programRoot && payload.stateRootAlgorithm === stateRootAlgorithm
        && payload.stateRoot === stateRoot, 'RCL_SESSION_NATIVE_CHECKPOINT_EVIDENCE_INVALID');
      return captureSequenceSessionCheckpoint(program, payload, stateRootAlgorithm);
    });
  }
  try {
    const greeting = await ready;
    if (greeting.status !== 'ready') throw sessionError('RCL_SESSION_NATIVE_NOT_READY');
    sequenceEvidenceSupported = greeting.sequenceCheckpointEvidence === true;
    const restoreSupported = sequenceRestore ? greeting.sequenceCheckpointRestore : greeting.scalarCheckpointRestore;
    if (restored && restoreSupported !== true) throw sessionError('RCL_SESSION_NATIVE_CHECKPOINT_UNSUPPORTED');
    const initial = await send('INIT', payload => verifySessionReply(program, payload, undefined, undefined, verification));
    state = initial.state;
    if (restored) {
      initialStateRoot = initial.stateRoot;
      if (admitCheckpoint) admitCheckpoint(initialStateRoot);
      const kind = sequenceRestore ? 'RESTORE_SEQUENCE' : 'RESTORE';
      const opened = await send(`${kind} ${restored.stateRoot} ${wireCheckpoint}`, payload => {
        const result = verifySessionReply(program, payload, undefined, undefined, verification);
        evidence(result.stateRoot === restored.stateRoot, 'RCL_SESSION_NATIVE_CHECKPOINT_STATE_ROOT_MISMATCH');
        return result;
      });
      state = opened.state;
      const checked = await (sequenceRestore ? readSequenceEvidence() : readScalarEvidence());
      if (sequenceRestore && checked.stateWireHex !== wireCheckpoint) {
        throw sessionError('RCL_SESSION_NATIVE_CHECKPOINT_EXACT_STATE_MISMATCH');
      }
      if (!sequenceRestore && JSON.stringify(scalarCheckpointNegativeZeroFacets(checked.state))
          !== JSON.stringify(scalarCheckpointNegativeZeroFacets(restored.state))) {
        throw sessionError('RCL_SESSION_NATIVE_CHECKPOINT_NUMBER_SIGNS_MISMATCH');
      }
    }
  } catch (error) { await close(); throw error; }
  let pending = Promise.resolve(), closing = false, closePromise;
  const snapshot = () => ({
    format: RCL_SESSION_FORMAT, backend: 'native', program: program.name,
    programRoot: program.programRoot, state: structuredClone(state),
    stateRoot: semanticStateRootForAlgorithm(state, stateRootAlgorithm),
    stateRootAlgorithm,
    native: { processId: child.pid, ...binding, bytecodeRoot: sha256(bytecode), stateRootsIndependentlyVerified: true,
      ...(restored ? { initialStateRoot, restoredCheckpointStateRoot: restored.stateRoot } : {}),
      peerStatus: closed ? 'CLOSED' : closing ? 'CLOSING' : 'NO_EXIT_OBSERVED', snapshotOrigin: 'LAST_VERIFIED_REPLY' },
  });
  function readCheckpoint(readEvidence) {
    if (closing || closed) return Promise.reject(sessionError('RCL_SESSION_NATIVE_CLOSED'));
    const operation = pending.then(readEvidence);
    pending = operation.catch(() => {});
    return operation;
  }
  return Object.freeze({
    snapshot,
    readScalarCheckpoint: () => readCheckpoint(readScalarEvidence),
    readSequenceCheckpoint: () => readCheckpoint(readSequenceEvidence),
    invoke(input) {
      if (closing || closed) return Promise.reject(sessionError('RCL_SESSION_NATIVE_CLOSED'));
      const command = normalizeSessionCommand(program, input);
      const wire = encodeSessionInputs(program, command.inputs).toString('hex');
      const operation = pending.then(async () => {
        const before = structuredClone(state);
        const result = await send(`STEP ${command.mode === 'realize' ? 1 : 0} ${command.rule} ${wire}`,
          payload => verifySessionReply(program, payload, before, command, verification));
        state = structuredClone(result.state);
        return result;
      });
      pending = operation.catch(() => {});
      return operation;
    },
    close() {
      if (!closePromise) {
        closing = true;
        closePromise = pending.then(() => close());
      }
      return closePromise;
    },
  });
}
