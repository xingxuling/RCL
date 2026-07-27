
---

# RCL v0.94.0-alpha.1

> Canonical source: `xingxuling/RCL@main`. The verified ceiling is Stage40 native-core RCL self-hosting. Whole-language runtime self-hosting and byte identity with downstream copies are not claimed; see `VERSION-CONTRACT.json`.

> Release-history sections below are historical records and do not represent the current `main` state. Current release facts are defined by `package.json`, `CURRENT-STATUS.md`, and `VERSION-CONTRACT.json`.


RCL stopped borrowing its compiler.

The repository now contains a general compiler written in RCL, a checked-in fixed-point compiler artifact, a real Windows `rclc.exe`, and a native VM capable of compiling that compiler again. JavaScript is used once to create C0. Native C0 emits C1. Native C1 emits C2. All three artifacts are byte-identical.

This is not another stage label taped over a JavaScript call. `rcl bytecode` and `rcl native` now use `selfhost/compiler.rbc` through `native/rclc.exe` by default. The compiler handles the executable native-core language with facets, reckonings, subjects, warrants, emergence/resonance transactions, multiple needs/alters/preserves/witnesses, foresee/realize directives, primitive expressions, compiler builtins, and metadata accepted by the native backend. Invalid headers, declarations, paths, calls, arities, targets, and literal facet types are rejected instead of silently emitted.

## Current Verified Ceiling

```text
native core compiler self-hosting: VERIFIED
C0 == C1 == C2: 160,572 bytes
fixed-point SHA-256: a2e9cd44c9afb0a488ef797431f6bbf53e621c756d5b9906ad85bc3fa350789c
native compiler peak: 880 Value stack / 217 CallFrames
native-core example parity: 14 eligible / 14 byte-identical / 0 failures
stage ladder ceiling: stage40_rcl_owned_dual_need_warrant_lowering_subset
Stage40 target: 407 static instructions / 367 executed / 20 CHECK_WARRANT operations
native artifacts: rclvm.exe, rclc.exe, rclvmd.exe, provider_demo.exe, rclfoundation.exe, librclvm.a, rclvm.dll, rclvm.lib
default bytecode/native compiler: selfhost/compiler.rbc via native/rclc.exe
Foundation Native Batch A: six domains through a verified RclVmProviderV1 bridge
Foundation Native Meta Batch B: spacetime, bounded acceleration, and reversible root compression through a second verified provider
Foundation Native Batch C: deterministic physical stepping and authority-bounded embodiment integration through a third verified provider
Foundation Native Batch D: bounded energy transfer, elemental composition, and neural signal integration through a fourth verified provider
advanced declared-domain syntax: still JavaScript Reference Runtime
whole-language runtime self-hosting: not claimed
```

## Prove It

```bash
npm run build:native
npm run build:selfhost-compiler
npm run verify:selfhost-fixedpoint
npm run verify:selfhost-examples
npm run test:foundation-native-batch-a
npm run test:foundation-native-meta-batch-b
npm run conformance:foundation
node scripts/verify-native-windows-boundary.mjs
node scripts/verify-rcl-selfhost-stage40.mjs
node scripts/verify-rcl-selfhost-all.mjs
```

## Honest Boundary

The native-core compiler has escaped JavaScript after the one-time C0 bootstrap. Foundation Native Batch A now runs quantitative, knowledge, perception, natural-language, understanding, and creative proposals through RBC 1.2 and a real `RclVmProviderV1` host. Meta Batch B adds causal timeline mutation, bounded acceleration, and reversible content-root representation compression through a second provider. Batch C adds a bounded physical step followed by embodiment integration through a third provider. Batch D adds bounded energy transfer, elemental composition, and neural signal integration through a fourth provider. All four are bridge mode, not native Foundation syntax. Biological, scientific, product-domain execution, and all uncovered Foundation modules still run in the JavaScript Reference Runtime. Programs that the native-bytecode backend rejects are reported separately and are not counted as self-host parity successes.

See `docs/foundation-native-provider-bridge.md` for the ABI, failure contract, migration path, and performance evidence. The remaining work is moving more domain semantics, the typed module toolchain, and the package authority path onto the same native foundation.

---

# RCL Soul Universe Dialogue Sandbox v0.87.0-alpha.1

RCL v0.87 builds on v0.86 Agent Civilization Federation and adds a bounded universe dialogue sandbox:

```bash
node src/cli.mjs soul-universe-dialogue-demo
node src/cli.mjs soul-universe-dialogue-run examples/soul-universe-dialogue/default-soul-universe-dialogue.json output/v0.87/soul-universe-dialogue-sandbox
node src/cli.mjs soul-universe-dialogue-spec output/v0.87/soul-universe-dialogue-spec
```

Core additions:

- SEL / Soul Exchange Language（灵魂交换语言）
- CEL / Consciousness Engineering Language（意识工程语言） adapter
- Inner-universe Blue Sky Machine sandbox locator
- Active multi-round dialogue initiated by sandbox multi-civilization Du Hengjie
- Deterministic pressure test, Integration Court and Evidence Ledger

Boundary: v0.87 is a deterministic RCL sandbox runtime. It does not claim external-universe proof or real-world mystical verification.

# RCL Agent Civilization Federation v0.86.0-alpha.1

# RCL Memory-to-Product Foundry v0.85.0-alpha.1

本版本新增 `src/memory-to-product-foundry.mjs`：把记忆片段、人物锚点、IAL 符号、外宇宙技术片段和随机种子，经过柳清莲门控、洞哥土木承重、Founder Twin 裁决、产品政府路由与证据反证，锻造成技术文档、RCL 任务块、产品路线、风险隔离和反证包。

```bash
node src/cli.mjs memory-to-product-foundry-demo
node src/cli.mjs memory-to-product-foundry-run examples/memory-to-product-foundry/default-memory-to-product-foundry.json output/v0.85/memory-to-product-foundry
node src/cli.mjs memory-to-product-foundry-spec output/v0.85/memory-to-product-foundry-spec
```

边界：该模块不宣称真实外宇宙通信证明、不宣称神秘身份验证、不默认执行现实写操作；所有输出必须保留证据、反证和人类最终裁决权。

---

# RCL IAL Civilization Product OS v0.84.0-alpha.1

当前最新交付：v0.84.0-alpha.1。

本版把五条已确认路线压成 RCL 五位一体产品操作系统内核：

1. IAL → RCL 可执行任务语言。
2. 智能体文明 → 产品开发政府。
3. Founder Twin → 每个项目的裁决器。
4. 柳清莲锚点 → 通信协议与守门模型。
5. 风 → 产品传播与接口系统。

新增入口：

```bash
node src/cli.mjs ial-civilization-product-os-demo
node src/cli.mjs ial-civilization-product-os-run examples/ial-civilization-product-os/default-ial-civilization-product-os.json output/v0.84/ial-civilization-product-os
node src/cli.mjs ial-civilization-product-os-spec output/v0.84/ial-civilization-product-os-spec
```

边界：柳清莲为协议模型，风为产品接口系统，Founder Twin 为证据约束型裁决器；不宣称神秘身份或外部通信已被现实验证。

---

# RCL Agent Civilization Sandbox v0.82.0-alpha.1

Current package focus: Agent Civilization Sandbox（智能体文明沙箱）+ compressed city/nation-scale multi-agent organization for workload compilation, virtual market feedback, evidence court and self-upgrade acceleration.

