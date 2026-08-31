import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RCLC = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclc.exe' : 'rclc');
const SPEC = path.join(ROOT, 'examples', 'universal-stress', 'k337-k338-compiler-governance-reactive.rcl');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function compilerSource() {
  return `${fs.readFileSync(path.join(ROOT, 'selfhost', 'compiler-core.rcl'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'selfhost', 'compiler-main.rcl'), 'utf8')}`;
}
function compileWith(candidateCompiler, source, directory, name) {
  const sourcePath = path.join(directory, `${name}.rcl`);
  const outputPath = path.join(directory, `${name}.rbc`);
  fs.writeFileSync(sourcePath, source, 'utf8');
  const run = spawnSync(RCLC, [candidateCompiler, sourcePath, outputPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { ...run, outputPath };
}

test('K337 self-host compiler rejects missing required warrant before RBC emission', { timeout: 90_000 }, () => {
  assert.equal(fs.existsSync(RCLC), true, 'native rclc is required for this compiler-semantic gate');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k337-static-warrant-'));
  try {
    const compilerRbc = path.join(directory, 'compiler-c0.rbc');
    fs.writeFileSync(compilerRbc, Buffer.from(compileRealityToBytecode(compilerSource())));
    const source = fs.readFileSync(SPEC, 'utf8');
    const invalid = source.replace('    warrant compiler.inspect on source\n', '');
    const result = compileWith(compilerRbc, invalid, directory, 'missing-warrant');

    assert.equal(result.status, 1);
    assert.equal(fs.existsSync(result.outputPath), false);
    assert.match(result.stderr, /RCL_SEMANTIC_ASSERT: authorize_candidate:maintainer:compiler\.inspect:source/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('K337 self-host warrant semantics preserve exact and hierarchical scope grants', { timeout: 90_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k337-static-warrant-scope-'));
  try {
    const compilerRbc = path.join(directory, 'compiler-c0.rbc');
    fs.writeFileSync(compilerRbc, Buffer.from(compileRealityToBytecode(compilerSource())));
    const source = fs.readFileSync(SPEC, 'utf8');

    const valid = compileWith(compilerRbc, source, directory, 'valid');
    assert.equal(valid.status, 0, valid.stderr);
    const validBytes = fs.readFileSync(valid.outputPath);
    assert.equal(sha256(validBytes), sha256(Buffer.from(compileRealityToBytecode(source))));

    const hierarchicalSource = source.replace(
      'need compiler.inspect on source',
      'need compiler.inspect on source.module',
    );
    const hierarchical = compileWith(compilerRbc, hierarchicalSource, directory, 'hierarchical');
    assert.equal(hierarchical.status, 0, hierarchical.stderr);
    assert.equal(fs.existsSync(hierarchical.outputPath), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
