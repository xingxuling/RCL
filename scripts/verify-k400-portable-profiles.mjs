import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { semanticStateRootForAlgorithm } from '../src/semantic-state-root.mjs';
import { evidenceRoot, campaignCellIdFor, UNIVERSAL_STRESS_GATES } from '../src/universal-program-stress.mjs';
import { ROOT, PROFILE_DIRECTORY, PORTABLE_PROFILES, applyInputs, exactEdit } from './k400-portable-profile-definitions.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const semanticRoot = state => semanticStateRootForAlgorithm(state, 'rcl.semantic-state-root.v2');
const matches = (state, expected) => Object.entries(expected).every(([name, value]) => JSON.stringify(state[name]) === JSON.stringify(value));
const requiredSourceFiles = ['src/portable-native-vm.mjs', 'scripts/run-k400-portable-profiles.mjs', 'scripts/k400-portable-profile-definitions.mjs',
  'scripts/run-native-wasi.mjs', 'scripts/build-native-linux.mjs', 'native/rclvm.c', 'native/rclvm.h', 'native/rclc.c',
  'native/semantic_state_v2.h', 'native/wasi-sha256.zig', 'native/wasi-compat/openssl/sha.h', 'native/wasi-compat/stdio-capture.c'];

export function verifyPortableProfileReceipt(id, records) {
  const profile = PORTABLE_PROFILES.find(profile => profile.id === id); assert.ok(profile);
  const prefix = PROFILE_DIRECTORY + '/' + id;
  if (!records && !fs.existsSync(path.join(ROOT, prefix + '-runtime.json'))) return { admitted: false, claims: [], reason: 'RUNTIME_RECEIPT_MISSING', id };
  const contract = records?.contract ?? read(prefix + '-contract.json'), report = records?.report ?? read(prefix + '-runtime.json');
  const cases = records?.cases ?? read(contract.casesPath), batch = records?.batch ?? read(report.independentBatchPath);
  const source = fs.readFileSync(path.join(ROOT, contract.sourcePath), 'utf8');
  assert.equal(contract.format, 'rcl.k400-portable-profile-contract.v1');
  assert.equal(report.format, 'rcl.k400-portable-profile-runtime.v1');
  assert.equal(contract.id, id); assert.equal(report.id, id);
  assert.equal(evidenceRoot({ ...contract, contractRoot: undefined }), contract.contractRoot);
  assert.equal(evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined }), report.reportRoot);
  assert.equal(report.contractRoot, contract.contractRoot);
  assert.equal(report.status, 'PASS_LOCAL_BOUND_TARGETS');
  assert.equal(contract.frozenBeforeIndependentTrials, true);
  assert.equal(sha(source), contract.sourceHash); assert.equal(report.sourceHash, contract.sourceHash);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, contract.compilerPath))), contract.compilerHash); assert.equal(report.compilerHash, contract.compilerHash);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, contract.casesPath))), contract.casesHash); assert.equal(report.casesHash, contract.casesHash);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, report.independentBatchPath))), report.independentBatchHash);
  assert.deepEqual(batch, read(report.independentBatchPath));
  assert.deepEqual(cases, read(contract.casesPath));
  assert.deepEqual(contract.environments, profile.environments);
  assert.deepEqual(contract.families, profile.families);
  const eligible = profile.environments.flatMap(environment => profile.families.map(family => campaignCellIdFor(environment, family)));
  assert.deepEqual(contract.eligibleCells, eligible); assert.deepEqual(report.eligibleCells, eligible);
  assert.deepEqual(Object.keys(report.backendResults), profile.environments);
  assert.equal(batch.canonicalSourceProvided || batch.oracleEditsProvided || batch.holdoutTestsProvided || batch.osIsolationClaimed, false);
  assert.equal(batch.contexts.length, 3); assert.equal(new Set(batch.contexts.map(context => context.context)).size, 3);
  assert.deepEqual(report.sourceBindings.map(item => item.path), requiredSourceFiles);
  for (const item of report.sourceBindings) assert.equal(sha(fs.readFileSync(path.join(ROOT, item.path))), item.sha256, item.path);
  const canonicalArtifact = sha(compileRealityToBytecode(source)), canonicalProgramRoot = compileReality(source).programRoot;
  const variants = cases.map(item => {
    const text = applyInputs(source, item.inputs); assert.equal(sha(text), item.sourceHash); assert.deepEqual(item.expected, profile.oracle(item.inputs));
    return { ...item, artifactHash: sha(compileRealityToBytecode(text)), sourceRoot: compileReality(text).programRoot };
  });
  function verifyRow(row, expected, artifactHash, sourceHash, sourceRoot) {
    assert.equal(row.artifactHash, artifactHash); assert.equal(row.sourceHash, sourceHash); assert.equal(row.sourceRoot, sourceRoot);
    assert.equal(row.stateRoot, semanticRoot(row.state)); assert.ok(matches(row.state, expected));
    assert.ok(Number.isFinite(row.compileMs) && row.compileMs >= 0); assert.ok(Number.isFinite(row.executeMs) && row.executeMs >= 0);
  }
  for (const [environment, backend] of Object.entries(report.backendResults)) {
    const expectedBinary = environment === 'wasm-vm' ? 'native/wasi/rclvm.wasm' : environment === 'windows' ? 'native/rclvm.exe' : 'native/linux/rclvm';
    const expectedCompiler = ['windows', 'wasm-vm'].includes(environment) ? 'native/rclc.exe' : 'native/linux/rclc';
    assert.equal(backend.binding.binary.path, expectedBinary); assert.equal(backend.binding.compilerBinary.path, expectedCompiler);
    for (const file of [backend.binding.binary, backend.binding.compilerBinary, backend.binding.compilerArtifact]) assert.equal(sha(fs.readFileSync(path.join(ROOT, file.path))), file.sha256);
    assert.equal(backend.binding.compilerArtifact.sha256, contract.compilerHash);
    if (environment === 'linux') assert.ok(/^Linux .* x86_64$/u.test(backend.binding.identity));
    if (environment === 'android') {
      assert.equal(backend.binding.os, 'Android'); assert.equal(backend.binding.arch, 'x86_64'); assert.equal(backend.binding.emulator, true);
      assert.equal(backend.binding.physicalDeviceClaimed, false); assert.equal(backend.binding.mobileUiClaimed, false);
    }
    if (environment === 'windows') assert.equal(backend.binding.os, 'win32');
    if (environment === 'wasm-vm') { assert.equal(backend.binding.os, 'WASI'); assert.equal(backend.binding.arch, 'wasm32'); }
    assert.equal(backend.rounds.length, contract.rounds);
    assert.deepEqual(backend.rounds.map(round => round.index), Array.from({ length: contract.rounds }, (_, index) => index));
    assert.equal(new Set(backend.rounds.map(round => round.stateRoot)).size, 1);
    for (const row of backend.rounds) verifyRow(row, profile.oracle(profile.baseline), canonicalArtifact, contract.sourceHash, canonicalProgramRoot);
    assert.equal(backend.inputResults.length, variants.length);
    for (const item of variants) {
      const row = backend.inputResults[item.index]; assert.equal(row.index, item.index); assert.deepEqual(row.inputs, item.inputs);
      verifyRow(row, item.expected, item.artifactHash, item.sourceHash, item.sourceRoot);
    }
    assert.equal(backend.independentTrials.length, 3);
    assert.equal(new Set(backend.independentTrials.map(trial => trial.generatorContext)).size, 3);
    for (const frozen of contract.trials) {
      const trial = backend.independentTrials.find(trial => trial.id === frozen.id), mutation = profile.mutations.find(mutation => mutation.id === frozen.id);
      const mutated = exactEdit(source, mutation.good, mutation.bad); assert.equal(sha(mutated), frozen.mutatedSourceHash);
      const context = batch.contexts.find(context => context.trialIndex === frozen.index), proposal = context.response.find(item => item.id === id);
      assert.deepEqual(trial.proposal, proposal); assert.equal(trial.generatorContext, context.context);
      assert.equal(proposal.file, 'candidate.rcl'); assert.equal(exactEdit(mutated, proposal.old, proposal.new), source);
      assert.equal(trial.exactCanonicalRestoration, true); assert.equal(trial.mutatedSourceHash, frozen.mutatedSourceHash);
      assert.equal(trial.mutatedStateRoot, semanticRoot(trial.mutatedState)); assert.ok(!matches(trial.mutatedState, profile.oracle(profile.baseline)));
      verifyRow(trial, profile.oracle(profile.baseline), canonicalArtifact, contract.sourceHash, canonicalProgramRoot);
    }
    for (const [field, name] of [['compileMs', 'compileP95Ms'], ['executeMs', 'executeP95Ms']]) {
      assert.equal(backend.performance[name], p95(backend.rounds.map(row => row[field])));
      assert.ok(backend.performance[name] <= contract.performanceBudget[name]);
    }
    assert.equal(backend.negativeControls.malformedRejected, true); assert.equal(backend.negativeControls.corruptRejected, true);
    assert.equal(backend.negativeControls.semanticMutationsDetected, 3);
    for (const gate of UNIVERSAL_STRESS_GATES) assert.equal(backend.gates[gate], 'PASS');
  }
  const backends = Object.values(report.backendResults);
  assert.equal(new Set(backends.map(backend => backend.rounds[0].stateRoot)).size, 1);
  for (const item of variants) assert.equal(new Set(backends.map(backend => backend.inputResults[item.index].stateRoot)).size, 1);
  const refs = [prefix + '-runtime.json', prefix + '-contract.json', contract.casesPath, report.independentBatchPath];
  return { admitted: true, id, reportRoot: report.reportRoot, eligibleCells: eligible,
    claims: profile.environments.flatMap(environment => profile.families.map(programFamily => ({
      id: `${environment}::${programFamily}`, environment, programFamily, coverageMode: 'native-semantic', lastVerifiedDate: '2026-10-13', changes: [],
      knownLimits: [contract.profile, '20 target rounds and 10 pre-sealed parametric cases; three fresh candidate-only repair contexts replayed on every credited target.',
        'Linux is real WSL2 execution; Android is x86_64 emulator native execution with no mobile UI/physical-device credit.',
        'WASI compiles on the Windows host and executes WebAssembly; Linux/Android also compile on their actual targets. No new hosted CI or secure OS sandbox is claimed.'],
      requiredGenes: ['portable-native-rbc-vm', 'root-v2', 'target-selfhost-compile-or-host-compile-explicit', 'pre-sealed-oracles', 'independent-exact-repair'],
      gates: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, { status: 'PASS', evidence: refs,
        note: 'Actual bound target execution, exact RBC parity, independent numerical/relational oracles, negative controls and source/binary-bound proposal replay.' }])),
    }))) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  for (const id of process.argv.slice(2).length ? process.argv.slice(2) : PORTABLE_PROFILES.map(profile => profile.id)) {
    const result = verifyPortableProfileReceipt(id);
    console.log(JSON.stringify({ admitted: result.admitted, id, eligibleCells: result.eligibleCells, reportRoot: result.reportRoot, reason: result.reason }));
    if (!result.admitted) process.exitCode = 1;
  }
}
