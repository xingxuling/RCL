import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { compileRealityToBytecode } from '../src/index.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RCLVM = path.join(PACKAGE_ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');

function assertCanonicalLf(bytes, label) {
  assert.ok(bytes.length > 1, `${label} must not be empty`);
  assert.equal(bytes.at(-1), 0x0a, `${label} must end in LF`);
  assert.notEqual(bytes.at(-2), 0x0d, `${label} must not be translated to CRLF`);
}

test('native CLI success output uses platform-independent LF bytes', () => {
  const source = fs.readFileSync(path.join(PACKAGE_ROOT, 'examples', 'hello-reality.rcl'), 'utf8');
  const temporary = path.join(os.tmpdir(), `rcl-native-canonical-output-${process.pid}-${Date.now()}.rbc`);
  fs.writeFileSync(temporary, compileRealityToBytecode(source));
  try {
    const result = spawnSync(RCLVM, [temporary], { encoding: null });
    assert.equal(result.status, 0, result.stderr.toString('utf8'));
    assertCanonicalLf(result.stdout, 'stdout');
    assert.equal(JSON.parse(result.stdout.toString('utf8')).status, 'ok');
  } finally {
    fs.rmSync(temporary, { force: true });
  }
});

test('native CLI error output uses platform-independent LF bytes', () => {
  const missing = path.join(os.tmpdir(), `rcl-native-canonical-output-missing-${process.pid}-${Date.now()}.rbc`);
  const result = spawnSync(RCLVM, [missing], { encoding: null });
  assert.equal(result.status, 1);
  assert.equal(result.stdout.length, 0);
  assertCanonicalLf(result.stderr, 'stderr');
  assert.equal(JSON.parse(result.stderr.toString('utf8')).status, 'error');
});
