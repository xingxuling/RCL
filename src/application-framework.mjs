import fs from 'node:fs';
import path from 'node:path';
import { realityRoot } from './canonical.mjs';
import { emitNativeUiAndroidActivity, lowerNativeUiToAndroid } from './ui/android-ui-backend.mjs';
import { compileNativeUiProgram } from './ui/ui-compiler.mjs';
import { nativeUiRoot } from './ui/ui-ir.mjs';
import { emitNativeUiWebHtml, emitNativeUiWebServer, lowerNativeUiToWeb } from './ui/web-ui-backend.mjs';
import { runNativeUiSemanticTrace } from './ui/ui-event.mjs';

export const RCL_APPLICATION_FRAMEWORK_VERSION = '0.1.0-alpha.1';
export const RCL_APPLICATION_FRAMEWORK_FORMAT = 'rcl.application-framework.v0.1';
export const RCL_APPLICATION_FRAMEWORK_SPEC_FORMAT = 'rcl.application-framework-spec.v0.1';
export const RCL_APPLICATION_FRAMEWORK_TRACE_FORMAT = 'rcl.application-framework-trace.v0.1';
export const RCL_APPLICATION_FRAMEWORK_CATALOG_FORMAT = 'rcl.application-framework-catalog.v0.1';
export const RCL_APPLICATION_FRAMEWORK_BUILD_FORMAT = 'rcl.application-framework-build.v0.1';
export const RCL_APPLICATION_FRAMEWORK_VERIFY_FORMAT = 'rcl.application-framework-verify.v0.1';

export const RCL_APPLICATION_FRAMEWORK_TARGETS = Object.freeze(['web', 'android']);

const DEFAULT_FRAMEWORK_ID = 'rcl.ui.native-app.v0.1';
const CLASSIFICATIONS = Object.freeze([
  'STD_CANDIDATE',
  'FRAMEWORK_CANDIDATE',
  'PACK_CANDIDATE',
  'PACK',
  'AUXILIARY_PROVIDER',
  'EXAMPLE',
  'RCL_GAP',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function assertPlainObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(code);
  return value;
}

function nonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(code);
  return value.trim();
}

