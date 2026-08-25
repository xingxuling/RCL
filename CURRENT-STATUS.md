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

Current result: `BLOCKED (8/9)`.

Direct evidence supports:

- RCL-authored general compiler;
- byte-identical native fixed point `C0 == C1 == C2`;
- current candidate fixed-point RBC size `265,286` bytes;
- current candidate fixed-point SHA-256 `00321946e2b4651b4a05b229e7ec650c76375b394afebbc89fb7e095fc28779b`;
- representative differential parity against the JS bootstrap oracle;
- malformed/unsupported negative-source rejection;
- native execution and measured performance within the declared campaign budget.

Remaining blocker: independent reproducible `AI_GENERATE` compiler-evolution/repair evidence.

Authority document: `docs/K01_SELFHOSTING_COMPILER_STRESS_CAMPAIGN_v0.1.md`.

### K02 — Complete Web application

Current result: `BLOCKED (8/9)`.

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

Remaining blocker: independent reproducible `AI_GENERATE` evidence.

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

The recorded campaign does **not** yet prove real APK installation/device or emulator interaction. Therefore `EXECUTE`, `CORRECT`, `PERFORMANCE`, and `AI_GENERATE` remain unverified in the campaign evidence.

Authority document: `docs/K03_NATIVE_ANDROID_APP_STRESS_CAMPAIGN_v0.1.md`.

### K08 — RCL-Native AI

Current native-learning result: `AI-N2 VERIFIED` for a bounded, configurable two-Dense-layer General MLP profile; K233 is the first evidence-complete K400 cell on the integration candidate.

Direct local evidence supports:

- RCL-owned tagged Model/Layer/Parameter/Activation/Loss/Optimizer/Dataset/Checkpoint semantics;
- the same generic native training path for XOR `2-2-1` and Majority-3 `3-3-1`;
- analytic backpropagation and Batch SGD without an ML provider or task-specific VM opcode;
- exact checkpoint resume, shape/dataset negative controls, three deterministic native replays and JS differential parity;
- three separate read-only AI repair sessions whose frozen candidates replay locally and in GitHub-hosted CI.

K233 `AI_GENERATE` is bound to GitHub Actions run `32780097954`, focused job `97600047380`, source commit `4686184d6790ec08b213a0176279f646a0919beb`, and rooted authority receipt `bb42598a6d656aab0d19da52491e820c24145aeb0233d3299abca6b171ea6b82`. Tensor, general Autodiff, AdamW, Transformer, LM, accelerator and distributed claims remain unverified.

The K08-C track now carries an `ENGINE_E1_CANDIDATE_GITHUB_REPLAY_BOUND` Tensor/CPU-engine candidate. Canonical Tensor identity is a typed RCL record with no data buffer and a distinct Storage Identity; the scalar RCL reference covers add/sub/mul/div, broadcast, reshape, transpose, slice, MatMul, sum/mean/max, exp/log/sqrt and softmax support. A Rust `RclVmProviderV1` CPU Dense organ executes general elementwise, reduction, MatMul, Softmax, LayerNorm and RMSNorm kernels. Local exact differential evidence measured `6.094x` end-to-end speedup for 24-cubed MatMul and `3.061x` kernel-only speedup for 192-cubed MatMul. GitHub run `32804405376` replayed portable correctness on Ubuntu and the native Provider/performance path on Windows for source commit `e5c3124bb759e5d5c2ec8bbf3e668aabc6a0b080`. This candidate has not lowered General MLP to the backend and does not close the inherited `118.300x` MLP Native/JS gap.

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
