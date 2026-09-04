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

Current authoritative matrix: `23 PASS / 0 BLOCKED / 377 UNTESTED`; maturity `U3`; K400 verdict `INCOMPLETE`. The PASS cells are K063, K064, K078, K083, K085, K098, K124, K138, K233, K321, K322, K326, K327, K329, K331, K332, K333, K334, K336, K337, K338, K339 and K340.

K331 is independently closed for one bounded deterministic logical-time compiler profile. The absorbed PR #56 JavaScript scheduler remains an auxiliary Runtime/Oracle while RCL owns event ordering, monotonic advance, budget atomicity, acceleration projection and external-time authority. Its 13 donor tests pass; 20/20 native rounds preserve one artifact and semantic root, match the auxiliary differential and reject semantic mutations plus corrupt RBC. The first acquisition's honest 2/3 result remains preserved, while three new unique read-only sessions restored the frozen priority, budget and authority mutations to exact Canonical bytes. GitHub run `33141180858` bound focused job `98752173946` and Windows job `98752173843` for exact source commit `43d195d98e1bbd4066922bb47a1e24eed816f86b`; authority root is `033010acf7f2f0005466b1ff53ed1cf324f9e613ab25c783404e24d8e084408d`. This closes only K331; `RCL_GAP_K331_PHYSICAL_TIME_INTERRUPT_PROTOCOL` remains open, and no wall-clock, deadline, interrupt or hard-real-time claim is granted.

K334 is independently closed for one bounded governed-agent compiler profile. Twenty native rounds preserve one artifact hash and semantic-state root, match an independent JavaScript deliberation oracle and reject capability, budget, approval and selection mutations plus corrupt RBC. Three unique read-only ephemeral sessions restored capability, budget and approval mutations to exact canonical bytes. GitHub run `33137843366` bound focused job `98741775199` and Windows job `98741775274` for exact source commit `b4287289b35423f3c74861e9a258afb0861532b8`; authority root is `64d632a8fbeaa71b48d05d44bbf3270caaef2a017cb7732d73cf1eea96e16a8b`. This closes only K334; no LLM reasoning, external tool execution, durable memory or autonomous production authority is granted, and `RCL_GAP_K334_EXTERNAL_AGENT_IO_PROTOCOL` remains open.

K336 is independently closed for one bounded governed-automation compiler profile. Twenty native rounds preserve one artifact hash and semantic-state root, match an independent JavaScript dependency/retry/approval/kill-switch/compensation oracle and reject four semantic mutations plus corrupt RBC. Three unique read-only ephemeral sessions restored dependency, retry and approval mutations to exact canonical bytes. GitHub run `33135430077` bound focused job `98734185571` and Windows job `98734185483` for exact source commit `a989db99643c8a3f61d6f416c57e5887c275eae1`; authority root is `406b0891c40b01d7ce84021e36b2a188cb32c72db173fc9711df2ad0af341ab7`. This closes only K336; no external-action, production scheduler or durable-queue claim is granted, and `RCL_GAP_K336_EXTERNAL_EFFECT_PROTOCOL` remains open.

K326 is independently closed for one bounded in-memory relational-transaction compiler profile. Twenty native rounds preserve one artifact hash and semantic-state root, match an independent JavaScript selection/join/aggregate/insert oracle and reject four semantic mutations plus corrupt RBC. Three unique read-only ephemeral sessions restored primary-key, foreign-key and domain-constraint mutations to exact canonical bytes. GitHub run `33093366736` bound focused job `98591815601` and Windows job `98591815857` for exact source commit `f7c266c6360ef72162064e6605a11fe3de4d1069`; authority root is `4eb155d0b6824d85c5191f2106c316a5a1d81c4e84b5c3e1c6ab6153617c208f`. This closes only K326; no SQL-engine, persistence, concurrency, isolation or distributed-database claim is granted.

K340 is independently closed for the bounded mixed-paradigm compiler-runtime profile. One RCL program combines recursive functional computation, declarative warrants/needs, governed transactional state changes and a state-triggered second rule. Twenty native rounds preserved one artifact root, one final semantic state root and exact transaction continuity; five semantic/corrupt-artifact controls failed closed. Three isolated read-only sessions repaired recursive computation, phase triggering and declarative authority mutations. GitHub run `33005515826` bound focused job `98298112072` and Windows job `98298112360` for exact source commit `01572386c82dd0e46b2eed4bc13b804ddc548a44`; authority root is `5611bea18a41f46aa863f9f2320a59c0b10afae916aec1f33400fb47cace4016`. This closes only K340 for the frozen profile. `RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION` remains open, and no arbitrary mixed-language, compiler-security, production-promotion or K400-completion claim is granted.

K333 is independently closed for the bounded integer-perceptron compiler-advisory profile. Twenty native rounds preserved exact artifact and semantic-state roots, matched an independent JavaScript oracle and passed five semantic/corrupt-artifact controls. Three isolated read-only sessions repaired label, update and model-authority mutations while restoring exact canonical bytes. GitHub run `33008611515` bound focused job `98308743737` and Windows job `98308743547` for exact source commit `6983b7d66813790b0727e4b66aafc8a8a27c4b01`; authority root is `72e8b699d53f5685b542de32dfdee2a3d41eea4b3c1bbed0395b9fc6f77d663d`. The learned recommendation remains advisory and deterministic compiler policy retains commit authority. This closes only K333; `RCL_GAP_K333_FLOAT_STATE_ROOT_CANONICALIZATION` and all broader ML/compiler-learning claims remain open.

