# K08 Native AI Evidence Ledger

## K08-A frozen baseline

- Scope: fixed 2-2-1 XOR MLP.
- Path: Pure RCL source -> native self-hosted compiler -> RBC -> native VM.
- Status before this campaign: AI-N1; every K233 gate except independent `AI_GENERATE` passed.
- Historical authority: `examples/native-ai/evidence/k08-a-evidence.json`.

## K08-B General MLP

| Evidence | Result |
|---|---:|
| Profile | `AI-N2-TWO-DENSE-LAYER-GENERAL-MLP` |
| RBC bytes / instructions | `24,499 / 1,432` |
| Native VM instructions | `109,205,579` |
| Native semantic state root | `890691f699db1d1166b3b3aa3f5744976a0c93acd3bac96f4331a8878149571e` |
| Deterministic replays | `3 / 3` |
| XOR architecture / parameters | `2-2-1 / 9` |
| XOR accuracy / loss | `1.0 / 0.0157034488743931` |
| Majority architecture / parameters | `3-3-1 / 16` |
| Majority accuracy / loss | `1.0 / 0.0111015956287353` |
| Maximum parameter drift | `< 5.4e-15` |
| Direct 32 vs resumed 16+16 | exact rooted parity |
| Median local native runtime | `1,369.6863 ms` |
| Native / JS oracle runtime ratio | `118.300x` |
| Serialized XOR checkpoint | `302 bytes` |
| Report root | `1335a812fd5162511f32fae054d945c5deaf2bd63026aec8495a6a21611de9b2` |

The first pre-evidence probe found equal instructions/constants/functions but a different RBC `programRoot` when Majority initialization used long decimal literals. The contract was explicitly refrozen after normalizing only those initialization literals to the 12-decimal portability envelope already used by K08-A. Thresholds were unchanged. The accepted evidence run then restored byte-identical compiler parity.

## Independent AI_GENERATE authority

- Contract: `examples/native-ai/k233-ai-generation-contract.v0.1.json`.
- Generator: three separate ephemeral Codex CLI sessions.
- Isolation: fresh temporary directory, ignored user config/rules, effective read-only filesystem, JSON Schema edit response.
- Trials: activation derivative, target binding and output-weight gradient routing.
- Result: `3/3` model edits restored canonical source bytes and passed native compilation, native execution, three deterministic replays and differential comparison.
- Unique generator sessions: `3`.
- Local receipt report root: `82cf5c5e906ab6bd15e9e3c30a50475304f79f4c90a35696995804d9996f6482`.
- GitHub Actions run / focused job: `32780097954 / 97600047380`.
- Source commit: `4686184d6790ec08b213a0176279f646a0919beb`.
- GitHub authority root: `bb42598a6d656aab0d19da52491e820c24145aeb0233d3299abca6b171ea6b82`.
- Current authority: `PASS_GITHUB_HOSTED_REPLAY_BOUND`.

Rejected generator candidates are retained in the contract audit: the local Qwen manifest had a missing model blob, and TinyLlama produced semantically incorrect structured edits. Neither was counted.

## Reproduction

```text
npm run build:native
npm run evidence:k08-native-ai:general-mlp
npm run verify:k233-ai-generate
node --test --test-concurrency=1 tests/k08-general-mlp.test.mjs tests/k233-ai-generation-receipt.test.mjs
```

`npm run evidence:k233-ai-generate` invokes new independent model sessions and is intentionally not part of ordinary CI. CI replays the frozen saved candidates instead.

## Evidence boundary

The K08-B portion of this ledger proves the bounded General MLP AI-N2 stack and independently replayed K233 repair evidence only. Later sections record separate Tensor and Autodiff candidates; the ledger still does not prove AdamW, Transformer, language-model training, accelerator lowering, distributed training, competitive performance or K400 completion.

## K08-C Tensor / CPU Engine candidate

Status: `ENGINE_E1_CANDIDATE_GITHUB_REPLAY_BOUND`. Authority remains candidate-only and separate from K233.

| Evidence | Result |
|---|---:|
| Canonical identity | typed `tensor::Tensor`, no data field |
| Storage boundary | separate `tensor::CpuDenseStorage` + `storageIdentity` |
| RCL scalar operations | add/sub/mul/div, broadcast, reshape, transpose, slice, MatMul, sum/mean/max, exp/log/sqrt, softmax |
| Optimized backend | Rust f64 CPU Dense organ through `RclVmProviderV1` |
| Optimized kernels | elementwise, reduction, blocked MatMul, Softmax, LayerNorm, RMSNorm |
| 24-cubed exact differential drift | `0` |
| 24-cubed end-to-end median | scalar `180.608 ms`; provider `29.635 ms`; `6.094x` |
| 192-cubed kernel median | scalar `7.229 ms`; optimized `2.362 ms`; `3.061x` |
| Replays | `7` scalar roots / `7` provider storage identities, one unique value each |
| Evidence report root | `890180d14c8585875d7122c0b38369ab8f8a01b592d6af80f127ebae070b3271` |
| GitHub run / source commit | `32804405376 / e5c3124bb759e5d5c2ec8bbf3e668aabc6a0b080` |
| GitHub Ubuntu / Windows jobs | `97671555187 / 97671555356`, both success |

Positive, negative, boundary and differential coverage includes valid kernels, invalid shape/broadcast/MatMul, dtype/device mismatch, divide-by-zero/log/sqrt domains, storage mismatch, unsupported layout/storage, rank/input/element caps, native self-host/JS compiler byte parity and native VM provider execution.

K08-C intentionally did not relabel the former `118.300x` General MLP Native/JS ratio because that implementation commit still used scalar recursive operations. K08-D below separately lowers and remeasures the General MLP. A floating generated-matrix probe also exposed scientific-notation number canonicalization drift between the native state root and the JS verifier; the accepted K08-C performance corpus uses integer values and records that unresolved evidence gap rather than disabling strict state-root verification.

The GitHub-hosted replay receipt is `examples/native-ai/evidence/tensor-cpu-v0.1/github-replay.json`. It binds the exact implementation commit, Ubuntu portable test, Windows native Provider test and Windows performance-evidence step; it grants no K400 promotion.

Reproduction:

```text
npm run test:k08-tensor
npm run evidence:k08-tensor-cpu
```

## K08-D General MLP Tensor lowering candidate

Status: `ENGINE_E1_GENERAL_MLP_TENSOR_LOWERING_CANDIDATE_GITHUB_REPLAY_BOUND`. Authority remains candidate-only and separate from K233.

| Evidence | Result |
|---|---:|
| Semantic source | unchanged `general-mlp.rcl` + rooted contract |
| Execution path | self-host compiler -> RBC -> native VM -> `RclVmProviderV1` -> Rust Tensor Plan |
| Plan | `6,112,741 bytes / 29,980 nodes / 40 initial tensors / 18 outputs` |
| Generic operations | `abs/add/div/matmul/mul/sub/sum/transpose` |
| Model-special operations | none |
| XOR / Majority-3 accuracy | `1 / 1` |
| Maximum parameter drift | `< 4.5e-15` |
| Determinism | `3/3` identical output and native semantic state roots |
| Checkpoint | exact f64 bit parity for direct 32 vs serialized 16+16 |
| Scalar / Tensor median | `2537.360 ms / 443.592 ms` |
| Scalar-to-Tensor speedup | `5.720x` |
| Prior / current Native-to-JS ratio | `118.300x / 15.863x` |
| Gap reduction factor | `7.458x` |
| Retained allocation upper bound | `1,657,080 bytes`; peak process RSS unmeasured |
| Plan SHA-256 | `319abf8a601d2f9d8c91928f0cd54135219d732b0d338c9706371c9daeb2a523` |
| Evidence report root | `f4982380f9d7d05bd85a838fa7b65f37bfee12c2a401abb95a31b0fff677f70d` |
| GitHub run / source commit | `32810795935 / 8b53c60321345fdcc9449c1a5b7b522a3e7939a9` |
| GitHub Ubuntu / Windows jobs | `97689609410 / 97689609314`, both success |

