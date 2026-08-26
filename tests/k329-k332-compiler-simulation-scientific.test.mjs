import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyK329K332CompilerSimulationScientificCandidate } from '../scripts/verify-k329-k332-compiler-simulation-scientific-candidate.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k329-k332-compiler-simulation-scientific.rcl');
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k329-k332-compiler-simulation-scientific-runtime-contract.v0.1.json');
const EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k329-k332-compiler-simulation-scientific-runtime-v0.1.json');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K329/K332 executes a native RCL simulation with an independent scientific oracle', () => {
  const result = verifyK329K332CompilerSimulationScientificCandidate();
  assert.equal(result.status, 'PASS');
  assert.equal(result.observed.position, 120);
  assert.equal(result.observed.velocity, 23);
  assert.deepEqual(result.observed.trajectory, [0, 3, 8, 15, 24, 35, 48, 63, 80, 99, 120]);
  assert.equal(result.observed.oraclePosition, 120);
  assert.equal(result.observed.oracleVelocity, 23);
});

test('K329/K332 simulation, scientific and boundary mutations remain effective', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const mutations = [
    ['position', 'make_state(\n      state_position(state) + state_velocity(state),', 'make_state(\n      state_position(state) + acceleration,'],
    ['velocity', 'state_velocity(state) + acceleration,', 'state_velocity(state) - acceleration,'],
    ['oracle', 'acceleration * steps * (steps - 1) / 2', 'acceleration * steps * (steps + 1) / 2'],
    ['zero-step', 'choose(completed >= steps,', 'choose(completed > steps,'],
  ];
  for (const [name, oldText, newText] of mutations) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k329-k332-${name}-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, oldText, newText), 'utf8');
      assert.equal(verifyK329K332CompilerSimulationScientificCandidate({ sourcePath: candidatePath }).status, 'FAIL', name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K329/K332 runtime evidence is rooted and candidate-only', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  assert.equal(evidence.contractRoot, evidenceRoot(contract));
  assert.equal(evidence.reportRoot, evidenceRoot({ ...evidence, generatedAt: undefined, reportRoot: undefined }));
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.summary.successfulRounds, 20);
  assert.equal(evidence.summary.uniqueStateRoots, 1);
  assert.equal(evidence.summary.uniqueArtifactHashes, 1);
  assert.equal(evidence.summary.controlsPassed, true);
  assert.equal(evidence.summary.performancePassed, true);
  assert.deepEqual(evidence.eligibleCells, ['K329', 'K332']);
});
