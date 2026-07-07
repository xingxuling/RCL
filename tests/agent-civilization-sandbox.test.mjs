import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runAgentCivilizationSandboxDemo,
  runAgentCivilizationSandbox,
  buildAgentCivilizationSandboxSpec,
  renderAgentCivilizationSandboxRcl,
  renderAgentCivilizationWorkMethodMarkdown,
  writeAgentCivilizationSandboxReports,
} from '../src/agent-civilization-sandbox.mjs';

test('v0.82 establishes compressed hierarchical agent civilization sandbox', () => {
  const bundle = runAgentCivilizationSandboxDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, '0.82.0-alpha.1');
  assert.equal(bundle.result.agentCivilizationSandboxEstablished, true);
  assert.equal(bundle.result.cabinetCount, 7);
  assert.equal(bundle.result.departmentCount, 49);
  assert.equal(bundle.result.roleCellCount, 343);
  assert.equal(bundle.result.totalFewShotSamples, 1029);
  assert.equal(bundle.result.projectedWorkerEquivalent, 2401);
  assert.equal(bundle.result.compressedPopulationKept, true);
  assert.equal(bundle.result.noFlatGroupChat, true);
});

test('v0.82 reduces communication explosion through hierarchy', () => {
  const bundle = runAgentCivilizationSandboxDemo();
  assert.ok(bundle.result.flatCommunicationEdges > 50000);
  assert.ok(bundle.result.hierarchicalCommunicationEdges < 500);
  assert.ok(bundle.result.communicationReductionRatio > 0.99);
  assert.equal(bundle.hierarchy.noFlatGroupChat, true);
});

test('v0.82 compiles useful workload packages and virtual market cohorts', () => {
  const bundle = runAgentCivilizationSandboxDemo();
  assert.equal(bundle.result.workloadPackageCount, 7);
  assert.equal(bundle.result.citizenCohortCount, 14);
  assert.ok(bundle.workload.workPackages.every(w => w.usefulFileTarget.endsWith('.md')));
  assert.ok(bundle.workload.workPackages.every(w => w.acceptanceRule.length > 20));
  assert.ok(bundle.citizenCohorts.every(c => c.feedbackContract.includes('acceptance')));
});

test('v0.82 accelerates candidate futures without claiming full outer-model replacement', () => {
  const bundle = runAgentCivilizationSandboxDemo();
  assert.equal(bundle.result.acceleratedBranchCount, 12);
  assert.ok(bundle.result.promotedBranchCount >= 1);
  assert.ok(bundle.result.accelerationFactor >= 50);
  assert.ok(bundle.result.topAcceleratedBranch.includes('workload') || bundle.result.topAcceleratedBranch.includes('patch') || bundle.result.topAcceleratedBranch.includes('market'));
  assert.equal(bundle.result.canReplaceOuterModelCompletely, false);
  assert.equal(bundle.result.humanFinalAuthorityKept, true);
  assert.equal(bundle.result.noRemoteMutation, true);
});

test('v0.82 council and evidence ledger keep semantic guard boundaries', () => {
  const bundle = runAgentCivilizationSandboxDemo();
  assert.equal(bundle.result.councilPassed, true);
  assert.equal(bundle.result.semanticGuardPresent, true);
  assert.equal(bundle.result.rollbackRequired, true);
  assert.equal(bundle.result.evidenceLedgerWritten, true);
  assert.equal(bundle.evidenceLedger.recordCount, 6);
  assert.equal(typeof bundle.evidenceLedger.canonicalRoot, 'string');
  assert.equal(bundle.evidenceLedger.canonicalRoot.length, 64);
});

test('v0.82 writes reports, RCL handoff and work method file', () => {
  const outDir = path.join(os.tmpdir(), `rcl-agent-civilization-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeAgentCivilizationSandboxReports(outDir, buildAgentCivilizationSandboxSpec());
  assert.equal(report.ok, true);
  for (const file of [
    'agent-civilization-result.json',
    'agent-civilization-bundle.json',
    'hierarchy-summary.md',
    'workload-compiler.md',
    'virtual-market-simulation.md',
    'accelerated-future-simulation.md',
    'council-verdict.md',
    'evidence-ledger.md',
    'agent-civilization-work-method.md',
    'agent-civilization-sandbox.rcl',
    'canonical-root.txt',
  ]) {
    assert.ok(fs.existsSync(path.join(outDir, file)), file);
  }
  const rcl = renderAgentCivilizationSandboxRcl();
  assert.match(rcl, /AgentCivilizationSandboxV082/);
  assert.match(rcl, /PARA/);
  assert.match(rcl, /RECURSE/);
  const method = renderAgentCivilizationWorkMethodMarkdown();
  assert.match(method, /减少外层模型工作量/);
  assert.match(method, /343 个岗位格/);
});