The JS auxiliary lowerer owns no model semantics and computes no training result. It binds the RCL source hash and contract root into a generic plan; typed/self-hosted plan construction remains `RCL_GAP_AI_009/011`. Decimal JSON checkpoint values are accompanied by exact finite f64 Storage bits because decimal cross-runtime parsing moved one value by one ULP during the negative probe.

The accepted local receipt is `examples/native-ai/evidence/general-mlp-tensor-v0.1/k08-d-general-mlp-tensor-evidence.json`. The separate `github-replay.json` binds the exact implementation commit, Ubuntu portable suite and Windows Provider/performance/evidence steps. It grants no native Autodiff, AdamW, Transformer, accelerator, distributed Tensor or K400 promotion claim.

Reproduction:

```text
npm run test:k08-tensor
npm run evidence:k08-tensor-mlp
```

## K08-E Tensor Plan liveness candidate

Status: `ENGINE_E1_TENSOR_PLAN_LIVENESS_CANDIDATE_GITHUB_REPLAY_BOUND`. It changes execution storage policy, not Tensor or model semantics.

| Evidence | Result |
|---|---:|
| Workload | unchanged K08-D `6,112,741-byte / 29,980-node` generic SSA plan |
| Semantic parity | all 14 controlled baseline/candidate output roots identical |
| Cumulative allocation | `207,135 elements / 1,657,080 bytes`, unchanged |
| Peak logical plan store | `232 elements / 1,856 bytes` |
| Retained requested outputs | `55 elements / 440 bytes` |
| Reclaimed values / elements | `30,002 / 207,080` |
| Logical plan-store reduction | `892.823x` |
| Controlled A/B medians | `331.937 ms` pre-liveness / `286.367 ms` liveness |
| Controlled workload speedup | `1.159x` (`13.729%` runtime reduction) |
| Exact baseline | clean detached worktree at `ccfab80217a76d8ad5ab923e891cb8e8fbd538d7` |
| Evidence report root | `0db5ef574caad46d22549c64e0f695d6e423bc9642965a85ca25b3d8cdf52629` |
| GitHub run / source commit | `32815298348 / 8073482a57cb4ac096cd8545dcd15d01e87c228b` |
| GitHub Ubuntu / Windows jobs | `97702229003 / 97702228815`, both success |

Requested intermediate outputs are pinned through their final downstream use; duplicate SSA definitions remain rejected even after the earlier value would have been reclaimed. The cumulative allocation ceiling is preserved and a separate simultaneous-live ceiling is added, so the change does not weaken the existing resource gate.

The accepted local receipt is `examples/native-ai/evidence/tensor-plan-liveness-v0.1/k08-e-tensor-plan-liveness-evidence.json`. The separate `github-replay.json` binds its root to the exact implementation and successful Ubuntu/Windows jobs. It measures the logical plan value store only. Process peak RSS, allocator overhead, transient cloned operands, response serialization, buffer reuse, general workload speedup, Native/JS parity and K400 promotion are not granted.

## K08-F Tensor Plan borrowed-input candidate

Status: `ENGINE_E1_TENSOR_BORROWED_INPUT_CANDIDATE_GITHUB_REPLAY_BOUND`. It changes Rust execution ownership only; Tensor Plan and operation semantics remain RCL-owned.

| Evidence | Result |
|---|---:|
| Exact baseline | clean detached worktree at `9805956dfd24834d650534a8186ab53eb084f8b5` |
| Production workload | unchanged `6,112,741-byte / 29,980-node` generic SSA Plan |
| Borrowed input bindings | `54,964 / 54,964` |
| Historical storage clone traffic avoided | `314,521 elements / 2,516,168 bytes` |
| Candidate Plan input clones | `0 elements / 0 bytes` |
| Controlled Plan medians | `234.698 ms` baseline / `192.423 ms` borrowed |
| Controlled workload speedup | `1.220x` (`18.013%` runtime reduction) |
| General MLP peak Working Set medians | `38,445,056 / 38,445,056 bytes`; no reduction observed |
| Clone-stress peak Working Set medians | `20,234,240 / 18,636,800 bytes`; `7.895%` lower |
| Semantic parity | one output root per workload across all baseline/candidate samples |
| Evidence report root | `9bc62c3b126a9428f6213989d0cb184ff0787cbeec989c51d130cbedad8720fe` |
| GitHub run / source commit | `32821559973 / d130a4d91f68159ea7405222ed6658ff2269b459` |
| GitHub Ubuntu / Windows jobs | `97720582566 / 97720582266`, both success |

The tracked sampler reads the exact child process `PeakWorkingSet64` while it is alive. The result includes all child-process memory and is deliberately separate from K08-E logical Plan-store telemetry. The 200,000-element-per-input stress isolates the historical `3,200,000`-byte storage clone boundary; neither result grants portable/general RSS reduction, VRAM reduction, buffer reuse, compact lowering, Autodiff or K400 promotion.

The hosted receipt is `examples/native-ai/evidence/tensor-plan-borrowed-inputs-v0.1/github-replay.json`. It binds the admitted run and preserves failed runs `32819776325` and `32820687027`, whose new sampler steps exposed an empty-request stdin transport on GitHub Windows. The admitted implementation reuses the existing Tensor CLI request-file path; it does not erase the negative evidence.

Reproduction:

```text
npm run test:k08-tensor
npm run evidence:k08-tensor-mlp
npm run evidence:k08-tensor-borrowed-input -- --baseline-binary <exact-main-release-binary> --baseline-repository <clean-exact-main-worktree>
```

## K08-G Native Reverse-Mode Autodiff candidate

Status: `ENGINE_E2_AUTODIFF_CANDIDATE_GITHUB_REPLAY_BOUND`. It replaces the General MLP execution dependency on its hand-written backward path; the old implementation remains a reference oracle only.

| Evidence | Result |
|---|---:|
| Canonical source | `examples/native-ai/autodiff-genome.rcl` |
| Graph boundary | generic Tensor SSA `ComputationGraph`; no model-special operation |
| Reverse semantics | `BackwardEdge`, `GradientIdentity`, shape-checked `GradientAccumulator`, `StopGradient`, `Backward()` |
| Differential primitive set | add/sub/mul/div, MatMul, transpose, reshape, broadcast, sum/mean, exp/log/sqrt/abs, activation, Softmax |
| Analytic/manual maximum drift | `0` |
| Central finite-difference maximum drift | `3.7655e-10` |
| Deterministic gradient replays | `3/3`, one root |
| XOR / Majority-3 accuracy | `1 / 1` |
| XOR / Majority-3 final loss | `0.01570345 / 0.01110160` |
| Maximum parameter drift vs hand-written oracle | `1.7764e-15` |
| Checkpoint | exact `32 == 16 + reload + 16`; `0` parameter drift |
| Accepted source commit | `3132b81d9e0b7b7788aaf4b23457656c559b9793` |
| Local evidence root | `5028e21e0c0184795cb0375e8aa2ef928c0f22d8fae1c32584f2192c41de7709` |

The first split-checkpoint probe failed exact parity by one ULP because exact Storage bits were applied during validation but the mutable SGD storage still held the decimal transport value. The accepted implementation materializes exact bits into mutable parameter storage before the first resumed update. No tolerance was relaxed.

The RCL Genome self-host compiler and JS bootstrap produce byte-identical RBC, and the resulting Genome executes in the native VM. Rust owns only the CPU execution organ. The bounded training envelope reuses the existing RCL Batch SGD semantics; it is not the ENGINE-E3 Optimizer Genome and contains no Momentum, Adam or AdamW state.

Performance is a local release child-process measurement. The accepted run measured XOR/Majority-3 end-to-end training wall time of `80.882 / 61.359 ms`, including request-file transport, process startup, forward, backward, Batch SGD updates and response serialization. Autodiff peak RSS, portable runtime ratios, accelerator execution and large-graph performance remain unmeasured.

Reproduction:

```text
npm run test:k08-autodiff
npm run evidence:k08-autodiff
```

