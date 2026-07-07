import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  runUnknownFrameworkGapClosureDemo,
  runUnknownFrameworkGapClosure,
  buildUnknownFrameworkGapClosureSpec,
  writeUnknownFrameworkGapClosureReports,
  renderUnknownFrameworkGapClosureRcl,
} from '../src/unknown-framework-gap-closure-runtime.mjs';

test('v0.79 generates an unknown framework and gap closure runtime from existing RCL abilities', () => {
  const bundle = runUnknownFrameworkGapClosureDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.unknownFrameworkGenerated, true);
  assert.equal(bundle.result.frontierGapClosureRuntimeEstablished, true);
  assert.equal(bundle.result.weaknessLedgerCount, 8);
  assert.equal(bundle.result.unknownFrameworkOperatorCount, 8);
  assert.equal(bundle.result.providerUpgradeContractCount, 8);
  assert.equal(bundle.result.rclVsLargeModelWeaknessResolvedAtSystemLevel, true);
  assert.equal(bundle.result.rclDefaultStillNotFrontierParameterModel, true);
  assert.equal(bundle.result.apiRequiredForDefaultRun, false);
  assert.equal(bundle.result.largeMemoryRequiredForDefaultRun, false);
  assert.equal(bundle.result.truthfulBoundaryKept, true);
});

test('v0.79 uses existing unknown knowledge, universe knowledge, super agent and composite router evidence', () => {
  const bundle = runUnknownFrameworkGapClosureDemo();
  assert.equal(bundle.sourceEvidence.unknownKnowledge.ok, true);
  assert.ok(bundle.sourceEvidence.unknownKnowledge.promotedCount >= 3);
  assert.equal(bundle.sourceEvidence.universeKnowledge.universeKnowledgeRuntimeEstablished, true);
  assert.equal(bundle.sourceEvidence.superAgent.rclSuperAgentRuntimeEstablished, true);
  assert.equal(bundle.sourceEvidence.compositeRouter.compositeProviderRouterEstablished, true);
  assert.equal(bundle.sourceEvidence.compositeRouter.averageCapabilityCoverage, 1);
});

test('v0.79 gap ledger preserves the honest boundary while creating closure tasks', () => {
  const bundle = runUnknownFrameworkGapClosure(buildUnknownFrameworkGapClosureSpec());
  assert.equal(bundle.frontierGapLedger.length, 8);
  assert.ok(bundle.frontierGapLedger.every((g) => g.closureReadiness >= 0.88));
  assert.ok(bundle.frontierGapLedger.some((g) => g.honestBoundary.includes('does not become a frontier parameter model')));
  assert.equal(bundle.closureTasks.length, 8);
  assert.ok(bundle.closureTasks.every((t) => t.requiredProviders.length >= 1));
});

test('v0.79 provider upgrade contracts include frontier inheritance and specialist co-processors', () => {
  const bundle = runUnknownFrameworkGapClosureDemo();
  const ids = bundle.providerUpgradeContracts.map((p) => p.id);
  assert.ok(ids.includes('frontier_llm_provider'));
  assert.ok(ids.includes('symbolic_solver_provider'));
  assert.ok(ids.includes('code_execution_oracle_provider'));
  assert.ok(ids.includes('benchmark_evaluator_provider'));
  assert.ok(ids.includes('distillation_memory_provider'));
  assert.equal(bundle.result.frontierLlmInheritanceReady, true);
  assert.equal(bundle.result.specialistCoProcessorClosureReady, true);
});

test('v0.79 writes reports and renders RCL', () => {
  const outDir = path.join(os.tmpdir(), `rcl-unknown-framework-gap-closure-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeUnknownFrameworkGapClosureReports(outDir, {});
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'unknown-framework-gap-closure-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'unknown-capability-framework.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'frontier-gap-ledger.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'provider-upgrade-contracts.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'capability-victory-matrix.md')));
  const rcl = renderUnknownFrameworkGapClosureRcl({});
  assert.match(rcl, /unknown_framework_gap_closure_v0_79/);
  assert.match(rcl, /frontier-provider inheritance/);
  assert.match(rcl, /truthful_boundary/);
});
