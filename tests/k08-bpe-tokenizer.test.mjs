import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tokenizer-engine', 'Cargo.toml');
const ENGINE = path.join(
  ROOT,
  'native',
  'tokenizer-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-bpe-trainer.exe' : 'rcl-bpe-trainer',
);
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'bpe-tokenizer-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'bpe-tokenizer-contract.v0.1.json');
const REQUEST_FORMAT = 'rcl.bpe-tokenizer-request.v0.1';

const LINE = '现实 reality 日本語 function add(a,b){ return a+b; } // RCL model training🙂\n';
const CORPUS_TEXT = LINE.repeat(64) + '中文 English 日本語 code code code reality compiler language.\n'.repeat(32);

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-bpe-trainer'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_M_CARGO_BUILD_FAILED');
}

function executeRequest(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-m-request-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify({ format: REQUEST_FORMAT, ...request }));
  const run = spawnSync(ENGINE, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_M_EXECUTION_STATUS');
  return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim());
}

function makeWorkspace(prefix = 'rcl-k08-m-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    directory,
    corpusPath: path.join(directory, 'corpus.txt'),
    artifactPath: path.join(directory, 'tokenizer.json'),
    cleanup() { fs.rmSync(directory, { recursive: true, force: true }); },
  };
}

function trainArtifact(corpusText = CORPUS_TEXT, targetVocabularySize = 320, minimumFrequency = 2) {
  const workspace = makeWorkspace();
  fs.writeFileSync(workspace.corpusPath, corpusText, 'utf8');
  const result = executeRequest({
    operation: 'train',
    corpusPath: workspace.corpusPath,
    artifactPath: workspace.artifactPath,
    targetVocabularySize,
    minimumFrequency,
  });
  return { workspace, result, artifact: JSON.parse(fs.readFileSync(workspace.artifactPath, 'utf8')) };
}

let trained;

test.before(() => {
  buildEngine();
  trained = trainArtifact();
});

test.after(() => trained?.workspace.cleanup());

test('K08-M RCL BPE semantic genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-m-source-'));
  const rbcPath = path.join(directory, 'bpe-tokenizer.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(compiled.status, 'ok');
  const nativeRbc = fs.readFileSync(rbcPath);
  const bootstrapRbc = Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')));
  assert.equal(nativeRbc.equals(bootstrapRbc), true);
  const run = runNativeBytecode(rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    requireNativeStateRoot: true,
  });
  assert.equal(run.stateRootVerified, true);
  assert.equal(run.state['evaluation.target_320_valid'], true);
  assert.equal(run.state['evaluation.target_65536_valid'], true);
  assert.equal(run.state['evaluation.target_overflow_rejected'], true);
  assert.equal(run.state['evaluation.tie_break_correct'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-M deterministic trainer reaches the bounded target and reproduces identical artifact bytes', () => {
  assert.equal(trained.result.status, 'ok');
  assert.equal(trained.result.actualVocabularySize, 320);
  assert.equal(trained.result.completeTarget, true);
  assert.equal(trained.artifact.actualVocabularySize, 320);
  assert.equal(trained.artifact.merges.length, 61);
  assert.match(trained.artifact.artifactRoot, /^sha256:[0-9a-f]{64}$/);
  assert.match(trained.artifact.corpusSha256, /^sha256:[0-9a-f]{64}$/);

  const replay = trainArtifact();
  try {
    assert.equal(replay.result.artifactRoot, trained.result.artifactRoot);
    assert.deepEqual(fs.readFileSync(replay.workspace.artifactPath), fs.readFileSync(trained.workspace.artifactPath));
  } finally {
    replay.workspace.cleanup();
  }
});

test('K08-M frequency ties use the canonical lowest numeric pair ordering', () => {
  const tie = trainArtifact('ababcdcd\nababcdcd\n', 260, 2);
  try {
    assert.equal(tie.artifact.merges.length, 1);
    assert.deepEqual(
      { left: tie.artifact.merges[0].left, right: tie.artifact.merges[0].right },
      { left: 'a'.charCodeAt(0), right: 'b'.charCodeAt(0) },
    );
  } finally {
    tie.workspace.cleanup();
  }
});

test('K08-M trained artifact roundtrips mixed text and compresses its training-domain sample', () => {
  const sample = LINE.repeat(4);
  const encoded = executeRequest({ operation: 'encode', artifactPath: trained.workspace.artifactPath, text: sample });
  assert.ok(encoded.tokenCount < Buffer.byteLength(sample), `expected BPE compression: ${encoded.tokenCount} vs ${Buffer.byteLength(sample)}`);
  const decoded = executeRequest({ operation: 'decode', artifactPath: trained.workspace.artifactPath, tokens: encoded.tokens });
  assert.equal(decoded.text, sample);
  assert.equal(decoded.artifactRoot, encoded.artifactRoot);
});

