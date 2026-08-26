import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { K337_K338_AI_GENERATION_MUTATIONS } from '../scripts/run-k337-k338-independent-ai-generation.mjs';
import { verifyK337K338CompilerGovernanceReactiveCandidate } from '../scripts/verify-k337-k338-compiler-governance-reactive-candidate.mjs';
import {
  verifyK337K338CompilerGovernanceReactiveReceipt,
  verifyK337K338RuntimeEvidence,
} from '../scripts/verify-k337-k338-compiler-governance-reactive-receipt.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k337-k338-compiler-governance-reactive.rcl');
const RUNTIME_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k337-k338-compiler-governance-reactive-runtime-v0.1.json');
const AUTHORITY_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k337-k338-compiler-governance-reactive-ai-generate', 'github-replay.json');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K337/K338 receipt replays three independent sessions and binds native runtime evidence', () => {
  const result = verifyK337K338CompilerGovernanceReactiveReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.runtimeEvidenceAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K337', 'K338']);
  assert.equal(result.results.every((trial) => trial.successful), true);
  if (fs.existsSync(AUTHORITY_PATH)) {
    assert.equal(result.aiGenerateAdmission, 'PASS');
    assert.equal(result.githubAuthority.admitted, true);
    assert.match(result.githubAuthority.authorityRoot, /^[0-9a-f]{64}$/u);
  } else {
    assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
    assert.equal(result.githubAuthority.admitted, false);
  }
});

test('all three K337/K338 semantic mutations are effective native negative controls', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  for (const [trialId, mutation] of Object.entries(K337_K338_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-test-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, mutation.old, mutation.replacement), 'utf8');
      assert.equal(verifyK337K338CompilerGovernanceReactiveCandidate({ sourcePath: candidatePath }).status, 'FAIL', trialId);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K337/K338 runtime evidence fails closed after rooted negative-control tampering', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k337-k338-runtime-tamper-'));
  try {
    const tamperedPath = path.join(directory, 'runtime.json');
    const evidence = JSON.parse(fs.readFileSync(RUNTIME_EVIDENCE_PATH, 'utf8'));
    evidence.negativeControls.missingWarrantRejected = false;
    fs.writeFileSync(tamperedPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    assert.throws(() => verifyK337K338RuntimeEvidence({ runtimeEvidencePath: tamperedPath }), /RCL_K337_K338_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
