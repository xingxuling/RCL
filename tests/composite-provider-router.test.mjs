import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  runCompositeProviderRouterDemo,
  runCompositeProviderRouter,
  normalizeCompositeProviderRouterSpec,
  writeCompositeProviderRouterReports,
  renderCompositeProviderRouterRcl,
} from '../src/composite-provider-router.mjs';
import { runLlmLikeRuntimeDemo } from '../src/llm-like-runtime.mjs';

test('v0.78.1 establishes composite provider routing without API or large memory', () => {
  const bundle = runCompositeProviderRouterDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.compositeProviderRouterEstablished, true);
  assert.equal(bundle.result.routeCount, 8);
  assert.equal(bundle.result.compositeRouteCount, 8);
  assert.equal(bundle.result.multiProviderSessionCount, 8);
  assert.equal(bundle.result.apiRequiredForDefaultRun, false);
  assert.equal(bundle.result.largeMemoryRequiredForDefaultRun, false);
  assert.equal(bundle.result.desktopExeBrainRoutingReady, true);
  assert.equal(bundle.result.averageCapabilityCoverage, 1);
});

test('v0.78.1 desktop EXE copilot uses a real composite provider chain', () => {
  const bundle = runCompositeProviderRouterDemo();
  const desktopRoute = bundle.router.routes.find((r) => r.mode === 'desktop_exe_copilot');
  assert.ok(desktopRoute);
  assert.equal(desktopRoute.coverage, 1);
  assert.ok(desktopRoute.selectedProviderIds.includes('mock_llm_provider'));
  assert.ok(desktopRoute.selectedProviderIds.includes('super_agent_provider'));
  assert.ok(desktopRoute.selectedProviderIds.includes('tool_call_provider'));
  assert.ok(desktopRoute.selectedProviderIds.includes('semantic_memory_provider'));
  assert.ok(desktopRoute.selectedProviderIds.includes('rule_provider'));
  assert.equal(desktopRoute.routeKind, 'composite');
});

test('v0.78.1 produces pass diagnostics for all default routes', () => {
  const bundle = runCompositeProviderRouter(normalizeCompositeProviderRouterSpec());
  assert.equal(bundle.routeDiagnostics.length, 8);
  assert.equal(bundle.routeDiagnostics.every((d) => d.status === 'pass'), true);
  assert.equal(bundle.result.partialDiagnosticCount, 0);
});

test('v0.78.1 writes router reports and renders RCL', () => {
  const outDir = path.join(os.tmpdir(), `rcl-composite-provider-router-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeCompositeProviderRouterReports(outDir, {});
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'composite-provider-router-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'composite-provider-router.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'desktop-exe-brain-routing-plan.md')));
  const rcl = renderCompositeProviderRouterRcl({});
  assert.match(rcl, /composite_provider_router_v0_78_1/);
  assert.match(rcl, /capability-sharded/);
  assert.match(rcl, /RCL Desktop EXE App Shell/);
});

test('v0.78.1 integrates back into the LLM-like runtime bundle', () => {
  const llmBundle = runLlmLikeRuntimeDemo();
  assert.equal(llmBundle.result.llmLikeRuntimeEstablished, true);
  assert.equal(llmBundle.result.compositeProviderRoutingReady, true);
  assert.equal(llmBundle.result.desktopExeBrainRoutingReady, true);
  assert.equal(llmBundle.compositeProviderRouter.compositeRoutingEstablished, true);
});
