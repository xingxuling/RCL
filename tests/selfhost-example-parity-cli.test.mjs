import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = path.join(root, 'scripts/verify-selfhost-example-parity.mjs');
const run = args => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-parity-cli-'));

test('selected source aliases reuse actual native byte evidence without overwriting the full report', () => {
  const directory = temporary();
  try {
    const first = path.join(directory, 'one.rcl'), alias = path.join(directory, 'alias.rcl'), other = path.join(directory, 'other.rcl'), report = path.join(directory, 'report.json');
    const source = 'reality Small { facet value : Number = 1 }';
    fs.writeFileSync(first, source); fs.writeFileSync(alias, source); fs.writeFileSync(other, source.replace('= 1', '= 2'));
    const full = path.join(root, 'output/selfhost/example-parity.json'), before = fs.existsSync(full) ? fs.readFileSync(full) : null;
    const result = run(['--source', first, '--source', alias, '--source', other, '--report', report]);
    assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(fs.readFileSync(report));
    assert.equal(value.ok, true); assert.equal(value.artifactParity, true);
    assert.equal(value.scope, 'explicit-selected-sources'); assert.equal(value.requestedSourceCount, 3);
    assert.equal(value.eligibleCount, 3); assert.equal(value.nativeCompileAttempts, 2); assert.equal(value.avoidedDuplicateCompiles, 1);
    assert.equal(value.compilerTimeoutMs, 60000); assert.equal(value.budgetProfile, 'original-60-second-target-budget');
    assert.equal(value.eligible.filter(item => item.evidenceReused).length, 1);
    assert.ok(value.eligible.filter(item => item.sourceSha256 === crypto.createHash('sha256').update(source).digest('hex')).every(item => item.bytes === compileRealityToBytecode(source).length));
    if (before) assert.deepEqual(fs.readFileSync(full), before);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('explicit timeout overrides retain a separate profile and observed original-budget result', () => {
  const directory = temporary();
  try {
    const input = path.join(directory, 'one.rcl'), report = path.join(directory, 'override.json');
    fs.writeFileSync(input, 'reality Small { facet value : Number = 1 }');
    const result = run(['--source', input, '--report', report, '--compiler-timeout-ms', '300000']);
    assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(fs.readFileSync(report));
    assert.equal(value.compilerTimeoutMs, 300000); assert.equal(value.budgetProfile, 'explicit-override-not-original-target-budget');
    assert.equal(value.originalBudgetSatisfied, true); assert.equal(value.nativeCompileAttempts, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('bad compiler artifacts fail the bootstrap-byte gate before any native source dispatch', () => {
  const directory = temporary();
  try {
    const input = path.join(directory, 'one.rcl'), report = path.join(directory, 'bad.json'), compiler = path.join(directory, 'compiler.rbc');
    fs.writeFileSync(input, 'reality Small { facet value : Number = 1 }'); fs.writeFileSync(compiler, 'invalid');
    const result = run(['--source', input, '--report', report, '--compiler-artifact', compiler]);
    assert.equal(result.status, 1);
    const value = JSON.parse(fs.readFileSync(report));
    assert.equal(value.artifactParity, false); assert.equal(value.nativeCompileAttempts, 0); assert.equal(value.eligibleCount, 0);
    assert.equal(value.failures[0].code, 'RCL_SELFHOST_ARTIFACT_PARITY_REQUIRED');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('invalid CLI selection and budget flags reject before writing reports', () => {
  const directory = temporary();
  try {
    const report = path.join(directory, 'absent.json');
    for (const flags of [['--unknown', 'value'], ['--compiler-timeout-ms', 'NaN'], ['--compiler-timeout-ms', '0'], ['--compiler-timeout-ms', '1', '--compiler-timeout-ms', '2'], ['--source']]) {
      const result = run(['--report', report, ...flags]); assert.equal(result.status, 1); assert.equal(fs.existsSync(report), false);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
