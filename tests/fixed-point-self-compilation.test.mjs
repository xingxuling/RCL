import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  bootstrapCompilerStage9,
  DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N_PATH,
  DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N1_PATH,
} from '../src/index.mjs';

function assertFixedPoint(report) {
  assert.equal(report.stage, 'fixed-point-self-compilation-v0.19');
  assert.equal(report.byteIdenticalArtifactFixedPoint, true);
  assert.equal(report.semanticFixedPoint, true);
  assert.equal(report.artifactNSha256, report.artifactN1Sha256);
  assert.deepEqual(report.signatureN, report.signatureN1);
  assert.equal(report.signatureN.program, 'RCLCompilerStage9FixedPoint');
  assert.equal(report.signatureN.supported, true);
}

test('Stage-9 proves byte-identical compiler artifact fixed point', () => {
  const report = bootstrapCompilerStage9();
  assertFixedPoint(report);
  assert.equal(fs.existsSync(DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N_PATH), true);
  assert.equal(fs.existsSync(DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N1_PATH), true);
  const n = fs.readFileSync(DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N_PATH);
  const n1 = fs.readFileSync(DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N1_PATH);
  assert.deepEqual(n, n1);
  assert.equal(n.length, report.artifactBytes);
});

test('Stage-9 semantic self-signature is stable over repeated native runs', () => {
  const first = bootstrapCompilerStage9({ write: false });
  const second = bootstrapCompilerStage9({ write: false });
  assertFixedPoint(first);
  assertFixedPoint(second);
  assert.equal(first.root, second.root);
  assert.deepEqual(first.signatureN, second.signatureN);
});

test('rcl bootstrap9 CLI reports fixed-point self-compilation witness', () => {
  const out = execFileSync('node', ['src/cli.mjs', 'bootstrap9'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  const report = JSON.parse(out);
  assertFixedPoint(report);
  assert.equal(report.artifactBytes > 0, true);
});
