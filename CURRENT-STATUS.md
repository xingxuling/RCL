# Current RCL Status: v0.94.0-alpha.1

- Canonical source: `xingxuling/RCL@main`.
- Package baseline: `v0.94.0-alpha.1`.
- Verified native ceiling: Stage40 native-core RCL self-hosting.
- Current research frontier: Universal Program Stress v0.1 with a permanent `20 × 20 = 400` environment/program matrix and nine non-compensatory gates.
- The repository contains the native-core compiler/VM path and fixed-point artifacts described in the main README.
- The current native VM emits `rcl.semantic-state-root.v1`; the JavaScript boundary independently recomputes the canonical semantic state root, rejects algorithm/root mismatch, and supports strict evidence enforcement through `requireNativeStateRoot: true`.
- Package, native-VM, typed-reference ABI and semantic-root versions are separate governed identities. Their source-backed registry is `COMPONENT-VERSIONS.json`; component versions must not be silently relabeled as the package release version.
- Whole-language runtime self-hosting is not claimed.
- TaoWind Auxiliary Language Federation v0.1 is a `CANDIDATE`: its bounded zh-CN/en-US RSL -> ASIL Programming Profile -> RCL path and duplicate-owner gate pass locally, while general RSL, IAL round-trip and SNLL/CSL-to-ASIL adapters remain unverified.

## Universal Program Stress frontier

The Universal Program Stress program is now the primary falsification harness for RCL's long-term universal-language objective.

Current authoritative matrix: `5 PASS / 3 BLOCKED / 392 UNTESTED`; maturity `U0`; K400 verdict `INCOMPLETE`. The five PASS cells are K063, K064, K078, K233 and K339.

Every evidence-bearing cell is evaluated through:

```text
EXPRESS
COMPILE
LOWER
EXECUTE
CORRECT
ROBUST
PERFORMANCE
AI_GENERATE
EVIDENCE
```

The gates are non-compensatory: a missing required gate blocks the cell, and a failed required gate fails it.

### K01 — Self-hosting compiler

Current result: `PASS (9/9)` for the bounded compiler repair/fixed-point profile.

Direct evidence supports:

- RCL-authored general compiler;
- byte-identical native fixed point `C0 == C1 == C2`;
- current candidate fixed-point RBC size `265,286` bytes;
- current candidate fixed-point SHA-256 `00321946e2b4651b4a05b229e7ec650c76375b394afebbc89fb7e095fc28779b`;
- representative differential parity against the JS bootstrap oracle;
- malformed/unsupported negative-source rejection;
- native execution and measured performance within the declared campaign budget.

The frozen K01 v0.2 campaign used three unique ephemeral read-only generator sessions to repair three effective RCL compiler opcode-lowering mutations, restore exact canonical compiler bytes, and share one native byte-identical `C0 == C1 == C2` fixed point. GitHub run `32869858927` bound focused Linux job `97873981605` and Windows native job `97873981286` for source commit `1bdab89cbff822b4d5f4119d009aaab8a07c12f0`; authority root is `ef6f03ca31bd6416f13f2fbab199e692c1111fc5b8db66aef947c463a6e52a43`. This closes K339 only and does not establish arbitrary compiler evolution or whole-runtime self-hosting.

Authority document: `docs/K01_SELFHOSTING_COMPILER_STRESS_CAMPAIGN_v0.1.md`.

### K02 — Complete Web application

Current result: `PASS (9/9)` for the bounded K02 Web vertical slice; coverage remains `lowered-execution`.

Coverage mode: `lowered-execution`.

Direct evidence supports:

- RCL-owned application state and governed transactions;
- structured Web lowering;
- real Chromium interaction;
- DOM state projection;
- preserve-failure negative control with authoritative state unchanged;
- generated Node HTTP/API state/observe/rule path;
- measured build/load/interaction performance;
- rooted direct evidence.

`AI_GENERATE` is bound to three separate ephemeral read-only repair sessions covering reactive state transition, authority binding and reactive view binding. All three restored canonical bytes and replayed the rooted Web manifest plus real loopback Node state/observe/rule execution. GitHub Actions run `32865270251`, focused job `97858888422`, exact source commit `41a5850178161cb26b80129251cd803598aeceda`, and authority root `bd266a10f6c5083c9b09875de5ea390693257a61a0f891f08eda702e928698cf` close K064. The same bounded receipt closes K063 and K078 because every repair replay includes structural GUI bindings and reactive execution; it does not grant arbitrary Web generation, native Web semantics, Android gates, compiler self-evolution or K400 completion.

