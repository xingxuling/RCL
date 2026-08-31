#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
const RECEIPT_PATH = path.join(EVIDENCE_DIR, 'RCL_CREATIVE_PROPOSAL_FEDERATION_GATE_RECEIPT_v0.1.json');

const SOURCE_FILES = [
  'src/cognition.mjs',
  'src/planes.mjs',
  'src/creative-proposal-api.mjs',
  'federation/RCL_CREATIVE_PROPOSAL_FEDERATION_CONTRACT_v0.1.json',
  'docs/CREATIVE-PROPOSAL-LIFECYCLE-v0.1.md',
  'tests/creative-proposal-lifecycle.test.mjs',
  'tests/language.test.mjs',
  'scripts/build-creative-proposal-federation-gate.mjs',
];

const TESTS = [
  {
    id: 'creative-proposal-regressions',
    args: ['--test', '--test-concurrency=1', 'tests/creative-proposal-lifecycle.test.mjs'],
  },
  {
    id: 'existing-creative-reality-regressions',
    args: [
      '--test',
      '--test-concurrency=1',
      '--test-name-pattern=creative reality|natural language, understanding and creation|creative preserve',
      'tests/language.test.mjs',
    ],
  },
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Json(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(canonicalize(value)), 'utf8'));
}

function fileSha(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return sha256Bytes(fs.readFileSync(full));
}

function parseCount(text, label) {
  const match = text.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
  return match ? Number(match[1]) : null;
}

function runTest(spec) {
  const result = spawnSync(process.execPath, spec.args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    id: spec.id,
    command: [process.execPath, ...spec.args].join(' '),
    exit_code: result.status,
    signal: result.signal ?? null,
    tests: parseCount(output, 'tests'),
    pass: parseCount(output, 'pass'),
    fail: parseCount(output, 'fail'),
    ok: result.status === 0,
  };
}

const scope = Object.fromEntries(SOURCE_FILES.map(rel => [rel, fileSha(rel)]));
const missing = Object.entries(scope).filter(([, sha]) => sha == null).map(([rel]) => rel);
const tests = TESTS.map(runTest);
const status = missing.length === 0 && tests.every(item => item.ok) ? 'PASS' : 'FAIL';

const receiptCore = {
  format: 'rcl.creative-proposal-federation-gate.v0.1',
  status,
  gap: 'RCL_GAP_UNSCORED_EXTERNAL_CREATION_PROPOSAL',
  source_scope_sha256: scope,
  missing_source_files: missing,
  tests,
  proven: [
    'external candidate can remain unscored without fabricated evaluator dimensions',
    'all four scoring dimensions are required explicitly before conversion to scored Create<T>',
    'unscored proposal cannot be selected or used as confidence-bearing Creation evidence',
    'scored candidate preserves the pre-existing RCL Creative Reality score/selection semantics',
    'Creative Reality exposes proposals separately from scored/selected candidates',
    'existing creative-reality language regressions remain passing in the scoped reference runtime',
  ],
  not_proven: [
    'general imagination quality',
    'aesthetic judgment',
    'scientific truth',
    'future success probability',
    'artifact acceptance',
    'RNCS execution or commit',
    'public package-root export through src/index.mjs',
    'full native-VM regression suite in an environment with native binaries built',
  ],
  authority: {
    canonical_promotion_performed: false,
    rcl_evidence_commit_performed: false,
    rncs_commit_performed: false,
    candidate_generator_may_self_score: false,
  },
  promotion_gate: 'CANDIDATE_SEMANTIC_CLOSURE_ONLY',
};

const receipt = { ...receiptCore, receipt_root: sha256Json(receiptCore) };
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
process.exit(status === 'PASS' ? 0 : 1);