K329 and K332 are independently closed for one bounded integer constant-acceleration compiler-runtime profile. Twenty native rounds preserved one artifact hash and one semantic-state root, while an independent JavaScript iterative simulation and closed-form oracle matched position, velocity, trajectory, zero/one-step boundaries and the discrete work invariant; five semantic/corrupt-artifact controls failed closed. Three isolated read-only sessions repaired transition, closed-form and zero-step mutations while restoring exact canonical bytes. GitHub run `33087711271` bound focused job `98571828813` and Windows job `98571829415` for exact source commit `311dcc56d0553a0784a3fe44bdbe3ac05931b961`; authority root is `3bd66c8f780345d688b381ba7364e6308fb9652f597439a8e9a1004f079d590c`. This closes only K329 simulation and K332 scientific for the frozen integer profile; floating-point solvers, arbitrary physics, chaotic-system accuracy, GPU/HPC performance and K400 completion remain unverified.

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

The separate K327 `compiler-runtime::compiler` campaign used three new ephemeral read-only sessions to repair `contains`, `sequence_concat` and `sha256_text` builtin-lowering mutations. Its evaluator restored exact canonical compiler bytes and reused the already admitted fixed-point execution only as a compiler-runtime binding, not as inherited AI authority. GitHub run `32880432503` bound focused job `97908294490` and Windows native job `97908294012` for source commit `42b77ceb71e1d00f686b41096646fd05a61ad6e9`; authority root is `72c0ebe2de859e8585fe1f3325d7240896de25eb42055daeec56a78b33934670`. This closes K327 only and does not broaden K339 or K400.

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

Current result: `PASS (9/9)` for the bounded K03 Android transaction UI across K083, K085 and K098.

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

The rebuilt APK was installed and exercised on the API 35 `Rcl_Aether_API35_ATD` emulator. The rooted receipt covers cold launch, initial state, empty-input guard, five transaction/reset rounds, rotation lifecycle restoration and an ADB/UIAutomator end-to-end p95 of `2981.554 ms` under the frozen `5000 ms` budget. Real execution exposed and drove the fix for Java ternary numeric promotion (`1.0` instead of integer `1`). `EXECUTE`, `CORRECT` and `PERFORMANCE` pass for K083, K085 and K098 on this bounded vertical slice.

The distinct K03 AI campaign used three unique read-only sessions to repair transaction increment, reactive input observation and lifecycle restoration mutations, restore exact canonical bytes, and replay the rooted Android manifest/Activity/host transaction path while binding the emulator receipt. GitHub run `32871776578`, focused job `97880272426`, exact source commit `b5d72ca19750b9e63e49bd4121ae30f18b42f8f0`, and authority root `14bb5c06cc64c1c1952418bd7765da7758353984c3c6c86d4e6bf30615750276` close `AI_GENERATE` for K083, K085 and K098 only.

Authority document: `docs/K03_NATIVE_ANDROID_APP_STRESS_CAMPAIGN_v0.1.md`.

### K400 Server Web/Reactive closure

Current result: `PASS (9/9)` for K124 `server::web` and K138 `server::reactive` on the bounded generated Node loopback profile; coverage remains `lowered-execution`.

The pre-acquisition runtime contract required 20 fresh ephemeral `127.0.0.1` server rounds, transaction p95 at most `100 ms`, and full-replay/startup-proxy p95 at most `1000 ms`. All 20 rounds passed state, observe, add/reset, authority and unknown-route rejection checks. Measured transaction p95 was `2.782 ms`; full-replay p95 was `66.846 ms`; runtime receipt root is `e0f4f5eaec5407564bc0a53358987d3208c768a0c4eb35698d0fbf8b4c47fe10`.

Three unique ephemeral read-only generator sessions independently repaired server state transition, authority binding and reset-state mutations and restored canonical bytes. GitHub run `32876898001`, focused job `97896893662`, exact source commit `f669460df4e4401e3e2f29b82c0ec35fc295930d`, and authority root `5fb9eb94d6575ce9e606fb7c77e30d20f9d531e3cb828d38fc8c7fe028f940d2` close K124 and K138 only. The `K04-SERVER` receipt prefix is an evidence-batch identifier and is distinct from Killer Task K04, the 2D game.

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

AI001 now has a `LOCAL_SELFHOST_TYPED_TENSOR_SHAPE_SEMANTICS_CANDIDATE`. The RCL genome validates typed Tensor descriptor identity, positive dimensions, exact element counts, row-major strides, dtype/layout/device agreement, ordered references, right-aligned broadcast, matmul, transpose, reshape and axis-reduction output shapes. The native self-hosted compiler/VM path passes `3/3` focused tests with native semantic-root verification; malformed shape, stride, metadata, reference and manifest-root cases fail closed. Local evidence root is `f7e9ffdd96412791363ba2cc8e619bb967429f84877ef7bbefe6e72425a919b1` on implementation commit `1ababfaba826a36904fe2ad859634ddee053e8ee`. This is an admission candidate only: numerical kernels, alias safety, device lowering, GPU execution, canonical promotion and scale remain open. Authority: `docs/native-ai/AI001_SELFHOST_TENSOR_SHAPE_SEMANTICS_CANDIDATE_v0.1.md` and `examples/native-ai/evidence/tensor-shape-semantics-v0.1/ai001-tensor-shape-semantics-local-evidence.json`.

AI002 now has a `LOCAL_SELFHOST_AUTODIFF_EXECUTION_BINDING_CANDIDATE`. The existing RCL Tensor shape genome and RCL Autodiff graph-governance genome are composed as a pre-provider admission: typed descriptors, storage profile, ordered reverse edges, gradient shapes and parameter order/identity must agree before the generic Rust CPU-f64 Autodiff provider is attempted. The focused suite passes `4/4`; shape drift and an unregistered provider profile are rejected without provider execution, while valid numeric gradients, reverse-edge order and gradient parameter identity match. Evidence root is `cac978860270ec3b53f38946caea7948df898c7a299483173eb79e16172080c0` on implementation commit `0b46847d703920073aabc101cc9939d887f93976`. This is a bounded bridge candidate: broader graph coverage, GPU-native reverse execution, canonical promotion, Transformer scale and K400 promotion remain open. Authority: `docs/native-ai/AI002_SELFHOST_AUTODIFF_EXECUTION_BINDING_CANDIDATE_v0.1.md` and `evidence/RCL_GAP_AI002_SELFHOST_AUTODIFF_EXECUTION_BINDING_CANDIDATE_v0.1.json`.