Authority document: `docs/K02_COMPLETE_WEB_APP_STRESS_CAMPAIGN_v0.1.md`.

### K03 — Native Android application

Current result: `BLOCKED`.

Coverage mode: `lowered-execution`.

Implemented evidence supports:

- RCL source to rooted Android runtime manifest;
- emitted native Java `MainActivity` and Gradle project;
- subject/warrant authority checks;
- proposed-state evaluation and preserve-failure closure;
- witness-bearing transaction history;
- Android View projection;
- lifecycle save/restore;
- host semantic replay and negative controls.

The rebuilt APK was installed and exercised on the API 35 `Rcl_Aether_API35_ATD` emulator. The rooted receipt covers cold launch, initial state, empty-input guard, five transaction/reset rounds, rotation lifecycle restoration and an ADB/UIAutomator end-to-end p95 of `2981.554 ms` under the frozen `5000 ms` budget. Real execution exposed and drove the fix for Java ternary numeric promotion (`1.0` instead of integer `1`). `EXECUTE`, `CORRECT` and `PERFORMANCE` now pass for K083, K085 and K098 on this bounded vertical slice; independent Android `AI_GENERATE` remains the only missing gate for those three cells.

The distinct K03 AI campaign now has a local candidate: three unique read-only sessions repaired transaction increment, reactive input observation and lifecycle restoration mutations, restored exact canonical bytes, and replayed the rooted Android manifest/Activity/host transaction path while binding the emulator receipt. Local AI receipt root is `15a1e75416299146b6987157a1bab9bf2fdc307a4cf1dcd2e007cf80cb2c3fe1`. The three cells remain BLOCKED until GitHub-hosted saved-receipt replay succeeds.

Authority document: `docs/K03_NATIVE_ANDROID_APP_STRESS_CAMPAIGN_v0.1.md`.

### K08 — RCL-Native AI

Current native-learning result: `AI-N2 VERIFIED` for a bounded, configurable two-Dense-layer General MLP profile; K233 remains the machine-learning evidence-complete cell while K063, K064 and K078 are now separately evidence-complete browser cells.

Direct local evidence supports:

- RCL-owned tagged Model/Layer/Parameter/Activation/Loss/Optimizer/Dataset/Checkpoint semantics;
- the same generic native training path for XOR `2-2-1` and Majority-3 `3-3-1`;
- analytic backpropagation and Batch SGD without an ML provider or task-specific VM opcode;
- exact checkpoint resume, shape/dataset negative controls, three deterministic native replays and JS differential parity;
- three separate read-only AI repair sessions whose frozen candidates replay locally and in GitHub-hosted CI.

K233 `AI_GENERATE` is bound to GitHub Actions run `32780097954`, focused job `97600047380`, source commit `4686184d6790ec08b213a0176279f646a0919beb`, and rooted authority receipt `bb42598a6d656aab0d19da52491e820c24145aeb0233d3299abca6b171ea6b82`. That K233 receipt itself grants no Tensor, general Autodiff, AdamW, Transformer, LM, accelerator or distributed claim; later ENGINE candidates are recorded separately below.

The K08-C track carries the GitHub-bound initial Tensor/CPU-engine candidate, and K08-D now adds an `ENGINE_E1_GENERAL_MLP_TENSOR_LOWERING_CANDIDATE_GITHUB_REPLAY_BOUND` closure. Canonical Tensor identity remains a typed RCL record separated from Storage; the Rust `RclVmProviderV1` organ now accepts a rooted generic Tensor SSA Plan with no model-special operation. The unchanged General MLP semantics lower to `29,980` nodes across `abs/add/div/matmul/mul/sub/sum/transpose`, preserve oracle/scalar parity below `4.5e-15`, and preserve exact `32 == save(16) + reload + 16` checkpoint parity through f64 bit-bound storage. Local end-to-end evidence measured scalar Native RCL `2537.360 ms` versus Tensor Plan `443.592 ms`, a `5.720x` speedup. The inherited `118.300x` Native/JS gap is reduced to a `15.863x` candidate ratio, not closed. GitHub run `32810795935` replayed portable correctness on Ubuntu and the real Windows Provider plus K08-D evidence path for exact source commit `8b53c60321345fdcc9449c1a5b7b522a3e7939a9`; that K08-D receipt grants no Autodiff, AdamW, Transformer, accelerator or distributed claim.