This candidate grants no ENGINE-E3 Optimizer Genome, AdamW, Transformer, Tiny LM, accelerator, general performance parity or K400 promotion claim.

Hosted replay is now bound by `examples/native-ai/evidence/native-autodiff-v0.1/github-replay.json`: run `32828410493`, Ubuntu job `97741439391`, Windows job `97741439698`, exact evidence commit `103a330f034a234c52d2d7eb287fd154c4e4b902`, all successful. The receipt authority root is `370de08a986177eb43546348a606c80ce291980eb3f37aba465211e54470a065`. This hosted admission changes the suffix only; it does not grant any claim listed above.

## K08-S BF16 Autodiff + AdamW reference candidate

Status: `BF16_AUTODIFF_ADAMW_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`. This candidate is based on latest `origin/main@30c162c6cd13b2c9310202f2a604da23e5b4c552` and safely replays the historical K08-S source commit `1c9cb93bb687eb47fb39ea7dd392d8cd5d607b30` before replacing its matmul-only path with a generic RCL Tensor SSA + Reverse Autodiff precision lowering.

| Evidence | Result |
|---|---:|
| RCL genome self-host/native-root parity | PASS |
| BF16 RNE bit oracle and forward-loss differential | PASS |
| FP32 gradient under explicit `straight-through-fp32` cast backward | PASS |
| FP32 master versus BF16 compute weights | PASS |
| FP32 AdamW one-step bit oracle | PASS |
| Loss decrease / all canonical parameters update | PASS |
| Deterministic replay | PASS |
| Direct N versus checkpoint K + resume N-K | exact PASS |
| Exact master/moment bits and checkpoint root | exact PASS |
| Malformed/non-finite exact bits | fail-closed PASS |
| Canonical optimizer-state order | fail-closed PASS |
| Unsupported accelerator | fail-closed PASS; no CPU fallback |
| Local Node suite / Rust unit suite | `9/9` / `7/7` |
| Hosted Ubuntu + Windows replay | PASS, run `32987036258`, head `73336cb7b76dbecd95aabe7f840374067c22c15a`, evidence root `fc3235622a6d0da8259d2b73fad5eb14dadc58c6fbb54cb9716335b58480db2e` |
| Real GPU execution | CLOSED / no accepted runner |

Authority files:

- `examples/native-ai/bf16-autodiff-adamw-genome.rcl`
- `examples/native-ai/bf16-autodiff-adamw-contract.v0.2.json`
- `examples/native-ai/evidence/bf16-autodiff-adamw-v0.2/k08-s-local-evidence.json`
- `docs/native-ai/bf16-autodiff-adamw-evidence-v0.2.md`

Reproduction:

```text
npm run verify:version-contract
npm run test:k08-bf16-autodiff-adamw
cargo test --release --locked --manifest-path native/tensor-engine/Cargo.toml
```

This candidate grants bounded BF16 generic Autodiff, FP32 gradient/master/AdamW state, exact FP32 checkpoint continuation and no-silent-fallback semantics only. It grants no GPU, multi-block BF16, RCL-10M, RCL-1B, production tokenizer/dataset or K400 claim. Open gaps: `RCL_GAP_GPU_EXECUTION`, `RCL_GAP_BF16_MULTI_BLOCK_INTEGRATION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`. Hosted replay gap `RCL_GAP_K08_S_HOSTED_REPLAY` is closed for this candidate by run `32987036258`, with Ubuntu job `98235663711` and Windows job `98235663539`.

## GPU backend reality audit

Status: `REAL_GPU_PRESENT_RCL_BACKEND_NOT_IMPLEMENTED_CANDIDATE_BLOCKED`. The current Windows host exposes a real AMD Radeon(TM) 860M (`0x1002:0x1114`) through Vulkan 1.4.325 and one AMD OpenCL 2.0 GPU device with `cl_khr_fp16`. The RCL Tensor organ is still CPU-only and rejects GPU device intent; hardware discovery is not GPU execution evidence.

Authority files:

- `docs/native-ai/gpu-backend-reality-audit-v0.1.md`
- `examples/native-ai/evidence/gpu-backend-audit-v0.1/gpu-backend-audit.json`

The bounded AMD OpenCL generic BF16 reference organ is now implemented as an auxiliary Python `ctypes` lowerer with explicit pack/unpack, FP32 accumulation, CPU differential parity, deterministic replay and fail-closed unavailable-backend behavior. This does not grant GPU training, OpenCL BF16 Autodiff/AdamW, RCL-10M or K400 promotion.

## K08 AMD OpenCL BF16 matmul candidate

Status: `PASS_LOCAL_AND_HOSTED_GPU_REFERENCE_CANDIDATE`. RCL owns the BF16 contract and genome; `native/tensor-engine/amd_opencl_bf16_provider.py` is an auxiliary lowerer only. The current Windows host selected the real AMD `gfx1152` OpenCL 2.0 device and executed the generic `rcl_bf16_matmul` kernel with `gpuExecuted=true` and `gpuClaim=false`. A fixed 2×3 by 3×2 request returned `4100,bfc0,4188,0000`, exactly matching the independent CPU BF16 bit oracle. Deterministic replay and fail-closed malformed, non-finite, shape and unsupported-backend negatives pass in `3/3` local tests. Hosted run `32993386531` passed Ubuntu job `98256291089` and Windows job `98256291461` on exact head `a45622d5d3eeee61528d797c38b2f55b1abe78de`; Hosted does not inherit the local AMD device receipt.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Real AMD OpenCL device receipt | PASS, `gfx1152`, driver `3661.0 (PAL,LC)` |
| OpenCL BF16 matmul execution | PASS, exact output bits |
| Independent CPU bit differential | exact PASS |
| Deterministic replay | exact PASS |
| Fail-closed negatives / no CPU fallback | PASS |
| Local Node evidence | `3/3 PASS` |
| Hosted Ubuntu + Windows replay | PASS, run `32993386531`, jobs `98256291089` / `98256291461` |

Authority files:

- `docs/native-ai/opencl-bf16-matmul-evidence-v0.1.md`
- `examples/native-ai/opencl-bf16-matmul-genome.rcl`
- `examples/native-ai/opencl-bf16-matmul-contract.v0.1.json`
- `examples/native-ai/evidence/opencl-bf16-matmul-v0.1/k08-amd-opencl-local-evidence.json`

Reproduction: npm run test:k08-amd-opencl-bf16. Claims are limited to AMD OpenCL BF16 matmul reference execution and bit-exact differential. Hosted replay gap RCL_GAP_OPENCL_HOSTED_REPLAY is closed for this candidate by run 32993386531. Open gaps: RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION and RCL_GAP_RCL10M_TOKENIZER_DATASET.

## GPU BF16 Autodiff + AdamW hybrid candidate

Status: PASS_LOCAL_GPU_HYBRID_CANDIDATE_HOSTED_REPLAY_PENDING. The generic RCL BF16 Autodiff + AdamW loop now admits an explicit opencl-amd-hybrid placement profile. Matmul nodes must execute through the existing AMD OpenCL lowerer; non-matmul nodes must explicitly use the RCL Rust BF16 CPU reference. The current Windows host executed the GPU matmul node on AMD gfx1152. CPU differential is exact for loss, parameters, optimizer states and checkpoint root. Local evidence is 3/3 PASS; missing placement, CPU matmul placement, missing provider and graph/backend mismatch all fail closed. This only reduces the accelerator integration gap: Reverse Autodiff, FP32 masters, AdamW state and optimizer updates remain RCL-owned Rust execution, and no GPU training, full-graph GPU, GPU backward/optimizer kernels, GQA/RoPE GPU or throughput claim is granted.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Generic BF16 Autodiff + AdamW graph reaches explicit GPU matmul | PASS |
| Real AMD OpenCL matmul in the training forward path | PASS, gfx1152 |
| Explicit host-reference placements | PASS |
| CPU loss/parameter/state/checkpoint differential | exact PASS |
| Placement/provider/backend fail-closed negatives | PASS |
| Local Node evidence | 3/3 PASS |
| Hosted Linux + Windows replay | PENDING, run 32997101860 |

