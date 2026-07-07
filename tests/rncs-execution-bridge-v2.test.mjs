import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  RCL_RNCS_EXECUTION_BRIDGE_V2_RESULT_FORMAT,
  RCL_RNCS_EXECUTION_PLAN_FORMAT,
  RCL_RNCS_PROVIDER_CONTRACT_FORMAT,
  evaluateRncsExecutionBridgeV2,
  runRncsExecutionBridgeV2,
  renderRncsExecutionBridgeV2Rcl,
  writeRncsExecutionBridgeV2Reports,
} from '../src/rncs-execution-bridge-v2.mjs';

const cwd = path.resolve(new URL('..', import.meta.url).pathname);
function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.63 converts civilization technology nodes into RNCS execution plans', () => {
  const evaluation = evaluateRncsExecutionBridgeV2();
  assert.equal(evaluation.result.format, RCL_RNCS_EXECUTION_BRIDGE_V2_RESULT_FORMAT);
  assert.equal(evaluation.result.rncsExecutionBridgeV2Established, true);
  assert.ok(evaluation.plans.length >= 8);
  assert.ok(evaluation.plans.every(plan => plan.format === RCL_RNCS_EXECUTION_PLAN_FORMAT));
  assert.ok(evaluation.providerContracts.every(contract => contract.format === RCL_RNCS_PROVIDER_CONTRACT_FORMAT));
});

test('v0.63 builds authorization, WAL, crash recovery and evidence writeback', () => {
  const bundle = runRncsExecutionBridgeV2();
  assert.equal(bundle.rncsExecutionBridgeV2Established, true);
  assert.ok(bundle.plans.every(plan => plan.authorizationBoundary.humanAuthorityRequired));
  assert.ok(bundle.plans.every(plan => plan.walEntries.length >= plan.actions.length));
  assert.ok(bundle.plans.every(plan => plan.crashRecoveryPlan.checkpointCount === plan.walEntries.length));
  assert.ok(bundle.plans.every(plan => plan.evidenceWriteback.targetLedgers.includes('rncs.event-log')));
  assert.equal(bundle.bridgeScores.averageBridgeScore, 1);
});

test('v0.63 renders RCL surface and technical documents', () => {
  const bundle = runRncsExecutionBridgeV2();
  assert.ok(bundle.documents.length >= 9);
  assert.match(bundle.documents[0].markdown, /RNCS Execution Bridge v2/);
  assert.match(bundle.documents[0].markdown, /Provider Contracts/);
  const rcl = renderRncsExecutionBridgeV2Rcl();
  assert.match(rcl, /reality RncsExecutionBridgeV2/);
  assert.match(rcl, /validation.established : Truth = true/);
});

test('v0.63 CLI writes RNCS execution bridge reports', () => {
  const dir = tempDir('rncs-execution-bridge-v2');
  const reports = writeRncsExecutionBridgeV2Reports(dir);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'rncs-execution-bridge-v2-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'rncs-execution-plans.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'provider-contracts.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'rncs-execution-docs')).length >= 9);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'rncs-execution-bridge-v2-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.rncsExecutionBridgeV2Established, true);
});