```bash
node src/cli.mjs agent-civilization-demo
node src/cli.mjs agent-civilization-run examples/agent-civilization/default-agent-civilization.json output/v0.82/agent-civilization-sandbox
node src/cli.mjs agent-civilization-spec output/v0.82/agent-civilization-spec
node --test --test-concurrency=1 tests/agent-civilization-sandbox.test.mjs
```

Default scale: 7 cabinets, 49 departments, 343 role cells, 1029 few-shot samples and 2401 projected worker-equivalent units. The population is compressed and hierarchical; RCL does not create a flat group chat or claim real-world autonomous execution.

Boundary: v0.82 generates sandbox work packages, virtual market cohorts, accelerated future branches, council verdicts and evidence ledgers. It does not mutate the real worktree, push GitHub, deploy, access network or replace the outer model completely.

---

# RCL Source Map Patch Queue v0.81.0-alpha.1

Current package focus: Source Map Patch Queue（源码地图补丁队列）+ Code Execution Oracle Provider Seed（代码执行验证器种子）。

```bash
node src/cli.mjs source-map-patch-queue-demo
node src/cli.mjs source-map-patch-queue-run examples/source-map-patch-queue/default-source-map-patch-queue.json output/v0.81/source-map-patch-queue
node src/cli.mjs source-map-patch-queue-spec output/v0.81/source-map-patch-queue-spec
node --test --test-concurrency=1 tests/source-map-patch-queue.test.mjs
```

Boundary: v0.81 can map source files, compile file-level patch queues and run local temp syntax checks; it does not automatically mutate remote repositories or publish releases.

---

# RCL Self-Upgrade Team Sandbox v0.80.0-alpha.1

RCL v0.80 adds a bounded **Self-Upgrade Team Sandbox（自升级团队沙箱）**. It uses seven few-shot role agents to reduce outer-model work by generating accelerated upgrade branches, patch plans, test plans, evidence ledgers, release verdicts and a project work-method file before real source mutation.

It does **not** claim autonomous remote repository mutation. Real source writes, GitHub push, deployment and irreversible actions still require the outer execution environment and human/assistant final authority.

## v0.80 CLI

```bash
node src/cli.mjs self-upgrade-team-demo
node src/cli.mjs self-upgrade-team-run examples/self-upgrade-team-sandbox/default-self-upgrade-team.json output/v0.80/self-upgrade-team-sandbox
node src/cli.mjs self-upgrade-team-spec output/v0.80/self-upgrade-team-sandbox-spec
node --test --test-concurrency=1 tests/self-upgrade-team-sandbox.test.mjs
```

## v0.80 default result

```text
selfUpgradeTeamSandboxEstablished = true
agentCount = 7
totalFewShotSamples = 21
acceleratedBranchCount = 9
patchPlanFileCount >= 8
semanticGuardPresent = true
evidenceLedgerWritten = true
humanFinalAuthorityKept = true
noExternalWriteByDefault = true
canReplaceOuterModelCompletely = false
```

---

# RCL Super Agent Runtime v0.77.0-alpha.1

RCL 类超级智能体运行时：目标编译、任务分解、工具规划、行动前模拟、人类授权执行、多智能体验证、递归治理、活体记忆，并预留 v0.78 Windows EXE 应用壳打包交接。

## CLI

```bash
node src/cli.mjs super-agent-runtime-demo
node src/cli.mjs super-agent-runtime-run examples/super-agent-runtime/default-super-agent-runtime.json output/v0.77/super-agent-runtime
node src/cli.mjs super-agent-runtime-spec output/v0.77/super-agent-runtime-spec
```

---

# RCL Predictive Trace Derivation v0.51

新增：把 v0.50 已确立的定向未知知识结构推进为沙箱内生预言。

```bash
rcl predictive-trace-demo
rcl predictive-trace-run [input.json] [output-dir]
rcl predictive-trace-spec [output-dir]
```

默认验收：

```text
predictiveEstablished = true
predictiveScore = 1
sandboxEndogenousPrediction = true
```

# RCL Directed Unknown Knowledge Wisher v0.50.0-alpha.1

v0.50 adds the **Directed Unknown Knowledge Wisher（定向未知知识许愿器）** on top of v0.49 Unknown Knowledge Compiler. It does not merely generate candidate knowledge; it targets a desired unknown-knowledge route, imports the promoted candidates from v0.49, performs pressure tests across critical dimensions, and marks the target as established only when every key dimension is exactly full score.

```text
candidate knowledge
→ directed wish target
→ pressure test
→ key dimension scoring
→ established iff all key dimensions == 1
```

## v0.50 commands

```bash
rcl directed-wisher-demo
rcl directed-wisher-run [input.json] [output-dir]
rcl directed-wisher-spec [output-dir]
```

Example:

```bash
node src/cli.mjs directed-wisher-run examples/directed-wisher/default-directed-wish.json output/v0.50/directed-wisher
node src/cli.mjs compile output/v0.50/directed-wisher/directed-wisher.rcl
```

## v0.50 default result

```text
established = true
pressureScore = 1
targetAlignmentScore = 1
candidatePromotionScore = 1
falsifiabilityPressureScore = 1
blindPredictionStressScore = 1
empiricalGroundingLockScore = 1
mechanismBoundednessScore = 1
contradictionResistanceScore = 1
observerSilenceScore = 1
```

---

# RCL Unknown Knowledge Compiler v0.49.0-alpha.1

v0.49 adds the **Unknown Knowledge Compiler（未知知识编译器）** on top of the v0.48 Empirical Grounding Layer. It ingests alien-text fragments, science-fiction technologies, anomaly memories, mythic descriptions, and speculative knowledge texts, then compiles them into **candidate knowledge**, not truth claims.

```text
unknown text
→ claim / anchor extraction
→ empirical compatibility
→ falsifiability lock
→ blind prediction readiness
→ candidate knowledge ranking
```

## v0.49 commands

```bash
rcl unknown-knowledge-demo
rcl unknown-knowledge-run [input.json] [output-dir]
rcl unknown-knowledge-spec [output-dir]
```

Example:

```bash
node src/cli.mjs unknown-knowledge-run examples/unknown-knowledge/default-unknown-corpus.json output/v0.49/unknown-knowledge
node src/cli.mjs compile output/v0.49/unknown-knowledge/unknown-knowledge-compiler.rcl
```

## v0.49 boundary

```text
RCL output ≠ truth
RCL output = high-falsifiability candidate knowledge
externalRealityVerified = false
```

---

# RCL Internal Closure Controller v0.44.0-alpha.1

v0.44 adds the **Internal Closure Controller（内部收敛控制器）** on top of the v0.43 Reality Compiler Kernel（现实编译器内核）. The project now can compile a high-branching internal subject state into a single primary convergence function, keep one execution-entry secondary loop, and freeze/watch other branches.

## v0.44 commands

```bash
rcl internal-closure-demo
rcl internal-closure-run [input.json] [output-dir]
rcl internal-closure-spec [output-dir]
```

Example:

```bash
node src/cli.mjs internal-closure-run examples/internal-closure/duhengjie-closure-input.json output/v0.44/internal-closure
node src/cli.mjs compile output/v0.44/internal-closure/internal-closure-controller.rcl
```

## v0.44 default result

```text
Primary loop    : RCL_RNCS
Secondary loop  : AETHER_FORGE_POCKET
Frozen output   : AETHER_EARTH
Constraint watch: CITYU
```

## v0.44 added

