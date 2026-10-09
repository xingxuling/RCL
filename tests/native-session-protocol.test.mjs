import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { encodeSessionInputs } from '../src/native-session.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(ROOT, 'examples/sessions/governed-counter.rcl'), 'utf8');
const program = compileReality(source);
const daemon = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvmd.exe' : 'rclvmd');
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
