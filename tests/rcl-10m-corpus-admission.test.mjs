import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import {
  RCL10M_CORPUS_MANIFEST_FORMAT,
  RCL10M_CORPUS_MANIFEST_STATUS,
  corpusManifestRoot,
  validateRcl10mCorpusManifest,
} from '../src/native-ai-corpus-admission.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'rcl-10m-corpus-admission-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'rcl-10m-corpus-admission-contract.v0.1.json');

function hash(label) {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

function manifest() {
  const tokenizerRoot = hash('development-tokenizer-root');
  const sources = ['zh', 'en', 'ja', 'code'].map((language, index) => ({
    id: `development-${language}`,
    language,
    domain: language === 'code' ? 'source-code' : 'natural-language',
    proportionPpm: 250000,
    sourceUri: `development://rcl10m/${language}`,
    sourceSha256: hash(`development-source-${language}`),
    byteCount: 100 + index,
    licenseReviewRef: `review://license/${language}`,
    privacyReviewRef: `review://privacy/${language}`,
    poisonReviewRef: `review://poison/${language}`,
  }));
  const candidate = {
    format: RCL10M_CORPUS_MANIFEST_FORMAT,
    status: RCL10M_CORPUS_MANIFEST_STATUS,
    canonicalOwner: 'RCL',
    manifestId: 'development-rcl10m-schema-fixture',
    targetTokens: 10000000,
    tokenizer: { id: 'development-bpe-with-byte-fallback', artifactRoot: tokenizerRoot, byteFallback: true },
    sources,
    filtering: {
      policyId: 'development-filter-policy',
      policyRoot: hash('development-filter-policy-root'),
      decisions: sources.map((source) => ({ sourceId: source.id, action: 'PENDING_USER_REVIEW' })),
    },
    deduplication: {
      algorithm: 'exact-source-sha256-plus-canonical-text-hash',
      version: 'development-v0.1',
      root: hash('development-dedup-root'),
    },
    shards: [{
      id: 'development-shard-000000',
      index: 0,
      sourceIds: sources.map((source) => source.id),
      tokenizerRoot,
      byteCount: 406,
      tokenCount: 10000000,
      tokenStreamSha256: hash('development-token-stream'),
      root: hash('development-shard-root'),
    }],
    admission: {
      license: 'PENDING_USER_REVIEW',
      privacy: 'PENDING_USER_REVIEW',
      poison: 'PENDING_USER_REVIEW',
      sourceBytesVerified: false,
      tokenStreamVerified: false,
    },
  };
  return { ...candidate, manifestRoot: corpusManifestRoot(candidate) };
}

test('RCL-10M corpus admission genome and contract are RCL-owned and schema-only', () => {
  const source = fs.readFileSync(GENOME, 'utf8');
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.ok(compileRealityToBytecode(source).length > 0);
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.status, RCL10M_CORPUS_MANIFEST_STATUS);
  assert.equal(contract.target.tokens, 10000000);
  assert.ok(contract.claimsNotGranted.includes('PRODUCTION_CORPUS_ADMISSION'));
});

test('complete manifest validates deterministically but remains blocked without user review and bytes', () => {
  const candidate = manifest();
  const first = validateRcl10mCorpusManifest(candidate);
  const second = validateRcl10mCorpusManifest(structuredClone(candidate));
  assert.equal(first.valid, true);
  assert.equal(first.ready, false);
  assert.equal(first.status, RCL10M_CORPUS_MANIFEST_STATUS);
  assert.deepEqual(first, second);
  assert.equal(first.expectedRoot, candidate.manifestRoot);
});

test('admitted status fails closed while review or artifact verification is pending', () => {
  const candidate = manifest();
  candidate.status = 'ADMITTED';
  candidate.manifestRoot = corpusManifestRoot(candidate);
  const result = validateRcl10mCorpusManifest(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'RCL10M_ADMISSION_NOT_READY'));
});

test('missing mixture, provenance and shard bindings fail closed', () => {
  const candidate = manifest();
  candidate.sources = candidate.sources.slice(0, 2);
  candidate.sources[0].sourceSha256 = 'sha256:bad';
  candidate.sources[1].proportionPpm = 1;
  candidate.shards[0].sourceIds = ['unknown-source'];
  candidate.manifestRoot = corpusManifestRoot(candidate);
  const result = validateRcl10mCorpusManifest(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'RCL10M_MIXTURE_COVERAGE'));
  assert.ok(result.errors.some((item) => item.code === 'RCL10M_HASH_REQUIRED'));
  assert.ok(result.errors.some((item) => item.code === 'RCL10M_SHARD_SOURCE_UNKNOWN'));
});

test('tampering with an otherwise valid manifest root fails closed', () => {
  const candidate = manifest();
  candidate.shards[0].tokenCount += 1;
  const result = validateRcl10mCorpusManifest(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'RCL10M_MANIFEST_ROOT'));
});