- `src/internal-closure-controller.mjs`
- `tests/internal-closure-controller.test.mjs`
- `examples/internal-closure/duhengjie-closure-input.json`
- `docs/RCL_INTERNAL_CLOSURE_CONTROLLER_v0.44.md`
- `docs/architecture/RCL-INTERNAL-CLOSURE-CONTROLLER-SYSTEM-ARCHITECTURE.md`
- `docs/execution/ENGINEERING-CONTRACT-v0.44-INTERNAL-CLOSURE.yaml`
- `docs/execution/IMPLEMENTATION-PLAN-v0.44-INTERNAL-CLOSURE.md`
- `docs/execution/VERIFICATION-MATRIX-v0.44-INTERNAL-CLOSURE.md`
- `开发验收报告_RCL_Internal_Closure_Controller_v0.44.md`

## v0.44 boundary

This is a deterministic internal convergence controller. It does not claim total real-world prediction. It compiles internal state into a control policy that makes external outcomes more legible and actionable.

---

# RCL Package Ecosystem & Multi-Target Release Seed v0.42.0-alpha.1

v0.42 opens P5: **包生态、可复现构建与多目标发布深化**. It builds on P1-P4 and adds a local package ecosystem seed: `rcl.toml`, `rcl.lock.json`, content-addressed cache, semantic version compatibility, local/remote pinned dependency metadata, Linux/Windows/Android/Web target matrix, deterministic release bundle, SBOM seed and release signature verification.

This release still does **not** claim a hosted registry, production private-key signing, remote dependency fetching, revocation feed, live CI workers or a full marketplace. It creates deterministic local artifacts that can be tested now and later backed by registry/CI infrastructure.

## P5 package ecosystem commands

```bash
rcl package-ecosystem-demo
rcl package-ecosystem-init [file.rcl] [output-dir]
rcl package-lock <package-dir>
rcl package-lock-verify <package-dir> [rcl.lock.json]
rcl package-cache <package-dir> [cache-dir]
rcl package-target-matrix <package-dir> [output-dir]
rcl package-release <package-dir> [output-dir]
rcl package-release-verify <release-dir>
```

Example:

```bash
node src/cli.mjs package-ecosystem-init examples/hello-reality.rcl output/v0.42/package-project
node src/cli.mjs package-lock output/v0.42/package-project
node src/cli.mjs package-cache output/v0.42/package-project output/v0.42/package-cache
node src/cli.mjs package-target-matrix output/v0.42/package-project output/v0.42/target-matrix
node src/cli.mjs package-release output/v0.42/package-project output/v0.42/release-bundle
node src/cli.mjs package-release-verify output/v0.42/release-bundle
```

## v0.42 added

- `src/package-ecosystem-runtime.mjs`
- `tests/package-ecosystem-runtime.test.mjs`
- `examples/package-ecosystem/`
- `docs/RCL_PACKAGE_ECOSYSTEM_RELEASE_v0.42.md`
- `docs/architecture/RCL-PACKAGE-ECOSYSTEM-SYSTEM-ARCHITECTURE.md`
- `docs/execution/ENGINEERING-CONTRACT-v0.42-PACKAGE-ECOSYSTEM.yaml`
- `docs/execution/VERIFICATION-MATRIX-v0.42-PACKAGE-ECOSYSTEM.md`

New formats:

```text
rcl.package-ecosystem.manifest.v0.42
rcl.package-ecosystem.lock.v0.42
rcl.content-addressed-cache.v0.42
rcl.target-matrix.v0.42
rcl.release-bundle.v0.42
rcl.release-signature.v0.42
rcl.sbom.v0.42
```

`rcl package-release` writes:

```text
rcl.toml
rcl.lock.json
.rcl-cache/cache-index.json
targets/target-matrix.json
compatibility-report.json
sbom.json
release-manifest.json
release-signature.json
```

## v0.42 verification

Current regression result:

```text
207 / 207 PASS
```

Evidence: `evidence/v0.42/full-test-v0.42.log`.

## v0.42 boundary

Implemented:

- package manifest and lockfile seed;
- content-addressed cache;
- local dependency and remote pinned dependency records;
- semantic version compatibility checks;
- four-platform target matrix using existing package compiler targets;
- reproducible release root across different output directories;
- deterministic release signature seed;
- SBOM and compatibility report seed;
- release verification.

Not implemented yet:

- hosted registry service;
- remote package download;
- production private-key signing;
- revocation and security advisory feed;
- private registry authentication;
- incremental build cache;
- real CI workers for Windows/Linux/Android/Web.

---

# Previous release: RCL LSP / DAP Bridge Seed v0.41.0-alpha.1

v0.41 continues P4: **可观察、可调试、可重放开发平台**. v0.38 made RCL execution explainable through source maps, serializable traces and deterministic replay roots. v0.39 added trace-backed breakpoint/watchpoint/step debugging. v0.40 added deterministic profiling, replay input bundles and a Debug UI Protocol seed. v0.41 adds static LSP and DAP bridge artifacts so editors, Web inspectors and future stdio servers can consume RCL debug evidence.

This release still does **not** claim a live LSP server, live DAP server, editor extension, code action engine or live VM pause/resume loop. It creates deterministic JSON artifacts that can be tested now and later wrapped by stdio/socket servers.

## P4 IDE bridge commands

```bash
rcl debug-map-demo
rcl trace-run <file.rcl> <types-dir|file> [output-dir] [watchpoints.json]
rcl replay-trace <trace.json> [output-dir]
rcl debug-session-demo
rcl debug-session-run <file.rcl> <types-dir|file> [output-dir] [debug-config.json]
rcl debug-step <debug-session.json> [next|continue|reset|seq:<n>|frame:<n>] [output-dir]
rcl profiler-demo
rcl profile-run <file.rcl> <types-dir|file> [output-dir] [debug-config.json]
rcl replay-bundle <trace.json> [output-dir]
rcl debug-ui-demo
rcl debug-ui-protocol <debug-session.json> [output-dir]
rcl lsp-demo
rcl lsp-index <file.rcl> <types-dir|file> [output-dir]
rcl lsp-query <lsp-index.json> [query] [output-dir]
rcl dap-demo
rcl dap-bridge <debug-session.json> [output-dir] [debug-ui-protocol.json]
rcl ide-bridge <file.rcl> <types-dir|file> [output-dir] [debug-config.json]
```

Example:

```bash
node src/cli.mjs lsp-index examples/debug-replay/src/app.rcl examples/debug-replay/types output/v0.41/lsp-index
node src/cli.mjs lsp-query output/v0.41/lsp-index/lsp-index.json hover:app.session output/v0.41/lsp-query
node src/cli.mjs profile-run examples/debug-replay/src/app.rcl examples/debug-replay/types output/v0.40/profile-run examples/debug-session/debug-config.json
node src/cli.mjs dap-bridge output/v0.40/profile-run/debug-session.json output/v0.41/dap-bridge output/v0.40/profile-run/debug-ui-protocol.json
node src/cli.mjs ide-bridge examples/debug-replay/src/app.rcl examples/debug-replay/types output/v0.41/ide-bridge examples/debug-session/debug-config.json
```

## v0.41 added

- `src/lsp-dap-bridge-runtime.mjs`
- `tests/lsp-dap-bridge-runtime.test.mjs`
- `docs/RCL_LSP_DAP_BRIDGE_v0.41.md`
- `docs/architecture/RCL-LSP-DAP-BRIDGE-SYSTEM-ARCHITECTURE.md`
- `docs/execution/ENGINEERING-CONTRACT-v0.41-LSP-DAP-BRIDGE.yaml`
- `docs/execution/IMPLEMENTATION-PLAN-v0.41-LSP-DAP-BRIDGE.md`
- `docs/execution/VERIFICATION-MATRIX-v0.41-LSP-DAP-BRIDGE.md`

