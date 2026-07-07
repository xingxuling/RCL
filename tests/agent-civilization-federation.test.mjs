
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runAgentCivilizationFederationDemo,
  runAgentCivilizationFederation,
  buildAgentCivilizationFederationSpec,
  renderAgentCivilizationFederationRcl,
  renderAgentCivilizationFederationWorkMethodMarkdown,
  writeAgentCivilizationFederationReports,
} from '../src/agent-civilization-federation.mjs';

test('v0.86 establishes a callable professional civilization federation', () => {
  const bundle = runAgentCivilizationFederationDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, '0.86.0-alpha.1');
  assert.equal(bundle.result.agentCivilizationFederationEstablished, true);
  assert.ok(bundle.result.professionalCivilizationCount >= 10);
  assert.equal(bundle.result.assistantCallable, true);
  assert.equal(bundle.result.productEmbeddingReady, true);
});

test('v0.86 forbids free civilization chatter and requires artifact handoff', () => {
  const bundle = runAgentCivilizationFederationDemo();
  assert.equal(bundle.result.civilizationTalkIsForbidden, true);
  assert.equal(bundle.result.artifactHandoffOnly, true);
  assert.ok(bundle.taskRoutes.every((entry) => entry.routes.every((route) => route.artifacts.length > 0 && route.handoffTo)));
});

test('v0.86 creates integration court and evidence ledger', () => {
  const bundle = runAgentCivilizationFederationDemo();
  assert.equal(bundle.integrationCourt.established, true);
  assert.equal(bundle.integrationCourt.verdict, 'passed_with_artifact_handoff_only');
  assert.equal(bundle.evidenceLedger.established, true);
  assert.match(bundle.canonicalRoot, /^[a-f0-9]{64}$/);
});

test('v0.86 supports custom task routing', () => {
  const bundle = runAgentCivilizationFederation({
    tasks: [{ id: 'custom', title: 'Custom', request: 'Design and test', requiredCivilizations: ['design_civilization', 'qa_verification_civilization'] }],
  });
  assert.equal(bundle.result.taskCount, 1);
  assert.equal(bundle.taskRoutes[0].routes.length, 2);
});

test('v0.86 writes federation reports and RCL program', () => {
  const outDir = path.join(os.tmpdir(), `rcl-v086-federation-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeAgentCivilizationFederationReports(outDir, buildAgentCivilizationFederationSpec());
  assert.equal(report.ok, true);
  for (const file of [
    'agent-civilization-federation-result.json',
    'agent-civilization-federation-bundle.json',
    'civilization-registry.md',
    'artifact-handoff-protocol.md',
    'integration-court-verdict.md',
    'federation-work-method.md',
    'agent-civilization-federation.rcl',
    'canonical-root.txt',
  ]) assert.ok(fs.existsSync(path.join(outDir, file)), file);
  assert.match(renderAgentCivilizationFederationRcl(), /AgentCivilizationFederationV086/);
  assert.match(renderAgentCivilizationFederationWorkMethodMarkdown(), /智能体文明/);
});
