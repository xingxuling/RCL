import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { semanticStateRootV2 } from '../src/canonical-f64.mjs';
import { materializeSemanticStateRootV2Candidate } from '../scripts/materialize-semantic-state-root-v2-vm-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CASES = [
  ['zero','0'],['negative-zero','-0'],['one-tenth','0.1'],['binary-rounding','0.30000000000000004'],
  ['fifteen-significant','1.23456789012345'],['seventeen-significant','1.2345678901234567'],
  ['max-safe-integer','9007199254740991'],['max-safe-minus-one','9007199254740990'],
  ['large-decimal','1234567890123456'],['small-decimal','0.000000000000001'],
];

function candidateCompiler() {
  const command = process.env.RCL_V2_CANDIDATE_CC || process.env.CC || 'cc';
  const name = path.basename(command).toLowerCase();
  return { command, isZig: name === 'zig' || name === 'zig.exe' };
}

function candidateCompilerAvailable() {
  const { command, isZig } = candidateCompiler();
  const probe = spawnSync(command, isZig ? ['version'] : ['--version'], { encoding:'utf8' });
  return !probe.error && (probe.status === 0 || (!isZig && probe.status === 2 && /cl\.exe$/iu.test(command)));
}

function buildCandidate(directory) {
  const c = path.join(directory, 'rclvm-v2.c');
  const bin = path.join(directory, process.platform === 'win32' ? 'rclvm-v2.exe' : 'rclvm-v2');
  fs.writeFileSync(c, materializeSemanticStateRootV2Candidate(), 'utf8');
  const { command, isZig } = candidateCompiler();
  const args = [
    ...(isZig ? ['cc'] : []),
    '-O2','-std=c11','-Wall','-Wextra','-Wpedantic','-I',path.join(ROOT,'native'),'-o',bin,c,
    ...(process.platform === 'win32' ? ['-lbcrypt','-lm'] : ['-lcrypto','-lm']),
  ];
  const build = spawnSync(command, args, { encoding:'utf8' });
  assert.equal(build.status, 0, build.stderr);
  return bin;
}

function runSourceCase(vm, directory, id, source, env = {}) {
  const rbc = path.join(directory, `${id}.rbc`);
  fs.writeFileSync(rbc, Buffer.from(compileRealityToBytecode(source)));
  const run = spawnSync(vm, [rbc], { encoding:'utf8', env:{...process.env,...env} });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

function runCase(vm, directory, id, literal, env = {}) {
  return runSourceCase(vm, directory, id, `reality NumberRootV2 { facet value : Number = ${literal} }`, env);
}

test('AI010/K333 materializer leaves default native v1 algorithm unchanged', { skip: !candidateCompilerAvailable() }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'rcl-state-root-v2-default-'));
  try {
    const vm = buildCandidate(directory);
    const payload = runCase(vm,directory,'default','0.1');
    assert.equal(payload.stateRootAlgorithm,'rcl.semantic-state-root.v1');
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

test('AI010/K333 candidate native VM closes the frozen 10-case number-root corpus under explicit v2 opt-in', { skip: !candidateCompilerAvailable() }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'rcl-state-root-v2-corpus-'));
  try {
    const vm = buildCandidate(directory);
    for (const [id,literal] of CASES) {
      const payload = runCase(vm,directory,id,literal,{RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2-candidate'});
      assert.equal(payload.stateRootAlgorithm,'rcl.semantic-state-root.v2-candidate',id);
      assert.equal(payload.stateRoot,semanticStateRootV2(payload.state),id);
    }
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

test('AI010/K333 v2 number-root candidate distinguishes adjacent max-safe integers that v1 collapsed', { skip: !candidateCompilerAvailable() }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'rcl-state-root-v2-adjacent-'));
  try {
    const vm = buildCandidate(directory);
    const a=runCase(vm,directory,'a','9007199254740991',{RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2-candidate'});
    const b=runCase(vm,directory,'b','9007199254740990',{RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2-candidate'});
    assert.notEqual(a.state.value,b.state.value);
    assert.notEqual(a.stateRoot,b.stateRoot);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

test('AI010/K333 candidate v2 is accepted by the ordinary native verification membrane when explicitly selected', { skip: !candidateCompilerAvailable() }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'rcl-state-root-v2-membrane-'));
  try {
    const vm = buildCandidate(directory);
    const source = 'reality NumberRootV2Membrane { facet value : Number = 9007199254740991 }';
    const result = runNativeBytecode(Buffer.from(compileRealityToBytecode(source)), {
      vmPath: vm,
      env: { RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2-candidate' },
      requireNativeStateRoot: true,
    });
    assert.equal(result.stateRootAlgorithm, 'rcl.semantic-state-root.v2-candidate');
    assert.equal(result.stateRootVerified, true);
    assert.equal(result.stateRootParity, true);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

test('AI010/K333 candidate v2 roots nested numeric sequences with one canonical representation', { skip: !candidateCompilerAvailable() }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'rcl-state-root-v2-structured-'));
  try {
    const vm = buildCandidate(directory);
    const source = `reality StructuredNumberRootV2 {
  reckon pair() -> Sequence = sequence_append(sequence_append(empty_sequence(), 0.1), 9007199254740991)
  facet values : Sequence = pair()
  facet ratio : Number = 0.00000001
}`;
    const payload = runSourceCase(vm, directory, 'structured', source, {
      RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2-candidate',
    });
    assert.equal(payload.stateRootAlgorithm, 'rcl.semantic-state-root.v2-candidate');
    assert.equal(payload.stateRoot, semanticStateRootV2(payload.state));
    assert.deepEqual(payload.state.values, [0.1, 9007199254740991]);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