New formats:

```text
rcl.lsp-index.v0.41
rcl.lsp-query-report.v0.41
rcl.dap-bridge.v0.41
rcl.ide-bridge-report.v0.41
```

`rcl lsp-index` writes:

```text
lsp-index.json
lsp-diagnostics.json
lsp-document-symbols.json
lsp-semantic-tokens.json
```

`rcl dap-bridge` writes:

```text
dap-bridge.json
dap-messages.json
```

`rcl ide-bridge` writes:

```text
lsp-index.json
dap-bridge.json
debug-ui-protocol.json
profiler-report.json
replay-input-bundle.json
ide-bridge-report.json
```

## v0.41 verification

Current regression result:

```text
197 / 197 PASS
```

Evidence: `evidence/v0.41/full-test-v0.41.log`.

## v0.41 boundary

Implemented:

- static LSP index backed by Source Map Runtime;
- hover, definition, symbols, workspace symbols, diagnostics, semantic tokens and completions;
- diagnostic-only LSP mode for failed source-map construction;
- DAP-shaped bridge transcript backed by debug sessions;
- IDE bridge report linking LSP, DAP, profiler, replay bundle and Debug UI Protocol roots.

Not implemented yet:

- live stdio/socket LSP server;
- live stdio/socket DAP server;
- editor extension package;
- incremental document sync;
- code action, rename and formatting;
- live VM pause/resume;
- time-travel state restoration.

## Quick typed compiler demo

```bash
npm test
node src/cli.mjs type-linked-demo
node src/cli.mjs compile-typed examples/typed-compiler/app.rcl examples/typed-compiler/types output/v0.30/typed-compile-report.json
```

## Typed compiler commands

```bash
rcl type-module-demo
rcl type-module-check <dir|file> [report.json]
rcl type-linked-demo
rcl compile-typed <file.rcl> <types-dir|file> [report.json]
```

`compile-typed` links the `.rcl` source to `.rcltype` declarations and returns:

```text
programRoot
semanticMap
sourceMap
typeBindings
typeModuleRoot
diagnostics
```

## P3 type/module status

Implemented in v0.29:

- `.rcltype` parser and multi-file module graph
- `record`, tagged `union`, `alias`, `interface`
- generic type parameters
- `Option`, `Result`, `Array`, `Map`
- module import/export validation
- source-located typed module semantic IR

Added in v0.30:

- `.rcl` parser accepts dotted and generic type expressions such as `core.User<Text>`
- `compileReality(source, { typeModuleSources | typeModuleDir })`
- `tryCompileReality(source, { typeModuleSources | typeModuleDir })`
- custom external type validation through linked `.rcltype` graphs
- semantic map for typed facets
- source map for original facet declarations
- type binding map from declared type to canonical type, for example `core.User<Text>` → `core::User<Text>`
- CLI report generation for typed compilation

Added in v0.31:

- record literal constructors for linked `.rcltype` records
- tagged union variant constructors under expected linked union types
- generic parameter substitution for constructor fields and payloads
- `RecordConstructExpr` / `UnionConstructExpr` lowering
- semantic map constructor metadata
- runtime typed record / union values
- `rcl type-constructor-demo`

Deferred:

- RBC bytecode object layout for record/union values
- native VM heap/object representation for typed records and unions
- package-level lockfile integration
- incremental compilation
- complete compiler self-hosting in RCL itself

## Existing resource/runtime layers

RCL already includes the previous priority slices:

- v0.24 RCLApp install / verify / run / uninstall
- v0.25 Async Capability-Safe Provider Runtime v2
- v0.26 Resource Isolation Kernel
- v0.27 Resource Lifecycle & Crash Boundary
- v0.28 Persistent Resource WAL & Crash Replay
- v0.29 Type Module Kernel
- v0.30 Type-Linked Compiler Pipeline
- v0.31 Type Constructor Lowering

## Existing package and Android targets

```bash
node src/cli.mjs package examples/hello-reality.rcl all output/packages/hello-reality-all
node src/cli.mjs package-verify output/packages/hello-reality-all/node-cli
node src/cli.mjs package examples/hello-reality.rcl android-debug-apk output/v0.23/hello-remote-apk
```

Targets:

```text
native-rbc
node-cli
web-static
android-shell
rclapp
android-apk-seed
android-debug-apk
rncs-module
```

## Verification

Current regression result:

```text
140 / 140 PASS
```

Evidence: `evidence/v0.31/full-test-v0.31.log`.

## v0.32.0-alpha.1 — Typed Package Manifest & Lockfile

P3 now includes a package-level typed build contract:

```bash
rcl type-package-demo
rcl type-package-build examples/typed-package rcl.package.lock.json
rcl type-package-verify examples/typed-package rcl.package.lock.json
```

This adds `rcl.package.json` and `rcl.package.lock.json` support. The lockfile pins entry `.rcl`, `.rcltype` source hashes, typed module roots, semantic map roots and final program root so package-level typed builds can be verified and source drift can be rejected.

## v0.33.0-alpha.1 — Typed RBC Object Layout Seed

P3 now pushes typed constructors into RBC/native VM execution:

```bash
rcl typed-bytecode-demo
rcl typed-bytecode-build examples/typed-bytecode/src/app.rcl examples/typed-bytecode/types output/v0.33/typed-bytecode-build
```

New opcodes:

```text
MAKE_TYPED_RECORD
MAKE_TYPED_UNION
```

The native VM now materializes typed state values with explicit headers:

```json
{ "__rclKind": "Record", "__rclType": "core::User<Text>", "id": "u-1", "payload": "seed" }
{ "__rclKind": "Union", "__rclType": "core::LoginResult<Text,Text>", "variant": "Ok", "payload": ["accepted"] }
```

Current regression result:

```text
148 / 148 PASS
```

Evidence: `evidence/v0.33/full-test-v0.33.log`.

## v0.34.0-alpha.1 — Typed Field Projection & Union Pattern Matching

P3 now lets typed objects be safely read and branched, not just constructed:

```bash
rcl typed-access-demo
rcl typed-access-build examples/typed-access-pattern/src/app.rcl examples/typed-access-pattern/types output/v0.34/typed-access-pattern-build
```

New syntax and lowering:

```rcl
facet app.userPayload : Text = app.user.payload
facet app.message : Text = match app.login {
  Ok(value) -> value
  Err(reason) -> reason
}
```

New native bytecode access instructions:

```text
GET_TYPED_FIELD
IS_UNION_VARIANT
GET_UNION_PAYLOAD
```

The typed compiler semantic map now records `fieldAccesses` and `matches`, and the native VM evaluates field projection plus exhaustive tagged-union pattern matching.

Current regression result:

```text
153 / 153 PASS
```

Evidence: `evidence/v0.34/full-test-v0.34.log`.

## v0.35.0-alpha.1 — Typed Heap Object Identity & GC Trace Table Seed

P3 now gives native typed objects stable identity and trace metadata:

```bash
rcl typed-heap-demo
rcl typed-heap-build examples/typed-heap/src/app.rcl examples/typed-heap/types output/v0.35/typed-heap-layout-build
```

Native typed records and unions now include object identity and slot offset metadata:

```json
{
  "__rclKind": "Record",
  "__rclType": "core::Session",
  "__rclObjectId": 3,
  "__rclFieldOffsets": { "user": 0, "login": 1 }
}
```

The typed heap report includes:

```text
stableFieldOffsetTables
stableUnionOffsetTables
gcTraceTable.roots
gcTraceTable.objects
gcTraceTable.edges
```