K08-S is `BF16_AUTODIFF_ADAMW_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`. From latest `origin/main` `30c162c6cd13b2c9310202f2a604da23e5b4c552`, the campaign branch safely cherry-picked the old K08-S source commit and replaced its matmul-only organ with a generic RCL Tensor SSA + Reverse Autodiff precision path. The RCL genome self-hosts with byte parity and native semantic-root verification. Local Windows evidence is `9/9` K08-S tests plus `7/7` Rust Tensor tests: BF16 RNE, BF16 forward/loss differential, FP32 straight-through gradients, exact FP32 master and AdamW state, loss decrease, deterministic replay, direct `N == checkpoint K + resume N-K`, exact checkpoint root, canonical state order, malformed/non-finite input rejection and unsupported accelerator fail-closed. GitHub run `32987036258` passed Ubuntu job `98235663711` and Windows job `98235663539` on exact head `73336cb7b76dbecd95aabe7f840374067c22c15a`. No GPU, multi-block BF16 or RCL-10M claim is granted. Open gaps are `RCL_GAP_GPU_EXECUTION` and `RCL_GAP_BF16_MULTI_BLOCK_INTEGRATION`. Authority: `docs/native-ai/bf16-autodiff-adamw-evidence-v0.2.md`, `examples/native-ai/bf16-autodiff-adamw-contract.v0.2.json` and `examples/native-ai/evidence/bf16-autodiff-adamw-v0.2/k08-s-local-evidence.json`.

Authority documents: `docs/K08_RCL_NATIVE_AI_CAMPAIGN_v0.1.md` and `docs/native-ai/evidence-ledger.md`.

### GPU backend reality audit

The current Windows host has a real AMD Radeon(TM) 860M Graphics device (`0x1002:0x1114`) with Vulkan 1.4.325 and one AMD OpenCL 2.0 GPU device exposing `cl_khr_fp16`. `nvidia-smi` and `rocminfo` are absent. The RCL Tensor organs remain CPU-only and fail closed for GPU device intent; the bounded AMD OpenCL provider below is a separate auxiliary lowerer and does not alter that ownership boundary. Authority: `docs/native-ai/gpu-backend-reality-audit-v0.1.md` and `examples/native-ai/evidence/gpu-backend-audit-v0.1/gpu-backend-audit.json`.

### K08 AMD OpenCL BF16 matmul candidate

Status: `PASS_LOCAL_AND_HOSTED_GPU_REFERENCE_CANDIDATE`. The RCL-owned BF16 contract and genome lower a bounded generic matmul through `native/tensor-engine/amd_opencl_bf16_provider.py`. On the current Windows host, the provider selected the real AMD `gfx1152` OpenCL 2.0 device and executed the kernel with `gpuExecuted=true`; the response is explicitly `gpuClaim=false`. Independent CPU BF16 bit differential, deterministic replay, malformed/non-finite input rejection, shape rejection and unsupported-backend fail-closed behavior pass in `3/3` local Node tests. Hosted run `32993386531` passed Ubuntu job `98256291089` and Windows job `98256291461` on exact head `a45622d5d3eeee61528d797c38b2f55b1abe78de`; Hosted does not inherit the local AMD device receipt. This candidate grants only AMD OpenCL BF16 matmul reference execution and bit-exact differential evidence.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Real AMD OpenCL device receipt | PASS, `gfx1152`, driver `3661.0 (PAL,LC)` |
| 2×3 by 3×2 OpenCL kernel | PASS, output bits `4100,bfc0,4188,0000` |
| Independent CPU bit differential | exact PASS |
| Deterministic replay | exact PASS |
| Fail-closed negatives | PASS |
| Local Node evidence | `3/3 PASS` |
| Hosted Ubuntu + Windows replay | PASS, run `32993386531`, jobs `98256291089` / `98256291461` |

Authority files: docs/native-ai/opencl-bf16-matmul-evidence-v0.1.md, examples/native-ai/opencl-bf16-matmul-contract.v0.1.json, examples/native-ai/evidence/opencl-bf16-matmul-v0.1/k08-amd-opencl-local-evidence.json. Open gaps: RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION and RCL_GAP_RCL10M_TOKENIZER_DATASET.

### GPU BF16 Autodiff + AdamW hybrid candidate

Status: PASS_LOCAL_GPU_HYBRID_CANDIDATE_HOSTED_REPLAY_PENDING. The new generic RCL BF16 Autodiff + AdamW organ accepts an explicit opencl-amd-hybrid graph: every matmul must carry placement gpu and execute through the existing AMD OpenCL lowerer; every non-matmul node must carry placement cpu-reference and execute through the RCL Rust BF16 reference. The current Windows host executed the GPU-placed matmul on AMD gfx1152; the CPU-equivalent graph produced identical initial/final loss, all parameters, optimizer states and checkpoint root. Local evidence is 3/3 PASS, and placement/provider/backend negatives fail closed. This is a bounded hybrid candidate, not GPU training: backward math, FP32 masters, AdamW state and optimizer updates remain in RCL Rust, while GPU backward/optimizer kernels, full-graph GPU execution, GQA/RoPE GPU and throughput remain unclaimed. Hosted run 32999052826 is pending on main head 3cdb94bdba850e0c21c1cc4a8a2c9defa95f47d7.

Authority files: docs/native-ai/gpu-bf16-autodiff-adamw-evidence-v0.1.md, examples/native-ai/gpu-bf16-autodiff-adamw-contract.v0.1.json, examples/native-ai/evidence/gpu-bf16-autodiff-adamw-v0.1/k08-gpu-bf16-autodiff-adamw-local-evidence.json. Reproduction: npm run test:k08-gpu-bf16-autodiff-adamw. Open gaps: RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION and RCL_GAP_RCL10M_TOKENIZER_DATASET.

### GPU BF16 ordered multi-block hybrid candidate

