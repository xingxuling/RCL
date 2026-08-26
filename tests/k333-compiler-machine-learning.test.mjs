import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyK333CompilerMachineLearningCandidate } from '../scripts/verify-k333-compiler-machine-learning-candidate.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k333-compiler-machine-learning.rcl');
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k333-compiler-machine-learning-runtime-contract.v0.1.json');
const EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k333-compiler-machine-learning-runtime-v0.1.json');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K333 trains and executes an RCL-owned compiler advisory perceptron natively', () => {
  const result = verifyK333CompilerMachineLearningCandidate();
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.observed.parameters, [3, 1, -5]);
  assert.equal(result.observed.accuracy, 1);
  assert.equal(result.observed.recommendation, 'EXPENSIVE_OPTIMIZATION_CANDIDATE');
  assert.equal(result.observed.modelCommitGranted, false);
});

test('K333 semantic and authority mutations remain effective negative controls', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const mutations = [
    ['label', 'row(1, 1, 0)', 'row(1, 1, 1)'],
    ['update-sign', 'node_weight(parameters) + choose', 'node_weight(parameters) - choose'],
    ['zero-epochs', 'facet training.epochs : Number = 16', 'facet training.epochs : Number = 0'],
    ['model-authority', 'facet authority.model_commit_granted : Truth = false', 'facet authority.model_commit_granted : Truth = true'],
  ];
  for (const [name, oldText, newText] of mutations) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k333-${name}-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, oldText, newText), 'utf8');
      assert.equal(verifyK333CompilerMachineLearningCandidate({ sourcePath: candidatePath }).status, 'FAIL', name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K333 checked-in runtime evidence is rooted and remains candidate-only', () => {
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
  assert.deepEqual(evidence.eligibleCells, ['K333']);
  assert.match(evidence.evidenceBoundary, /can admit only K333/u);
});
