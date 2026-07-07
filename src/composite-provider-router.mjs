import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  buildLlmLikeRuntimeSpec,
  buildCompositeProviderRouter,
  runLlmLikeRuntime,
  readLlmLikeRuntimeInput,
  renderLlmLikeRuntimeRcl,
} from './llm-like-runtime.mjs';

export const RCL_COMPOSITE_PROVIDER_ROUTER_VERSION = '0.78.1-alpha.1';
export const RCL_COMPOSITE_PROVIDER_ROUTER_SPEC_FORMAT = 'rcl.composite-provider-router-spec.v0.78.1';
export const RCL_COMPOSITE_PROVIDER_ROUTER_RESULT_FORMAT = 'rcl.composite-provider-router-result.v0.78.1';
export const RCL_COMPOSITE_PROVIDER_ROUTER_BUNDLE_FORMAT = 'rcl.composite-provider-router-bundle.v0.78.1';
export const RCL_COMPOSITE_ROUTE_FORMAT = 'rcl.composite-provider-route.v0.78.1';

function compact(value) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export const DEFAULT_COMPOSITE_PROVIDER_ROUTER_SPEC = Object.freeze({
  format: RCL_COMPOSITE_PROVIDER_ROUTER_SPEC_FORMAT,
  id: 'rcl_composite_provider_router_default_v0_78_1',
  version: RCL_COMPOSITE_PROVIDER_ROUTER_VERSION,
  objective: 'Upgrade RCL LLM-like Runtime from single-provider session routing to composite provider routing for desktop EXE brain readiness.',
});

export function normalizeCompositeProviderRouterSpec(input = {}) {
  return {
    format: input.format ?? RCL_COMPOSITE_PROVIDER_ROUTER_SPEC_FORMAT,
    id: input.id ?? DEFAULT_COMPOSITE_PROVIDER_ROUTER_SPEC.id,
    version: input.version ?? RCL_COMPOSITE_PROVIDER_ROUTER_VERSION,
    objective: input.objective ?? DEFAULT_COMPOSITE_PROVIDER_ROUTER_SPEC.objective,
    llmLikeRuntime: buildLlmLikeRuntimeSpec(input.llmLikeRuntime ?? input),
    thresholds: {
      minRouteCount: Number(input.thresholds?.minRouteCount ?? 8),
      minMultiProviderSessionCount: Number(input.thresholds?.minMultiProviderSessionCount ?? 6),
      minAverageCapabilityCoverage: Number(input.thresholds?.minAverageCapabilityCoverage ?? 0.98),
      requireNoApiDefault: input.thresholds?.requireNoApiDefault ?? true,
      requireNoLargeMemoryDefault: input.thresholds?.requireNoLargeMemoryDefault ?? true,
      requireDesktopExeBrainRouting: input.thresholds?.requireDesktopExeBrainRouting ?? true,
    },
  };
}

function buildRouteDiagnostics(route) {
  const missing = route.capabilityBindings.filter((b) => !b.covered).map((b) => b.capability);
  const providers = route.selectedProviderIds;
  return {
    routeId: `${route.sessionId}:diagnostics`,
    status: missing.length ? 'partial' : 'pass',
    missingCapabilities: missing,
    providerCount: providers.length,
    routeKind: route.routeKind,
    writeGated: String(route.privacyClass ?? '').includes('write') || String(route.privacyClass ?? '').includes('authority'),
    recommendedUiSurface: providers.length > 1 ? 'provider-chain-inspector' : 'single-provider-route-card',
    diagnosticsRoot: sha256(compact({ routeRoot: route.routeRoot, missing, providers })),
  };
}

function buildDesktopBrainPlan(router) {
  const desktopRoute = router.routes.find((r) => r.mode === 'desktop_exe_copilot') ?? router.routes.at(-1);
  const plan = {
    id: 'rcl_desktop_exe_brain_composite_provider_plan_v0_78_1',
    target: 'v0.79 RCL Desktop EXE App Shell（RCL 桌面 EXE 应用壳）',
    ready: Boolean(router.desktopExeBrainRoutingReady),
    requiredPanels: [
      'Composite Provider Chain Inspector（复合 Provider 链检查器）',
      'Capability Binding Matrix（能力绑定矩阵）',
      'Context / Memory Split View（上下文 / 记忆拆分视图）',
      'Tool-call Dry-run Preview（工具调用空跑预览）',
      'Rule Self-check Diagnostics（规则自检诊断）',
      'Human Authority Gate（人类权威闸门）',
    ],
    desktopRoute: desktopRoute ? {
      sessionId: desktopRoute.sessionId,
      providerIds: desktopRoute.selectedProviderIds,
      coverage: desktopRoute.coverage,
      mergePolicy: desktopRoute.mergePolicy,
    } : null,
  };
  return {
    ...plan,
    planRoot: sha256(compact(plan)),
  };
}