function uniqueStrings(value, code) {
  if (!Array.isArray(value)) throw new TypeError(code);
  const result = [];
  for (const item of value) {
    const normalized = nonEmptyString(item, code);
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function packageSegment(value) {
  const segment = String(value ?? 'app')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gu, '_')
    .replace(/^[^a-z]+/u, 'app_')
    .replace(/_+$/u, '')
    .slice(0, 48);
  return segment || 'app';
}

function defaultAndroidApplicationId(appId, uiId) {
  return `org.rcl.${packageSegment(appId || uiId)}`;
}

const RAW_APPLICATION_FRAMEWORK_CATALOG = [
  {
    id: 'rcl.native-ui.program.v0.1',
    classification: 'STD_CANDIDATE',
    status: 'CANDIDATE_ONLY',
    semanticOwner: 'RCL',
    title: 'Native UI semantic program',
    purpose: 'Stable UI semantic substrate shared by application frameworks and platform lowerings.',
    developerValue: ['typed local state and derived state', 'role-scoped view tree', 'reactive bindings', 'fail-closed event validation'],
    userValue: ['state changes are reflected through one semantic projection', 'accessibility labels are part of the UI contract'],
    composes: [
      'rcl.native-ui.event-graph.v0.1',
      'rcl.native-ui.style-sheet.v0.1',
      'rcl.native-ui.navigation.v0.1',
      'rcl.native-ui.device-adaptation.v0.1',
    ],
    providers: ['Web DOM/CSS/browser runtime', 'Android Views/Java/Gradle project'],
    gaps: ['resources', 'complete accessibility tree and focus traversal', 'animation', 'list virtualization', 'broader device adaptation'],
    evidence: [
      'examples/native-ui/counter.rcl',
      'examples/native-ui/navigation.rcl',
      'examples/native-ui/device-adaptation.rcl',
      'tests/native-ui-parser-ir.test.mjs',
      'tests/native-ui-runtime-style-layout.test.mjs',
    ],
    promotion: 'Require repeated K400 UI stress coverage, negative controls and runtime/device evidence before standard promotion.',
  },
  {
    id: 'rcl.ui.native-app.v0.1',
    classification: 'FRAMEWORK_CANDIDATE',
    status: 'CANDIDATE_ONLY',
    semanticOwner: 'RCL',
    title: 'Native Application Framework Profile',
    purpose: 'One RCL UI source to canonical UI IR, target lowerings and shared semantic replay.',
    developerValue: ['one compile entrypoint for Web and Android', 'default target configuration', 'automatic target-root collection', 'cross-target semantic parity replay'],
    userValue: ['reactive interactions', 'lifecycle and local-state restoration hooks', 'navigation and available-width adaptation', 'consistent semantics across target organs'],
    composes: ['rcl.native-ui.program.v0.1'],
    providers: ['rcl.native-ui.web-lowering.v0.1', 'rcl.native-ui.android-lowering.v0.1'],
    gaps: ['async effects and data fetching', 'persistence and offline sync', 'complete accessibility/focus model', 'resource and media lifecycle', 'production-grade target packaging'],
    evidence: [
      'src/ui/ui-compiler.mjs',
      'src/ui/ui-ir.mjs',
      'src/ui/ui-event.mjs',
      'src/ui/web-ui-backend.mjs',
      'src/ui/android-ui-backend.mjs',
      'tests/native-ui-backends-equivalence.test.mjs',
    ],
    promotion: 'Keep as a Framework Profile until K400 coverage expands beyond the bounded K02/K03 UI cells and real target evidence is rerun.',
  },
  {
    id: 'rcl.app.product-entry.v0.65',
    classification: 'PACK_CANDIDATE',
    status: 'CANDIDATE_ONLY',
    semanticOwner: 'RCL for goal/evidence/authority contracts; host shell for presentation',
    title: 'Goal-to-plan product shell',
    purpose: 'Package goal intake, plan card, execution preview, evidence panel, rollback and feedback surfaces.',
    developerValue: ['repeatable product entry surfaces', 'reviewable execution flow', 'evidence and rollback fields are not forgotten'],
    userValue: ['ordinary users need not understand RCL/RNCS/WAL', 'impact, evidence and confirmation remain visible'],
    composes: ['reality-product-entry-runtime.v0.65', 'evidence-product-shell-runtime.v0.67'],
    providers: ['host UI renderer', 'RNCS handoff', 'provider runtime'],
    gaps: ['generic CRUD/data application semantics', 'full visual component system'],
    evidence: ['src/reality-product-entry-runtime.mjs', 'src/evidence-product-shell-runtime.mjs', 'tests/evidence-product-shell-runtime.test.mjs'],
    promotion: 'Treat as a Pack-backed profile; do not move product-shell morphology into RCL Core.',
  },
  {
    id: 'rcl.dev.evidence-loop.v0.1',
    classification: 'PACK_CANDIDATE',
    status: 'CANDIDATE_ONLY',
    semanticOwner: 'RCL evidence contracts; tooling/runtime adapters for developer surfaces',
    title: 'Evidence-first developer loop',
    purpose: 'Make compile, trace, replay, diagnostics and review evidence a default application-development loop.',
    developerValue: ['debug/replay/profiler/LSP/DAP surfaces', 'rooted reports and negative controls', 'bounded claims instead of demo-only success'],
    userValue: ['reviewable state and failure explanation', 'clear boundary between preview and external execution'],
    composes: ['debug-replay-runtime', 'debug-session-runtime', 'profiler-debug-ui-runtime', 'lsp-dap-bridge-runtime'],
    providers: ['IDE/editor integrations', 'host filesystem and process runtime'],
    gaps: ['single unified project command', 'visual acceptance harness across all target organs'],
    evidence: ['src/debug-replay-runtime.mjs', 'src/debug-session-runtime.mjs', 'src/profiler-debug-ui-runtime.mjs', 'src/lsp-dap-bridge-runtime.mjs'],
    promotion: 'Keep as developer tooling Pack until its contracts are unified and independent replay evidence is collected.',
  },
  {
    id: 'rcl.delivery.multi-target.v0.42',
    classification: 'PACK_CANDIDATE',
    status: 'CANDIDATE_ONLY',
    semanticOwner: 'RCL package/release contract; host packager and platform builders',
    title: 'Multi-target delivery Pack',
    purpose: 'Generate lock, cache, target matrix, package, release and verification artifacts from one project entry.',
    developerValue: ['repeatable project initialization', 'multi-target matrix', 'hardened manifests and secret scans', 'release verification'],
    userValue: ['installable/runnable artifacts with explicit target boundaries'],
    composes: ['package-ecosystem-runtime.v0.42', 'package-compiler.v0.24', 'rclapp-kernel.v0.24'],
    providers: ['Node/native VM', 'Gradle/Android SDK', 'host filesystem'],
    gaps: ['single native-UI-aware application release command', 'verified browser and physical-device delivery'],
    evidence: ['src/package-ecosystem-runtime.mjs', 'src/package-compiler.mjs', 'src/rclapp-kernel.mjs', 'tests/package-compiler.test.mjs', 'tests/rclapp-kernel.test.mjs'],
    promotion: 'Pack only; the packager explicitly records that it is host-backed and not RCL-native.',
  },
  {
    id: 'rcl.forge.domain.v0.1',
    classification: 'PACK',
    status: 'EXISTING_BOUNDARY',
    semanticOwner: 'RCL app/evidence contracts; domain Forge or provider for implementation',
    title: 'Domain Forge Packs',
    purpose: 'Reusable app, media and neural domain templates with explicit provider boundaries.',
    developerValue: ['domain-specific starting points', 'deterministic demo generation', 'less boilerplate for bounded domains'],
    userValue: ['faster domain prototype surfaces'],
    composes: ['app-forge', 'media-forge', 'neuro-forge'],
    providers: ['domain-specific renderers', 'deterministic trainer/media runtime'],
    gaps: ['generic application semantics', 'production asset and provider guarantees'],
    evidence: ['src/forge/app-forge.mjs', 'src/forge/media-forge.mjs', 'src/forge/neuro-forge.mjs', 'tests/forge.test.mjs'],
    promotion: 'Remain Pack/Provider; domain convenience must not become a general RCL primitive.',
  },
  {
    id: 'rcl.provider.host.v2',
    classification: 'AUXILIARY_PROVIDER',
    status: 'EXISTING_BOUNDARY',
    semanticOwner: 'Provider implementation/runtime; RCL owns request, authority and evidence contract',
    title: 'Provider host bridge',
    purpose: 'Expose specialized host capabilities without assigning their implementation semantics to RCL Core.',
    developerValue: ['timeouts and concurrency limits', 'capability offers', 'resource isolation and receipts'],
    userValue: ['bounded external capability use with visible failure boundaries'],
    composes: ['rcl.provider-runtime.v2', 'resource-isolation-kernel', 'resource-wal-runtime'],
    providers: ['network', 'filesystem', 'media', 'model', 'hardware and other specialized hosts'],
    gaps: ['provider-specific correctness is never supplied by the bridge alone'],
    evidence: ['src/provider-runtime-v2.mjs', 'src/resource-isolation-kernel.mjs', 'src/resource-wal-runtime.mjs'],
    promotion: 'Always keep implementation-specific capabilities in Auxiliary Language/Provider unless a general semantic primitive is extracted.',
  },
  {
    id: 'rcl.example.native-ui.counter.v0.1',
    classification: 'EXAMPLE',
    status: 'EXISTING_EXAMPLE',
    semanticOwner: 'RCL example corpus',
    title: 'Counter application example',
    purpose: 'Small stress cell for state, derived text, style, local events and lifecycle restore.',
    developerValue: ['fast smoke fixture', 'readable onboarding example'],
    userValue: ['demonstrates a minimal reactive interaction'],
    composes: ['rcl.ui.native-app.v0.1'],
    providers: ['Web and Android lowering examples'],
    gaps: ['not evidence for arbitrary application generation'],
    evidence: ['examples/native-ui/counter.rcl', 'tests/native-ui-runtime-style-layout.test.mjs'],
    promotion: 'Keep as Example; examples supply stress evidence but do not define framework ownership by themselves.',
  },
  {
    id: 'rcl.gap.application-async-data.v0.1',
    classification: 'RCL_GAP',
    status: 'UNRESOLVED',
    semanticOwner: 'Not assigned',
    title: 'Async effects, data and persistence',
    purpose: 'Missing general contract for loading, cancellation, persistence, offline state, synchronization and data ownership in apps.',
    developerValue: ['would remove repeated ad hoc host bridges'],
    userValue: ['would support real data-driven applications instead of bounded local state'],
    composes: [],
    providers: ['network/storage/database providers remain implementation organs'],
    gaps: ['needs primitive/IR/runtime design and negative controls'],
    evidence: ['docs/ui-native-genome/native-ui-semantics.md', 'src/provider-runtime-v2.mjs'],
    promotion: 'Do not silently solve with fetch/database code. Record donor advantage, candidate genome, K400 cells and replay evidence first.',
  },
  {
    id: 'rcl.gap.application-accessibility-resources.v0.1',
    classification: 'RCL_GAP',
    status: 'UNRESOLVED',
    semanticOwner: 'Not assigned',
    title: 'Complete accessibility, focus and resource semantics',
    purpose: 'Missing general contracts for focus traversal, accessibility trees, media/resource identity and lifecycle.',
    developerValue: ['would make accessible and media-rich UI reusable rather than target-specific'],
    userValue: ['keyboard/screen-reader access and reliable resources are direct UX quality gains'],
    composes: ['rcl.native-ui.program.v0.1'],
    providers: ['browser accessibility APIs', 'Android accessibility/resource APIs'],
    gaps: ['current UI only carries accessibility labels and has an empty resources extension point'],
    evidence: ['docs/ui-native-genome/native-ui-semantics.md', 'src/ui/ui-schema.mjs', 'src/ui/ui-compiler.mjs'],
    promotion: 'Extract only the irreducible cross-target semantics; leave API/pixel/device mechanisms to providers.',
  },
];

for (const item of RAW_APPLICATION_FRAMEWORK_CATALOG) {
  if (!CLASSIFICATIONS.includes(item.classification)) throw new Error(`RCL_APPLICATION_FRAMEWORK_CATALOG_CLASSIFICATION:${item.classification}`);
}

export const RCL_APPLICATION_FRAMEWORK_CATALOG = deepFreeze(RAW_APPLICATION_FRAMEWORK_CATALOG);

export const DEFAULT_RCL_APPLICATION_FRAMEWORK_SPEC = deepFreeze({
  format: RCL_APPLICATION_FRAMEWORK_SPEC_FORMAT,
  version: RCL_APPLICATION_FRAMEWORK_VERSION,
  frameworkId: DEFAULT_FRAMEWORK_ID,
  targets: [...RCL_APPLICATION_FRAMEWORK_TARGETS],
  appId: null,
  uiId: null,
  title: null,
  language: 'zh-CN',
  web: {},
  android: {},
});

export function listRclApplicationFrameworks(filter = {}) {
  const classification = filter.classification ?? null;
  if (classification !== null && !CLASSIFICATIONS.includes(classification)) throw new Error(`RCL_APPLICATION_FRAMEWORK_CLASSIFICATION:${classification}`);
  return clone(RCL_APPLICATION_FRAMEWORK_CATALOG.filter(item => classification === null || item.classification === classification));
}

export function getRclApplicationFramework(id) {
  const normalized = nonEmptyString(id, 'RCL_APPLICATION_FRAMEWORK_ID_REQUIRED');
  const match = RCL_APPLICATION_FRAMEWORK_CATALOG.find(item => item.id === normalized);
  return match ? clone(match) : null;
}

export function normalizeRclApplicationFrameworkSpec(input = {}) {
  assertPlainObject(input, 'RCL_APPLICATION_FRAMEWORK_SPEC_OBJECT');
  if (input.format !== undefined && input.format !== RCL_APPLICATION_FRAMEWORK_SPEC_FORMAT) {
    throw new Error(`RCL_APPLICATION_FRAMEWORK_SPEC_FORMAT:${input.format}`);
  }
  const frameworkId = input.frameworkId ?? input.framework ?? DEFAULT_FRAMEWORK_ID;
  const framework = getRclApplicationFramework(frameworkId);
  if (!framework || framework.classification !== 'FRAMEWORK_CANDIDATE') throw new Error(`RCL_APPLICATION_FRAMEWORK_UNKNOWN:${frameworkId}`);
  const rawTargets = input.targets ?? DEFAULT_RCL_APPLICATION_FRAMEWORK_SPEC.targets;
  const targets = uniqueStrings(rawTargets, 'RCL_APPLICATION_FRAMEWORK_TARGETS');
  for (const target of targets) if (!RCL_APPLICATION_FRAMEWORK_TARGETS.includes(target)) throw new Error(`RCL_APPLICATION_FRAMEWORK_TARGET:${target}`);
  if (targets.length === 0) throw new Error('RCL_APPLICATION_FRAMEWORK_TARGETS_EMPTY');
  const web = clone(assertPlainObject(input.web ?? {}, 'RCL_APPLICATION_FRAMEWORK_WEB_OBJECT'));
  const android = clone(assertPlainObject(input.android ?? {}, 'RCL_APPLICATION_FRAMEWORK_ANDROID_OBJECT'));
  const appId = input.appId === null || input.appId === undefined ? null : nonEmptyString(input.appId, 'RCL_APPLICATION_FRAMEWORK_APP_ID');
  const uiId = input.uiId === null || input.uiId === undefined ? null : nonEmptyString(input.uiId, 'RCL_APPLICATION_FRAMEWORK_UI_ID');
  const title = input.title === null || input.title === undefined ? null : nonEmptyString(input.title, 'RCL_APPLICATION_FRAMEWORK_TITLE');
  const language = input.language === null || input.language === undefined ? 'zh-CN' : nonEmptyString(input.language, 'RCL_APPLICATION_FRAMEWORK_LANGUAGE');
  const traceEvents = input.traceEvents === undefined ? [] : clone(input.traceEvents);
  if (!Array.isArray(traceEvents)) throw new TypeError('RCL_APPLICATION_FRAMEWORK_TRACE_EVENTS');
  return deepFreeze({
    format: RCL_APPLICATION_FRAMEWORK_SPEC_FORMAT,
    version: input.version ?? RCL_APPLICATION_FRAMEWORK_VERSION,
    frameworkId,
    targets,
    appId,
    uiId,
    title,
    language,
    web,
    android,
    traceEvents,
  });
}

function targetTitle(spec, ui) {
  return spec.title ?? spec.web.title ?? spec.android.title ?? ui.id;
}

export function compileRclApplicationFramework(source, input = {}) {
  if (typeof source !== 'string') throw new TypeError('RCL_APPLICATION_FRAMEWORK_SOURCE');
  const spec = normalizeRclApplicationFrameworkSpec(input);
  const ui = compileNativeUiProgram(source, spec.uiId);
  const outputs = {};
  if (spec.targets.includes('web')) {
    outputs.web = lowerNativeUiToWeb(ui, {
      ...spec.web,
      title: targetTitle(spec, ui),
      language: spec.web.language ?? spec.language,
    });
  }
  if (spec.targets.includes('android')) {
    outputs.android = lowerNativeUiToAndroid(ui, {
      ...spec.android,
      applicationId: spec.android.applicationId ?? defaultAndroidApplicationId(spec.appId, ui.id),
      title: targetTitle(spec, ui),
    });
  }
  const report = {
    format: RCL_APPLICATION_FRAMEWORK_FORMAT,
    version: RCL_APPLICATION_FRAMEWORK_VERSION,
    kind: 'ApplicationFrameworkCompilation',
    frameworkId: spec.frameworkId,
    classification: 'FRAMEWORK_CANDIDATE',
    status: 'CANDIDATE_ONLY',
    semanticOwner: 'RCL',
    sourceRoot: nativeUiRoot(source),
    uiProgram: ui,
    uiProgramRoot: ui.semanticRoot,
    traceEvents: clone(spec.traceEvents),
    targets: outputs,
    targetRoots: Object.fromEntries(Object.entries(outputs).map(([target, value]) => [target, value.loweringRoot])),
    evidenceBoundary: {
      compile: 'RCL parser/type/UI IR validation',
      lower: 'host backend lowering reports',
      execute: 'not performed by compilation',
      runtime: 'Web browser/Android device evidence remains separate',
      promotion: 'human review and K400 evidence required',
    },
  };
  return Object.freeze({ ...report, root: realityRoot({
    format: report.format,
    version: report.version,
    frameworkId: report.frameworkId,
    sourceRoot: report.sourceRoot,
    uiProgramRoot: report.uiProgramRoot,
    targetRoots: report.targetRoots,
  }) });
}

function comparableTrace(trace) {
  const { platform: _platform, ...semantic } = trace;
  return semantic;
}

export function traceRclApplicationFramework(compiled, events = null, options = {}) {
  if (!compiled || compiled.format !== RCL_APPLICATION_FRAMEWORK_FORMAT) throw new TypeError('RCL_APPLICATION_FRAMEWORK_COMPILED_FORMAT');
  const eventList = events === null ? compiled.traceEvents ?? compiled.spec?.traceEvents ?? [] : clone(events);
  if (!Array.isArray(eventList)) throw new TypeError('RCL_APPLICATION_FRAMEWORK_TRACE_EVENTS');
  const targetNames = Object.keys(compiled.targets ?? {});
  if (targetNames.length === 0) throw new Error('RCL_APPLICATION_FRAMEWORK_TARGETS_EMPTY');
  const traces = Object.fromEntries(targetNames.map(target => [target, runNativeUiSemanticTrace(compiled.uiProgram, eventList, target, options)]));
  const values = Object.values(traces).map(comparableTrace);
  const semanticParity = values.every(value => JSON.stringify(value) === JSON.stringify(values[0]));
  const report = {
    format: RCL_APPLICATION_FRAMEWORK_TRACE_FORMAT,
    version: RCL_APPLICATION_FRAMEWORK_VERSION,
    frameworkId: compiled.frameworkId,
    status: semanticParity ? 'PASS' : 'FAIL',
    evidenceLevel: 'HOST_SEMANTIC_REPLAY',
    externalRuntimeExecuted: false,
    physicalDeviceExecuted: false,
    semanticParity,
    uiProgramRoot: compiled.uiProgramRoot,
    targets: targetNames,
    traces,
  };
  return Object.freeze({ ...report, root: realityRoot({
    format: report.format,
    version: report.version,
    frameworkId: report.frameworkId,
    status: report.status,
    semanticParity: report.semanticParity,
    uiProgramRoot: report.uiProgramRoot,
    traces: Object.fromEntries(Object.entries(traces).map(([target, trace]) => [target, comparableTrace(trace)])),
  }) });
}

function writeText(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function buildRclApplicationFramework({ rclPath, outputPath, specPath = null } = {}) {
  if (typeof rclPath !== 'string' || rclPath.length === 0) throw new TypeError('RCL_APPLICATION_FRAMEWORK_RCL_PATH');
  if (typeof outputPath !== 'string' || outputPath.length === 0) throw new TypeError('RCL_APPLICATION_FRAMEWORK_OUTPUT_PATH');
  const sourcePath = path.resolve(rclPath);
  const root = path.resolve(outputPath);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const spec = specPath === null || specPath === undefined
    ? {}
    : JSON.parse(fs.readFileSync(path.resolve(specPath), 'utf8'));
  const compiled = compileRclApplicationFramework(source, spec);
  const trace = traceRclApplicationFramework(compiled);
  const files = ['program.rcl', 'application-framework.json', 'semantic-trace.json'];
  writeText(path.join(root, 'program.rcl'), source);
  writeJson(path.join(root, 'application-framework.json'), compiled);
  writeJson(path.join(root, 'semantic-trace.json'), trace);
  if (compiled.targets.web) {
    writeJson(path.join(root, 'web', 'lowering.json'), compiled.targets.web);
    writeText(path.join(root, 'web', 'index.html'), emitNativeUiWebHtml(compiled.targets.web));
    writeText(path.join(root, 'web', 'server.mjs'), emitNativeUiWebServer(compiled.targets.web));
    files.push('web/lowering.json', 'web/index.html', 'web/server.mjs');
  }
  if (compiled.targets.android) {
    writeJson(path.join(root, 'android', 'lowering.json'), compiled.targets.android);
    writeText(path.join(root, 'android', 'MainActivity.java'), emitNativeUiAndroidActivity(compiled.targets.android));
    files.push('android/lowering.json', 'android/MainActivity.java');
  }
  writeText(path.join(root, 'README.md'), `# RCL Application Framework Candidate\n\n` +
    `Framework: ${compiled.frameworkId}\n\n` +
    `This directory contains candidate Native UI artifacts from one canonical UI semantic root.\n\n` +
    `- Web: web/index.html and web/server.mjs\n` +
    `- Android: android/MainActivity.java and android/lowering.json\n` +
    `- Host semantic replay: semantic-trace.json\n` +
    `- Compilation: application-framework.json\n\n` +
    `The Web file is a standalone browser artifact and the Android file is a source/lowering artifact. No browser session, Android device, APK build or production release is claimed by this builder.\n`);
  files.push('README.md');
  const result = {
    format: RCL_APPLICATION_FRAMEWORK_BUILD_FORMAT,
    version: RCL_APPLICATION_FRAMEWORK_VERSION,
    status: 'CANDIDATE_ARTIFACTS_GENERATED',
    outputPath: root,
    sourcePath,
    frameworkId: compiled.frameworkId,
    uiProgramRoot: compiled.uiProgramRoot,
    targetRoots: compiled.targetRoots,
    compilationRoot: compiled.root,
    traceRoot: trace.root,
    traceStatus: trace.status,
    files,
    evidenceBoundary: {
      hostSemanticReplay: trace.evidenceLevel,
      browserSession: 'NOT_RUN',
      androidDevice: 'NOT_RUN',
      apkOrAab: 'NOT_BUILT',
      productionRelease: 'NOT_DEPLOYED',
    },
  };
  writeJson(path.join(root, 'application-framework-build.json'), { ...result, root: realityRoot(result) });
  return Object.freeze({ ...result, root: realityRoot(result) });
}

export function verifyRclApplicationFrameworkBuild(outputPath) {
  if (typeof outputPath !== 'string' || outputPath.length === 0) throw new TypeError('RCL_APPLICATION_FRAMEWORK_OUTPUT_PATH');
  const root = path.resolve(outputPath);
  const errors = [];
  const readJson = relative => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
    } catch {
      errors.push(`MISSING_OR_INVALID:${relative}`);
      return null;
    }
  };
  const build = readJson('application-framework-build.json');
  const compiled = readJson('application-framework.json');
  const trace = readJson('semantic-trace.json');
  const checkRoot = (label, actual, expected) => {
    if (actual !== expected) errors.push(`${label}:ROOT_MISMATCH`);
  };
  if (compiled) {
    if (compiled.format !== RCL_APPLICATION_FRAMEWORK_FORMAT) errors.push('COMPILED_FORMAT');
    checkRoot('compiled', compiled.root, realityRoot({
      format: compiled.format,
      version: compiled.version,
      frameworkId: compiled.frameworkId,
      sourceRoot: compiled.sourceRoot,
      uiProgramRoot: compiled.uiProgramRoot,
      targetRoots: compiled.targetRoots,
    }));
    for (const [target, value] of Object.entries(compiled.targets ?? {})) {
      if (compiled.targetRoots?.[target] !== value.loweringRoot) errors.push(`TARGET_ROOT:${target}`);
      if (compiled.uiProgramRoot !== value.uiProgramRoot) errors.push(`TARGET_UI_ROOT:${target}`);
    }
  }
  if (trace) {
    if (trace.format !== RCL_APPLICATION_FRAMEWORK_TRACE_FORMAT) errors.push('TRACE_FORMAT');
    if (trace.status !== 'PASS' || trace.semanticParity !== true) errors.push('TRACE_NOT_PASS');
    const comparableTraces = Object.fromEntries(Object.entries(trace.traces ?? {}).map(([target, value]) => [target, comparableTrace(value)]));
    checkRoot('trace', trace.root, realityRoot({
      format: trace.format,
      version: trace.version,
      frameworkId: trace.frameworkId,
      status: trace.status,
      semanticParity: trace.semanticParity,
      uiProgramRoot: trace.uiProgramRoot,
      traces: comparableTraces,
    }));
  }
  if (build) {
    if (build.format !== RCL_APPLICATION_FRAMEWORK_BUILD_FORMAT) errors.push('BUILD_FORMAT');
    const { root: _buildRoot, ...buildPayload } = build;
    checkRoot('build', build.root, realityRoot(buildPayload));
    if (compiled && build.compilationRoot !== compiled.root) errors.push('COMPILATION_ROOT_LINK');
    if (trace && build.traceRoot !== trace.root) errors.push('TRACE_ROOT_LINK');
    if (compiled && JSON.stringify(build.targetRoots) !== JSON.stringify(compiled.targetRoots)) errors.push('TARGET_ROOTS_LINK');
    for (const relative of build.files ?? []) {
      if (typeof relative !== 'string') {
        errors.push('FILE_ENTRY_TYPE');
        continue;
      }
      const candidate = path.resolve(root, relative);
      if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        errors.push(`FILE_OUTSIDE_OUTPUT:${relative}`);
      } else if (!fs.existsSync(candidate)) {
        errors.push(`FILE_MISSING:${relative}`);
      }
    }
  }
  const report = {
    format: RCL_APPLICATION_FRAMEWORK_VERIFY_FORMAT,
    version: RCL_APPLICATION_FRAMEWORK_VERSION,
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    evidenceLevel: 'STATIC_ARTIFACT_VERIFY',
    outputPath: root,
    promotionStatus: 'CANDIDATE_ONLY',
    verified: {
      buildManifest: Boolean(build),
      compilationManifest: Boolean(compiled),
      semanticTrace: Boolean(trace),
      listedFiles: Boolean(build) && errors.every(error => !error.startsWith('FILE_')),
      rootedLinks: errors.every(error => !error.includes('ROOT')),
    },
    errors,
    evidenceBoundary: {
      hostSemanticReplay: trace?.evidenceLevel ?? 'NOT_AVAILABLE',
      browserSession: 'NOT_RUN',
      androidDevice: 'NOT_RUN',
      apkOrAab: 'NOT_BUILT',
      productionRelease: 'NOT_DEPLOYED',
    },
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export function assessRclApplicationFrameworkCatalog() {
  const counts = Object.fromEntries(CLASSIFICATIONS.map(classification => [classification, 0]));
  for (const item of RCL_APPLICATION_FRAMEWORK_CATALOG) counts[item.classification] += 1;
  const report = {
    format: RCL_APPLICATION_FRAMEWORK_CATALOG_FORMAT,
    version: RCL_APPLICATION_FRAMEWORK_VERSION,
    status: 'CANDIDATE_ONLY',
    source: 'RCL repository application/UI/package/Forge/provider archaeology',
    count: RCL_APPLICATION_FRAMEWORK_CATALOG.length,
    classifications: counts,
    frameworkCandidates: RCL_APPLICATION_FRAMEWORK_CATALOG.filter(item => item.classification === 'FRAMEWORK_CANDIDATE').map(item => item.id),
    promotionPolicy: 'No catalog entry promotes itself; promotion requires implementation, negative controls, K400 gate evidence and human review.',
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}
