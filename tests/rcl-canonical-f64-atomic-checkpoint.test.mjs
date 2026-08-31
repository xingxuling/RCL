import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { canonicalF64Hex, f64FromCanonicalHex, semanticStateCanonicalV2, semanticStateRootV2 } from '../src/canonical-f64.mjs';
import { createAtomicCheckpoint, exactF64Bits, verifyAtomicCheckpoint, writeAtomicCheckpoint } from '../src/atomic-checkpoint.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/\/tests$/u, '');
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64);

function compileNativeHelper(directory) {
  const source = path.join(ROOT, 'native', 'rcl_canonical_f64.c');
  const output = path.join(directory, process.platform === 'win32' ? 'rcl_canonical_f64.exe' : 'rcl_canonical_f64');
  const compiler = process.env.CC || (process.platform === 'win32' ? 'cc' : 'cc');
  const run = spawnSync(compiler, [source, '-O2', '-std=c11', '-o', output], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`RCL_CANONICAL_F64_NATIVE_BUILD_FAILED:${run.stderr}`);
  return output;
}

test('AI010/K333 canonical F64 hex is lexical-format independent and exact', () => {
  for (const [value, expected] of [
    [0, '0000000000000000'], [-0, '0000000000000000'], [1, '3ff0000000000000'],
    [0.1, '3fb999999999999a'], [1e-8, '3e45798ee2308c3a'], [Number.MIN_VALUE, '0000000000000001'],
  ]) {
    assert.equal(canonicalF64Hex(value), expected);
    assert.equal(Object.is(f64FromCanonicalHex(expected), -0), false);
    assert.equal(f64FromCanonicalHex(expected), Object.is(value, -0) ? 0 : value);
  }
  assert.equal(canonicalF64Hex(1e-8), canonicalF64Hex(0.00000001));
  assert.throws(() => canonicalF64Hex(Infinity), /RCL_CANONICAL_F64_FINITE_NUMBER_REQUIRED/u);
});

test('AI010/K333 C and JS canonical F64 primitives agree on scientific/edge corpus', { skip: process.platform === 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-f64-parity-'));
  try {
    const helper = compileNativeHelper(directory);
    const texts = ['1e-8','0.00000001','0.1','-0','5e-324','1.2345678901234567','9007199254740991'];
    const native = spawnSync(helper, texts, { encoding: 'utf8' });
    assert.equal(native.status, 0, native.stderr);
    const rows = native.stdout.trim().split(/\r?\n/u);
    assert.deepEqual(rows, texts.map((text) => canonicalF64Hex(Number(text))));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('candidate semantic-state-root v2 hashes exact number tags instead of JSON numeric spelling', () => {
  const a = { x: 1e-8, nested: [0.1, -0] };
  const b = { nested: [0.10000000000000001, 0], x: 0.00000001 };
  assert.equal(semanticStateCanonicalV2(a), semanticStateCanonicalV2(b));
  assert.equal(semanticStateRootV2(a), semanticStateRootV2(b));
  assert.match(semanticStateCanonicalV2(a), /\$rclF64/u);
});

test('AI006 checkpoint persists exact f64 bits and verifies rooted lineage', () => {
  const cp = createAtomicCheckpoint({
    checkpointId:'step-16',parentCheckpointRoot:A,modelRoot:B,optimizerRoot:C,tokenizerRoot:D,step:16,
    exactStorageBits:{w:exactF64Bits([0.1,1e-8,-0])},payload:{displayValues:[0.1,1e-8,0]},
  });
  assert.deepEqual(cp.exactStorageBits.w,['3fb999999999999a','3e45798ee2308c3a','0000000000000000']);
  assert.equal(verifyAtomicCheckpoint(cp).status,'VERIFIED');
  const tampered={...cp,step:17};
  assert.throws(()=>verifyAtomicCheckpoint(tampered),/RCL_CHECKPOINT_ROOT_MISMATCH/u);
});

test('AI006 atomic persistence uses same-directory temp + fsync + rename and leaves valid checkpoint', () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-atomic-checkpoint-'));
  try{
    const target=path.join(directory,'checkpoint.json');
    const first=createAtomicCheckpoint({checkpointId:'a',modelRoot:A,optimizerRoot:B,step:1,exactStorageBits:{w:exactF64Bits([1,2])}});
    const receipt=writeAtomicCheckpoint(target,first);
    assert.equal(receipt.atomicRenamePerformed,true);assert.equal(receipt.tempPathAbsentAfterCommit,true);
    assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).checkpointRoot,first.checkpointRoot);

    const staleTemp=path.join(directory,`.checkpoint.json.${'f'.repeat(64)}.tmp`);
    fs.writeFileSync(staleTemp,'incomplete');
    assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).checkpointRoot,first.checkpointRoot);
    fs.unlinkSync(staleTemp);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
