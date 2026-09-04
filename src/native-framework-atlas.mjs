import { realityRoot } from './canonical.mjs';

export const RCL_NATIVE_FRAMEWORK_ATLAS_VERSION = '0.1.0-alpha.1';
export const RCL_NATIVE_FRAMEWORK_ATLAS_FORMAT = 'rcl.native-framework-atlas.v0.1';

export const RCL_NATIVE_FRAMEWORK_CLASSIFICATIONS = Object.freeze([
  'NATIVE_CORE_CANDIDATE',
  'NATIVE_RUNTIME_CANDIDATE',
  'NATIVE_DOMAIN_CANDIDATE',
  'FRAMEWORK_CANDIDATE',
  'PACK_CANDIDATE',
  'AUXILIARY_PROVIDER',
]);

const RAW_ATLAS = [
  {
    id: 'rcl.core.language.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'NATIVE_CORE_CANDIDATE',
    status: 'BOUNDED_NATIVE_CORE_VERIFIED',
    formalNameEn: 'RCL Core Language Framework',
    friendlyNameEn: 'RCL Core',
    formalNameZh: 'RCL 核心语言框架',
    friendlyNameZh: '核心语',
    semanticOwner: 'RCL',
    purpose: 'Own source syntax, expressions, subjects, rules, type checking and compilation semantics.',
    developerValue: ['one language-level source model', 'typed diagnostics and source maps', 'compiler self-hosting path'],
    userValue: ['explicit state and transition meaning', 'deterministic validation before execution'],
    nativeSemantics: ['lexing', 'parsing', 'types', 'expressions', 'rules', 'source-to-IR compilation'],
    composes: ['rcl.core.runtime.v0.1', 'rcl.reality.transaction.v0.1', 'rcl.data.typed.v0.1'],
    lowersTo: ['RBC bytecode', 'native VM', 'Web/Android application backends', 'host provider calls'],
    doNotAbsorb: ['JavaScript/TypeScript syntax', 'provider-specific SDK semantics', 'IDE protocol implementation'],
    evidenceLevel: 'SOURCE_AND_BOUNDED_NATIVE_SELF_HOSTING',
    sourceEvidence: ['src/lexer.mjs', 'src/parser.mjs', 'src/type-system.mjs', 'src/compiler.mjs', 'CURRENT-STATUS.md'],
    promotion: 'Keep RCL ownership; broaden whole-language self-hosting and K400 coverage before claiming universal completion.',
  },
  {
    id: 'rcl.core.runtime.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'NATIVE_RUNTIME_CANDIDATE',
    status: 'BOUNDED_NATIVE_RUNTIME_VERIFIED',
    formalNameEn: 'RCL Native Runtime Framework',
    friendlyNameEn: 'RCL Engine',
    formalNameZh: 'RCL 原生运行时框架',
    friendlyNameZh: '原生引擎',
    semanticOwner: 'RCL',
    purpose: 'Execute RCL meaning through reference runtime, bytecode and native VM paths with semantic roots.',
    developerValue: ['native execution path', 'bytecode inspection', 'reference/native differential checks'],
    userValue: ['deterministic state results', 'stable execution identity'],
    nativeSemantics: ['expression evaluation', 'RBC opcodes', 'native execution', 'semantic state root verification'],
    composes: ['rcl.core.language.v0.1', 'rcl.data.typed.v0.1'],
    lowersTo: ['native/rclvm', 'embedded native VM', 'host-backed runtime process'],
    doNotAbsorb: ['GPU kernel implementation', 'browser event loop', 'Android lifecycle implementation'],
    evidenceLevel: 'BOUNDED_NATIVE_CORE_AND_VM_PATH',
    sourceEvidence: ['src/runtime.mjs', 'src/bytecode.mjs', 'src/native-vm.mjs', 'src/embedded-vm.mjs', 'src/semantic-state-root.mjs', 'CURRENT-STATUS.md'],
    promotion: 'Separate native-core verification from whole-language runtime coverage; close uncovered runtime domains independently.',
  },
  {
    id: 'rcl.reality.transaction.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'NATIVE_CORE_CANDIDATE',
    status: 'SEMANTIC_CANDIDATE',
    formalNameEn: 'RCL Governed Reality Framework',
    friendlyNameEn: 'RCL Reality',
    formalNameZh: 'RCL 受治理实境框架',
    friendlyNameZh: '实境核',
    semanticOwner: 'RCL',
    purpose: 'Model state, authority, effects, invariants, candidate transitions, commits and evidence as language semantics.',
    developerValue: ['transaction-shaped state changes', 'authority and invariant checks', 'content-addressed evidence and commits'],
    userValue: ['actions have explicit responsibility and boundaries', 'failed transitions do not silently commit'],
    nativeSemantics: ['facet state', 'warrant/needs authority', 'effect analysis', 'alter/preserve/witness', 'candidate-to-commit transition'],
    composes: ['rcl.core.language.v0.1', 'rcl.core.runtime.v0.1'],
    lowersTo: ['RNCS proposal input', 'product confirmation shell', 'provider execution gateway'],
    doNotAbsorb: ['RNCS scheduler implementation', 'human authorization custody', 'external side-effect executor'],
    evidenceLevel: 'SOURCE_BACKED_SEMANTIC_CANDIDATE',
    sourceEvidence: ['src/effects.mjs', 'src/reality-store.mjs', 'src/compiler.mjs', 'src/rncs-bridge.mjs', 'src/semantic-state-root.mjs'],
    promotion: 'Extract and replay the common transition semantics across more K400 cells; keep RNCS and external custody as downstream organs.',
  },
  {
    id: 'rcl.data.typed.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'NATIVE_RUNTIME_CANDIDATE',
    status: 'BOUNDED_TYPED_RUNTIME_CANDIDATE',
    formalNameEn: 'RCL Typed Data and Memory Framework',
    friendlyNameEn: 'RCL Typeforge',
    formalNameZh: 'RCL 类型数据与内存框架',
    friendlyNameZh: '型构工坊',
    semanticOwner: 'RCL',
    purpose: 'Own typed module meaning and connect records, unions, references, heap layout, GC snapshots and ABI contracts.',
    developerValue: ['reusable typed modules', 'typed constructor and field diagnostics', 'inspectable memory and reference reports'],
    userValue: ['stable data identity', 'less ambiguity at state boundaries'],
    nativeSemantics: ['record/union types', 'generic type resolution', 'typed references', 'semantic heap identity', 'snapshot and ABI contracts'],
    composes: ['rcl.core.language.v0.1', 'rcl.core.runtime.v0.1'],
    lowersTo: ['RBC/native heap', 'typed package artifacts', 'host storage adapters'],
    doNotAbsorb: ['database schema dialects', 'allocator-specific policy', 'storage engine implementation'],
    evidenceLevel: 'BOUNDED_TYPED_ABI_AND_MEMORY_CANDIDATE',
    sourceEvidence: ['src/type-module-kernel.mjs', 'src/typed-package-kernel.mjs', 'src/typed-reference-abi.mjs', 'src/typed-heap-layout.mjs', 'src/typed-gc-snapshot.mjs'],
    promotion: 'Unify repeated typed data contracts without confusing typed package delivery with RCL semantic ownership.',
  },
  {
    id: 'rcl.ui.native-app.v0.1',
    idStatus: 'EXISTING_CANDIDATE_ID',
    classification: 'FRAMEWORK_CANDIDATE',
    status: 'CANDIDATE_ONLY',
    formalNameEn: 'RCL Weave Application Framework',
    friendlyNameEn: 'RCL Weave',
    formalNameZh: 'RCL 织界应用框架',
    friendlyNameZh: '织界',
    semanticOwner: 'RCL',
    purpose: 'Compile one RCL Native UI semantic program into rooted target lowerings and shared semantic replay.',
    developerValue: ['one source for Web and Android candidate targets', 'reactive state and typed local events', 'navigation, lifecycle and adaptive layout primitives'],
    userValue: ['consistent interaction meaning across target organs', 'state restoration and accessibility labels in the contract'],
    nativeSemantics: ['UI state', 'derived values', 'view roles', 'bindings', 'local events', 'layout', 'style', 'lifecycle', 'navigation', 'width adaptation'],
    composes: ['rcl.core.language.v0.1', 'rcl.reality.transaction.v0.1'],
    lowersTo: ['rcl.native-ui.web-lowering.v0.1', 'rcl.native-ui.android-lowering.v0.1'],
    doNotAbsorb: ['DOM/CSS grammar', 'Android View grammar', 'React/Compose implementation', 'browser/device runtime'],
    evidenceLevel: 'HOST_SEMANTIC_REPLAY_CANDIDATE',
    sourceEvidence: ['src/ui/ui-schema.mjs', 'src/ui/ui-ir.mjs', 'src/ui/ui-compiler.mjs', 'src/ui/ui-event.mjs', 'src/ui/web-ui-backend.mjs', 'src/ui/android-ui-backend.mjs', 'src/application-framework.mjs'],
    promotion: 'Expand accessibility, resources, async/data and real target evidence; do not promote from host replay alone.',
  },
  {
    id: 'rcl.dev.trace.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'NATIVE_CORE_CANDIDATE',
    status: 'TOOLING_SEMANTIC_CANDIDATE',
    formalNameEn: 'RCL Trace and Replay Framework',
    friendlyNameEn: 'RCL Trace',
    formalNameZh: 'RCL 追踪与回放框架',
    friendlyNameZh: '迹流',
    semanticOwner: 'RCL for source/execution meaning; host adapters for IDE transport',
    purpose: 'Make source maps, execution traces, replay, debug sessions and profiler evidence first-class around RCL programs.',
    developerValue: ['reproducible failure replay', 'source-to-runtime inspection', 'evidence-bearing debugging'],
    userValue: ['clear explanation of failed or refused transitions'],
    nativeSemantics: ['RCL source locations', 'execution events', 'replay inputs', 'state/effect trace identity'],
    composes: ['rcl.core.language.v0.1', 'rcl.core.runtime.v0.1', 'rcl.reality.transaction.v0.1'],
    lowersTo: ['LSP', 'DAP', 'IDE panels', 'flamegraph and host profiler output'],
    doNotAbsorb: ['editor protocol ownership', 'IDE UI toolkit', 'host process debugger implementation'],
    evidenceLevel: 'SOURCE_BACKED_TOOLING_CANDIDATE',
    sourceEvidence: ['src/debug-replay-runtime.mjs', 'src/debug-session-runtime.mjs', 'src/profiler-debug-ui-runtime.mjs', 'src/lsp-dap-bridge-runtime.mjs'],
    promotion: 'Keep semantic trace contracts in RCL and transport protocols in adapters; prove replay stability across more runtime targets.',
  },
  {
    id: 'rcl.knowledge.simulation.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'NATIVE_DOMAIN_CANDIDATE',
    status: 'DOMAIN_CANDIDATE',
    formalNameEn: 'RCL Knowledge and Simulation Framework',
    friendlyNameEn: 'RCL Atlas',
    formalNameZh: 'RCL 知识与模拟框架',
    friendlyNameZh: '知域',
    semanticOwner: 'RCL for declared domain semantics; specialized solvers/providers remain auxiliary',
    purpose: 'Provide native semantic building blocks for quantities, knowledge, cognition, spacetime, experiments and bounded simulations.',
    developerValue: ['domain values with explicit meaning', 'experiment and simulation contracts', 'shared scientific/cognitive primitives'],
    userValue: ['uncertainty and evidence can remain visible in domain applications'],
    nativeSemantics: ['quantities and measurements', 'knowledge claims', 'cognitive values', 'spacetime points', 'experiment/result contracts'],
    composes: ['rcl.core.language.v0.1', 'rcl.reality.transaction.v0.1'],
    lowersTo: ['reference simulations', 'specialized numerical providers', 'research/product Packs'],
    doNotAbsorb: ['arbitrary scientific solver implementations', 'model training frameworks', 'claims about external reality without evidence'],
    evidenceLevel: 'DOMAIN_SEMANTIC_CANDIDATE',
    sourceEvidence: ['src/foundation.mjs', 'src/quantity.mjs', 'src/knowledge.mjs', 'src/cognition.mjs', 'src/meta-planes.mjs', 'src/reality-compiler-kernel.mjs'],
    promotion: 'Split reusable semantic primitives from domain-specific models and require independent correctness evidence before core promotion.',
  },
  {
    id: 'rcl.app.launchpad.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'PACK_CANDIDATE',
    status: 'PACK_CANDIDATE',
    formalNameEn: 'RCL Rapid Application Launchpad',
    friendlyNameEn: 'RCL Launchpad',
    formalNameZh: 'RCL 快速应用启动框架',
    friendlyNameZh: '启界',
    semanticOwner: 'RCL contracts; host shell and product presentation are auxiliary',
    purpose: 'Compose Weave, product entry, evidence loop and common app shell patterns for fast application starts.',
    developerValue: ['starter templates', 'goal-to-plan and preview surfaces', 'common navigation and evidence defaults'],
    userValue: ['shorter path from idea to understandable runnable surface'],
    nativeSemantics: ['only the RCL-owned contracts it composes'],
    composes: ['rcl.ui.native-app.v0.1', 'rcl.app.product-entry.v0.65', 'rcl.dev.evidence-loop.v0.1'],
    lowersTo: ['host UI shell', 'RCLApp/package artifacts'],
    doNotAbsorb: ['generic widget AST', 'product branding rules', 'framework-specific component implementations'],
    evidenceLevel: 'PACK_ARCHAEOLOGY_CANDIDATE',
    sourceEvidence: ['src/reality-product-entry-runtime.mjs', 'src/evidence-product-shell-runtime.mjs', 'src/application-framework.mjs'],
    promotion: 'Keep as Pack until reusable shell semantics are separated from presentation templates and tested across multiple apps.',
  },
  {
    id: 'rcl.delivery.shipyard.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'PACK_CANDIDATE',
    status: 'HOST_BACKED_PACK',
    formalNameEn: 'RCL Multi-target Delivery Pack',
    friendlyNameEn: 'RCL Shipyard',
    formalNameZh: 'RCL 多目标交付框架',
    friendlyNameZh: '交付坞',
    semanticOwner: 'RCL package/release contracts; host packagers own build mechanics',
    purpose: 'Lock, cache, package, verify and release RCL artifacts across configured targets.',
    developerValue: ['repeatable target matrix', 'hardened package manifests', 'release verification'],
    userValue: ['installable artifacts with explicit evidence boundaries'],
    nativeSemantics: ['package identity and verification contract'],
    composes: ['rcl.package-compiler.v0.24', 'rcl.package-ecosystem.v0.42', 'rclapp-kernel.v0.24'],
    lowersTo: ['Node/native VM', 'Gradle/Android SDK', 'host filesystem'],
    doNotAbsorb: ['Gradle semantics', 'SDK behavior', 'release-signing custody'],
    evidenceLevel: 'HOST_BACKED_PACK',
    sourceEvidence: ['src/package-compiler.mjs', 'src/package-ecosystem-runtime.mjs', 'src/rclapp-kernel.mjs'],
    promotion: 'Remain Pack/backend; add native-UI-aware build/verify only through explicit contracts.',
  },
  {
    id: 'rcl.forge.domain.v0.1',
    idStatus: 'EXISTING_BOUNDARY_ID',
    classification: 'PACK_CANDIDATE',
    status: 'DOMAIN_PACK',
    formalNameEn: 'RCL Domain Forge Pack',
    friendlyNameEn: 'RCL Forge',
    formalNameZh: 'RCL 领域 Forge 包',
    friendlyNameZh: '领域工坊',
    semanticOwner: 'RCL contracts; domain Forge/provider owns specialized implementation',
    purpose: 'Offer fast domain starts for app, media and neural prototypes without polluting Core.',
    developerValue: ['domain-specific templates', 'less prototype boilerplate', 'bounded deterministic demos'],
    userValue: ['faster domain-specific first experiences'],
    nativeSemantics: ['only shared RCL contracts declared by the Pack'],
    composes: ['app-forge', 'media-forge', 'neuro-forge'],
    lowersTo: ['domain renderers', 'media runtimes', 'neural providers'],
    doNotAbsorb: ['domain-specific rendering', 'model trainer internals', 'provider-only data formats'],
    evidenceLevel: 'EXISTING_PACK_BOUNDARY',
    sourceEvidence: ['src/forge/app-forge.mjs', 'src/forge/media-forge.mjs', 'src/forge/neuro-forge.mjs'],
    promotion: 'Keep Pack/Auxiliary unless a repeated cross-domain semantic primitive is independently extracted.',
  },
  {
    id: 'rcl.provider.gate.v0.1',
    idStatus: 'PROPOSED_ATLAS_ID',
    classification: 'AUXILIARY_PROVIDER',
    status: 'AUXILIARY_BOUNDARY',
    formalNameEn: 'RCL Provider Capability Gate',
    friendlyNameEn: 'RCL Gate',
    formalNameZh: 'RCL Provider 能力门',
    friendlyNameZh: '能力门',
    semanticOwner: 'RCL owns request/authority/evidence contract; provider owns implementation',
    purpose: 'Bound external network, filesystem, media, model, hardware and other specialized capabilities.',
    developerValue: ['timeouts and concurrency limits', 'resource isolation', 'provider receipts'],
    userValue: ['external capability use remains bounded and inspectable'],
    nativeSemantics: ['capability request shape', 'authority boundary', 'receipt/evidence requirement'],
    composes: ['rcl.provider-runtime.v2', 'resource-isolation-kernel', 'resource-wal-runtime'],
    lowersTo: ['network', 'filesystem', 'media', 'model', 'hardware and specialized hosts'],
    doNotAbsorb: ['provider-specific correctness', 'external credential custody', 'host implementation semantics'],
    evidenceLevel: 'AUXILIARY_PROVIDER_BOUNDARY',
    sourceEvidence: ['src/provider-runtime-v2.mjs', 'src/resource-isolation-kernel.mjs', 'src/resource-wal-runtime.mjs', 'src/rncs-bridge.mjs'],
    promotion: 'Never promote the bridge itself; only extract a general RCL semantic primitive when repeated evidence supports it.',
  },
];

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

