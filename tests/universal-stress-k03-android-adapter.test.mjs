import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRESS_STATUS } from '../src/universal-program-stress.mjs';
import { buildK03ClaimFromDirectEvidence, summarizeK03Blockers } from '../src/universal-stress-k03-android-adapter.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/universal-stress/k03-direct-evidence-2026-08-08.json'), 'utf8'));

test('K03 remains blocked while Android build/runtime and AI generation are unverified', () => {
  const claim = buildK03ClaimFromDirectEvidence(evidence);
  assert.equal(claim.id, 'android::mobile');
  assert.equal(claim.status, STRESS_STATUS.BLOCKED);
  assert.equal(claim.gates.COMPILE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.gates.AI_GENERATE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.coverageMode, 'lowered-execution');
  assert.equal(claim.specialCaseAudit.status, STRESS_STATUS.PASS);
  assert.deepEqual(summarizeK03Blockers(evidence), ['ANDROID_BUILD_NOT_VERIFIED', 'ANDROID_RUNTIME_NOT_VERIFIED', 'AI_GENERATE_UNVERIFIED']);
});

test('K03 can become a pass only after all nine gates are evidenced', () => {
  const complete = structuredClone(evidence);
  complete.gates = Object.fromEntries(Object.keys(complete.gates).map((gate) => [gate, 'PASS']));
  complete.android.build.status = 'BUILT';
  complete.android.runtime.status = 'EXECUTED';
  const claim = buildK03ClaimFromDirectEvidence(complete);
  assert.equal(claim.status, STRESS_STATUS.PASS);
  assert.equal(claim.universalGrowthEligible, true);
});