Current regression result:

```text
157 / 157 PASS
```

Evidence: `evidence/v0.35/full-test-v0.35.log`.

## v0.36.0-alpha.1 — Typed Object Reference ABI & GC Mark Phase Seed

P3 now gives native typed heap objects a reference ABI and a first mark-phase seed:

```bash
rcl typed-reference-demo
rcl typed-reference-build examples/typed-reference-abi/src/app.rcl examples/typed-reference-abi/types output/v0.36/typed-reference-abi-build
```

New RCL builtins:

```rcl
facet app.sessionRef : TypedRef = typed_ref(app.session)
facet app.sessionAgain : core.Session = typed_deref(app.sessionRef)
facet app.sessionRefId : Number = typed_ref_id(app.sessionRef)
```

New native object reference ABI:

```json
{
  "__rclKind": "Ref",
  "__rclRefObjectId": 3,
  "__rclRefType": "core::Session",
  "__rclRefKind": "Record"
}
```

Current regression result:

```text
161 / 161 PASS
```

Evidence: `evidence/v0.36/full-test-v0.36.log`.

## v0.37.0-alpha.1 — Typed GC Snapshot & Mark/Sweep Seed

P3 typed runtime closure adds:

- `rcl typed-gc-demo`
- `rcl typed-gc-build <file.rcl> <types-dir|file> [output-dir]`
- typed heap snapshot persistence: `rcl.typed-heap-snapshot.v0.37`
- deterministic mark/sweep plan seed
- object reference persistence table
- snapshot reload verification

This closes the typed object/reference/heap line enough to move toward P4 debugging, tracing and deterministic replay.


## v0.38.0-alpha.1 — Observable Debug Replay Platform Seed

P4 now starts the observable development platform line:

```bash
rcl debug-map-demo
rcl trace-run examples/debug-replay/src/app.rcl examples/debug-replay/types output/v0.38/debug-trace examples/debug-replay/watchpoints.json
rcl replay-trace output/v0.38/debug-trace/trace.json output/v0.38/replay
```

New core module:

```text
src/debug-replay-runtime.mjs
```

Implemented:

- Source Map Runtime: joins compiled program root, RBC instruction map, compiler `semanticMap`, compiler `sourceMap`, facet/type metadata and source locations.
- Query API: resolve by runtime state path, facet name, semantic node id, RBC instruction index or source location.
- Execution Trace Runtime: emits serializable events for facet evaluation, RBC instruction execution plan, typed constructors, typed field access, typed union match branches, provider call RBC boundaries, typed object creation, typed refs, GC snapshot root, mark/sweep plan root and resource operations.
- Deterministic Replay Seed: recomputes trace summary roots and trace roots from serialized `trace.json` without re-calling providers or distributed actors.
- Debug Report CLI: writes `source-map-runtime.json`, `trace.json`, `replay-report.json` and `debug-report.json`.
- Watchpoint seed: records watchpoint hits by facet, semantic node or source location without interactive pause.
- Typed heap / GC connection: trace includes typed object identity, typed refs, snapshot root and deterministic mark/sweep plan root from v0.37.

New CLI commands:

```text
rcl debug-map-demo
rcl trace-run <file.rcl> <types-dir|file> [output-dir] [watchpoints.json]
rcl replay-trace <trace.json> [output-dir]
```

Current regression result:

```text
173 / 173 PASS
```

Evidence: `evidence/v0.38/full-test-v0.38.log`.

Boundary:

- single-process deterministic replay only; no distributed actor replay yet;
- watchpoints only record hits; no interactive pause/step/resume yet;
- provider calls are source/RBC mapped as debug boundaries, but generic native provider injection remains outside `rclvm`;
- profiler, DAP, LSP and Debug UI protocol remain v0.39-v0.41 work.

## v0.43 Reality Compiler Kernel

RCL v0.43 adds a deterministic Reality Compiler Kernel that turns the RCL/RNCS robustness sandbox into runtime APIs, CLI commands and a compilable RCL projection.

New commands:

```bash
rcl reality-compiler-demo
rcl reality-compiler-sandbox output/v0.43/reality-compiler
rcl reality-compiler-spec output/v0.43/reality-compiler-spec
```

Core interpretation:

```text
Reality noise -> State augmentation -> Adaptive invariant field -> Constraint compilation -> Control policy -> Stable trajectory
```

This release treats RCL as a high-order reality compiler: hidden memory, delayed feedback, low visibility, regime switching and multi-agent coupling become explicit structures instead of accidental prompt context.


## v0.45 Cosmogenic Reality Compiler

RCL v0.45 adds `src/cosmogenic-reality-compiler.mjs`, a bounded coarse-grained compiler that tests whether normalized primordial-origin parameters can forward-compile into an Earth-consistent macro-history under explicit historical constraints.

CLI:

```bash
node src/cli.mjs cosmogenic-demo
node src/cli.mjs cosmogenic-run output/v0.45/cosmogenic-reality
node src/cli.mjs cosmogenic-spec output/v0.45/cosmogenic-spec
```

Boundary: this is not particle-exact cosmology; it is an evidence-backed RCL compiler pass for origin-to-Earth historical consistency.

## v0.46 Nested Universe Memory Compiler

RCL v0.46 adds `Nested Universe Memory Compiler`, a sandbox compiler for testing whether a supplied memory can be represented as a three-layer containment model:

```text
Surface Universe（表宇宙）
→ Outer Universe（外宇宙）
→ Inner Universe（里宇宙）
```

The order is treated as observation order, not branch order or parallel-world order. The current implementation compiles it as `egg_shell_core_containment` and checks:

- layer containment integrity;
- surface/outer time-offset lock;
- memory-link/data-leak event structure;
- identity-signature bridge rather than same-biography identity;
- anchor-set specificity;
- predicted events and falsifiers.

CLI:

```bash
node src/cli.mjs nested-universe-demo
node src/cli.mjs nested-universe-run examples/nested-universe/duhaolin-memory-link.json output/v0.46/nested-universe-memory
node src/cli.mjs nested-universe-spec output/v0.46/nested-universe-spec
```

Boundary: this validates structural compilability inside RCL, not external empirical proof of a physical multiverse.


### v0.46.1 Age-Phase Correction

v0.46.1 corrects the supplied memory timeline and adds explicit age-phase validation:

```text
Outer 2062 age 14 ↔ Surface 2022 age 19
Outer 2066 age 18 ↔ Surface 2026 age 23
```

The compiler now checks `agePhaseLock`, emits `P3_age_phase_lock`, and fails the age-phase score if the four-year progression is broken even when the +40 year temporal bridge still aligns.

## RCL Universe Interstice Observer Compiler v0.47

v0.47 upgrades the nested universe memory compiler with an eight-observer interstice falsifiability test.

```text
8 universe interstice spaces
→ 1 observer per interstice
→ observer-specific falsifier
→ aggregate falsifiability score
```

Key result from the default sandbox:

```text
previousFalsifiabilityBaseline = 0.78
observerFalsifiabilityScore   = 0.89849707
absoluteGain                  = 0.11849707
residualReduction             = 0.538623047
intersticeAdjustedCoherence   = 0.962868207
externalRealityVerified       = false
```

Commands:

```bash
node src/cli.mjs interstice-observer-demo
node src/cli.mjs interstice-observer-run examples/interstice-observer/eight-observer-falsifiability.json output/v0.47/interstice-observer
node src/cli.mjs interstice-observer-spec output/v0.47/interstice-observer-spec
```