export function compileCompositeProviderRouter(input = {}) {
  const spec = normalizeCompositeProviderRouterSpec(input);
  const llmBundle = runLlmLikeRuntime(spec.llmLikeRuntime);
  const router = llmBundle.compositeProviderRouter ?? buildCompositeProviderRouter(llmBundle.providerContracts, llmBundle.sessions);
  const routeDiagnostics = router.routes.map(buildRouteDiagnostics);
  const desktopBrainPlan = buildDesktopBrainPlan(router);
  const passDiagnostics = routeDiagnostics.filter((d) => d.status === 'pass').length;
  const result = {
    format: RCL_COMPOSITE_PROVIDER_ROUTER_RESULT_FORMAT,
    version: RCL_COMPOSITE_PROVIDER_ROUTER_VERSION,
    compositeProviderRouterEstablished:
      router.compositeRoutingEstablished &&
      router.routeCount >= spec.thresholds.minRouteCount &&
      router.multiProviderSessionCount >= spec.thresholds.minMultiProviderSessionCount &&
      router.averageCapabilityCoverage >= spec.thresholds.minAverageCapabilityCoverage &&
      (!spec.thresholds.requireNoApiDefault || !router.defaultNeedsApi) &&
      (!spec.thresholds.requireNoLargeMemoryDefault || !router.defaultNeedsLargeMemory) &&
      (!spec.thresholds.requireDesktopExeBrainRouting || desktopBrainPlan.ready),
    routeCount: router.routeCount,
    compositeRouteCount: router.routes.filter((r) => r.routeKind === 'composite').length,
    multiProviderSessionCount: router.multiProviderSessionCount,
    capabilityBindingCount: router.routes.reduce((sum, r) => sum + r.capabilityBindings.length, 0),
    passDiagnosticCount: passDiagnostics,
    partialDiagnosticCount: routeDiagnostics.length - passDiagnostics,
    averageCapabilityCoverage: router.averageCapabilityCoverage,
    averageProviderChainLength: round(average(router.routes.map((r) => r.selectedProviderIds.length))),
    apiRequiredForDefaultRun: router.defaultNeedsApi,
    largeMemoryRequiredForDefaultRun: router.defaultNeedsLargeMemory,
    desktopExeBrainRoutingReady: desktopBrainPlan.ready,
    llmLikeRuntimeStillEstablished: llmBundle.result?.llmLikeRuntimeEstablished ?? false,
    nextHandoff: 'v0.79 RCL Desktop EXE App Shell（RCL 桌面 EXE 应用壳）',
    canonicalRoot: sha256(compact({ spec, routerRoot: router.routerRoot, diagnostics: routeDiagnostics.map((d) => d.diagnosticsRoot), desktopBrainPlan })),
  };
  return {
    ok: result.compositeProviderRouterEstablished,
    format: RCL_COMPOSITE_PROVIDER_ROUTER_BUNDLE_FORMAT,
    spec,
    llmLikeRuntime: {
      ok: llmBundle.ok,
      result: llmBundle.result,
    },
    router,
    routeDiagnostics,
    desktopBrainPlan,
    result,
  };
}

export function runCompositeProviderRouter(input = {}) {
  return compileCompositeProviderRouter(input);
}

export function runCompositeProviderRouterDemo(overrides = {}) {
  return runCompositeProviderRouter(overrides);
}

export function renderCompositeProviderRouterRcl(input = {}) {
  const spec = normalizeCompositeProviderRouterSpec(input);
  const lines = [];
  lines.push('reality composite_provider_router_v0_78_1 {');
  lines.push(`  objective: ${JSON.stringify(spec.objective)}`);
  lines.push('  route_policy: "capability-sharded composite routing"');
  lines.push('  default_runtime: "no-api / no-large-memory / local-first"');
  lines.push('  requires: [provider_contract, capability_binding, provider_chain, merge_policy, rule_self_check, human_authority_gate]');
  lines.push('  fixes: "v0.78 single-session single-provider limitation"');
  lines.push('  next: "v0.79 RCL Desktop EXE App Shell"');
  lines.push('}');
  return lines.join('\n');
}

