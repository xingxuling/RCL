import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evidenceRoot, UNIVERSAL_STRESS_GATES } from '../src/universal-program-stress.mjs';
import { semanticStateRootForAlgorithm } from '../src/semantic-state-root.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const semanticStateRootV2 = state => semanticStateRootForAlgorithm(state, 'rcl.semantic-state-root.v2');
const base = 'examples/universal-stress/expansion-wave1/';
const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, base + name), 'utf8'));

export function verifyPortableAlgorithmReceipt(records) {
  if (!records && !fs.existsSync(path.join(ROOT, base + 'algorithm-runtime.json'))) return { admitted: false, claims: [], reason: 'RUNTIME_RECEIPT_MISSING' };
  const contract = records?.contract ?? read('algorithm-contract.json'), report = records?.report ?? read('algorithm-runtime.json'), proposals = records?.proposals ?? read('algorithm-independent-proposals.json');
  const source = fs.readFileSync(path.join(ROOT, contract.sourcePath), 'utf8');
  assert.equal(evidenceRoot({ ...contract, contractRoot: undefined }), contract.contractRoot);
  assert.equal(evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined }), report.reportRoot);
  assert.equal(report.contractRoot, contract.contractRoot);
  assert.equal(proposals.contractRoot, contract.contractRoot);
  assert.deepEqual(contract.eligibleCells, ['K001', 'K002', 'K041', 'K042']);
  assert.deepEqual(report.eligibleCells, contract.eligibleCells);
  assert.equal(sha(source), report.sourceHash);
  assert.equal(report.sourceHash, contract.sourceHash);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, contract.compilerPath))), report.compilerHash);
  assert.equal(report.compilerHash, contract.compilerHash);
  for (const file of report.sourceBindings) assert.equal(sha(fs.readFileSync(path.join(ROOT, file.path))), file.sha256, file.path);
  assert.equal(report.status, 'PASS_LOCAL_WINDOWS_AND_WASM_WASI');
  assert.equal(report.rounds.length, contract.rounds);
  assert.equal(new Set(report.rounds.map(round => round.artifactHash)).size, 1);
  assert.equal(new Set(report.rounds.map(round => round.stateRoot)).size, 1);
  assert.equal(report.inputResults.length, 10);
  assert.equal(report.runtimeBindings.windows.platform, 'win32');
  assert.equal(report.runtimeBindings.windows.vmHash, sha(fs.readFileSync(path.join(ROOT, 'native/rclvm.exe'))));
  assert.equal(report.runtimeBindings.wasi.target, 'wasm32-wasi');
  const wasm = path.join(ROOT, 'native/wasi/rclvm.wasm');
  assert.equal(sha(fs.readFileSync(wasm)), report.runtimeBindings.wasi.wasmHash);
  for (const gate of UNIVERSAL_STRESS_GATES) assert.equal(report.gates[gate], 'PASS');
  assert.equal(report.negativeControls.malformedRejected, true);
  assert.equal(report.negativeControls.nativeCorruptRejected, true);
  assert.equal(report.negativeControls.wasiCorruptRejected, true);
  assert.equal(report.negativeControls.semanticMutationsDetected, 3);
  assert.ok(report.performance.compileP95Ms <= contract.performanceBudget.compileP95Ms);
  assert.ok(report.performance.windowsP95Ms <= contract.performanceBudget.executeP95Ms);
  assert.ok(report.performance.wasiP95Ms <= contract.performanceBudget.executeP95Ms);
  const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  for (const [field, metric] of [['compileMs', 'compileP95Ms'], ['windowsMs', 'windowsP95Ms'], ['wasiMs', 'wasiP95Ms']]) {
    assert.ok(report.rounds.every(round => Number.isFinite(round[field]) && round[field] >= 0));
    assert.equal(p95(report.rounds.map(round => round[field])), report.performance[metric]);
  }
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const oracle = ([a, b, n, sum]) => {
    let x = 0, y = 1, squares = 0;
    for (let index = 0; index < n; index++) [x, y] = [y, x + y];
    for (let index = 1; index <= sum; index++) squares += index * index;
    return { 'result.gcd': gcd(a, b), 'result.fibonacci': x, 'result.sum_squares': squares };
  };
  for (const row of [...report.rounds, ...report.inputResults]) {
    assert.equal(semanticStateRootV2(row.state), row.stateRoot);
    assert.equal(row.wasiStateRoot, row.stateRoot);
    for (const [name, value] of Object.entries(oracle(row.values ?? [1071, 462, 12, 24]))) assert.equal(row.state[name], value);
  }
  assert.equal(proposals.canonicalSourceProvided, false);
  assert.equal(proposals.oracleEditsProvided, false);
  assert.equal(proposals.osIsolationClaimed, false);
  assert.equal(proposals.trials.length, 3);
  const trials = report.independentGeneration.trials;
  assert.equal(trials.length, 3);
  assert.equal(new Set(trials.map(trial => trial.generatorContext)).size, 3);
  for (const trial of trials) {
    const input = proposals.trials.find(item => item.id === trial.id), frozen = contract.trials.find(item => item.id === trial.id);
    assert.deepEqual(trial.proposal, input.proposal);
    assert.equal(trial.generatorContext, input.generatorContext);
    assert.equal(trial.mutatedSourceHash, frozen.mutatedSourceHash);
    assert.equal(trial.candidateSourceHash, contract.sourceHash);
    assert.equal(trial.exactCanonicalRestoration && trial.windowsReplay && trial.wasiReplay, true);
    assert.equal(semanticStateRootV2(trial.repairedState), trial.stateRoot);
    assert.ok(Object.entries(oracle([1071, 462, 12, 24])).some(([name, value]) => trial.mutatedState[name] !== value));
    assert.equal(source.split(trial.proposal.new).length, 2);
    const mutated = source.replace(trial.proposal.new, trial.proposal.old);
    assert.equal(sha(mutated), frozen.mutatedSourceHash);
  }
  const ref = base + 'algorithm-runtime.json';
  return { admitted: true, reportRoot: report.reportRoot, eligibleCells: contract.eligibleCells,
    claims: ['wasm-vm', 'windows'].flatMap(environment => ['algorithm', 'cli'].map(programFamily => ({
      id: `${environment}::${programFamily}`, environment, programFamily, coverageMode: 'native-semantic',
      lastVerifiedDate: '2026-10-13',
      knownLimits: [contract.profile, 'Local source-bound replay; no hosted CI authority claimed.',
        'Independent generators used fresh proposal contexts with no tools requested; hardened OS isolation is not claimed.',
        'No interactive shell, public deployment, arbitrary algorithms, browser or Linux credit.'],
      changes: [], requiredGenes: ['portable-native-rbc-vm', 'root-v2', 'independent-repair-and-parametric-oracle'],
      gates: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, { status: 'PASS', evidence: [ref, base + 'algorithm-contract.json', base + 'algorithm-independent-proposals.json'],
        note: '20 process executions per backend, bootstrap parity, independent oracle, 10 parametric inputs and 3 independent repaired-source replays.' }])),
    }))) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyPortableAlgorithmReceipt(); console.log(JSON.stringify(result, null, 2));
  if (!result.admitted) process.exitCode = 1;
}