Status: `PASS_LOCAL_GPU_HYBRID_ORDERED_MULTI_MATMUL_CANDIDATE_GITHUB_REPLAY_BOUND`. The new RCL-owned generic graph composes two ordered BF16 matmul blocks in one explicit `opencl-amd-hybrid` training forward: both matmuls are `gpu`, and eight non-matmul nodes are explicitly `cpu-reference`. The current AMD gfx1152 host executed both GPU nodes; the CPU-equivalent RCL graph matched initial/final loss, all four canonical parameters, AdamW states and checkpoint root exactly. Direct replay and checkpoint resume are exact, and placement/provider/backend negatives fail closed. This remains a bounded hybrid candidate: reverse Autodiff, FP32 masters, AdamW state and updates remain in RCL Rust; no GPU training, GPU backward/optimizer kernels, GQA/RoPE GPU or throughput claim is granted. PR #90 hosted run `33000754805` passed Ubuntu job `98281650727` and Windows job `98281650452` on the evidence commit.

Authority files: `docs/native-ai/gpu-bf16-multiblock-evidence-v0.1.md`, `examples/native-ai/gpu-bf16-multiblock-contract.v0.1.json`, `examples/native-ai/evidence/gpu-bf16-multiblock-v0.1/k08-gpu-bf16-multiblock-local-evidence.json`. Reproduction: `npm run test:k08-gpu-bf16-multiblock`. Open gaps: `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`.

### GPU GQA + RoPE hybrid candidate

Status: `PASS_LOCAL_GPU_HYBRID_GQA_ROPE_FORWARD_CANDIDATE_GITHUB_REPLAY_BOUND`. The new RCL-owned generic graph has two independent query heads sharing one K/V projection path, with the RCL `rcl-rope-frame` organ supplying the position frame. Eleven matmul nodes per forward, including projections, RoPE rotations, attention scores and context products, use explicit `gpu` placement through the AMD OpenCL lowerer; 21 masking/softmax/transpose/elementwise/loss nodes use explicit `cpu-reference`. On the current AMD gfx1152 host, local `3/3` evidence passed; CPU-equivalent BF16 training matched loss, all four parameters, AdamW states and checkpoint root exactly, and direct/checkpoint replay was exact. This remains a bounded hybrid forward candidate, not GPU training or GPU-native attention/backward/optimizer execution. PR #91 run `33002049364` passed Ubuntu job `98286127130` and Windows job `98286127096` on the evidence commit.

Authority files: `docs/native-ai/gpu-gqa-rope-evidence-v0.1.md`, `examples/native-ai/gpu-gqa-rope-contract.v0.1.json`, `examples/native-ai/evidence/gpu-gqa-rope-v0.1/k08-gpu-gqa-rope-local-evidence.json`. Reproduction: `npm run test:k08-gpu-gqa-rope`. Open gaps: `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`.

### GPU-native BF16 backward + AdamW candidate

Status: `PASS_LOCAL_GPU_NATIVE_REVERSE_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`. The RCL-owned generic BF16 Tensor SSA path now lowers forward matmul, both reverse matmul-gradient directions and elementwise FP32 AdamW to explicit AMD OpenCL provider primitives. On the current AMD `gfx1152` host, the provider executed real GPU forward, reverse and optimizer kernels; the Rust organ imported exact FP32 bits with no CPU fallback. The minimal generic graph matched the CPU reference loss, parameters, optimizer states and checkpoint root bit-for-bit; direct replay, checkpoint resume and missing placement/provider/backend negatives pass in `3/3` local tests. Existing GPU hybrid/multi-block/GQA+RoPE and CPU multi-block regressions remain green, with Rust Tensor unit tests `7/7`. PR #93 hosted run `33005295847` passed Ubuntu job `98297368527` and Windows job `98297368737`.

This is a bounded reverse/optimizer lowering candidate, not a `GPU_TRAINING` claim. Full-graph GPU execution, GPU-native GQA/RoPE multi-block integration, generic GPU portability, throughput, RCL-10M, RCL-1B, distributed training and K400 promotion remain closed. Hosted runners cannot inherit the current host AMD device receipt. The exact FP32 operation sequence explicitly disables OpenCL contraction and requests correctly rounded divide/sqrt to preserve CPU differential parity.

Authority files: `docs/native-ai/gpu-native-backward-adamw-evidence-v0.1.md`, `examples/native-ai/gpu-native-backward-adamw-contract.v0.1.json`, `examples/native-ai/evidence/gpu-native-backward-adamw-v0.1/k08-gpu-native-backward-adamw-local-evidence.json`. Reproduction: `npm run test:k08-gpu-native-backward-adamw`. Claims granted only: `OPENCL_AMD_BF16_MATMUL_GRADIENT_LOWERING`, `OPENCL_AMD_FP32_ADAMW_LOWERING` and `OPENCL_GPU_NATIVE_REVERSE_ADAMW_CANDIDATE`. Open gaps: `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`.

### GPU-native multi-block GQA + RoPE backward + AdamW candidate

Status: `PASS_LOCAL_GPU_NATIVE_GQA_ROPE_BACKWARD_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`. PR #97 extends the RCL-owned generic K08-R-style graph to two blocks, two query heads and shared K/V paths per block. On the current Windows AMD `gfx1152` host, all `36` forward matmul nodes, `72` reverse matmul-gradient calls and `14` FP32 AdamW parameter groups execute through explicit AMD OpenCL provider primitives; more than `40` non-matmul nodes remain explicit RCL CPU reference nodes. The graph has `208` canonical parameter elements and no model-special opcode. CPU loss, parameters, optimizer states and checkpoint roots match exactly; direct replay, checkpoint resume and placement/provider/backend negatives pass. Local candidate evidence is `3/3 PASS`, existing GPU/CPU regressions are `15/15 PASS`, and Rust Tensor tests are `7/7 PASS`.