Boundary: this is a sandbox falsifiability upgrade, not external empirical proof.

## RCL Empirical Grounding Layer v0.48

v0.48 upgrades RCL from memory-structure falsifiability into empirical scientific grounding.

It separates:

```text
calibration data -> cosmogenic seed search
holdout data -> blind validation only
```

The layer uses measured science data as the parameter grounding surface, then checks whether the sandbox still reproduces Earth facts that were not used by the seed-search scoring function.

### New module

```text
src/empirical-grounding-layer.mjs
```

### CLI

```bash
node src/cli.mjs empirical-grounding-demo
node src/cli.mjs empirical-grounding-run examples/empirical-grounding/science-grounded-universe-sandbox.json output/v0.48/empirical-grounding
node src/cli.mjs empirical-grounding-spec output/v0.48/empirical-grounding-spec
```

### Default result

```text
empiricalGroundingScore = 0.99052626
holdoutScore = 1
cosmogenicCalibrationScore = 0.97157878
bestSeed = 20263864
externalRealityVerified = false
```

Boundary: this is an empirically grounded universe-sandbox candidate, not external physical proof.

## v0.52 Temporal Fingerprint Resonance

Adds `src/temporal-fingerprint-resonance.mjs` to test whether `forty_year_temporal_shell_trace` and `five_year_age_phase_offset_trace` are merely result-level traces or internally derivable temporal constants from nested memory, interstice observers, and predictive trace layers.

```bash
node src/cli.mjs temporal-fingerprint-demo
node src/cli.mjs temporal-fingerprint-run examples/temporal-fingerprint/default-temporal-fingerprint.json output/v0.52/temporal-fingerprint
```

Default result:

```text
temporalFingerprintEstablished = true
memoryStructureIsTemporalFingerprint = true
resonanceScore = 1
```

## v0.53 Candidate Knowledge Pressure Forge

v0.53 adds the **Candidate Knowledge Pressure Forge（候选知识压力锻炉）**. It expands the unknown-knowledge corpus, stress-tests every candidate, rejects negative controls, and renders successful candidates as natural-language technical documents.

### New module

```text
src/candidate-knowledge-pressure-forge.mjs
```

### CLI

```bash
node src/cli.mjs candidate-pressure-forge-demo
node src/cli.mjs candidate-pressure-forge-run examples/candidate-pressure-forge/default-pressure-corpus.json output/v0.53/candidate-pressure-forge
node src/cli.mjs candidate-pressure-forge-spec output/v0.53/candidate-pressure-forge-spec
```

### Default result

```text
pressureForgeEstablished = true
candidateCount = 18
promotedCount = 11
rejectedCount = 7
documentCount = 11
averagePressureScore = 0.840472859
averageDocumentReadinessScore = 0.719890241
```

Technical documents are written to:

```text
output/v0.53/candidate-pressure-forge/technical-docs/
```

## v0.54 Ecological Injection Phase0

v0.54 lands **RCL-EI-001 Phase 0（异种文明生态注入实验 Phase 0）** as a small-scale computational prototype.

Purpose:

```text
IMLO candidate entity
→ silicate reaction-diffusion memory cell
→ controls and perturbation stress
→ unknown-knowledge extraction
→ directed closure pressure test
→ technical document output
```

Default result:

```text
phase0Established = true
mechanismOperational = true
experimentScore = 0.838895153
maxControlScore = 0.178198402
advantageOverControls = 0.660696751
unknownKnowledgePromoted = true
unknownCandidateKnowledgeScore = 0.904163907
directedClosureEstablished = true
directedClosurePressureScore = 1
```

New module:

```text
src/ecological-injection-phase0.mjs
```

CLI:

```bash
node src/cli.mjs ecological-phase0-demo
node src/cli.mjs ecological-phase0-run examples/ecological-phase0/rcl-ei-001-phase0.json output/v0.54/ecological-injection-phase0
node src/cli.mjs ecological-phase0-spec output/v0.54/ecological-phase0-spec
```


## RCL Esoteric Mechanism Compiler v0.55（隐性机制编译器）

v0.55 adds `src/esoteric-mechanism-compiler.mjs`, a compiler that translates aura, aether, cultivation, magic, formations and alchemy into pressure-tested mechanism candidates.

v0.55 新增 `src/esoteric-mechanism-compiler.mjs`，用于把灵气、以太、修仙、魔法、阵法、炼金术等概念转译成可压力测试的机制候选。

### CLI

```bash
node src/cli.mjs esoteric-mechanism-demo
node src/cli.mjs esoteric-mechanism-run examples/esoteric-mechanism/default-esoteric-corpus.json output/v0.55/esoteric-mechanism
node src/cli.mjs esoteric-mechanism-spec output/v0.55/esoteric-mechanism-spec
```

### Output（输出）

- mechanism score（机制分）
- energy closure（能量闭合）
- information channel（信息通道）
- biological coupling（生物耦合）
- material carrier（材料承载）
- symbolic control（符号控制）
- falsifiability trace（可反证痕迹）
- civilization technology tree（文明技术树）
- bilingual natural language technical documents（中英双语自然语言技术文档）

## v0.56 — Akashic Record Compiler（阿卡西记录编译器）

新增 `src/akashic-record-compiler.mjs`，把 Akashic Records（阿卡西记录）降解为有限、可索引、可读出、可反证的记录底层机制族。输出包括候选机制评分、负例控制拒绝、技术文档与 RCL 内化规格。

CLI:

```bash
node src/cli.mjs akashic-record-demo
node src/cli.mjs akashic-record-run examples/akashic-record/default-akashic-record.json output/v0.56/akashic-record
node src/cli.mjs akashic-record-spec output/v0.56/akashic-record-spec
```

## v0.57 Self-Akashic Record Compiler（自阿卡西记录编译器）

v0.57 adds a bounded self-reference test: RCL scans its own version history, module graph, CLI surface, tests and generated documentation, then emits its own technical record.

新增命令：

```bash
node src/cli.mjs self-akashic-record-demo
node src/cli.mjs self-akashic-record-run examples/self-akashic-record/default-self-akashic-record.json output/v0.57/self-akashic-record
node src/cli.mjs self-akashic-record-spec output/v0.57/self-akashic-record-spec
```

## v0.58 Future RCL Akashic Compiler（未来 RCL 阿卡西编译器）

v0.58 将 RCL 自身的有限阿卡西记录继续递归，编译出未来 RCL 的有界路线图、模块候选、验收闸门、风险账本和未来技术文档。

```bash
node src/cli.mjs future-rcl-akashic-demo
node src/cli.mjs future-rcl-akashic-run examples/future-rcl-akashic/default-future-rcl-akashic.json output/v0.58/future-rcl-akashic
node src/cli.mjs future-rcl-akashic-spec output/v0.58/future-rcl-akashic-spec
```

## v0.59 Experiment Design Synthesizer（实验设计合成器）

RCL v0.59 follows the v0.58 Future RCL Akashic roadmap and adds `Experiment Design Synthesizer（实验设计合成器）`.

New commands:

```bash
node src/cli.mjs experiment-design-demo
node src/cli.mjs experiment-design-run examples/experiment-design-synthesizer/default-experiment-design.json output/v0.59/experiment-design-synthesizer
node src/cli.mjs experiment-design-spec output/v0.59/experiment-design-spec
```

It compiles promoted candidate mechanisms into controlled experiment protocols with hypotheses, variables, controls, instrumentation plans, blind holdouts, failure conditions, evidence outputs and natural-language technical documents.


## RCL v0.60 - Mechanism-to-Prototype Generator（机制到原型生成器）