test('K08-M byte fallback preserves unseen multilingual/code text exactly', () => {
  const unseen = '全新的句子 / unseen 日本語 / let π = 3.14159; 🚀\n';
  const encoded = executeRequest({ operation: 'encode', artifactPath: trained.workspace.artifactPath, text: unseen, addBos: true, addEos: true });
  assert.equal(encoded.tokens[0], 257);
  assert.equal(encoded.tokens.at(-1), 258);
  const decoded = executeRequest({ operation: 'decode', artifactPath: trained.workspace.artifactPath, tokens: encoded.tokens, allowSpecial: true });
  assert.equal(decoded.text, unseen);
});

test('K08-M tampered vocabulary artifacts and invalid training boundaries fail closed', () => {
  const tamperedPath = path.join(trained.workspace.directory, 'tampered.json');
  const tampered = structuredClone(trained.artifact);
  tampered.merges[0].frequency += 1;
  fs.writeFileSync(tamperedPath, JSON.stringify(tampered));
  assert.equal(executeRequest({ operation: 'encode', artifactPath: tamperedPath, text: 'test' }, false).code, 'RCL_BPE_ARTIFACT_ROOT');

  const invalidTarget = makeWorkspace('rcl-k08-m-invalid-target-');
  try {
    fs.writeFileSync(invalidTarget.corpusPath, 'abcabc', 'utf8');
    assert.equal(executeRequest({ operation: 'train', corpusPath: invalidTarget.corpusPath, artifactPath: invalidTarget.artifactPath, targetVocabularySize: 259, minimumFrequency: 2 }, false).code, 'RCL_BPE_TARGET_VOCAB');
    assert.equal(executeRequest({ operation: 'train', corpusPath: invalidTarget.corpusPath, artifactPath: invalidTarget.artifactPath, targetVocabularySize: 65537, minimumFrequency: 2 }, false).code, 'RCL_BPE_TARGET_VOCAB');
    assert.equal(executeRequest({ operation: 'train', corpusPath: invalidTarget.corpusPath, artifactPath: invalidTarget.artifactPath, targetVocabularySize: 300, minimumFrequency: 1 }, false).code, 'RCL_BPE_MIN_FREQUENCY');
  } finally {
    invalidTarget.cleanup();
  }

  const invalidUtf8 = makeWorkspace('rcl-k08-m-invalid-utf8-');
  try {
    fs.writeFileSync(invalidUtf8.corpusPath, Buffer.from([0xff, 0xfe]));
    assert.equal(executeRequest({ operation: 'train', corpusPath: invalidUtf8.corpusPath, artifactPath: invalidUtf8.artifactPath, targetVocabularySize: 300, minimumFrequency: 2 }, false).code, 'RCL_BPE_CORPUS_UTF8');
  } finally {
    invalidUtf8.cleanup();
  }
});

test('K08-M 64K target is a valid request boundary but remains unclaimed unless the artifact actually reaches it', { timeout: 180_000 }, () => {
  const probe = trainArtifact(LINE.repeat(8), 65536, 2);
  try {
    assert.equal(probe.artifact.targetVocabularySize, 65536);
    assert.ok(probe.artifact.actualVocabularySize < 65536);
    assert.equal(probe.artifact.completeTarget, false);
    assert.equal(probe.artifact.exhausted, true);
  } finally {
    probe.workspace.cleanup();
  }
});

test('K08-M contract grants the trainer/artifact only and keeps production 64K vocabulary and scale claims closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-m.bpe-tokenizer-contract.v0.1');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.ok(contract.claimsGrantedOnAdmission.includes('DETERMINISTIC_BYTE_BPE_TRAINER'));
  assert.ok(contract.claimsGrantedOnAdmission.includes('ROOTED_LEARNED_VOCABULARY_ARTIFACT'));
  assert.ok(contract.claimsGrantedOnAdmission.includes('BYTE_FALLBACK_BPE_ENCODING'));
  for (const claim of ['RCL_64K_VOCABULARY', 'PRODUCTION_TOKENIZER_QUALITY', 'PRODUCTION_CORPUS_ADMISSION', 'ROPE', 'MULTI_HEAD_ATTENTION', 'RCL_10M', 'GPU', 'RCL_1B_COMPLETE']) {
    assert.ok(contract.claimsNotGranted.includes(claim));
  }
});