Dedicated hosted run `33089637536` passed Ubuntu job `98578654811` and Windows job `98578655228` at exact branch head `beb57db4e0b5e330cdc736a030e92eebeac4cc0a`. Repository-wide verification initially exposed an environment-sensitive existing Android package assertion; rerun job `98582383466` passed the complete `1045/1045` suite at the same head. The implementation is merged into main at `d0af3cbaee6613665a3352b885f638e49540b666`.

This remains a bounded GPU-native reverse/optimizer candidate, not a `GPU_TRAINING` claim. Hosted runners do not inherit the local AMD device receipt. Full-graph GPU execution, generic GPU portability, throughput, RCL-10M, RCL-1B, distributed training and K400 promotion remain closed. `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` is partially reduced; the next real gate is batched/persistent GPU dispatch plus larger real-GPU evidence. `RCL_GAP_RCL10M_TOKENIZER_DATASET` remains `OPEN / BLOCKED_USER_CORPUS`.

Authority files: `docs/native-ai/gpu-gqa-rope-native-backward-adamw-evidence-v0.1.md`, `examples/native-ai/gpu-gqa-rope-native-backward-adamw-genome.rcl`, `examples/native-ai/gpu-gqa-rope-native-backward-adamw-contract.v0.1.json`, `examples/native-ai/evidence/gpu-gqa-rope-native-backward-adamw-v0.1/k08-gpu-gqa-rope-native-backward-adamw-local-evidence.json`. Reproduction: `npm run test:k08-gpu-gqa-rope-native-backward-adamw`.

### RCL-10M corpus admission gate

Status: `CANDIDATE_SCHEMA_ONLY_BLOCKED_USER_CORPUS`. K08-L byte tokenization and K08-M deterministic byte-BPE infrastructure are reusable, but the repository still contains no admitted Chinese/English/Japanese/code corpus, production approximately 64K tokenizer artifact, license/privacy/poison review, or deterministic real-data shard manifest. The new RCL-owned gate validates the frozen 10,000,000-token manifest shape, rooted tokenizer/filter/dedup/shard provenance, exact ppm mixture coverage and fail-closed admission/tamper boundaries. Its local `5/5` evidence uses only explicitly synthetic `development://` fixture values; Hosted run `32995055906` passed Ubuntu job `98261962473` and Windows job `98261962226` for the same schema gate. This grants no corpus, tokenizer, RCL-10M training or quality claim.

Authority files: `docs/native-ai/rcl-10m-corpus-admission-evidence-v0.1.md`, `examples/native-ai/rcl-10m-corpus-admission-contract.v0.1.json`, `examples/native-ai/evidence/rcl-10m-corpus-admission-v0.1/k08-rcl10m-corpus-admission-local-evidence.json`. Open gaps: `RCL_GAP_USER_CORPUS_LICENSE_PRIVACY_POISON_REVIEW`, `RCL_GAP_RCL10M_CORPUS_BYTES_AND_SHARDS` and `RCL_GAP_RCL10M_TOKENIZER_FREEZE`.

### K08-S BF16 multi-block candidate

K08-S multi-block BF16 is `BF16_MULTIBLOCK_ADAMW_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`. On the post-audit main `609fbc57baf7aa7b60eeb8974ba5843dfaec4e10`, a generic two-block Tensor SSA graph trains through the existing BF16 RNE / FP32 accumulation / Reverse Autodiff / exact FP32 AdamW organ. The four canonical groups (token embedding, block 0, block 1 and LM head) all update; independent initial loss, exact direct-versus-checkpoint resume and deterministic replay pass in `6/6` local tests. GitHub run `32988994250` passed Ubuntu job `98241831755` and Windows job `98241831517` on exact head `fa20e5a860bcbc63594f22a6bdfe4c0bd9c21dc5`. This bounded profile does not claim K08-R's GQA+RoPE graph in BF16, GPU/OpenCL/Vulkan execution, RCL-10M, RCL-1B or K400. Authority: `docs/native-ai/bf16-multiblock-adamw-evidence-v0.1.md`, `examples/native-ai/bf16-multiblock-adamw-contract.v0.1.json` and `examples/native-ai/evidence/bf16-multiblock-adamw-v0.1/k08-s-multiblock-local-evidence.json`.

### K08-R GQA + RoPE BF16 multi-block candidate

K08-R BF16 GQA+RoPE multi-block is `BF16_GQA_ROPE_MULTIBLOCK_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`. On main `a095872beca5d61a3ffde99f31e7163dc54a4dbb`, the existing K08-N/K08-O/K08-R two-block generic graph now executes through K08-S BF16 RNE, FP32 accumulation, Reverse Autodiff and exact FP32 AdamW. All fourteen canonical parameter groups update; loss decrease, deterministic replay and exact direct `6 == checkpoint 3 + resume 3` pass in `6/6` local tests. GitHub run `32989948133` passed Ubuntu job `98244912540` and Windows job `98244912816` on exact head `3716f51`. No GPU/OpenCL/Vulkan, RCL-10M, RCL-1B or K400 claim is granted. Authority: `docs/native-ai/bf16-gqa-rope-multiblock-evidence-v0.1.md`, `examples/native-ai/bf16-gqa-rope-multiblock-contract.v0.1.json` and `examples/native-ai/evidence/bf16-gqa-rope-multiblock-v0.1/k08-r-bf16-local-evidence.json`.

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

## K09 AMD OpenCL persistent provider dispatch

Status: `PASS_LOCAL_AND_HOSTED_OPENCL_PERSISTENT_DISPATCH_CANDIDATE`.
The RCL-owned BF16 GPU training path now starts one auxiliary Python provider
session per training request and reuses one AMD OpenCL context/program across
ordered forward matmul, reverse matmul-gradient and AdamW requests. The
current Windows AMD `gfx1152` host passed the two-request session smoke and
the two-block GQA+RoPE GPU-native exact differential (`3/3`); one-step
telemetry records `338` ordered requests over `persistent-session-v0.1`.
K08-S/K08-R CPU and prior GPU regressions remain green, and provider,
placement and backend errors still fail closed. This reduces
`RCL_GAP_GPU_PROVIDER_DISPATCH_OVERHEAD` only partially: batched kernels,
device-buffer residency, throughput, generic GPU portability, GPU training
promotion and K400 remain closed. Hosted replay for exact evidence head
`fb9afdbf9af318d466a2e2ce8fed03847acfa317` passed: K09 dedicated run
`33095344582`, Universal Stress run `33095344489`,
Authority run `33095344565` and Canonical Verification run `33095344564` all
passed at exact head `fb9afdbf9af318d466a2e2ce8fed03847acfa317`. The RCL-10M tokenizer/dataset gate remains
`OPEN / BLOCKED_USER_CORPUS`.