Authority files:

- docs/native-ai/gpu-bf16-autodiff-adamw-evidence-v0.1.md
- examples/native-ai/gpu-bf16-autodiff-adamw-genome.rcl
- examples/native-ai/gpu-bf16-autodiff-adamw-contract.v0.1.json
- examples/native-ai/evidence/gpu-bf16-autodiff-adamw-v0.1/k08-gpu-bf16-autodiff-adamw-local-evidence.json

Reproduction: npm run test:k08-gpu-bf16-autodiff-adamw. Open gaps: RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION and RCL_GAP_RCL10M_TOKENIZER_DATASET.

## GPU BF16 ordered multi-block hybrid candidate

Status: `PASS_LOCAL_GPU_HYBRID_ORDERED_MULTI_MATMUL_CANDIDATE_GITHUB_REPLAY_BOUND`. This candidate extends the explicit AMD OpenCL hybrid profile to an ordered generic graph with two GPU-placed matmul nodes and eight explicitly RCL-hosted BF16 reference nodes. The current AMD gfx1152 host executed both matmuls inside the real BF16 Reverse Autodiff + AdamW loop. The CPU-equivalent graph matched initial/final loss, all four canonical parameters, optimizer states and checkpoint root exactly; direct replay and checkpoint resume are exact. Provider, placement and backend mismatch negatives fail closed.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Ordered two-matmul graph | PASS |
| Real AMD OpenCL execution of both GPU nodes | PASS, gfx1152 |
| Explicit host-reference nodes | PASS, 8 per forward |
| CPU loss/parameter/state/checkpoint differential | exact PASS |
| Deterministic replay and checkpoint resume | exact PASS |
| Placement/provider/backend fail-closed negatives | PASS |
| Local Node evidence | `3/3 PASS` |
| Hosted Ubuntu replay | PASS, run `33000754805`, job `98281650727` |
| Hosted Windows replay | PASS, run `33000754805`, job `98281650452` |

Authority files:

- `docs/native-ai/gpu-bf16-multiblock-evidence-v0.1.md`
- `examples/native-ai/gpu-bf16-multiblock-genome.rcl`
- `examples/native-ai/gpu-bf16-multiblock-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-bf16-multiblock-v0.1/k08-gpu-bf16-multiblock-local-evidence.json`

Reproduction: `npm run test:k08-gpu-bf16-multiblock`. Claims are limited to ordered multi-matmul OpenCL hybrid candidate execution. GPU training, GPU backward/optimizer kernels, generic GPU portability, GQA/RoPE GPU, RCL-10M and K400 promotion remain closed. Open gaps: `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## GPU GQA + RoPE hybrid candidate

Status: `PASS_LOCAL_GPU_HYBRID_GQA_ROPE_FORWARD_CANDIDATE_GITHUB_REPLAY_BOUND`. This candidate binds a minimal generic RCL GQA + RoPE graph to the AMD OpenCL matmul lowerer. Two query heads retain independent Q paths while sharing one K/V path; the native RCL RoPE frame organ supplies the position frame. Eleven matmul nodes per forward execute through explicit GPU placement, while 21 softmax, mask, transpose, elementwise and loss nodes remain explicit RCL CPU reference. The current AMD gfx1152 host passed local `3/3`; CPU loss/parameter/state/checkpoint differential and direct/checkpoint replay are exact. Placement/provider/backend negatives fail closed.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Native RCL RoPE frame | PASS |
| Two query heads with shared K/V path | PASS |
| Real AMD OpenCL projection/RoPE/attention matmuls | PASS, gfx1152, 11 per forward |
| Explicit host-reference nodes | PASS, 21 per forward |
| CPU loss/parameter/state/checkpoint differential | exact PASS |
| Deterministic replay and checkpoint resume | exact PASS |
| Placement/provider/backend fail-closed negatives | PASS |
| Local Node evidence | `3/3 PASS` |
| Hosted Ubuntu + Windows replay | PASS, run `33002049364`, Ubuntu job `98286127130`, Windows job `98286127096` |

Authority files:

- `docs/native-ai/gpu-gqa-rope-evidence-v0.1.md`
- `examples/native-ai/gpu-gqa-rope-genome.rcl`
- `examples/native-ai/gpu-gqa-rope-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-gqa-rope-v0.1/k08-gpu-gqa-rope-local-evidence.json`

Reproduction: `npm run test:k08-gpu-gqa-rope`. Claims are limited to bounded GQA + RoPE forward matmul lowering in an explicit OpenCL hybrid. Full GPU training, GPU-native attention/backward/optimizer kernels, generic GPU portability, RCL-10M and K400 promotion remain closed. Open gaps: `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## GPU-native BF16 backward + AdamW candidate

Status: `PASS_LOCAL_GPU_NATIVE_REVERSE_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`. The generic RCL Tensor SSA path now reaches three explicit AMD OpenCL lowerings: left and right matmul gradients plus elementwise FP32 AdamW. The current AMD `gfx1152` host executed all three classes of GPU primitive; the Rust organ retains RCL ownership of reverse rules, BF16 RNE, FP32 master/state bits and checkpoint identity, and forbids CPU fallback. The minimal graph matched CPU loss, parameters, optimizer state and checkpoint root exactly, with exact direct replay/resume and fail-closed placement/provider/backend negatives. PR #93 run `33005295847` passed Ubuntu job `98297368527` and Windows job `98297368737`.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Real AMD OpenCL reverse matmul gradients | PASS |
| Real AMD OpenCL FP32 AdamW | PASS |
| GPU forward/reverse/optimizer telemetry | PASS, `1 / 2 / 4` bounded nodes/elements |
| CPU exact differential and checkpoint parity | PASS |
| Fail-closed negatives | PASS |
| Local candidate suite | `3/3 PASS` |
| Existing GPU/CPU regressions | `15/15 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| Hosted replay | PASS, PR #93 run `33005295847`, jobs `98297368527` / `98297368737` |

Authority files:

- `docs/native-ai/gpu-native-backward-adamw-evidence-v0.1.md`
- `examples/native-ai/gpu-native-backward-adamw-genome.rcl`
- `examples/native-ai/gpu-native-backward-adamw-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-native-backward-adamw-v0.1/k08-gpu-native-backward-adamw-local-evidence.json`

Reproduction: `npm run test:k08-gpu-native-backward-adamw`. Claims are limited to bounded AMD OpenCL matmul-gradient and FP32 AdamW lowering. `GPU_TRAINING`, full-graph GPU, GPU-native GQA/RoPE training, generic GPU portability, RCL-10M and K400 promotion remain closed. `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` is partially reduced; `RCL_GAP_RCL10M_TOKENIZER_DATASET` remains open and blocked on user-owned corpus bytes.

## GPU-native multi-block GQA + RoPE backward + AdamW candidate

Status: `PASS_LOCAL_GPU_NATIVE_GQA_ROPE_BACKWARD_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`. This candidate integrates the prior GPU-native reverse matmul and FP32 AdamW primitives into the complete bounded K08-R-style two-block generic Tensor SSA graph. RCL owns the graph, two-query-head/shared-KV topology, native RoPE composition, reverse rules, BF16 RNE, FP32 accumulation, FP32 master/state bits and checkpoint identity. The Python provider remains an auxiliary lowering organ and CPU fallback is forbidden.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Two-block GQA with shared K/V per block | PASS |
| Native RCL RoPE frame | PASS |
| Generic graph without model-special opcode | PASS |
| GPU forward matmul nodes per step | `36` |
| GPU reverse matmul-gradient calls per step | `72` |
| Explicit host CPU reference nodes per step | `>40` |
| Canonical parameter groups / elements | `14 / 208` |
| Real AMD OpenCL forward, reverse-left, reverse-right and AdamW | PASS |
| CPU loss/parameter/state/checkpoint differential | exact PASS |
| Direct replay and checkpoint resume | exact PASS |
| Placement/provider/backend negatives | fail-closed PASS |
| Local candidate suite | `3/3 PASS` |
| Existing GPU/CPU regressions | `15/15 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| Hosted dedicated workflow | PASS, run `33089637536`, jobs `98578654811` / `98578655228` |
| Repository-wide canonical verification | PASS on rerun, `1045/1045`, job `98582383466` |

