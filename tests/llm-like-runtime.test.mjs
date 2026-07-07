import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  buildLlmLikeRuntimeSpec,
  runLlmLikeRuntime,
  runLlmLikeRuntimeDemo,
  writeLlmLikeRuntimeReports,
  renderLlmLikeRuntimeRcl,
  defaultLlmProviderContracts,
} from '../src/llm-like-runtime.mjs';

test('v0.78 default runtime establishes without API or large memory requirement', () => {
  const bundle = runLlmLikeRuntimeDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.llmLikeRuntimeEstablished, true);
  assert.equal(bundle.result.providerContractCount, 8);
  assert.equal(bundle.result.runtimeSessionCount, 8);
  assert.equal(bundle.result.apiRequiredForDefaultRun, false);
  assert.equal(bundle.result.largeMemoryRequiredForDefaultRun, false);
  assert.equal(bundle.result.mockProviderReady, true);
  assert.equal(bundle.result.rclKnowledgeProviderReady, true);
  assert.equal(bundle.result.superAgentAdapterReady, true);
  assert.equal(bundle.result.desktopExeHandoffReady, true);
  assert.ok(bundle.result.averageRuntimeReadiness >= 0.9);
});

test('v0.78 keeps cloud and local model providers as contracts, not hard dependencies', () => {
  const bundle = runLlmLikeRuntime(buildLlmLikeRuntimeSpec());
  const openai = bundle.providerContracts.find((p) => p.id === 'openai_compatible_provider');
  const ollama = bundle.providerContracts.find((p) => p.id === 'ollama_local_provider');
  assert.equal(openai.limits.requiresApiKey, true);
  assert.equal(openai.governance.defaultEnabled, false);
  assert.equal(ollama.limits.requiresLargeMemory, true);
  assert.equal(ollama.governance.defaultEnabled, false);
  assert.equal(bundle.providerRouter.defaultNeedsApi, false);
  assert.equal(bundle.providerRouter.defaultNeedsLargeMemory, false);
});

test('v0.78 sessions include prompt, context, semantic memory, tool formatter and self-check', () => {
  const bundle = runLlmLikeRuntimeDemo();
  for (const session of bundle.sessions) {
    assert.ok(session.promptFrame.frameRoot);
    assert.ok(session.contextWindow.contextRoot);
    assert.ok(session.semanticMemory.memoryRoot);
    assert.equal(session.toolFormatter.writeActionRequiresHumanAuthority, true);
    assert.ok(session.outputDecoder.decoderRoot);
    assert.ok(session.selfCheck.selfCheckRoot);
  }
});

test('v0.78 writes reports and renders RCL', () => {
  const outDir = path.join(os.tmpdir(), `rcl-llm-like-runtime-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeLlmLikeRuntimeReports(outDir, {});
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'llm-like-runtime-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'provider-contracts.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'provider-router.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'desktop-exe-handoff.md')));
  const rcl = renderLlmLikeRuntimeRcl(buildLlmLikeRuntimeSpec());
  assert.match(rcl, /llm_like_runtime_v0_78/);
  assert.match(rcl, /no-api/);
  assert.match(rcl, /RCL Desktop EXE App Shell/);
});

test('v0.78 provider catalog is deterministic and provider-contract shaped', () => {
  const providers = defaultLlmProviderContracts();
  assert.equal(providers.length, 8);
  assert.equal(providers.filter((p) => p.defaultEnabled).length, 6);
  assert.ok(providers.some((p) => p.id === 'tool_call_provider'));
  assert.ok(providers.some((p) => p.id === 'semantic_memory_provider'));
});