Authority: `docs/native-ai/gpu-opencl-persistent-dispatch-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-persistent-dispatch-contract.v0.1.json` and
`examples/native-ai/evidence/gpu-opencl-persistent-dispatch-v0.1/k09-opencl-persistent-dispatch-local-evidence.json`.

## K10 AMD OpenCL batched dispatch candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_BATCHED_ADAMW_DISPATCH_CANDIDATE`.
K10 adds a bounded ordered batch message to the K09 persistent AMD OpenCL
session and applies it at the independent AdamW-update boundary. RCL retains
logical request accounting and all Tensor/BF16/autodiff/AdamW semantics. The
provider reuses its process/context/program, but every child operation still
uses isolated kernel and input/output buffers. Real AMD `gfx1152` batch smoke
matched individual BF16 matmul output/root exactly; a 65-operation request
failed closed with `RCL_OPENCL_BATCH`. The two-block GQA+RoPE GPU-native
backward/AdamW differential passed `3/3`; one-step telemetry preserved `338`
logical requests while recording `325` transport dispatches and one batch.
This is dispatch evidence, not throughput evidence. Device-buffer residency,
parallel execution, batched kernels, portability, GPU training promotion,
RCL-10M and K400 remain closed. Hosted replay for exact head
`dbd4979f0ff37fcf098bdafb3c8cbf389399840a` passed: K10 `33137325268`,
Universal Stress `33137325306` after K01 rerun job `98741699248`, Authority
`33137325285` and Canonical Verification `33137325278`. The initial K01 job
`98740106273` exceeded the 240000 ms fixed-point budget; the rerun passed
without a source change. Post-merge main verification passed at
`686659c848a6c642a8d9fd2191f3d6b82b4205d2`: K10 `33138220712`, K09
`33138220700`, Universal Stress `33138220701`, Authority `33138220757` and
Canonical Verification `33138220708`.