The current host receipt is AMD Accelerated Parallel Processing / `gfx1152` / OpenCL `2.0 AMD-APP (3661.0)` / driver `3661.0 (PAL,LC)`. The one-step differential timing was `234474.7675 ms`; the two-step replay/resume/negative-boundary timing was `1095830.0468 ms`. These are correctness-run timings, not throughput evidence. The first repository-wide attempt failed only at an existing Android package verification assertion (`expected verified`, `actual rejected`); the same job was rerun at the identical head and passed, and the initial failure remains recorded in the evidence JSON.

Authority files:

- `docs/native-ai/gpu-gqa-rope-native-backward-adamw-evidence-v0.1.md`
- `examples/native-ai/gpu-gqa-rope-native-backward-adamw-genome.rcl`
- `examples/native-ai/gpu-gqa-rope-native-backward-adamw-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-gqa-rope-native-backward-adamw-v0.1/k08-gpu-gqa-rope-native-backward-adamw-local-evidence.json`

Reproduction: `npm run test:k08-gpu-gqa-rope-native-backward-adamw`. Claims are limited to bounded AMD OpenCL GQA/RoPE forward matmul plus GPU-native reverse matmul-gradient and FP32 AdamW lowering. `GPU_TRAINING`, full-graph GPU, generic GPU portability, throughput, RCL-10M, RCL-1B, distributed training and K400 promotion remain closed. `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` is partially reduced; `RCL_GAP_RCL10M_TOKENIZER_DATASET` remains open and blocked on user-owned corpus bytes.

## RCL-10M corpus admission gate

Status: `CANDIDATE_SCHEMA_ONLY_BLOCKED_USER_CORPUS`. K08-L and K08-M provide reusable byte/BPE semantics and deterministic rooted artifacts, but no real admitted multilingual/code corpus or production tokenizer artifact is present in the repository. The new RCL-owned validator freezes the minimum 10,000,000-token admission manifest: rooted tokenizer, exact ppm language/domain mixture, source hashes and review references, filtering and dedup roots, deterministic shards and explicit admission decisions. Local `5/5` tests use synthetic `development://` values only; Hosted run `32995055906` passed the same schema gate on Ubuntu and Windows. They prove the gate, not a dataset.

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract | PASS |
| Frozen RCL-10M manifest schema | PASS |
| Deterministic manifest root | PASS |
| Pending review/bytes block admission | fail-closed PASS |
| Missing mixture/provenance/shard bindings | fail-closed PASS |
| Tampered root | fail-closed PASS |
| Local Node evidence | `5/5 PASS` |
| Hosted Ubuntu + Windows schema replay | PASS, run `32995055906`, jobs `98261962473` / `98261962226` |
| Real user corpus and production tokenizer | BLOCKED_USER_INPUT |

Authority files:

- `docs/native-ai/rcl-10m-corpus-admission-evidence-v0.1.md`
- `examples/native-ai/rcl-10m-corpus-admission-genome.rcl`
- `examples/native-ai/rcl-10m-corpus-admission-contract.v0.1.json`
- `examples/native-ai/evidence/rcl-10m-corpus-admission-v0.1/k08-rcl10m-corpus-admission-local-evidence.json`

Reproduction: `npm run test:rcl-10m-corpus-admission`. Claims are limited to a schema candidate. Open gaps: `RCL_GAP_USER_CORPUS_LICENSE_PRIVACY_POISON_REVIEW`, `RCL_GAP_RCL10M_CORPUS_BYTES_AND_SHARDS` and `RCL_GAP_RCL10M_TOKENIZER_FREEZE`.

## K08-S BF16 multi-block reference candidate

Status: `BF16_MULTIBLOCK_ADAMW_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`. This is a bounded two-block generic Tensor SSA composition on top of K08-S BF16 RNE, FP32 accumulation, Reverse Autodiff and exact FP32 AdamW state. It trains four canonical groups in order: shared token embedding, block 0, block 1 and shared LM head. The profile is intentionally smaller than K08-R's GQA+RoPE graph; it does not silently claim BF16 GQA/RoPE integration.

| Evidence | Result |
|---|---:|
| RCL genome self-host/native-root parity | PASS |
| Independent two-block BF16 loss differential | PASS |
| Loss decrease / all four parameter groups update | PASS |
| FP32 master versus BF16 compute / exact optimizer state | PASS |
| Deterministic replay | PASS |
| Direct 6 versus checkpoint 3 + resume 3 | exact PASS |
| Canonical state order and model-special negatives | fail-closed PASS |
| Local Node evidence | `6/6 PASS` |
| Hosted Ubuntu + Windows replay | PASS, run `32988994250`, Ubuntu job `98241831755`, Windows job `98241831517`, exact head `fa20e5a860bcbc63594f22a6bdfe4c0bd9c21dc5` |

Authority files:

- `examples/native-ai/bf16-multiblock-adamw-genome.rcl`
- `examples/native-ai/bf16-multiblock-adamw-contract.v0.1.json`
- `examples/native-ai/evidence/bf16-multiblock-adamw-v0.1/k08-s-multiblock-local-evidence.json`
- `docs/native-ai/bf16-multiblock-adamw-evidence-v0.1.md`

Reproduction: `npm run test:k08-bf16-multiblock`. Claims are limited to bounded two-block BF16 training, exact continuation and all canonical group updates. Hosted replay gap `RCL_GAP_K08_S_MB_HOSTED_REPLAY` is closed for this candidate by run `32988994250`. Open gaps: `RCL_GAP_GPU_EXECUTION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K08-R GQA + RoPE BF16 multi-block candidate

Status: `BF16_GQA_ROPE_MULTIBLOCK_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`. The existing K08-N RoPE + K08-O GQA + K08-R two-block generic Tensor graph now runs through K08-S BF16 RNE, FP32 accumulation, Reverse Autodiff and exact FP32 AdamW. Fourteen canonical parameter groups update in order, and local evidence is `6/6 PASS` for genome/native-root parity, GQA+RoPE composition, loss decrease, exact state, deterministic replay, exact checkpoint resume and fail-closed negatives.

| Evidence | Result |
|---|---:|
| Two-block K08-N/K08-O graph under BF16 Autodiff AdamW | PASS |
| All fourteen parameter groups update | PASS |
| Direct 6 versus checkpoint 3 + resume 3 | exact PASS |
| Local Node evidence | `6/6 PASS` |
| Hosted Ubuntu + Windows replay | PASS, run `32989948133`, Ubuntu job `98244912540`, Windows job `98244912816`, exact head `3716f51` |

Authority files:

- `examples/native-ai/bf16-gqa-rope-multiblock-genome.rcl`
- `examples/native-ai/bf16-gqa-rope-multiblock-contract.v0.1.json`
- `examples/native-ai/evidence/bf16-gqa-rope-multiblock-v0.1/k08-r-bf16-local-evidence.json`
- `docs/native-ai/bf16-gqa-rope-multiblock-evidence-v0.1.md`

Reproduction: `npm run test:k08-r-gqa-rope-bf16`. This grants only bounded BF16 GQA+RoPE two-block training and exact continuation. Hosted gap `RCL_GAP_K08_R_BF16_HOSTED_REPLAY` is closed for this candidate by run `32989948133`. Open gaps: `RCL_GAP_GPU_EXECUTION` and `RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K09 AMD OpenCL persistent dispatch candidate

Status: `PASS_LOCAL_AND_HOSTED_OPENCL_PERSISTENT_DISPATCH_CANDIDATE`.
The RCL-owned GPU training path now uses one newline-delimited auxiliary
provider session per RCL training request. The session reuses one provider
process, OpenCL context and OpenCL program while keeping kernel and buffer
objects request-local. Real AMD `gfx1152` session smoke passed with exact
`4000` output roots; the two-block GQA+RoPE GPU-native backward/AdamW path
passed `3/3` with CPU loss, parameters, optimizer states and checkpoint root
exact. One-step telemetry records `338` ordered provider requests over
`persistent-session-v0.1`. K08-S/K08-R CPU and prior GPU regressions remain
green; provider, placement and backend errors remain fail-closed. K09
dedicated run `33095344582`, Universal Stress `33095344489`, Authority
`33095344565` and Canonical Verification `33095344564` all passed at exact
head `fb9afdbf9af318d466a2e2ce8fed03847acfa317`.