for (const item of RAW_ATLAS) {
  if (!RCL_NATIVE_FRAMEWORK_CLASSIFICATIONS.includes(item.classification)) {
    throw new Error(`RCL_NATIVE_FRAMEWORK_ATLAS_CLASSIFICATION:${item.classification}`);
  }
  if (!item.formalNameEn || !item.friendlyNameEn || !item.formalNameZh || !item.friendlyNameZh) {
    throw new Error(`RCL_NATIVE_FRAMEWORK_ATLAS_NAME_MISSING:${item.id}`);
  }
}

export const RCL_NATIVE_FRAMEWORK_ATLAS = deepFreeze(RAW_ATLAS);

export function listRclNativeFrameworks({ classification = null, status = null } = {}) {
  if (classification !== null && !RCL_NATIVE_FRAMEWORK_CLASSIFICATIONS.includes(classification)) {
    throw new Error(`RCL_NATIVE_FRAMEWORK_ATLAS_CLASSIFICATION:${classification}`);
  }
  return clone(RCL_NATIVE_FRAMEWORK_ATLAS.filter(item =>
    (classification === null || item.classification === classification)
    && (status === null || item.status === status)));
}

export function getRclNativeFramework(id) {
  const match = RCL_NATIVE_FRAMEWORK_ATLAS.find(item => item.id === id);
  return match ? clone(match) : null;
}

export function assessRclNativeFrameworkAtlas() {
  const classifications = Object.fromEntries(RCL_NATIVE_FRAMEWORK_CLASSIFICATIONS.map(item => [item, 0]));
  for (const item of RCL_NATIVE_FRAMEWORK_ATLAS) classifications[item.classification] += 1;
  const native = RCL_NATIVE_FRAMEWORK_ATLAS.filter(item => item.classification.startsWith('NATIVE_') || item.classification === 'FRAMEWORK_CANDIDATE');
  const report = {
    format: RCL_NATIVE_FRAMEWORK_ATLAS_FORMAT,
    version: RCL_NATIVE_FRAMEWORK_ATLAS_VERSION,
    status: 'INVENTORY_CANDIDATE_ONLY',
    count: RCL_NATIVE_FRAMEWORK_ATLAS.length,
    nativeFrameworks: native.map(item => ({ id: item.id, friendlyNameEn: item.friendlyNameEn, friendlyNameZh: item.friendlyNameZh })),
    classifications,
    rule: 'Native means RCL owns semantics; implementation may lower to a backend. Atlas membership does not promote a framework.',
    root: null,
  };
  report.root = realityRoot({ ...report, root: undefined });
  return Object.freeze(report);
}
