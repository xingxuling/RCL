import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { createNativeRealitySession, encodeSessionInputs } from '../src/native-session.mjs';
import { defaultNativeExecutablePath } from '../src/native-vm-materialization.mjs';
import { semanticStateRootV2Stable } from '../src/semantic-state-root-v2.mjs';
import { encodeSequenceCheckpointState } from '../src/session-checkpoint-state.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(ROOT, 'examples/sessions/governed-counter.rcl'), 'utf8');
const program = compileReality(source);
const daemon = defaultNativeExecutablePath(ROOT, 'rclvmd');
const text = value => { const bytes = Buffer.from(value), size = Buffer.alloc(4); size.writeUInt32LE(bytes.length); return Buffer.concat([size, bytes]); };
const numberInput = (name, value) => { const bytes = Buffer.alloc(8); bytes.writeDoubleLE(value); return Buffer.concat([text(name), Buffer.from([1]), bytes]); };
const frame = fields => { const header = Buffer.alloc(8); header.write('RCI1'); header.writeUInt32LE(fields.length, 4); return Buffer.concat([header, ...fields]); };

test('the C VM itself rejects undeclared, duplicate and nonfinite input batches atomically', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-protocol-'));
  try {
    const bytecode = path.join(directory, 'session.rbc'); fs.writeFileSync(bytecode, compileRealitySessionBytecode(program));
    const invalid = [
      frame([numberInput('event.delta', 30), numberInput('counter.value', 50)]),
      frame([numberInput('event.delta', 30), numberInput('event.delta', 1)]),
      frame([numberInput('event.delta', Infinity)]),
    ];
    const valid = encodeSessionInputs(program, { 'event.delta': 1 });
    const input = ['INIT', ...invalid.map(bytes => 'STEP 1 increment ' + bytes.toString('hex')), 'STEP 1 increment ' + valid.toString('hex'), 'QUIT'].join('\n') + '\n';
    const run = spawnSync(daemon, [bytecode], { input, encoding: 'utf8', timeout: 10_000, windowsHide: true, env: { ...process.env, RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2' } });
    assert.equal(run.status, 0, run.stderr);
    const messages = run.stdout.trim().split('\n').map(JSON.parse);
    assert.equal(messages[2].result.code, 'RCL_SESSION_INPUT_NOT_DECLARED');
    assert.equal(messages[3].result.code, 'RCL_SESSION_INPUT_DUPLICATE');
    assert.equal(messages[4].result.code, 'RCL_SESSION_INPUT_TYPE_MISMATCH');
    assert.equal(messages[5].result.state['counter.value'], 1);
    assert.equal(messages[5].result.state['event.delta'], 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('an RBC 1.3 instruction cannot be smuggled under a legacy feature header', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-session-header-'));
  try {
    const bytes = compileRealitySessionBytecode(program); bytes.writeUInt16LE(2, 6);
    const bytecode = path.join(directory, 'downgraded.rbc'); fs.writeFileSync(bytecode, bytes);
    const run = spawnSync(daemon, [bytecode], { input: 'INIT\nQUIT\n', encoding: 'utf8', timeout: 10_000, windowsHide: true });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /RCL_NATIVE_BYTECODE_FEATURE_VERSION/u);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('scalar checkpoint restore is explicit, root-checked and restricted to before the first step', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-checkpoint-'));
  try {
    const state = {
      'event.delta': 3, 'event.label': '已提交', 'counter.value': 3,
      'counter.lastLabel': '已提交', 'access.enabled': true,
    };
    const stateRoot = semanticStateRootV2Stable(state);
    const payload = encodeSessionInputs(program, state).toString('hex');
    const restore = 'RESTORE ' + stateRoot + ' ' + payload;
    const step = 'STEP 1 increment ' + encodeSessionInputs(program, { 'event.delta': 2 }).toString('hex');
    const bytecode = path.join(directory, 'session.rbc');
    fs.writeFileSync(bytecode, compileRealitySessionBytecode(program));
    const run = (commands, args = []) => {
      const response = spawnSync(daemon, [bytecode, ...args], {
        input: [...commands, 'QUIT', ''].join('\n'), encoding: 'utf8', timeout: 10000, windowsHide: true,
        env: { ...process.env, RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2' },
      });
      assert.equal(response.status, 0, response.stderr);
      return response.stdout.trim().split('\n').map(JSON.parse);
    };
    const defaults = run(['INIT', restore, step]);
    assert.equal(defaults[0].scalarCheckpointRestore, undefined);
    assert.equal(defaults[2].status, 'error');
    assert.equal(defaults[3].result.state['counter.value'], 2);

    const partial = 'RESTORE ' + stateRoot + ' ' + encodeSessionInputs(program, { 'counter.value': 3 }).toString('hex');
    const wrongRoot = 'RESTORE ' + '0'.repeat(64) + ' ' + payload;
    const opted = run([restore, 'INIT', partial, wrongRoot, restore, restore, step], ['--restore-scalar-checkpoint']);
    assert.equal(opted[0].scalarCheckpointRestore, true);
    assert.equal(opted[1].message, 'RCL_SESSION_CHECKPOINT_PHASE_OR_ROOT_INVALID');
    assert.equal(opted[3].message, 'RCL_SESSION_CHECKPOINT_STATE_INVALID');
    assert.equal(opted[4].message, 'RCL_SESSION_CHECKPOINT_STATE_ROOT_MISMATCH');
    assert.deepEqual(opted[5].result.state, state);
    assert.equal(opted[6].message, 'RCL_SESSION_CHECKPOINT_PHASE_OR_ROOT_INVALID');
    assert.equal(opted[7].result.state['counter.value'], 5);

    const afterStep = run(['INIT', step, restore, step], ['--restore-scalar-checkpoint']);
    assert.equal(afterStep[3].message, 'RCL_SESSION_CHECKPOINT_PHASE_OR_ROOT_INVALID');
    assert.equal(afterStep[4].result.state['counter.value'], 4);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('native Sequence restore rejects malformed or unpinned state before replacing any facet', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-sequence-frame-'));
  try {
    const source = 'reality SequenceFrame { facet values : Sequence = empty_sequence() }';
    const program = compileReality(source);
    const bytecode = path.join(directory, 'session.rbc');
    fs.writeFileSync(bytecode, compileRealitySessionBytecode(program));
    const initial = { values: [] }, restored = { values: [[-0, true, '😀'], []] };
    const stateRoot = semanticStateRootV2Stable(restored);
    const wire = encodeSequenceCheckpointState(program, restored);
    const malformed = Buffer.from(wire, 'hex');
    malformed.writeUInt32LE(0xffffffff, 8 + 4 + 'values'.length + 1);
    const restore = 'RESTORE_SEQUENCE ' + stateRoot + ' ' + wire;
    const run = (commands, args = []) => {
      const response = spawnSync(daemon, [bytecode, ...args], {
        input: [...commands, 'QUIT', ''].join('\n'), encoding: 'utf8', timeout: 10_000, windowsHide: true,
        env: { ...process.env, RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2' },
      });
      assert.equal(response.status, 0, response.stderr);
      return response.stdout.trim().split('\n').map(JSON.parse);
    };
    const standard = run(['INIT', restore, 'SEQUENCE_EVIDENCE']);
    assert.equal(standard[0].sequenceCheckpointRestore, undefined);
    assert.equal(standard[2].status, 'error');
    assert.equal(standard[3].result.stateWireHex, encodeSequenceCheckpointState(program, initial));
    const opted = run([
      restore, 'INIT', 'RESTORE_SEQUENCE ' + stateRoot + ' ' + malformed.toString('hex'),
      'RESTORE_SEQUENCE ' + '0'.repeat(64) + ' ' + wire, 'SEQUENCE_EVIDENCE',
      restore, 'SEQUENCE_EVIDENCE', restore,
    ], ['--restore-sequence-checkpoint']);
    assert.equal(opted[0].sequenceCheckpointRestore, true);
    assert.equal(opted[1].message, 'RCL_SESSION_CHECKPOINT_PHASE_OR_ROOT_INVALID');
    assert.equal(opted[3].message, 'RCL_SESSION_CHECKPOINT_STATE_INVALID');
    assert.equal(opted[4].message, 'RCL_SESSION_CHECKPOINT_STATE_ROOT_MISMATCH');
    assert.equal(opted[5].result.stateWireHex, encodeSequenceCheckpointState(program, initial));
    assert.equal(opted[6].result.stateRoot, stateRoot);
    assert.equal(opted[7].result.stateWireHex, wire);
    assert.equal(opted[8].message, 'RCL_SESSION_CHECKPOINT_PHASE_OR_ROOT_INVALID');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('failed native process launch rejects promptly and removes its temporary bytecode', { timeout: 5_000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-bad-native-launch-'));
  const badDaemon = path.join(directory, process.platform === 'win32' ? 'invalid.exe' : 'invalid');
  const mkdtemp = fs.mkdtempSync;
  let bytecodeDirectory;
  try {
    fs.writeFileSync(badDaemon, 'not a native executable', { mode: 0o600 });
    fs.mkdtempSync = (prefix, ...args) => {
      const created = mkdtemp(prefix, ...args);
      if (prefix === path.join(os.tmpdir(), 'rcl-session-')) bytecodeDirectory = created;
      return created;
    };
    await assert.rejects(createNativeRealitySession(program, { daemonPath: badDaemon }),
      error => error.code === 'RCL_SESSION_NATIVE_PROCESS');
    assert.ok(bytecodeDirectory);
    assert.equal(fs.existsSync(bytecodeDirectory), false);
  } finally {
    fs.mkdtempSync = mkdtemp;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('native sessions capture the selected evidence profile for the lifetime of the peer', async () => {
  const options = { stateRootAlgorithm: 'rcl.semantic-state-root.v2' };
  const session = await createNativeRealitySession(program, options);
  try {
    options.stateRootAlgorithm = 'rcl.semantic-state-root.v3-candidate';
    const result = await session.invoke({ rule: 'increment', inputs: { 'event.delta': 1 } });
    assert.equal(result.stateRootAlgorithm, 'rcl.semantic-state-root.v2');
    assert.equal(result.state['counter.value'], 1);
    assert.equal(result.afterRoot, session.snapshot().stateRoot);
  } finally {
    await session.close();
  }
});