| Evidence | Result |
|---|---:|
| Local K09 persistent-session smoke | `1/1 PASS` |
| Local K08 GPU-native GQA+RoPE integration | `3/3 PASS` |
| K08 CPU regression suites | `21/21 PASS` |
| K08 GPU regression suites | `12/12 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| Hosted K09 / Universal Stress / Authority / Canonical | PASS at `fb9afdbf9af318d466a2e2ce8fed03847acfa317` |

Authority files:

- `docs/native-ai/gpu-opencl-persistent-dispatch-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-persistent-dispatch-genome.rcl`
- `examples/native-ai/gpu-opencl-persistent-dispatch-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-opencl-persistent-dispatch-v0.1/k09-opencl-persistent-dispatch-local-evidence.json`

Reproduction: `npm run test:k09-opencl-persistent-dispatch` and
`npm run test:k08-gpu-gqa-rope-native-backward-adamw`. The candidate grants
only `OPENCL_AMD_PERSISTENT_PROVIDER_TRANSPORT_CANDIDATE`; batched kernels,
device-buffer residency, throughput, generic portability, GPU training
promotion, RCL-10M and K400 remain closed. Open gaps:
`RCL_GAP_GPU_PROVIDER_DISPATCH_OVERHEAD` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K10 AMD OpenCL batched dispatch candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_BATCHED_ADAMW_DISPATCH_CANDIDATE`.
K10 adds a bounded ordered batch transport to the K09 persistent session and
integrates it at the independent AdamW-update boundary. RCL remains the
canonical owner; the provider remains an auxiliary lowering/transport organ.
Real AMD `gfx1152` smoke passed for individual versus two-operation batched
BF16 matmul with exact child output bits and execution roots. The 65-operation
boundary failed closed with `RCL_OPENCL_BATCH`. The K08 GPU-native two-block
GQA+RoPE backward/AdamW differential passed `3/3`, preserving exact CPU loss,
parameters, optimizer state and checkpoint root. One-step telemetry records
`338` logical provider requests, `325` transport dispatches and one
`adamw-update-v0.1` batch; no throughput conclusion is made. K08 CPU/Tensor,
GPU and K09 regressions remain green.

| Evidence | Result |
|---|---:|
| K10 genome/contract compilation | PASS_LOCAL |
| Real AMD batch smoke and exact child parity | PASS_LOCAL |
| 65-operation bound and fail-closed error | PASS_LOCAL |
| K08 GPU-native integration | `3/3 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| K08 Tensor suite | `16 PASS, 1 declared skip, 0 FAIL` |
| Affected K08 GPU suites | five suites, `3/3 PASS` each |
| K09 persistent regression | `1/1 PASS` |
| Hosted exact-head replay | PASS, head `dbd4979`, K10 `33137325268`, Universal `33137325306` after K01 rerun, Authority `33137325285`, Canonical `33137325278` |
| Post-merge main replay | PASS, merge `686659c`, K10 `33138220712`, K09 `33138220700`, Universal `33138220701`, Authority `33138220757`, Canonical `33138220708` |

Authority files:

- `docs/native-ai/gpu-opencl-batched-dispatch-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-batched-dispatch-genome.rcl`
- `examples/native-ai/gpu-opencl-batched-dispatch-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-opencl-batched-dispatch-v0.1/k10-opencl-batched-dispatch-local-evidence.json`

Reproduction: `npm run test:k10-opencl-batched-dispatch` and
`npm run test:k08-gpu-gqa-rope-native-backward-adamw`. Claims are limited to
`OPENCL_AMD_BATCHED_ADAMW_DISPATCH_CANDIDATE`; batched kernels,
device-buffer residency, parallel execution, throughput, generic portability,
GPU training promotion, RCL-10M and K400 remain closed. Open gaps:
`RCL_GAP_GPU_BATCH_PLANNER`, `RCL_GAP_GPU_DEVICE_BUFFER_RESIDENCY` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K11 AMD OpenCL gradient pair batch candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_GRADIENT_PAIR_BATCH_CANDIDATE`.
K11 reuses the K10 ordered batch transport for exactly one GPU matmul node's
`left-gradient` then `right-gradient` children. RCL owns reverse traversal and
all Tensor/BF16/autodiff/AdamW semantics; no cross-node batching, device-buffer
residency or throughput claim is made. Real AMD `gfx1152` pair smoke matched
individual child output bits and execution roots. K08 GPU-native backward/AdamW
passed `3/3` with exact CPU checkpoint parity; telemetry records `338` logical
requests, `217` transport dispatches, `108` gradient-pair batches and one
AdamW batch. Hosted and post-merge verification are pending.

| Evidence | Result |
|---|---:|
| K11 genome/contract compilation | PASS_LOCAL |
| Real AMD individual versus pair gradient smoke | PASS_LOCAL |
| K08 GPU-native backward/AdamW integration | `3/3 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| K08 Tensor suite | `16 PASS, 1 declared skip, 0 FAIL` |
| K08 GPU and K10/K09 regressions | PASS_LOCAL |
| Hosted exact-head replay | PASS, head `5838471`, K11 `33140897123`, K10 `33140897173`, K09 `33140897078`, Universal `33140897113`, Authority `33140897104`, Canonical `33140897161` |
| Post-merge main replay | PASS, merge `e17cca7`, K11 `33142026819`, K10 `33142026818`, K09 `33142026797`, Universal `33142026794`, Authority `33142026811`, Canonical `33142026816` |

Authority files:

- `docs/native-ai/gpu-opencl-gradient-pair-batch-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-gradient-pair-batch-genome.rcl`
- `examples/native-ai/gpu-opencl-gradient-pair-batch-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-opencl-gradient-pair-batch-v0.1/k11-opencl-gradient-pair-batch-local-evidence.json`

Reproduction: `npm run test:k11-opencl-gradient-pair-batch` and
`npm run test:k08-gpu-gqa-rope-native-backward-adamw`. Claims are limited to
`OPENCL_AMD_GRADIENT_PAIR_BATCHED_DISPATCH_CANDIDATE`; cross-node batching,
batched kernels, device-buffer residency, parallel execution, throughput,
generic portability, GPU training promotion, RCL-10M and K400 remain closed.
Open gaps: `RCL_GAP_GPU_BATCH_PLANNER`,
`RCL_GAP_GPU_DEVICE_BUFFER_RESIDENCY` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K12 AMD OpenCL cross-node gradient batch candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_CROSS_NODE_GRADIENT_BATCH_CANDIDATE`.
K12 closes the bounded K11 cross-node planner gap for one opt-in ready-frontier
profile. RCL owns readiness, independence, canonical reverse order and gradient
accumulation; the OpenCL provider owns only ordered auxiliary transport. The
planner admits at most `32` contiguous ready independent GPU matmul nodes and
keeps each node's left/right child order. No model-special or GPU-special Core
opcode was introduced.