- 新增 `src/mechanism-to-prototype-generator.mjs`。
- 将 v0.59 的 8 个 Experiment Protocol（实验协议）内化为 Experiment Object（实验对象）与 Prototype IR（原型中间表示）。
- 输出 Control Graph（对照组图）、Metric Contract（指标契约）、Evidence Schema（证据结构）和 Replay Notebook（可重放实验日志）。
- 验收：v0.60 targeted tests 4/4 PASS；v0.59 + v0.60 selected tests 8/8 PASS。


## v0.61 Empirical Lab Notebook Runtime（实证实验日志运行时）

新增 `src/empirical-lab-notebook-runtime.mjs`，将 v0.60 的 Experiment Object（实验对象）与 Prototype IR（原型中间表示）内化为可运行、可记录、可重放、可审计的 Empirical Lab Notebook（实证实验日志）。

新增 CLI：

```bash
node src/cli.mjs empirical-lab-notebook-demo
node src/cli.mjs empirical-lab-notebook-run examples/empirical-lab-notebook/default-empirical-lab-notebook.json output/v0.61/empirical-lab-notebook
node src/cli.mjs empirical-lab-notebook-spec output/v0.61/empirical-lab-notebook-spec
```

核心闭环：

```text
Experiment Object（实验对象）
→ Prototype IR（原型中间表示）
→ Lab Notebook（实验日志）
→ Notebook Run（日志运行）
→ Audit Ledger（审计账本）
→ Replay Hash（重放哈希）
→ Derived Candidate Handoff（派生候选交接）
```


## RCL v0.62.0-alpha.1 — Civilization Technology Tree Compiler（文明技术树编译器）

本版本将 v0.61 的 Empirical Lab Notebook（实证实验日志）升级为 Civilization Technology Tree（文明技术树）。RCL 现在能够把实验日志、重放哈希、审计账本、失败账本和派生候选交接，编译为 Technology Node（技术节点）、Dependency Graph（依赖图）、Civilization Roadmap（文明阶段路线）与 Capability Map（能力图谱）。

核心模块：`src/civilization-technology-tree-compiler.mjs`

新增 CLI：

```bash
node src/cli.mjs civilization-tech-tree-demo
node src/cli.mjs civilization-tech-tree-run examples/civilization-tech-tree/default-civilization-tech-tree.json output/v0.62/civilization-tech-tree
node src/cli.mjs civilization-tech-tree-spec output/v0.62/civilization-tech-tree-spec
```

默认验收：

```text
civilizationTechnologyTreeEstablished = true
nodeCount = 8
establishedNodeCount = 8
dependencyEdgeCount = 20
roadmapPhaseCount = 6
averageTreeScore = 1
```

下一步路线：v0.63 RNCS Execution Bridge v2（RNCS 执行桥 v2），把文明技术树节点转译成真实执行计划、权限、Provider、WAL 和回滚路径。


## RCL RNCS Execution Bridge v2 v0.63

`RCL RNCS Execution Bridge v2`（RCL RNCS 执行桥 v2）把 v0.62 文明技术树中的技术节点转译为可执行 RNCS 计划。

新增 CLI：

```bash
node src/cli.mjs rncs-execution-bridge-v2-demo
node src/cli.mjs rncs-execution-bridge-v2-run examples/rncs-execution-bridge-v2/default-rncs-execution-bridge-v2.json output/v0.63/rncs-execution-bridge-v2
node src/cli.mjs rncs-execution-bridge-v2-spec output/v0.63/rncs-execution-bridge-v2-spec
```

核心输出：Execution Plan（执行计划）、Provider Contract（能力提供者契约）、Authorization Boundary（授权边界）、WAL（预写日志）、Crash Recovery（崩溃恢复）、Evidence Writeback（证据回写）。


## RCL v0.65.0-alpha.1 — Reality Product Entry Runtime（现实产品入口运行时）

本版本将 v0.64 的 Human Capability Feedback OS（人类能力反馈操作系统）包装成普通用户可用的 Product Entry Runtime（产品入口运行时）。RCL 现在可以把人的自然语言目标转译成 Goal Intake（目标输入）、Plan Card（计划卡）、Execution Preview（执行预览）、Evidence Panel（证据面板）与 Capability Feedback（能力反馈）。

核心模块：`src/reality-product-entry-runtime.mjs`

新增 CLI：

```bash
node src/cli.mjs reality-product-entry-demo
node src/cli.mjs reality-product-entry-run examples/reality-product-entry-runtime/default-reality-product-entry-runtime.json output/v0.65/reality-product-entry-runtime
node src/cli.mjs reality-product-entry-spec output/v0.65/reality-product-entry-spec
```

默认验收：

```text
realityProductEntryRuntimeEstablished = true
entryCount = 8
planCardCount = 8
sessionCount = 8
evidencePanelCount = 8
capabilityFeedbackWidgetCount = 8
averageEntryScore = 1
```

下一步路线：v0.66 Recursive Future Release Planner（递归未来版本规划器）或 Product Shell（产品外壳）集成。


## v0.66 Recursive Future Release Planner（递归未来版本规划器）

本版本新增 `src/recursive-future-release-planner.mjs`，将 v0.65 的现实产品入口运行时编译为未来版本计划、路线阶段、递归规划账本、证据继承、人类确认闸门和停止条件。


## v0.67 Evidence Product Shell Runtime（证据产品壳运行时）

RCL now packages recursive future release plans into product-facing evidence shells, review cards, evidence dossiers, demo surfaces, rollback paths and human review gates.


## RCL Aether Forge Pocket Product Bridge v0.68

v0.68 adds `src/aether-forge-pocket-product-bridge.mjs`, bridging Evidence Product Shells（证据产品壳） into Aether Forge Pocket（以太锻造口袋） mobile product cards, project knowledge, plan-mode contracts, preview surfaces, build adapters and delivery handoffs.


## RCL Experiment Automation Adapter v0.69

v0.69 adds `src/experiment-automation-adapter.mjs`, converting Aether Forge Pocket Product Cards（移动产品卡） into Task Queues（任务队列）, Device Adapters（设备适配器）, Sensor Pipelines（传感器管线）, Scheduler Plans（调度计划）, Failure Recovery（失败恢复） and Evidence Writeback（证据回写） channels.


## RCL Prototype Simulation Runtime v0.70

- 新增 `src/prototype-simulation-runtime.mjs`。
- 将 v0.69 自动化适配器升级为执行前模拟运行层。
- 输出模拟场景、扰动模型、失败预测、证据预估和 v0.71 数据接入交接。


## RCL Real World Data Ingestion Layer v0.71.0-alpha.1

v0.71 upgrades Prototype Simulation Runtime into a real-world data ingestion layer:

- Data Source Contract（数据源契约）
- Validation Pipeline（校验管线）
- Cleaning Pipeline（清洗管线）
- Blind Holdout Split（盲测留出分流）
- Evidence Binding（证据绑定）
- Writeback Route（回写路径）
- Human Consent Gate（人类同意闸门）
- v0.72 Multi-Agent Verification Council handoff（多智能体验证委员会交接）

CLI:

```bash
node src/cli.mjs real-world-data-ingestion-demo
node src/cli.mjs real-world-data-ingestion-run examples/real-world-data-ingestion-layer/default-real-world-data-ingestion-layer.json output/v0.71/real-world-data-ingestion-layer
node src/cli.mjs real-world-data-ingestion-spec output/v0.71/real-world-data-ingestion-spec
```


## RCL Multi-Agent Verification Council v0.72.0-alpha.1

