import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const cli = path.join(ROOT, 'src/reality-hub-cli.mjs');
const fixture = path.join(ROOT, 'examples/sessions/governed-counter.rcl');
const command = { requestId: 'one', expectedRevision: 0, rule: 'increment', inputs: { 'event.delta': 1 } };
function invoke(args, status = 0) {
  const run = spawnSync(process.execPath, [cli, 'session', ...args], { encoding: 'utf8', timeout: 20_000, windowsHide: true });
  assert.equal(run.status, status, run.stderr + run.stdout);
  return JSON.parse(run.stdout);
}

test('CLI checks trusted head and revision before inspecting, invoking or verifying', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cli-head-'));
  const storage = path.join(directory, 'state'), commandPath = path.join(directory, 'command.json');
  try {
    fs.writeFileSync(commandPath, JSON.stringify(command));
    const genesis = invoke(['init', fixture, storage]);
    const first = invoke(['invoke', storage, commandPath, '--expected-root', genesis.journalRoot, '--minimum-revision', '0']);
    assert.equal(first.result.state['counter.value'], 1);
    const root = first.receipt.root;
    const journal = path.join(storage, 'journal.jsonl'), bytes = fs.readFileSync(journal);
    assert.equal(invoke(['inspect', storage, '--minimum-revision', '1', '--expected-root', root]).journalRoot, root);
    assert.equal(invoke(['verify', storage, '--reference', '--expected-root', root, '--minimum-revision', '1']).externalHistoryAnchorChecked, true);
    assert.equal(invoke(['invoke', storage, commandPath, '--expected-root', genesis.journalRoot], 1).code, 'RCL_SESSION_EXPECTED_HEAD_MISMATCH');
    assert.ok(fs.readFileSync(journal).equals(bytes), 'A failed anchor cannot append a retry or new command');
    fs.writeFileSync(journal, bytes.subarray(0, bytes.indexOf(10) + 1));
    assert.equal(invoke(['verify', storage, '--minimum-revision', '1'], 1).code, 'RCL_SESSION_REVISION_ROLLBACK');
    assert.equal(invoke(['inspect', storage, '--expected-root', root], 1).code, 'RCL_SESSION_EXPECTED_HEAD_MISMATCH');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('CLI recovery validates a trusted anchor before changing an incomplete tail', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cli-recovery-'));
  const storage = path.join(directory, 'state');
  try {
    const initial = invoke(['init', fixture, storage]);
    const journal = path.join(storage, 'journal.jsonl');
    const prefix = fs.readFileSync(journal), tail = Buffer.from('{"interrupted":');
    fs.appendFileSync(journal, tail);
    assert.equal(invoke(['recover', storage, '--repair-incomplete-tail', '--expected-root', '0'.repeat(64)], 1).code, 'RCL_SESSION_EXPECTED_HEAD_MISMATCH');
    assert.ok(fs.readFileSync(journal).equals(Buffer.concat([prefix, tail])));
    assert.deepEqual(fs.readdirSync(storage).filter(name => name.startsWith('recovery-tail-')), []);
    const recovered = invoke(['recover', storage, '--expected-root', initial.journalRoot, '--minimum-revision', '0', '--repair-incomplete-tail']);
    assert.equal(recovered.recovery.discardedIncompleteBytes, tail.length);
    assert.ok(fs.readFileSync(recovered.recovery.backupPath).equals(tail));
    assert.ok(fs.readFileSync(journal).equals(prefix));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('CLI rejects malformed, duplicate and inappropriate flags before creating artifacts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cli-flags-'));
  try {
    const storage = path.join(directory, 'absent'), output = path.join(directory, 'absent.rbc');
    for (const flags of [['--unknown'], ['--bootstrap'], ['--repair-incomplete-tail'], ['--reference']]) {
      assert.equal(invoke(['init', fixture, storage, ...flags], 1).code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
      assert.equal(fs.existsSync(storage), false);
    }
    for (const flags of [
      ['--unknown'], ['--expected-root'], ['--expected-root', 'bad'],
      ['--minimum-revision', '-1'], ['--minimum-revision', '1.5'], ['--minimum-revision', '9007199254740992'],
      ['--expected-root', '0'.repeat(64), '--expected-root', '0'.repeat(64)], ['--reference', '--reference'],
      ['--bootstrap'], ['--repair-incomplete-tail'], ['extra-positional'],
    ]) {
      assert.equal(invoke(['verify', storage, ...flags], 1).code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
      assert.equal(fs.existsSync(storage), false);
    }
    assert.equal(invoke(['compile', fixture, output, '--minimum-revision', '0'], 1).code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
    assert.equal(fs.existsSync(output), false);
    assert.equal(invoke(['recover', storage], 1).code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('CLI session compilers retain native/bootstrap parity and refuse artifact overwrite', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cli-compile-'));
  const native = path.join(directory, 'native.rbc'), bootstrap = path.join(directory, 'bootstrap.rbc');
  try {
    assert.equal(invoke(['compile', fixture, native]).compilerOwner, 'RCL');
    assert.equal(invoke(['compile', fixture, bootstrap, '--bootstrap']).compilerOwner, 'JavaScript bootstrap');
    assert.ok(fs.readFileSync(native).equals(fs.readFileSync(bootstrap)));
    const bytes = fs.readFileSync(native);
    assert.equal(invoke(['compile', fixture, native], 1).code, 'EEXIST');
    assert.ok(fs.readFileSync(native).equals(bytes));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