| Evidence | Result |
|---|---:|
| K12 genome/contract compilation | PASS_LOCAL |
| Real AMD two-node/four-child protocol smoke | PASS_LOCAL |
| Same-node versus cross-node execution roots/state/checkpoint | EXACT |
| CPU checkpoint differential | EXACT |
| Logical provider accounting | `338` requests, `108` gradient batches unchanged |
| Transport accounting | dispatches `217 -> 199`; batches `109 -> 91`; `18` cross-node batches / `36` nodes |
| Unsupported/unavailable modes | FAIL_CLOSED |
| K12 integration/protocol suite | `4/4 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| K08 Tensor suite | `16 PASS, 1 declared skip, 0 FAIL` |
| K11/K10/K09 regressions | `1/1 PASS` each |
| License audit | PASS, no new dependencies or donor code |
| Hosted exact-head replay | PASS, head `f725709`, K12 `33186294873` Ubuntu+Windows, K11 `33186294809`, K10 `33186294821`, K09 `33186294829`, Universal `33186294878`, Canonical `33186294825`, Authority `33186294855` |
| Post-merge main replay | PASS, merge `b6886c8`, K12 `33189905627` Ubuntu+Windows, K11 `33189905678`, K10 `33189905671`, K09 `33189905592`, Universal `33189905603`, Canonical `33189905537`, Authority `33189905662` |

Authority files:

- `docs/native-ai/gpu-opencl-cross-node-gradient-batch-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-cross-node-gradient-batch-genome.rcl`
- `examples/native-ai/gpu-opencl-cross-node-gradient-batch-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-opencl-cross-node-gradient-batch-v0.1/k12-opencl-cross-node-gradient-batch-local-evidence.json`

Reproduction: `npm run test:k12-opencl-cross-node-gradient-batch`. Claims are
limited to `OPENCL_AMD_CROSS_NODE_GRADIENT_BATCHED_DISPATCH_CANDIDATE`.
Batched kernels, device-buffer residency, parallel execution, throughput,
generic portability, GPU training promotion, RCL-10M, RCL-1B and K400 remain
closed. Open gaps: `RCL_GAP_GPU_DEVICE_BUFFER_RESIDENCY`,
`RCL_GAP_GPU_TRAINING_THROUGHPUT` and
`RCL_GAP_RCL10M_TOKENIZER_DATASET`.

## K13 AMD OpenCL session buffer arena candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_SESSION_BUFFER_ALLOCATION_REUSE_CANDIDATE`.
RCL owns an explicit exact-size/flags buffer reuse profile, resource bounds and
the no-residency boundary. The AMD OpenCL provider owns only `cl_mem` lifecycle
and kernel execution. Every operation still uploads inputs and reads outputs.

| Evidence | Result |
|---|---:|
| K13 genome/contract compilation | PASS_LOCAL |
| Real AMD two-operation protocol smoke | allocations `6 -> 3`, reuses `0 -> 3`, exact outputs/roots |
| GQA+RoPE buffer acquisitions | `1070 == 41 allocations + 1029 reuses` |
| Newly allocated byte accounting | `31,828 -> 1,804` cumulative bytes |
| Arena peak / bound | `41 / 64` buffers; `1,804 / 2,097,152` bytes |
| Explicit close receipt | `41` released; pool `0` buffers / `0` bytes |
| Arena versus per-kernel execution roots/state/checkpoint | EXACT |
| CPU checkpoint differential | EXACT |
| Unsupported/unavailable/receipt drift | FAIL_CLOSED |
| K13 integration/protocol suite | `6/6 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| K08 Tensor suite | `16 PASS, 1 declared skip, 0 FAIL` |
| K12/K11/K10/K09 regressions | `4/4`, `1/1`, `1/1`, `1/1` PASS |
| Strict Clippy | BLOCKED by 8 pre-existing warnings; no PASS claim |
| License audit | PASS, no new dependencies or external donor code |
| Hosted exact-head replay | PASS, PR #115 head `0840e9d`, K13 `33859229990` Ubuntu+Windows, K12 `33859230064`, K11 `33859230080`, K10 `33859229958`, K09 `33859230119`, Universal `33859229985`, Canonical `33859230051`, Authority `33859230044` |
| Post-merge main replay | PASS, merge `251b20a`, K13 `33860059592` Ubuntu+Windows, K12 `33860059548`, K11 `33860059794`, K10 `33860059684`, K09 `33860059750`, Universal `33860059606` attempt 3, Canonical `33860059582`, Authority `33860059629`; Universal attempts 1/2 hit the existing Windows K01 fixed-point timeout and were rerun successfully |

Authority files:

- `docs/native-ai/gpu-opencl-buffer-arena-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-buffer-arena-genome.rcl`
- `examples/native-ai/gpu-opencl-buffer-arena-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-opencl-buffer-arena-v0.1/k13-opencl-buffer-arena-local-evidence.json`

Reproduction: `npm run test:k13-opencl-buffer-arena`. Claims are limited to
`OPENCL_AMD_SESSION_BUFFER_ALLOCATION_REUSE_CANDIDATE`. Tensor value residency,
transfer elision, wall-time/throughput improvement, generic portability, GPU
training promotion, RCL-10M, RCL-1B and K400 remain closed.

## K14 AMD OpenCL Tensor value residency candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_VALUE_RESIDENCY_CANDIDATE`.
K14 adds an opt-in RCL-owned Rust probe and `tensor-residency-v0.1` provider
session. `storageIdentity` and a deterministic value root over dtype, shape and
canonical BF16 bits are the admission key. The provider can retain only
read-only input `cl_mem`; an exact identity/value-root hit elides the repeated
host-to-device upload, while changed roots fail closed. Matmul outputs remain
explicitly read back on every operation.

| Evidence | Result |
|---|---:|
| K14 genome/contract compilation | PASS_LOCAL |
| Real AMD residency probe | two uploads, two exact hits, two matmuls, exact `4130` outputs |
| Transfer accounting | `2` host-to-device uploads; `2` device-to-host readbacks |
| Lifetime accounting | `4` allocations / `4` releases; `0` resident buffers after close |
| Bounds | `64` tensors / `2,097,152` bytes declared and validated |
| Stale identity negative | `RCL_OPENCL_TENSOR_VALUE_STALE` |
| K14 protocol suite | `3/3 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |
| K08 Tensor suite | `16 PASS, 1 declared skip, 0 FAIL` |
| Strict Clippy | BLOCKED by 8 pre-existing warnings; no K14-specific warning observed |
| License audit | PASS, no new dependencies or donor code |
| Hosted exact-head replay | PASS, PR #117; K14 run `33866569331` (Ubuntu/Windows), regressions and repository checks green |
| Post-merge main replay | PASS, main `418f50f43d446b696a74f2086cf8fafb28c4fb5a`; K14 run `33867880127` (Ubuntu/Windows), regressions and repository checks green |

Authority files:

- `docs/native-ai/gpu-opencl-tensor-residency-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-tensor-residency-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-tensor-residency-genome.rcl`
- `native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`
- `examples/native-ai/evidence/gpu-opencl-tensor-residency-v0.1/k14-opencl-tensor-residency-local-evidence.json`

Reproduction: `npm run test:k14-opencl-tensor-residency`. Claims are limited
to `OPENCL_AMD_READ_ONLY_TENSOR_INPUT_RESIDENCY_CANDIDATE` and
`OPENCL_AMD_INPUT_TRANSFER_ELISION_CANDIDATE`. Output/full-graph or
training-step residency, wall-time/throughput improvement, VRAM reduction,
generic portability, GPU training promotion, RCL-10M, RCL-1B and K400 remain
closed. The K400 matrix remains `23 PASS / 0 BLOCKED / 377 UNTESTED`.

## K15 AMD OpenCL ordered Tensor graph residency candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_GRAPH_RESIDENCY_CANDIDATE`.
RCL owns the ordered graph, Tensor `storageIdentity` and deterministic
`valueRoot`, shape/dtype checks, resource order and readback policy. The AMD
OpenCL provider owns only ephemeral `cl_mem` allocation, kernel arguments and
ordered dispatch. The candidate reuses the K14 Tensor residency session; it
does not create a second Tensor identity or a model-special operation.

