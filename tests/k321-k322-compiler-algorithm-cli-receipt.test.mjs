import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { K321_K322_AI_GENERATION_MUTATIONS } from '../scripts/run-k321-k322-independent-ai-generation.mjs';
import { verifyK321K322CompilerAlgorithmCliCandidate } from '../scripts/verify-k321-k322-compiler-algorithm-cli-candidate.mjs';
import {
  verifyK321K322CompilerAlgorithmCliReceipt,
  verifyK321K322RuntimeEvidence,
} from '../scripts/verify-k321-k322-compiler-algorithm-cli-receipt.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k321-k322-compiler-algorithm-cli.rcl');
const RUNTIME_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k321-k322-compiler-algorithm-cli-runtime-v0.1.json');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K321/K322 receipt replays three independent sessions and binds the native runtime receipt', () => {
  const result = verifyK321K322CompilerAlgorithmCliReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.runtimeEvidenceAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K321', 'K322']);
  assert.equal(result.results.every((trial) => trial.successful), true);
});

test('all three K321/K322 semantic mutations are effective negative controls', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  for (const [trialId, mutation] of Object.entries(K321_K322_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-test-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, mutation.old, mutation.replacement), 'utf8');
      assert.equal(verifyK321K322CompilerAlgorithmCliCandidate({ sourcePath: candidatePath }).status, 'FAIL', trialId);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('runtime evidence fails closed when its rooted performance result is altered', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k321-k322-runtime-tamper-'));
  try {
    const tamperedPath = path.join(directory, 'runtime.json');
    const evidence = JSON.parse(fs.readFileSync(RUNTIME_EVIDENCE_PATH, 'utf8'));
    evidence.performance.compileP95Ms = evidence.performance.budget.compileP95MsMax + 1;
    fs.writeFileSync(tamperedPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    assert.throws(() => verifyK321K322RuntimeEvidence({ runtimeEvidencePath: tamperedPath }), /RCL_K321_K322_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
