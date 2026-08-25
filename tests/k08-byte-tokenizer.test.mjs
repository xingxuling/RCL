import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  process.platform === 'win32' ? 'rcl-tokenizer-engine.exe' : 'rcl-tokenizer-engine',
);
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'byte-tokenizer-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'byte-tokenizer-contract.v0.1.json');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--manifest-path', MANIFEST], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_L_CARGO_BUILD_FAILED');
}

function executeRequest(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-l-request-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, ['execute', requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_L_EXECUTION_STATUS');
  const payload = expectSuccess ? run.stdout : run.stderr;
  return JSON.parse(payload.trim());
}

function encode(text, options = {}) {
  return executeRequest({
    format: 'rcl.byte-tokenizer-request.v0.1',
    operation: 'encode',
    text,
    addBos: options.addBos ?? false,
    addEos: options.addEos ?? false,
  });
}

function decode(tokens, allowSpecial = false, expectSuccess = true) {
  return executeRequest({
    format: 'rcl.byte-tokenizer-request.v0.1',
    operation: 'decode',
    tokens,
    allowSpecial,
  }, expectSuccess);
}

function describe() {
  const run = spawnSync(ENGINE, ['describe'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_L_DESCRIBE_FAILED');
  return JSON.parse(run.stdout.trim());
}

function encodeFile(sourceBytes, { addBos = false, addEos = false } = {}, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-l-file-'));
  const source = path.join(directory, 'source.txt');
  const tokenFile = path.join(directory, 'tokens.bin');
  const receiptFile = path.join(directory, 'receipt.json');
  fs.writeFileSync(source, sourceBytes);
  const args = ['encode-file', source, tokenFile, receiptFile];
  if (addBos) args.push('--bos');
  if (addEos) args.push('--eos');
  const run = spawnSync(ENGINE, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if ((run.status === 0) !== expectSuccess) {
    const message = run.stderr || run.stdout || 'RCL_K08_L_ENCODE_FILE_STATUS';
    fs.rmSync(directory, { recursive: true, force: true });
    throw new Error(message);
  }
  if (!expectSuccess) {
    const error = JSON.parse(run.stderr.trim());
    fs.rmSync(directory, { recursive: true, force: true });
    return error;
  }
  const tokenBytes = fs.readFileSync(tokenFile);
  const receiptBytes = fs.readFileSync(receiptFile);
  const result = {
    stdout: JSON.parse(run.stdout.trim()),
    tokenBytes,
    receiptBytes,
    receipt: JSON.parse(receiptBytes.toString('utf8')),
  };
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

function u32le(buffer) {
  assert.equal(buffer.length % 4, 0);
  return Array.from({ length: buffer.length / 4 }, (_, index) => buffer.readUInt32LE(index * 4));
}

let description;

test.before(() => {
  buildEngine();
  description = describe();
});

test('K08-L RCL Byte Tokenizer Genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-l-source-'));
  const rbcPath = path.join(directory, 'byte-tokenizer.rbc');
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
  assert.equal(run.state['evaluation.ascii_a_identity'], true);
  assert.equal(run.state['evaluation.specials_valid'], true);
  assert.equal(run.state['evaluation.out_of_range_rejected'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-L byte IDs exactly match UTF-8 for ASCII, Chinese, Japanese and emoji', () => {
  assert.deepEqual(encode('A').tokens, [65]);
  assert.deepEqual(encode('中').tokens, [228, 184, 173]);
  assert.deepEqual(encode('日').tokens, [230, 151, 165]);
  assert.deepEqual(encode('🙂').tokens, [240, 159, 153, 130]);
});

test('K08-L mixed Chinese English Japanese code corpus roundtrips losslessly', () => {
  const text = '现实 RCL 日本語 const answer = 42; // 代码🙂\n';
  const encoded = encode(text);
  assert.deepEqual(encoded.tokens, [...Buffer.from(text, 'utf8')]);
  assert.equal(encoded.byteCount, Buffer.byteLength(text));
  assert.equal(encoded.tokenCount, Buffer.byteLength(text));
  const decoded = decode(encoded.tokens);
  assert.equal(decoded.text, text);
  assert.equal(decoded.byteCount, Buffer.byteLength(text));
  assert.equal(encoded.tokenizerRoot, decoded.tokenizerRoot);
});

test('K08-L normalization NONE preserves distinct Unicode byte realities', () => {
  const composed = 'é';
  const decomposed = 'e\u0301';
  const left = encode(composed);
  const right = encode(decomposed);
  assert.notDeepEqual(left.tokens, right.tokens);
  assert.deepEqual(left.tokens, [195, 169]);
  assert.deepEqual(right.tokens, [101, 204, 129]);
  assert.equal(decode(left.tokens).text, composed);
  assert.equal(decode(right.tokens).text, decomposed);
  assert.equal(left.normalization, 'NONE');
  assert.equal(right.normalization, 'NONE');
});

test('K08-L BOS/EOS are explicit and decoding special tokens is permissioned', () => {
  const encoded = encode('A', { addBos: true, addEos: true });
  assert.deepEqual(encoded.tokens, [257, 65, 258]);
  assert.equal(decode(encoded.tokens, true).text, 'A');
  assert.equal(decode(encoded.tokens, false, false).code, 'RCL_TOKENIZER_SPECIAL_TOKEN');
});

test('K08-L invalid token range and invalid UTF-8 byte sequence fail closed', () => {
  assert.equal(decode([259], false, false).code, 'RCL_TOKENIZER_TOKEN_RANGE');
  assert.equal(decode([255], false, false).code, 'RCL_TOKENIZER_INVALID_UTF8');
  const badSource = encodeFile(Buffer.from([0xff, 0xfe]), {}, false);
  assert.equal(badSource.code, 'RCL_TOKENIZER_SOURCE_UTF8');
});

test('K08-L tokenizer artifact identity is deterministic and frozen', () => {
  const again = describe();
  assert.equal(description.tokenizerId, 'rcl.byte-tokenizer.utf8.v0.1');
  assert.equal(description.tokenizerRoot, again.tokenizerRoot);
  assert.equal(description.normalization, 'NONE');
  assert.deepEqual(description.specialTokens, { bos: 257, eos: 258, pad: 256 });
  assert.equal(description.vocabSize, 259);
  assert.equal(description.tokenStreamEncoding, 'u32-le');
  assert.equal(encode('identity').tokenizerRoot, description.tokenizerRoot);
});

test('K08-L governed token-stream file roots source bytes and u32-le token bytes deterministically', () => {
  const text = '中文 / English / 日本語 / function f(x){return x+1;}\n';
  const source = Buffer.from(text, 'utf8');
  const first = encodeFile(source, { addBos: true, addEos: true });
  const second = encodeFile(source, { addBos: true, addEos: true });
  assert.deepEqual(first.tokenBytes, second.tokenBytes);
  assert.deepEqual(first.receipt, second.receipt);
  assert.deepEqual(u32le(first.tokenBytes), [257, ...source, 258]);
  assert.equal(first.receipt.sourceSha256, `sha256:${sha256(source)}`);
  assert.equal(first.receipt.tokenStreamSha256, `sha256:${sha256(first.tokenBytes)}`);
  assert.equal(first.receipt.tokenizerRoot, description.tokenizerRoot);
  assert.equal(first.receipt.normalization, 'NONE');
  assert.equal(first.receipt.tokenStreamEncoding, 'u32-le');
  assert.equal(first.receipt.byteCount, source.length);
  assert.equal(first.receipt.tokenCount, source.length + 2);
  assert.match(first.receipt.receiptRoot, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(first.stdout, first.receipt);
});

test('K08-L contract grants byte substrate only and keeps final 64K tokenizer / scale claims closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-l.byte-tokenizer-contract.v0.1');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.ok(contract.claimsGrantedOnAdmission.includes('LOSSLESS_UTF8_BYTE_TOKENIZER_SUBSTRATE'));
  assert.ok(contract.claimsGrantedOnAdmission.includes('GOVERNED_U32_TOKEN_STREAM_ARTIFACT'));
  for (const claim of ['BPE', 'RCL_64K_VOCABULARY', 'TOKENIZER_TRAINING', 'ROPE', 'MULTI_HEAD_ATTENTION', 'RCL_10M', 'GPU', 'RCL_1B_COMPLETE']) {
    assert.ok(contract.claimsNotGranted.includes(claim));
  }
});