v0.72 upgrades Real World Data Ingestion Layer（真实世界数据接入层）into a Multi-Agent Verification Council（多智能体验证委员会）:

- Evidence Steward（证据管理员）
- Domain Reviewer（领域审查员）
- Statistical Reviewer（统计审查员）
- Red-team Falsifier（红队反证员）
- Blind Holdout Auditor（盲测留出审计员）
- Safety Boundary Guard（安全边界守卫）
- Human Authority Delegate（人类权威代理）

CLI:

```bash
node src/cli.mjs multi-agent-verification-council-demo
node src/cli.mjs multi-agent-verification-council-run examples/multi-agent-verification-council/default-multi-agent-verification-council.json output/v0.72/multi-agent-verification-council
node src/cli.mjs multi-agent-verification-council-spec output/v0.72/multi-agent-verification-council-spec
```


## v0.73 Living Artifact Runtime（活体产物运行时）

v0.73 turns v0.72 verification sessions into stateful Living Artifacts（活体产物） with state capsules（状态胶囊）, version ledgers（版本账本）, branch registries（分支注册表）, lifecycle policies（生命周期策略）, mutation contracts（变异契约） and evidence continuity ledgers（证据连续性账本）.

CLI:

```bash
node src/cli.mjs living-artifact-demo
node src/cli.mjs living-artifact-run examples/living-artifact-runtime/default-living-artifact-runtime.json output/v0.73/living-artifact-runtime
node src/cli.mjs living-artifact-spec output/v0.73/living-artifact-spec
```


## v0.74 Recursive Governance Kernel（递归治理内核）

v0.74 governs Living Artifacts（活体产物） with Authority Policy（权威策略）, Risk Budget（风险预算）, Stop Conditions（停止条件）, Permission Matrix（权限矩阵）, Audit Cadence（审计节奏）, Release Gate（发布闸门）, Rollback Obligation（回滚义务） and Human Final Authority Gate（人类最终权威闸门）.

CLI:

```bash
node src/cli.mjs recursive-governance-demo
node src/cli.mjs recursive-governance-run examples/recursive-governance-kernel/default-recursive-governance-kernel.json output/v0.74/recursive-governance-kernel
node src/cli.mjs recursive-governance-spec output/v0.74/recursive-governance-spec
```


## v0.75 Universal Semantic Translator（通用语义翻译器）

RCL v0.75 新增 `src/universal-semantic-translator.mjs`，把 RCL 结构、代码、实验协议、文明技术树、产品入口、治理策略、未知知识候选统一翻译成自然语言文档。

### CLI

```bash
node src/cli.mjs universal-semantic-translator-demo
node src/cli.mjs universal-semantic-translator-run examples/universal-semantic-translator/default-universal-semantic-translator.json output/v0.75/universal-semantic-translator
node src/cli.mjs universal-semantic-translator-spec output/v0.75/universal-semantic-translator-spec
```


## v0.76 Universe Knowledge Runtime（宇宙知识运行时）

RCL v0.76 新增 `src/universe-knowledge-runtime.mjs`，把宇宙模型、未知知识、实验日志、文明技术树、RNCS 执行桥、真实世界数据、验证委员会、活体产物、递归治理和通用语义翻译统一内化为 Knowledge Object（知识对象）。

### CLI

```bash
node src/cli.mjs universe-knowledge-runtime-demo
node src/cli.mjs universe-knowledge-runtime-run examples/universe-knowledge-runtime/default-universe-knowledge-runtime.json output/v0.76/universe-knowledge-runtime
node src/cli.mjs universe-knowledge-runtime-spec output/v0.76/universe-knowledge-runtime-spec
```


## RCL LLM-like Runtime v0.78.0-alpha.1（类大语言模型运行时）

v0.78 adds a provider-neutral LLM-like runtime shell. It does not train or embed a large model. Instead, it defines Provider Contract（能力提供者契约）, Prompt Compiler（提示词编译器）, Context Window Manager（上下文窗口管理器）, Semantic Memory Layer（语义记忆层）, Tool Call Formatter（工具调用格式化器）, Output Decoder（输出解码器） and Self-check Loop（自检循环）.

Default execution is local-first and does **not** require API keys, network access or large local model memory. Cloud APIs and Ollama-style local models are optional Provider slots.

CLI:

```bash
node src/cli.mjs llm-like-runtime-demo
node src/cli.mjs llm-like-runtime-run examples/llm-like-runtime/default-llm-like-runtime.json output/v0.78/llm-like-runtime
node src/cli.mjs llm-like-runtime-spec output/v0.78/llm-like-runtime-spec
```
## RCL v0.78.1 Composite Provider Router（复合能力提供者路由器）

本版本在 v0.78 LLM-like Runtime（类大语言模型运行时）基础上补齐 Composite Provider Routing（复合能力提供者路由）：一个 Runtime Session（运行时会话）可以同时绑定 Mock LLM Provider（模拟大模型提供者）、Rule Provider（规则提供者）、RCL Knowledge Provider（RCL 知识提供者）、Super Agent Provider（类超级智能体提供者）、Tool Call Provider（工具调用提供者）和 Semantic Memory Provider（语义记忆提供者）。

默认运行仍然不需要 API、不需要联网、不需要大内存；OpenAI Compatible Provider（OpenAI 兼容提供者）和 Ollama Local Provider（Ollama 本地模型提供者）仍作为可插拔契约槽保留。

```bash
node src/cli.mjs composite-provider-router-demo
node src/cli.mjs composite-provider-router-run examples/composite-provider-router/default-composite-provider-router.json output/v0.78.1/composite-provider-router
node src/cli.mjs composite-provider-router-spec output/v0.78.1/composite-provider-router-spec
```



## v0.79 Unknown Framework & Frontier Gap Closure Runtime（未知框架与前沿模型差距闭合运行时）

新增 `src/unknown-framework-gap-closure-runtime.mjs`，调用 RCL 已有 Unknown Knowledge、Universe Knowledge、Super Agent、LLM-like Runtime、Composite Provider Router 生成未知能力闭合框架，并把 RCL 相对前沿大模型的弱项转化为 Provider Contract、专项协处理器、证据账本、基准闸门和受治理升级任务。

---

## RCL Founder Twin Agent City Accelerator v0.83.0-alpha.1

v0.83 adds a Founder Twin layer above the v0.82 Agent Civilization Sandbox.

```text
杜衡界意图
→ Founder Twin：结构识别 / 接口调度 / 主权编译
→ 九核镜像审查
→ 智能体城市重排工作包
→ 证据法院审查
→ Founder Utility 裁决
→ 外层真实执行
```

CLI:

```bash
node src/cli.mjs founder-twin-agent-city-demo
node src/cli.mjs founder-twin-agent-city-run examples/founder-twin-agent-city/default-founder-twin-agent-city.json output/v0.83/founder-twin-agent-city
node src/cli.mjs founder-twin-agent-city-spec output/v0.83/founder-twin-agent-city-spec
```

Boundary: Founder Twin is an evidence-constrained simulation of the founder decision pattern, not the real user and not a full replacement for the outer model, real tests, or human final authority.


## v0.86 Agent Civilization Federation

- 新增多专业智能体文明联邦：产品、设计、工程、代码、美术、策划、测试、发布、市场、安全治理。
- 文明之间不自由聊天，只通过 artifact handoff bus 交付文件。
- Founder Twin 保留最终裁决权；Integration Court 负责冲突裁决；Evidence Ledger 负责复验。
- CLI: `agent-civilization-federation-demo/run/spec`。