K08-E is an `ENGINE_E1_TENSOR_PLAN_LIVENESS_CANDIDATE_GITHUB_REPLAY_BOUND`. The generic SSA executor now validates the complete definition/use graph before execution, retains requested intermediate outputs, reclaims dead values after their final use, and keeps the pre-existing cumulative allocation limit while adding a separate peak-live limit. On the unchanged K08-D plan, logical plan-store peak fell from the historical retained `1,657,080` bytes to `1,856` bytes, with `440` output bytes retained and `30,002` values reclaimed. A same-host, same-plan, alternating seven-round comparison against exact pre-liveness commit `ccfab80217a76d8ad5ab923e891cb8e8fbd538d7` measured `331.937 ms` versus `286.367 ms` median (`1.159x`). GitHub run `32815298348` replayed portable liveness/K400 checks on Ubuntu and the real Provider/Tensor/General MLP path on Windows for exact commit `8073482a57cb4ac096cd8545dcd15d01e87c228b`. This is workload-bounded candidate evidence: process RSS, allocator/transient clone memory, buffer reuse and general Tensor speedup remain unverified.

K08-F is an `ENGINE_E1_TENSOR_BORROWED_INPUT_CANDIDATE_GITHUB_REPLAY_BOUND`. The Plan executor now binds descriptors and Dense Storage by reference into the existing generic kernels instead of cloning both for every node. On the unchanged 29,980-node Plan it audited `54,964` borrowed bindings, avoided `314,521` historical input elements / `2,516,168` bytes of copy traffic, and reported zero cloned input elements. Exact-main baseline `9805956dfd24834d650534a8186ab53eb084f8b5` and candidate output roots matched across controlled runtime and process-memory samples. The accepted local seven-round timing measured `234.698 ms` versus `192.423 ms` median (`1.220x`); Windows child-process peak Working Set medians were both `38,445,056` bytes, so no production-Plan RSS reduction was observed in this run. A separate 200,000-element-per-input clone stress measured `20,234,240` versus `18,636,800` bytes (`7.895%` lower). GitHub run `32821559973` passed Ubuntu `97720582566` and Windows `97720582266` for exact source commit `d130a4d91f68159ea7405222ed6658ff2269b459`, including real Provider and process-memory A/B execution. Two earlier sampler-transport failures remain preserved in the hosted receipt. This does not grant portable/general memory reduction, buffer reuse, compact lowering, Autodiff or K400 promotion.

K08-G is an `ENGINE_E2_AUTODIFF_CANDIDATE_GITHUB_REPLAY_BOUND`. The new RCL Autodiff Genome self-host-compiles with byte parity and executes in the native VM; the Rust Tensor organ performs generic reverse traversal with `BackwardEdge`, shape-checked `GradientAccumulator`, `GradientIdentity` and `StopGradient`. Analytic/manual gradient drift is `0`, central finite-difference maximum drift is `3.7655e-10`, and three gradient replays have one root. The unchanged General MLP contract now trains XOR and Majority-3 through Tensor forward + native Autodiff + existing Batch SGD semantics with accuracy `1 / 1`, final loss `0.01570345 / 0.01110160`, and maximum parameter drift `1.7764e-15` versus the retained hand-written oracle. Exact f64 checkpoint materialization preserves bit-exact `32 == 16 + reload + 16`. Local evidence root `5028e21e0c0184795cb0375e8aa2ef928c0f22d8fae1c32584f2192c41de7709` is bound to implementation commit `3132b81d9e0b7b7788aaf4b23457656c559b9793`. GitHub run `32828410493` passed Ubuntu `97741439391` and Windows `97741439698` for exact evidence commit `103a330f034a234c52d2d7eb287fd154c4e4b902`, including native Autodiff/General-MLP evidence and K400 non-promotion. This grants no ENGINE-E3 Optimizer Genome, AdamW, Transformer, Tiny LM, accelerator, general performance parity or K400 promotion.

Authority documents: `docs/K08_RCL_NATIVE_AI_CAMPAIGN_v0.1.md` and `docs/native-ai/evidence-ledger.md`.

### Native UI Genome v0.1 candidate