Authority: `docs/native-ai/gpu-opencl-batched-dispatch-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-batched-dispatch-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-batched-dispatch-genome.rcl` and
`examples/native-ai/evidence/gpu-opencl-batched-dispatch-v0.1/k10-opencl-batched-dispatch-local-evidence.json`.
Open gaps: `RCL_GAP_GPU_BATCH_PLANNER`,
`RCL_GAP_GPU_DEVICE_BUFFER_RESIDENCY` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K11 AMD OpenCL gradient pair batch candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_GRADIENT_PAIR_BATCH_CANDIDATE`.
K11 reuses the K10 bounded ordered batch transport for exactly the two
reverse-matmul gradient children of one GPU matmul node, in the fixed order
`left-gradient`, `right-gradient`. It does not batch across nodes, change RCL
reverse traversal, create batched kernels or retain device buffers. Real AMD
`gfx1152` individual and pair smoke matched child output bits and execution
roots exactly. The K08 GPU-native multi-block GQA+RoPE backward/AdamW
differential passed `3/3`; one-step telemetry preserved `338` logical requests,
reduced transport dispatches to `217`, and recorded `108` gradient-pair batches
plus one AdamW batch. This is dispatch evidence, not throughput evidence.
Hosted replay for exact head `5838471265383762c858a6c4630e217c0e7eed28` passed:
K11 `33140897123`, K10 `33140897173`, K09 `33140897078`, Universal Stress
`33140897113` (including Windows K01), Canonical `33140897161` and Authority
`33140897104`. Post-merge main verification passed at
`e17cca7e1f4ee613acbad3e2f720cf65f6056218`: K11 `33142026819`, K10
`33142026818`, K09 `33142026797`, Universal Stress `33142026794`, Canonical
`33142026816` and Authority `33142026811`. Authority:
`docs/native-ai/gpu-opencl-gradient-pair-batch-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-gradient-pair-batch-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-gradient-pair-batch-genome.rcl` and
`examples/native-ai/evidence/gpu-opencl-gradient-pair-batch-v0.1/k11-opencl-gradient-pair-batch-local-evidence.json`.
Open gaps: `RCL_GAP_GPU_BATCH_PLANNER`,
`RCL_GAP_GPU_DEVICE_BUFFER_RESIDENCY` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K12 AMD OpenCL cross-node gradient batch candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_CROSS_NODE_GRADIENT_BATCH_CANDIDATE`.
K12 adds an opt-in RCL-owned planner for contiguous ready independent GPU
matmul nodes in canonical reverse order. Each node contributes its fixed K11
`left-gradient`, `right-gradient` pair to one bounded K10 transport message;
the frontier is capped at `32` nodes / `64` operations and singleton work stays
on the K11 path. Real AMD `gfx1152` execution preserved all forward/backward
child roots, losses, parameters, optimizer states and checkpoint root exactly
against same-node batching, while retaining exact CPU checkpoint parity. In the
one-step two-block GQA+RoPE fixture, `338` logical requests and `108` logical
gradient batches were unchanged; `18` cross-node batches covered `36` nodes and
reduced transport dispatches `217 -> 199` and total batches `109 -> 91`. This
is dispatch-count evidence, not throughput evidence. Unknown and unavailable
modes fail closed. Local K12 is `4/4 PASS`, Rust Tensor is `7/7`, K08 Tensor is
`16 PASS + 1 declared skip`, and K11/K10/K09 regressions are green. K400 stays
`23 PASS / 377 UNTESTED`; no cell promotion is claimed. Hosted replay passed
on exact head `f7257091c8178d6c8f813d8d0ba8faaf34543ac8`: K12
`33186294873` passed Ubuntu and Windows; K11 `33186294809`, K10
`33186294821`, K09 `33186294829`, Universal Stress `33186294878`, Canonical
`33186294825` and Authority `33186294855` also passed. Post-merge main
verification passed at `b6886c8c35f8a3fbc0f3441cff016bc601371f54`: K12
`33189905627` passed Ubuntu and Windows; K11 `33189905678`, K10 `33189905671`,
K09 `33189905592`, Universal Stress `33189905603`, Canonical `33189905537` and
Authority `33189905662` also passed. Authority:
`docs/native-ai/gpu-opencl-cross-node-gradient-batch-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-cross-node-gradient-batch-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-cross-node-gradient-batch-genome.rcl` and
`examples/native-ai/evidence/gpu-opencl-cross-node-gradient-batch-v0.1/k12-opencl-cross-node-gradient-batch-local-evidence.json`.
Open gaps: `RCL_GAP_GPU_DEVICE_BUFFER_RESIDENCY`,
`RCL_GAP_GPU_TRAINING_THROUGHPUT` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K13 AMD OpenCL session buffer arena candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_SESSION_BUFFER_ALLOCATION_REUSE_CANDIDATE`.
K13 adds an opt-in RCL-owned `session-arena-v0.1` allocation profile over the
existing persistent AMD OpenCL organ. Buffers are reusable only when OpenCL
memory flags and exact byte length match, with bounds of `64` pooled buffers and
`2,097,152` pooled bytes. A final close receipt proves every pooled allocation
was released before context teardown. On real AMD `gfx1152`, the two-operation
protocol smoke changed six allocations into three allocations plus three
reuses with exact output/root parity. The one-step two-block GQA+RoPE path kept
`1070` buffer acquisitions but changed `1070` new allocations / `31,828` bytes
into `41` allocations / `1,804` bytes plus `1029` reuses. Forward/backward
roots, losses, parameters, optimizer states, checkpoint and CPU parity remained
exact. K13 is `6/6 PASS`, Rust Tensor is `7/7`, K08 Tensor is `16 PASS + 1
declared skip`, K12 is `4/4` and K11/K10/K09 regressions are green. Hosted
exact-head PR #115 passed on `0840e9d83a05a9a4b69e99059c42aace82860f51`, with
K13 Ubuntu/Windows, Universal, Canonical, Authority and K09-K12 checks green.
Post-merge main `251b20a758326fd3a17056c424584145dde15e89` also passed K13 on
Ubuntu/Windows, K09-K12, Canonical and Authority; Universal passed on official
attempt 3 after attempts 1 and 2 hit the existing Windows K01 fixed-point
`240000 ms` timeout. This is allocation-count evidence only: inputs are still
uploaded and outputs read back for every operation, so Tensor residency,
transfer elision, wall-time, throughput, generic portability, GPU training,
RCL-10M and K400 promotion remain closed. Authority:
`docs/native-ai/gpu-opencl-buffer-arena-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-buffer-arena-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-buffer-arena-genome.rcl` and
`examples/native-ai/evidence/gpu-opencl-buffer-arena-v0.1/k13-opencl-buffer-arena-local-evidence.json`.

## K14 AMD OpenCL Tensor value residency candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_VALUE_RESIDENCY_CANDIDATE`.
K14 adds a separate opt-in `tensor-residency-v0.1` session and an RCL-owned
Rust probe bridge. RCL computes a deterministic value root from
`dtype + shape + canonical BF16 bits` and binds it beside `storageIdentity`;
the auxiliary provider owns only the read-only OpenCL `cl_mem` lifetime and
kernel lowering. An exact identity/value-root bind is a hit with no new
host-to-device upload. A changed value root without an explicit replacement
fails closed. Each bounded matmul still performs an explicit device-to-host
readback, so this candidate does not claim output or full-graph residency.

Real local AMD `gfx1152` evidence records two first-bind uploads, two exact
identity/value-root hits, two resident-input transfers, two output readbacks,
two resident Tensor releases and exact `4130` BF16 outputs for two matmuls.
The close receipt reports four total OpenCL allocations/releases (two resident
inputs and two transient outputs) with zero resident buffers after close.
K14 is `3/3 PASS`; Rust Tensor is `7/7`; K08 Tensor is `16 PASS + 1 declared
skip`; K13 and the earlier GPU dispatch candidates remain green. Hosted PR #117
replay passed on Ubuntu and Windows, and post-merge main `418f50f43d446b696a74f2086cf8fafb28c4fb5a`
passed K14 plus the K09-K13, Canonical, Universal and Authority checks. Strict
Clippy remains blocked by eight pre-existing warnings, with no K14-specific
warning observed. Tensor output/full-graph or training-step residency,
wall-time/throughput, VRAM, generic portability, GPU-training promotion,
RCL-10M and K400 remain closed. Authority:
`docs/native-ai/gpu-opencl-tensor-residency-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-tensor-residency-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-tensor-residency-genome.rcl` and
`examples/native-ai/evidence/gpu-opencl-tensor-residency-v0.1/k14-opencl-tensor-residency-local-evidence.json`.

## K15 AMD OpenCL ordered Tensor graph residency candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_GRAPH_RESIDENCY_CANDIDATE`.
K15 extends the opt-in K14 `tensor-residency-v0.1` session with an RCL-owned
ordered graph envelope for two through eight rank-2 BF16 matmul nodes. A node
may consume a resident Tensor identity/value root or an ephemeral resource
produced by an earlier node. Intermediate device-to-host readbacks are
forbidden; the final node must request exactly one explicit readback. The
provider owns only the temporary OpenCL `cl_mem` resources and kernel lowering;
an intermediate resource is not a canonical Tensor value or checkpoint
identity.

