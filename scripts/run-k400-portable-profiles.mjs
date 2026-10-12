import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { createPortableNativeTarget } from '../src/portable-native-vm.mjs';
import { evidenceRoot, UNIVERSAL_STRESS_GATES } from '../src/universal-program-stress.mjs';
import { ROOT, PROFILE_DIRECTORY, PORTABLE_PROFILES, applyInputs, exactEdit } from './k400-portable-profile-definitions.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const matches = (state, expected) => Object.entries(expected).every(([name, value]) => equal(state[name], value));
const sourceBindings = ['src/portable-native-vm.mjs', 'scripts/run-k400-portable-profiles.mjs', 'scripts/k400-portable-profile-definitions.mjs',
  'scripts/run-native-wasi.mjs', 'scripts/build-native-linux.mjs', 'native/rclvm.c', 'native/rclvm.h', 'native/rclc.c',
  'native/semantic_state_v2.h', 'native/wasi-sha256.zig', 'native/wasi-compat/openssl/sha.h', 'native/wasi-compat/stdio-capture.c'];

export function runPortableProfile(profileId) {
  const definition = PORTABLE_PROFILES.find(profile => profile.id === profileId);
  assert.ok(definition, 'Unknown profile');
  const prefix = PROFILE_DIRECTORY + '/' + profileId;
  const contract = read(prefix + '-contract.json'), cases = read(contract.casesPath);
  const batchPath = PROFILE_DIRECTORY + '/independent-batch.json', batch = read(batchPath);
  const source = fs.readFileSync(path.join(ROOT, contract.sourcePath), 'utf8');
  assert.equal(evidenceRoot({ ...contract, contractRoot: undefined }), contract.contractRoot);
  assert.equal(contract.frozenBeforeIndependentTrials, true);
  assert.equal(sha(source), contract.sourceHash);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, contract.casesPath))), contract.casesHash);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, contract.compilerPath))), contract.compilerHash);
  assert.equal(new Set(batch.contexts.map(context => context.context)).size, 3);
  assert.equal(batch.canonicalSourceProvided || batch.oracleEditsProvided || batch.holdoutTestsProvided || batch.osIsolationClaimed, false);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-portable-profile-'));
  const targets = [];
  try {
    for (const environment of contract.environments) targets.push(createPortableNativeTarget(environment));
    const backendResults = {};
    function compile(target, text, name) {
      const input = path.join(temporary, target.environment + '-' + name + '.rcl');
      const output = input.replace(/\.rcl$/u, '.rbc'); fs.writeFileSync(input, text);
      const compilation = target.compile(input, output);
      assert.ok(compilation.bytecode.equals(compileRealityToBytecode(text)), 'Exact bootstrap parity: ' + target.environment);
      return { path: output, artifactHash: sha(compilation.bytecode), sourceHash: sha(text), sourceRoot: compileReality(text).programRoot, compileMs: compilation.ms };
    }
    function execute(target, artifact, expected) {
      const execution = target.execute(artifact.path, artifact.sourceRoot);
      assert.ok(matches(execution.result.state, expected), 'Independent oracle: ' + target.environment);
      return { sourceHash: artifact.sourceHash, sourceRoot: artifact.sourceRoot, artifactHash: artifact.artifactHash,
        state: execution.result.state, stateRoot: execution.result.stateRoot, compileMs: artifact.compileMs, executeMs: execution.ms };
    }
    for (const target of targets) {
      console.log(JSON.stringify({ status: 'TARGET_RUNNING', profileId, environment: target.environment }));
      const rounds = [], inputResults = [], independentTrials = [];
      const expected = definition.oracle(definition.baseline);
      for (let index = 0; index < contract.rounds; index++) {
        rounds.push({ index, ...execute(target, compile(target, source, 'round-' + index), expected) });
      }
      assert.equal(new Set(rounds.map(round => round.artifactHash)).size, 1);
      assert.equal(new Set(rounds.map(round => round.stateRoot)).size, 1);
      for (const item of cases) {
        assert.deepEqual(item.expected, definition.oracle(item.inputs));
        const variant = applyInputs(source, item.inputs); assert.equal(sha(variant), item.sourceHash);
        inputResults.push({ index: item.index, inputs: item.inputs, ...execute(target, compile(target, variant, 'case-' + item.index), item.expected) });
      }
      for (const frozen of contract.trials) {
        const context = batch.contexts.find(context => context.trialIndex === frozen.index);
        const proposal = context.response.find(proposal => proposal.id === profileId);
        const mutation = definition.mutations.find(mutation => mutation.id === frozen.id);
        const mutated = exactEdit(source, mutation.good, mutation.bad);
        assert.equal(sha(mutated), frozen.mutatedSourceHash);
        const brokenArtifact = compile(target, mutated, 'broken-' + frozen.id), broken = target.execute(brokenArtifact.path, brokenArtifact.sourceRoot);
        assert.ok(!matches(broken.result.state, expected), 'Mutation must alter observed target outputs');
        const repaired = exactEdit(mutated, proposal.old, proposal.new); assert.equal(repaired, source);
        independentTrials.push({ id: frozen.id, generatorContext: context.context, proposal,
          mutatedSourceHash: frozen.mutatedSourceHash, mutatedState: broken.result.state, mutatedStateRoot: broken.result.stateRoot,
          exactCanonicalRestoration: true, ...execute(target, compile(target, repaired, 'repair-' + frozen.id), expected) });
      }
      let malformedRejected = false, malformedDiagnostic = '';
      const malformed = path.join(temporary, target.environment + '-malformed.rcl'), malformedOutput = malformed + '.rbc';
      fs.writeFileSync(malformed, source.replace(/^reality /u, 'realty '));
      try { target.compile(malformed, malformedOutput); } catch (error) {
        malformedDiagnostic = error.message; malformedRejected = /COMPILE|compil|reality/iu.test(malformedDiagnostic);
      }
      assert.equal(malformedRejected, true, malformedDiagnostic);
      const corrupt = path.join(temporary, target.environment + '-corrupt.rbc'); fs.writeFileSync(corrupt, Buffer.from('RCLB'));
      let corruptRejected = false, corruptDiagnostic = '';
      try { target.execute(corrupt); } catch (error) { corruptDiagnostic = error.message; corruptRejected = /BYTECODE|bytecode|magic|truncat|header|binary/iu.test(corruptDiagnostic); }
      assert.equal(corruptRejected, true, corruptDiagnostic);
      const timing = { compileP95Ms: p95(rounds.map(round => round.compileMs)), executeP95Ms: p95(rounds.map(round => round.executeMs)) };
      assert.ok(timing.compileP95Ms <= contract.performanceBudget.compileP95Ms);
      assert.ok(timing.executeP95Ms <= contract.performanceBudget.executeP95Ms);
      backendResults[target.environment] = { binding: target.binding, rounds, inputResults, independentTrials,
        negativeControls: { malformedRejected, malformedDiagnostic, corruptRejected, corruptDiagnostic, semanticMutationsDetected: independentTrials.length },
        performance: timing, gates: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, 'PASS'])) };
      console.log(JSON.stringify({ status: 'TARGET_PASS', profileId, environment: target.environment, timing }));
    }
    const all = Object.values(backendResults);
    assert.equal(new Set(all.map(backend => backend.rounds[0].artifactHash)).size, 1);
    assert.equal(new Set(all.map(backend => backend.rounds[0].stateRoot)).size, 1);
    for (const index of cases.map(item => item.index)) assert.equal(new Set(all.map(backend => backend.inputResults[index].stateRoot)).size, 1);
    const report = { format: 'rcl.k400-portable-profile-runtime.v1', status: 'PASS_LOCAL_BOUND_TARGETS', id: profileId, generatedAt: new Date().toISOString(),
      contractRoot: contract.contractRoot, sourceHash: contract.sourceHash, compilerHash: contract.compilerHash, casesHash: contract.casesHash,
      eligibleCells: contract.eligibleCells, independentBatchPath: batchPath, independentBatchHash: sha(fs.readFileSync(path.join(ROOT, batchPath))),
      backendResults, sourceBindings: sourceBindings.map(file => ({ path: file, sha256: sha(fs.readFileSync(path.join(ROOT, file))) })),
      evidenceBoundary: contract.profile, osIsolationClaimed: false, hostedCi: 'NOT_RUN_USER_INSTRUCTION', reportRoot: null };
    report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
    fs.writeFileSync(path.join(ROOT, prefix + '-runtime.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: report.status, profileId, eligibleCells: contract.eligibleCells, reportRoot: report.reportRoot }));
    return report;
  } finally {
    for (const target of targets) target.dispose();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  for (const id of process.argv.slice(2).length ? process.argv.slice(2) : PORTABLE_PROFILES.map(profile => profile.id)) runPortableProfile(id);
}