- `.rcl` reference-parser syntax, rooted Canonical Native UI IR, reactive state/binding/events, layout, style/cascade and lifecycle are implemented on an isolated candidate branch.
- Web and Android consume the same UI semantic root for `examples/native-ui/counter.rcl`.
- Real Chrome Counter interaction and a real Gradle debug APK build are evidenced.
- Android installation/device interaction is not verified.
- Canonical self-host compiler ownership is verified for the minimal UI, exact Counter state/derived/lifecycle/theme/style/tree/binding/layout/local-event slice, typed or standard-inferred UI-local parameters, governed `reality-transaction` declarations, fixed width/height intent, canonical in-app navigation, and non-overlapping available-width profiles with adaptive layout direction. The same rooted adaptation lowers to real Chrome media-query behavior and Android `screenWidthDp` orientation logic. Unknown rule references, mixed-authority handlers, invalid fixed sizes/routes/targets, multiple route transitions, overlapping ranges and unknown profiles fail closed; execution still requires an external Gateway that emits only `CandidateReality`. Resources, adaptation beyond width-profile layout direction, full accessibility and Android device execution remain absent/unverified, so repository-wide UI stays `NATIVE_UI_CANDIDATE_WITH_BLOCKED_CANONICAL_PROMOTION`.

Authority document: `docs/ui-native-genome/evidence-ledger.md`.

### K04

The next killer task in the declared campaign is a 2D game. No K04 PASS claim is made in this status file until an evidence-bearing campaign is merged.

## Native / Foundation status

- Six Foundation domains, the three Meta Batch B planes, the `physical` -> `embodiment` Batch C chain, the `energy` -> `elemental` -> `neural` Batch D chain, and the `metacomputation` -> `computation` Batch E chain execute through RBC 1.2 and five `RclVmProviderV1` Native Provider bridges.
- The bridge is explicitly reported as `bridge`, not native Foundation syntax. Its executable is `native/rclfoundation.exe`.
- Uncovered and declared-domain runtime remains JavaScript.
- `RCL RNCS Visual Intent v0.1` provides a rooted bridge input for animation graphs, blend layers, masks, look-at/two-bone IK constraints, skin selection and morph weights; it is an input contract and not a rendering claim.
- `RCL RNCS Runtime Binding v0.1` consumes the RNCS authority-presentation receipt, verifies state/frame/packet root links and carries the binding into RCL proposals, causal references and evidence edges; it remains a migration consumer and does not execute RSR or VSR itself.

## Downstream and authority boundaries

- Downstream copies are governed by `DOWNSTREAM-CONSUMERS.json`, not treated as implicit byte-identical sources.
- The RNCS embedded extension currently lacks its required upstream provenance contract.
- The Zhinao vendor snapshot is explicitly stale and requires synchronization plus rebuilt evidence.
- Machine-readable canonical contract: `VERSION-CONTRACT.json`.
- Technical-debt authority: `docs/governance/RCL_TECHNICAL_DEBT_REGISTER_v0.1.md`.

## Verification entrypoints

```bash
npm run verify:version-contract
node --test tests/native-semantic-state-root-native.test.mjs
npm run test:foundation-native-batch-a
npm run test:foundation-native-meta-batch-b
npm run test:foundation-native-batch-c
npm run test:foundation-native-batch-d
npm run test:foundation-native-batch-e
npm run conformance:foundation
node --test tests/universal-program-stress.test.mjs
node scripts/universal-program-stress-report.mjs
node scripts/run-universal-stress-k01.mjs
```

## Experimental capability metabolism layer

- `Capability Metabolism v0.1` adds a bounded external-capability manifest, semantic-kernel extraction, generated RCL declarations, declared-equivalence evidence, absorption-stage scoring and cross-domain compound-organ synthesis.
- The layer deliberately reports `native-candidate` rather than native status.
- Native promotion still requires independent source/runtime differential execution, RBC lowering and native-VM parity evidence.
- Verification entrypoints: `node --test --test-concurrency=1 tests/capability-metabolism.test.mjs` and `node examples/capability-metabolism-demo.mjs`.

## Honest boundary

- Stage40 native-core compiler self-hosting is verified.
- Whole-language runtime self-hosting is not claimed.
- K01 and K02 are blocked at 8/9 gates, not PASS.
- K03 has a real lowering/project-generation path, but the recorded campaign has not closed real Android runtime evidence.
- Most of the 400-cell universal stress matrix remains unknown by design.
- The repository does not currently claim “RCL can write any program.” It defines a permanent, falsifiable process for testing how far that proposition can be pushed.

`CONTEXT.md` remains historical handoff material and must not be treated as the current authority state.