On the current AMD `gfx1152` host, the two-node graph returned exact output
bits `4040`, kept the first `[1,2]` output device-resident until the second
node, performed zero intermediate and one final readback, and released both
ephemeral resources before session close. Telemetry recorded five allocations
(`22` bytes), five releases, three Tensor uploads and one device-to-host
transfer. K15 is `3/3 PASS` locally; K14 Tensor residency and K13 allocation
arena remain required regressions. Intermediate-readback and use-before-
produce-resource negatives fail closed. Hosted PR #119 exact-head replay
passed K15 and all K09-K14 regressions plus Authority; post-merge `main`
`d2efae85c7f4ce047ff05f09d39f61abf01aec74` passed the same K15/K09-K14 scope.
The repository-wide Canonical and Universal checks remain independently
failed on the pre-existing K337/K338/K340 compiler RBC drift (including both
hosted retries and the post-merge run); these failures do not involve K15.
This remains a bounded lowering candidate:
canonical Tensor output/full-graph/training-step residency, GPU training,
throughput, VRAM, portability, RCL-10M and K400 promotion remain closed.
Authority:
`docs/native-ai/gpu-opencl-tensor-graph-residency-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-tensor-graph-residency-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-tensor-graph-residency-genome.rcl` and
`examples/native-ai/evidence/gpu-opencl-tensor-graph-residency-v0.1/k15-opencl-tensor-graph-residency-local-evidence.json`.

## K16 AMD OpenCL BF16 additive masked softmax candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_MASKED_SOFTMAX_CANDIDATE`.
K16 adds an RCL-owned generic additive masked-softmax genome and contract. The
semantic boundary is BF16 input/storage, FP32 stable max-subtracted exp/sum/
divide, and BF16 round-to-nearest-even output; the provider owns only the
explicit AMD OpenCL row-kernel lowering and buffer dispatch, with fallback
forbidden. On the real AMD `gfx1152` device, the rank-2 `2 x 3` fixture
returned exact bits `3f80 31c1 3283 323f 3f3b 3e8a`, normalized rows, exact
independent CPU BF16/FP32 differential and deterministic execution root
`959537aaf0115e819ad927a3d1fc3ec6eff6a9dbba086c964460f5036f4c9e03`. The
negative suite rejects unsupported backend, non-additive mask mode, non-finite
BF16 input and malformed shape; local K16 is `3/3 PASS`.

Implementation commit `efdd97291fcae73221253834a2d960890418a948` was merged
by PR #125 as `main@c13a573e997cf59d8f80c79bb79ca69b238ae56f`. Exact-head PR
K16, K08 AMD, K09–K15 regression, Authority, Canonical and Universal checks
passed on Ubuntu and Windows. The same K16/K09–K15/Authority,
Canonical/Universal scope passed post-merge on the new main; exact run/job
receipts are retained in the evidence JSON and are not broader authority than
the bounded K16 contract. This remains a bounded
lowering candidate: full graph or training-step residency, GPU-native
Autodiff/AdamW, GPU training, throughput, VRAM, portability, RCL-10M/RCL-1B
and K400 promotion remain closed. Authority:
`docs/native-ai/gpu-opencl-masked-softmax-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-masked-softmax-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-masked-softmax-genome.rcl`,
`native/tensor-engine/amd_opencl_bf16_provider.py`,
`tests/k16-opencl-masked-softmax.test.mjs` and
`examples/native-ai/evidence/gpu-opencl-masked-softmax-v0.1/k16-opencl-masked-softmax-local-evidence.json`.

## K17 AMD OpenCL mixed Tensor graph candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_MIXED_GRAPH_CANDIDATE`.
K17 extends the RCL-owned ordered Tensor graph with a bounded generic
`matmul -> additive masked-softmax` chain. The BF16 matmul output remains an
ephemeral device resource consumed by the masked-softmax node; intermediate
readback is rejected and exactly one final readback is allowed. RCL owns the
Tensor, graph, masking and numerical semantics. The AMD OpenCL provider owns
only the auxiliary lowering, dispatch and temporary `cl_mem` lifetime.

On the real AMD `gfx1152` device, the `[1,2]` fixture returned exact BF16 bits
`3f00 3f00`, with exact CPU differential and deterministic execution root
`fc1ac696f0e92dd4798d4344bd886dc040eb6d21db177bfb0527d2641c9d1a9f`. Local
K17 is `3/3 PASS`; telemetry recorded zero intermediate readbacks, one final
readback, three host-to-device transfers, one device-to-host transfer, five
allocations/releases and zero resident bytes at close. Unknown operation,
non-additive mask, intermediate readback and shape drift all fail closed.

Exact head `7717296f38326ea30ba82951adecbf95254e851e` passed PR #130 on Ubuntu
and Windows, including K08 AMD, K09–K16, Authority, Canonical and Universal
scopes. The PR merged as `main@edc166ae9acb50741c490678e66d078fb821ec5a`;
post-merge K17, K09–K16, Authority, Canonical and Universal replay also passed.
The earlier K01 Windows timeout was a transient repository-wide replay event;
the rerun passed and is retained in the hosted receipt chain.

This remains a bounded lowering candidate. Full graph or training-step
residency, GPU-native Autodiff/AdamW, GPU training, parallel execution,
throughput, VRAM, portability, RCL-10M/RCL-1B, production model claims and
K400 promotion remain closed. Authority:
`docs/native-ai/gpu-opencl-tensor-mixed-graph-evidence-v0.1.md`,
`examples/native-ai/gpu-opencl-tensor-mixed-graph-contract.v0.1.json`,
`examples/native-ai/gpu-opencl-tensor-mixed-graph-genome.rcl`,
`native/tensor-engine/amd_opencl_bf16_provider.py`,
`native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`,
`tests/k17-opencl-tensor-mixed-graph.test.mjs` and
`examples/native-ai/evidence/gpu-opencl-tensor-mixed-graph-v0.1/k17-opencl-tensor-mixed-graph-local-evidence.json`.
The K400 matrix remains `23 PASS / 0 BLOCKED / 377 UNTESTED`.