export function readCompositeProviderRouterInput(filePath) {
  return readLlmLikeRuntimeInput(filePath);
}

function makeRouterMarkdown(router) {
  const lines = ['# RCL v0.78.1 Composite Provider Router（复合能力提供者路由器）', ''];
  lines.push(`Composite Routing Established（复合路由成立）: **${router.compositeRoutingEstablished}**`);
  lines.push(`Default Needs API（默认需要 API）: **${router.defaultNeedsApi}**`);
  lines.push(`Default Needs Large Memory（默认需要大量内存）: **${router.defaultNeedsLargeMemory}**`);
  lines.push(`Average Capability Coverage（平均能力覆盖）: **${router.averageCapabilityCoverage}**`);
  lines.push('');
  lines.push('| Session（会话） | Mode（模式） | Providers（提供者链） | Merge Policy（合并策略） | Coverage（覆盖率） |');
  lines.push('|---|---|---|---|---:|');
  for (const route of router.routes) {
    lines.push(`| ${route.sessionId} | ${route.mode} | ${route.selectedProviderIds.join(' → ')} | ${route.mergePolicy} | ${route.coverage} |`);
  }
  return lines.join('\n');
}

function makeDiagnosticsMarkdown(diagnostics) {
  const lines = ['# Route Diagnostics（路由诊断）', ''];
  lines.push('| Route（路由） | Status（状态） | Provider Count（Provider 数） | Missing（缺失能力） | UI Surface（界面） |');
  lines.push('|---|---|---:|---|---|');
  for (const d of diagnostics) {
    lines.push(`| ${d.routeId} | ${d.status} | ${d.providerCount} | ${d.missingCapabilities.join(', ') || '-'} | ${d.recommendedUiSurface} |`);
  }
  return lines.join('\n');
}

function makeDesktopBrainPlanMarkdown(plan) {
  const lines = ['# Desktop EXE Brain Routing Plan（桌面 EXE 大脑路由计划）', ''];
  lines.push(`Ready（就绪）: **${plan.ready}**`);
  lines.push(`Target（目标）: ${plan.target}`);
  lines.push('');
  lines.push('## Required Panels（必要面板）');
  for (const panel of plan.requiredPanels) lines.push(`- ${panel}`);
  lines.push('');
  lines.push('## Desktop Route（桌面路由）');
  lines.push('```json');
  lines.push(JSON.stringify(plan.desktopRoute, null, 2));
  lines.push('```');
  return lines.join('\n');
}

export function writeCompositeProviderRouterReports(outDir, input = {}) {
  const bundle = runCompositeProviderRouter(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'composite-provider-router-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'composite-provider-router-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'composite-provider-router.json'), `${JSON.stringify(bundle.router, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'composite-provider-router.md'), `${makeRouterMarkdown(bundle.router)}\n`);
  fs.writeFileSync(path.join(dir, 'route-diagnostics.json'), `${JSON.stringify(bundle.routeDiagnostics, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'route-diagnostics.md'), `${makeDiagnosticsMarkdown(bundle.routeDiagnostics)}\n`);
  fs.writeFileSync(path.join(dir, 'desktop-exe-brain-routing-plan.json'), `${JSON.stringify(bundle.desktopBrainPlan, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'desktop-exe-brain-routing-plan.md'), `${makeDesktopBrainPlanMarkdown(bundle.desktopBrainPlan)}\n`);
  fs.writeFileSync(path.join(dir, 'composite-provider-router.rcl'), `${renderCompositeProviderRouterRcl(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'llm-like-runtime-v0.78.1.rcl'), `${renderLlmLikeRuntimeRcl(bundle.spec.llmLikeRuntime)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.result.canonicalRoot}\n`);
  return {
    ok: bundle.ok,
    outDir: dir,
    result: bundle.result,
    files: [
      'composite-provider-router-result.json',
      'composite-provider-router-bundle.json',
      'composite-provider-router.json',
      'composite-provider-router.md',
      'route-diagnostics.json',
      'route-diagnostics.md',
      'desktop-exe-brain-routing-plan.json',
      'desktop-exe-brain-routing-plan.md',
      'composite-provider-router.rcl',
      'llm-like-runtime-v0.78.1.rcl',
      'canonical-root.txt',
    ],
  };
}
