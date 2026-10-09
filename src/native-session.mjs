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
  const send = async command => {
    if (closed) throw sessionError('RCL_SESSION_NATIVE_CLOSED', stderr);
    const response = next();
    child.stdin.write(`${command}\n`, error => { if (error) fail(sessionError('RCL_SESSION_NATIVE_PROCESS', error.message)); });
    const envelope = await response;
    const payload = envelope.result ?? envelope;
    if (payload.status === 'error') {
      const code = payload.code ?? /^([A-Z0-9_]+)/u.exec(payload.message ?? '')?.[1] ?? 'RCL_SESSION_NATIVE_FAILURE';
      throw sessionError(code, payload.message);
    }
    return verifyNativeSemanticStateRoot(payload, { requireNativeRoot: true, expectedAlgorithm: 'rcl.semantic-state-root.v2' });
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
    const initial = await send('INIT');
    if (initial.sourceRoot !== undefined && initial.sourceRoot !== program.programRoot) throw sessionError('RCL_SESSION_NATIVE_SOURCE_ROOT_MISMATCH');
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
        const result = await send(`STEP ${command.mode === 'realize' ? 1 : 0} ${command.rule} ${wire}`);
        state = result.state;
        const record = command.mode === 'realize' ? result.history.at(-1) : result.projections.at(-1);
        return sessionResult(program, command, before, state, record);
      });
      pending = operation.catch(() => {});
      return operation;
    },
    async close() { await pending; await close(); },
  });
}
