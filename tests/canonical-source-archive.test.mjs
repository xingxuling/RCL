import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  readCanonicalCompilerArtifact,
  readCanonicalCompilerSourcePair,
} from '../src/canonical-source-archive.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k337-k338-compiler-governance-reactive-runtime-contract.v0.1.json');
const SOURCE_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k01-ai-generation-contract.v0.2.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('canonical compiler artifact resolves the frozen historical binary after live evolution', () => {
  const contract = readJson(RUNTIME_CONTRACT_PATH);
  const artifact = readCanonicalCompilerArtifact(contract);
  assert.equal(artifact.sourceMode, 'archive');
  assert.equal(artifact.sha256, contract.canonical.compilerRbcSha256);
  assert.equal(sha256File(artifact.path), contract.canonical.compilerRbcSha256);
  assert.equal(artifact.sourceCommit, '07109ade4394056286df0f6593b9eba4f2dbecb9');
});

test('canonical compiler artifact prefers a matching live binary', () => {
  const contract = readJson(RUNTIME_CONTRACT_PATH);
  const livePath = path.join(ROOT, contract.canonical.compilerRbcPath);
  const liveHash = sha256File(livePath);
  const liveContract = {
    ...contract,
    canonical: { ...contract.canonical, compilerRbcSha256: liveHash },
  };
  const artifact = readCanonicalCompilerArtifact(liveContract);
  assert.equal(artifact.sourceMode, 'live');
  assert.equal(artifact.path, livePath);
  assert.equal(artifact.sha256, liveHash);
  assert.equal(artifact.archiveId, null);
});

test('canonical compiler artifact rejects an unbound historical hash', () => {
  const contract = readJson(RUNTIME_CONTRACT_PATH);
  const invalid = {
    ...contract,
    canonical: { ...contract.canonical, compilerRbcSha256: '0'.repeat(64) },
  };
  assert.throws(
    () => readCanonicalCompilerArtifact(invalid),
    /RCL_CANONICAL_COMPILER_ARTIFACT_ARCHIVE_MISSING/u,
  );
});

test('source archive behavior remains unchanged for frozen compiler source pairs', () => {
  const contract = readJson(SOURCE_CONTRACT_PATH);
  const pair = readCanonicalCompilerSourcePair(contract);
  assert.ok(['live', 'archive'].includes(pair.sourceMode));
  assert.equal(crypto.createHash('sha256').update(pair.files['candidate-core.rcl']).digest('hex'), contract.canonical.coreSha256);
  assert.equal(crypto.createHash('sha256').update(pair.files['candidate-main.rcl']).digest('hex'), contract.canonical.mainSha256);
});
