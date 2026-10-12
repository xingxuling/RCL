import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileReality } from './compiler.mjs';
import { compileRealitySessionBytecode } from './bytecode.mjs';
import { verifyNativeSemanticStateRoot } from './semantic-state-root.mjs';
import { semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';
import { RCL_SESSION_FORMAT, RCL_SESSION_INPUT_TYPES, normalizeSessionCommand, sessionResult, sessionError } from './session-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const root = semanticStateRootV2Stable;
const evidence = (condition, code) => { if (!condition) throw sessionError(code); };

function verifySessionReply(program, payload, before, command) {
  evidence(payload.status === 'ok' && payload.program === program.name
    && payload.sourceRoot === program.programRoot, 'RCL_SESSION_NATIVE_SOURCE_ROOT_MISMATCH');
  evidence(Array.isArray(payload.history) && Array.isArray(payload.projections), 'RCL_SESSION_NATIVE_RECORDS_INVALID');
  const result = verifyNativeSemanticStateRoot(payload, { requireNativeRoot: true, expectedAlgorithm: 'rcl.semantic-state-root.v2' });
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
    return sessionResult(program, command, before, result.state, null);
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
  return sessionResult(program, command, before, result.state, record);
}

function daemonBinding(daemonPath, custom) {
  const daemonRoot = sha256(fs.readFileSync(daemonPath));
  if (process.platform !== 'win32' || custom) return { daemonRoot, sourceBound: false };
  const manifestPath = path.join(ROOT, 'native/native-windows-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expected = ['native/rclvm.c', 'native/rclvm.h', 'native/semantic_state_v2.h', 'native/rclc.c', 'native/rclvmd.c', 'native/provider_demo.c', 'native/foundation_provider.c', 'scripts/build-native-windows.mjs'];
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
  const header = Buffer.alloc(8);
  header.write('RCI1'); header.writeUInt32LE(fields.length, 4);
  const text = value => {
    const bytes = Buffer.from(value, 'utf8'), count = Buffer.alloc(4);
    count.writeUInt32LE(bytes.length); return Buffer.concat([count, bytes]);
  };
  const values = fields.map(([name, value]) => {
    const type = RCL_SESSION_INPUT_TYPES[program.facets.find(facet => facet.path === name).valueType];
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
  const program = structuredClone(typeof sourceOrProgram === 'string' ? compileReality(sourceOrProgram) : sourceOrProgram);
  const bytecode = options.bytecode === undefined ? compileRealitySessionBytecode(program) : Buffer.from(options.bytecode);
  // A supplied artifact must match bootstrap lowering before it can acquire inputs.
  if (options.bytecode !== undefined && !bytecode.equals(compileRealitySessionBytecode(program))) {
    throw sessionError('RCL_SESSION_BYTECODE_SOURCE_MISMATCH');
  }
  const daemonPath = options.daemonPath ?? path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvmd.exe' : 'rclvmd');
  if (!fs.existsSync(daemonPath)) throw sessionError('RCL_SESSION_NATIVE_DAEMON_MISSING');
  const binding = daemonBinding(daemonPath, options.daemonPath !== undefined);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-'));
  const bytecodePath = path.join(directory, 'session.rbc');
  fs.writeFileSync(bytecodePath, bytecode);
  const child = spawn(daemonPath, [bytecodePath, ...(options.lockPath ? [path.resolve(options.lockPath)] : [])], {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env ?? {}), RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2' },
  });
  let buffer = '', stderr = '', closed = false, state;
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
  child.on('exit', (code, signal) => fail(sessionError(stderr.includes('RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID')
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
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      if (closed) child.kill();
      else child.stdin.end('QUIT\n');
      const timer = setTimeout(() => child.kill(), 1000);
      await exited; clearTimeout(timer);
    }
    fs.rmSync(directory, { recursive: true, force: true });
  };
  try {
    const greeting = await ready;
    if (greeting.status !== 'ready') throw sessionError('RCL_SESSION_NATIVE_NOT_READY');
    const initial = await send('INIT', payload => verifySessionReply(program, payload));
    state = initial.state;
  } catch (error) { await close(); throw error; }
  let pending = Promise.resolve();
  const snapshot = () => ({
    format: RCL_SESSION_FORMAT, backend: 'native', program: program.name,
    programRoot: program.programRoot, state: structuredClone(state),
    stateRoot: semanticStateRootV2Stable(state),
    stateRootAlgorithm: 'rcl.semantic-state-root.v2',
    native: { processId: child.pid, ...binding, bytecodeRoot: sha256(bytecode), stateRootsIndependentlyVerified: true },
  });
  return Object.freeze({
    snapshot,
    invoke(input) {
      const command = normalizeSessionCommand(program, input);
      const wire = encodeSessionInputs(program, command.inputs).toString('hex');
      const operation = pending.then(async () => {
        const before = structuredClone(state);
        const result = await send(`STEP ${command.mode === 'realize' ? 1 : 0} ${command.rule} ${wire}`,
          payload => verifySessionReply(program, payload, before, command));
        state = structuredClone(result.state);
        return result;
      });
      pending = operation.catch(() => {});
      return operation;
    },
    async close() { await pending; await close(); },
  });
}
