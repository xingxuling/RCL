import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  runSelfUpgradeTeamSandboxDemo,
  runSelfUpgradeTeamSandbox,
  buildSelfUpgradeTeamSandboxSpec,
  renderSelfUpgradeTeamSandboxRcl,
  renderSelfUpgradeWorkMethodMarkdown,
  writeSelfUpgradeTeamSandboxReports,
} from '../src/self-upgrade-team-sandbox.mjs';

test('v0.80 establishes a bounded multi-agent self-upgrade team sandbox', () => {
  const bundle = runSelfUpgradeTeamSandboxDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.selfUpgradeTeamSandboxEstablished, true);
  assert.equal(bundle.result.agentCount, 7);
  assert.equal(bundle.result.totalFewShotSamples, 21);
  assert.equal(bundle.result.acceleratedBranchCount, 9);
  assert.ok(bundle.result.promotedBranchCount >= 3);
  assert.ok(bundle.result.patchPlanFileCount >= 8);
  assert.equal(bundle.result.semanticGuardPresent, true);
  assert.equal(bundle.result.evidenceLedgerWritten, true);
  assert.equal(bundle.result.rollbackPlanPresent, true);
  assert.equal(bundle.result.humanFinalAuthorityKept, true);
  assert.equal(bundle.result.noExternalWriteByDefault, true);
  assert.equal(bundle.result.canReplaceOuterModelCompletely, false);
  assert.equal(bundle.result.truthfulBoundaryKept, true);
});

test('v0.80 agents use exactly three samples as role routers and produce useful outputs', () => {
  const bundle = runSelfUpgradeTeamSandbox({});
  const ids = bundle.agents.map(a => a.id);
  assert.deepEqual(ids, [
    'version_strategist',
    'source_cartographer',
    'runtime_engineer',
    'test_forger',
    'evidence_keeper',
    'semantic_guard',
    'release_packager',
  ]);
  for (const agent of bundle.agents) {
    assert.equal(agent.sampleCount, 3);
    assert.ok(agent.usefulOutputs.length >= 2);
    assert.match(agent.workMode, /few-shot-role-routing/);
  }
});

test('v0.80 branch acceleration ranks candidate futures without claiming real-world time travel', () => {
  const bundle = runSelfUpgradeTeamSandboxDemo();
  assert.ok(bundle.acceleratedBranches.length >= 8);
  assert.ok(bundle.acceleratedBranches.some(b => b.goal === 'self_upgrade_team_sandbox_seed'));
  assert.ok(bundle.acceleratedBranches.every(b => b.simulatedTimeline.realWorldMinutesAvoidedClaim === true));
  assert.ok(bundle.acceleratedBranches.every(b => b.requiredGuards.includes('human_final_authority')));
  assert.ok(bundle.selectedBranches.every(b => b.verdict === 'promote-to-patch-plan'));
});

test('v0.80 patch plan and test plan preserve executable handoff boundaries', () => {
  const bundle = runSelfUpgradeTeamSandboxDemo();
  const paths = bundle.patchPlan.files.map(f => f.path);
  assert.ok(paths.includes('src/self-upgrade-team-sandbox.mjs'));
  assert.ok(paths.includes('tests/self-upgrade-team-sandbox.test.mjs'));
  assert.ok(paths.includes('src/cli.mjs'));
  assert.ok(paths.includes('src/index.mjs'));
  assert.ok(paths.includes('RCL_SELF_UPGRADE_TEAM_WORK_METHOD_v0.80.md'));
  assert.ok(bundle.patchPlan.rollbackPlan.length >= 3);
  assert.ok(bundle.patchPlan.humanAuthorityRequiredBefore.includes('git push'));
  assert.ok(bundle.testPlan.commands.some(c => c.includes('self-upgrade-team-demo')));
  assert.equal(bundle.releaseVerdict.ready, true);
  assert.match(bundle.releaseVerdict.externalExecutionBoundary, /outer execution environment/);
});

test('v0.80 writes reports and renders RCL plus project work method', () => {
  const outDir = path.join(os.tmpdir(), `rcl-self-upgrade-team-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeSelfUpgradeTeamSandboxReports(outDir, {});
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'self-upgrade-team-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'agent-roster.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'branch-simulation.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'patch-plan.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'test-plan.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'evidence-ledger.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'release-verdict.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'self-upgrade-team-sandbox.rcl')));
  assert.ok(fs.existsSync(path.join(outDir, 'RCL_SELF_UPGRADE_TEAM_WORK_METHOD_v0.80.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'canonical-root.txt')));
  const rcl = renderSelfUpgradeTeamSandboxRcl(buildSelfUpgradeTeamSandboxSpec());
  assert.match(rcl, /SelfUpgradeTeamSandboxV080/);
  assert.match(rcl, /semantic_guard/);
  assert.match(rcl, /human_final_authority/);
  const workMethod = renderSelfUpgradeWorkMethodMarkdown();
  assert.match(workMethod, /RCL 自升级团队工作法 v0\.80/);
  assert.match(workMethod, /减少外层模型/);
});
