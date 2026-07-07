import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  runSuperAgentRuntimeDemo,
  writeSuperAgentRuntimeReports,
  buildSuperAgentRuntimeSpec,
  renderSuperAgentRuntimeRcl,
} from '../src/super-agent-runtime.mjs';

test('v0.77 demo establishes RCL Super Agent Runtime', () => {
  const bundle = runSuperAgentRuntimeDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.rclSuperAgentRuntimeEstablished, true);
  assert.equal(bundle.result.agentSessionCount, 8);
  assert.equal(bundle.result.goalCompilerCount, 8);
  assert.equal(bundle.result.taskGraphCount, 8);
  assert.equal(bundle.result.simulationGateCount, 8);
  assert.equal(bundle.result.verificationCouncilHookCount, 8);
  assert.equal(bundle.result.governanceHookCount, 8);
  assert.equal(bundle.result.livingArtifactMemoryCount, 8);
  assert.equal(bundle.result.exePackagingHandoffReady, true);
  assert.equal(bundle.result.desktopExeAppHandoffReady, true);
  assert.equal(bundle.result.humanCommandConsoleReady, true);
  assert.ok(bundle.result.averageAgentReadiness >= 0.9);
});

test('v0.77 sessions contain goal compiler, task graph, tool plan, simulation, governance and memory', () => {
  const bundle = runSuperAgentRuntimeDemo();
  for (const session of bundle.sessions) {
    assert.equal(session.format, 'rcl.super-agent-session.v0.77');
    assert.ok(session.compiledGoal.compiledRoot.length >= 32);
    assert.equal(session.taskGraph.tasks.length, 8);
    assert.ok(session.toolPlan.tools.length >= 8);
    assert.equal(session.simulationGate.simulationBeforeAction, true);
    assert.equal(session.executionLoop.mode, 'human-gated-bounded-autonomy');
    assert.equal(session.verificationCouncilHook.memberCount, 6);
    assert.equal(session.governanceHook.humanFinalAuthority, true);
    assert.ok(session.livingArtifactMemory.evidenceContinuityRoot.length >= 32);
    assert.equal(session.humanCommandCard.requiresHumanApprovalBeforeExecution, true);
  }
});

test('v0.77 roadmap hands off to desktop EXE app shell', () => {
  const bundle = runSuperAgentRuntimeDemo();
  assert.equal(bundle.futurePlan.releases[0].version, 'v0.78');
  assert.equal(bundle.futurePlan.releases[0].module, 'RCL Desktop EXE App Shell');
  assert.equal(bundle.exePackagingHandoff.ready, true);
  assert.equal(bundle.exePackagingHandoff.target, 'windows-desktop-exe');
  assert.ok(bundle.exePackagingHandoff.recommendedShells.some((s) => s.name === 'Electron'));
});

test('v0.77 report writer creates super-agent and EXE handoff artifacts', () => {
  const outDir = path.resolve('output/test-v0.77-super-agent-runtime');
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeSuperAgentRuntimeReports(outDir, {});
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'super-agent-runtime-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'human-command-console.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'exe-packaging-handoff.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'session-docs')));
  const rcl = renderSuperAgentRuntimeRcl(buildSuperAgentRuntimeSpec());
  assert.match(rcl, /super_agent_runtime_v0_77/);
  assert.match(rcl, /RCL Desktop EXE App Shell/);
});
