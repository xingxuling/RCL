import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRESS_STATUS } from '../src/universal-program-stress.mjs';
import { buildK02ClaimFromDirectEvidence } from '../src/universal-stress-k02-web-adapter.mjs';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const evidence=JSON.parse(fs.readFileSync(path.join(ROOT,'examples/universal-stress/k02-direct-evidence-2026-08-08.json'),'utf8'));

test('K02 remains blocked while AI_GENERATE is independently unverified',()=>{
  const claim=buildK02ClaimFromDirectEvidence(evidence);
  assert.equal(claim.status,STRESS_STATUS.BLOCKED);
  assert.equal(claim.gates.EXECUTE.status,STRESS_STATUS.PASS);
  assert.equal(claim.gates.AI_GENERATE.status,STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.coverageMode,'lowered-execution');
  assert.equal(claim.specialCaseAudit.status,STRESS_STATUS.PASS);
});

test('K02 becomes pass only when every gate has evidence',()=>{
  const complete=structuredClone(evidence);
  complete.gates.AI_GENERATE='PASS';
  const claim=buildK02ClaimFromDirectEvidence(complete);
  assert.equal(claim.status,STRESS_STATUS.PASS);
  assert.equal(claim.universalGrowthEligible,true);
});