| Evidence | Result |
|---|---:|
| K15 genome/contract compilation | PASS_LOCAL |
| Real AMD ordered graph | two BF16 matmul nodes on `gfx1152`, exact output `4040` |
| Intermediate residency | first `[1,2]` resource remains device-resident until node two |
| Readback policy | `0` intermediate; `1` final explicit device-to-host readback |
| Resource lifetime | `2` ephemeral allocations / `2` resource releases; close complete |
| Session allocation telemetry | `5` buffers / `22` bytes / `5` releases |
| Tensor transfer telemetry | `3` host-to-device uploads / `1` device-to-host readback |
| Graph order negatives | intermediate readback and use-before-produce fail closed |
| K15 protocol suite | `3/3 PASS` |
| Rust release bridge build | PASS with locked dependencies |
| K14/K13/K12/K11/K10/K09 regressions | green locally, hosted exact-head and post-merge main |
| License audit | PASS, no new dependencies or donor code |
| Hosted exact-head replay | K15/K09-K14 and Authority PASS on PR #119 at `f3884aa`; Canonical and Universal independently FAIL on pre-existing K337/K338/K340 compiler RBC drift |
| Post-merge main replay | K15/K09-K14 and Authority PASS on `d2efae8`; Canonical and Universal independently FAIL on the same pre-existing K337/K338/K340 compiler RBC drift |

Authority files:

- `docs/native-ai/gpu-opencl-tensor-graph-residency-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-tensor-graph-residency-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-tensor-graph-residency-genome.rcl`
- `native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `examples/native-ai/evidence/gpu-opencl-tensor-graph-residency-v0.1/k15-opencl-tensor-graph-residency-local-evidence.json`

Reproduction: `npm run test:k15-opencl-tensor-graph-residency`.
Claims are limited to `OPENCL_AMD_ORDERED_TENSOR_GRAPH_RESIDENCY_CANDIDATE`
and `OPENCL_AMD_INTERMEDIATE_DEVICE_RESOURCE_CANDIDATE`. Canonical Tensor
output/full-graph/training-step residency, GPU training, parallel execution,
wall-time/throughput, VRAM reduction, generic portability, RCL-10M, RCL-1B and
K400 promotion remain closed. Hosted and post-merge K15-scope evidence is bound
above; repository-wide Canonical/Universal failures are preserved as
pre-existing K337/K338/K340 compiler RBC drift and do not alter the K15 ruling.

## K16 AMD OpenCL BF16 additive masked softmax candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_MASKED_SOFTMAX_CANDIDATE`.
RCL owns generic additive masked-softmax semantics, stable row normalization,
BF16 storage, FP32 compute and BF16 RNE output. The AMD OpenCL provider owns
only the bounded row-kernel lowerer and buffer dispatch; fallback is forbidden.

| Evidence | Result |
|---|---:|
| K16 genome/contract compilation | PASS_LOCAL |
| Real AMD OpenCL execution | `gfx1152`, rank-2 `2 x 3` fixture |
| Exact output | BF16 bits `3f80 31c1 3283 323f 3f3b 3e8a` |
| CPU differential | exact independent BF16/FP32 stable-softmax oracle |
| Deterministic replay | execution root `959537aaf0115e819ad927a3d1fc3ec6eff6a9dbba086c964460f5036f4c9e03` repeated exactly |
| Negative controls | wrong backend, mask mode, non-finite input and malformed shape fail closed |
| K16 protocol suite | `3/3 PASS` |
| K08 AMD and K09–K15 regressions | green locally, exact-head PR #125 and post-merge `c13a573` scope; Canonical/Universal/Authority also SUCCESS |
| License audit | PASS, no new dependencies or donor code |

Authority files:

- `docs/native-ai/gpu-opencl-masked-softmax-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-masked-softmax-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-masked-softmax-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `tests/k16-opencl-masked-softmax.test.mjs`
- `examples/native-ai/evidence/gpu-opencl-masked-softmax-v0.1/k16-opencl-masked-softmax-local-evidence.json`

Reproduction: `npm run test:k16-opencl-masked-softmax`.
Claims are limited to `OPENCL_AMD_BF16_MASKED_SOFTMAX_LOWERING_CANDIDATE` and
`OPENCL_AMD_GPU_NATIVE_ADDITIVE_MASK_CANDIDATE`. Full graph execution or
residency, GPU-native Autodiff/AdamW, GPU training, throughput, VRAM,
portability, RCL-10M, RCL-1B and K400 promotion remain closed. The K400 matrix
remains `23 PASS / 0 BLOCKED / 377 UNTESTED`.

## K17 AMD OpenCL mixed Tensor graph candidate

Status: `PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_TENSOR_MIXED_GRAPH_CANDIDATE`.
K17 keeps RCL as the canonical owner of generic Tensor graph and masking
semantics while extending the bounded OpenCL lowerer to an ordered
`matmul -> additive masked-softmax` chain. The intermediate is an ephemeral
device resource; intermediate readback is forbidden and one final readback is
explicit.

| Evidence | Result |
|---|---:|
| K17 genome/contract compilation | PASS_LOCAL |
| Real AMD OpenCL execution | `gfx1152`, BF16 `[1,2]` mixed graph |
| Exact output | BF16 bits `3f00 3f00` |
| CPU differential | exact independent BF16/FP32 reference |
| Deterministic replay | execution root `fc1ac696f0e92dd4798d4344bd886dc040eb6d21db177bfb0527d2641c9d1a9f` repeated exactly |
| Residency telemetry | 0 intermediate / 1 final readback; 3 H2D / 1 D2H; 5 allocations / 5 releases; resident bytes 0 at close |
| Negative controls | unknown operation, non-additive mask, intermediate readback and shape drift fail closed |
| K17 protocol suite | `3/3 PASS` |
| K08 AMD and K09–K16 regressions | green locally, exact-head PR #130 and post-merge `edc166a` scope; Canonical/Universal/Authority also SUCCESS |
| License audit | PASS, no new dependencies or donor code |

Authority files:

- `docs/native-ai/gpu-opencl-tensor-mixed-graph-evidence-v0.1.md`
- `examples/native-ai/gpu-opencl-tensor-mixed-graph-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-tensor-mixed-graph-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `native/tensor-engine/src/bin/rcl-opencl-tensor-residency.rs`
- `tests/k17-opencl-tensor-mixed-graph.test.mjs`
- `examples/native-ai/evidence/gpu-opencl-tensor-mixed-graph-v0.1/k17-opencl-tensor-mixed-graph-local-evidence.json`

Reproduction: `npm run test:k17-opencl-tensor-mixed-graph`.
Claims are limited to `OPENCL_AMD_ORDERED_TENSOR_MIXED_GRAPH_CANDIDATE` and
`OPENCL_AMD_GRAPH_MASKED_SOFTMAX_CANDIDATE`. Full graph/output or training-step
residency, GPU-native Autodiff/AdamW, GPU training, parallel execution,
throughput, VRAM, portability, RCL-10M, RCL-1B and K400 promotion remain
closed. The K400 matrix remains `23 PASS / 0 BLOCKED / 377 UNTESTED`.

## AI001 self-hosted Tensor shape-semantics candidate

Status: `PASS_LOCAL_SELFHOST_TYPED_TENSOR_SHAPE_SEMANTICS_CANDIDATE`.
The RCL-owned genome validates typed Tensor descriptor identity, positive
dimensions, exact element counts, row-major stride identity, dtype/layout/device
agreement, ordered references, right-aligned broadcast, matmul, transpose,
reshape and axis-reduction output shapes. The native self-hosted compiler and
VM verify the semantic state root. Focused local evidence is `3/3 PASS`, with
shape, stride, metadata, missing-reference and manifest-root mutations rejected
before backend execution.

Authority files:

- `docs/native-ai/AI001_SELFHOST_TENSOR_SHAPE_SEMANTICS_CANDIDATE_v0.1.md`
- `examples/native-ai/tensor-shape-semantics-genome.rcl`
- `examples/native-ai/tensor-shape-semantics-contract.v0.1.json`
- `src/selfhost-tensor-shape-semantics.mjs`
- `tests/selfhost-tensor-shape-semantics.test.mjs`
- `examples/native-ai/evidence/tensor-shape-semantics-v0.1/ai001-tensor-shape-semantics-local-evidence.json`

Reproduction: `npm run test:selfhost-tensor-shape-semantics` and
`npm run evidence:selfhost-tensor-shape-semantics`. This grants only bounded
RCL semantic admission. Numerical storage kernels, alias safety, device
placement, GPU execution, canonical promotion, scale and K400 remain closed.
