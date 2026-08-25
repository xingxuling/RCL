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

The ledger proves the bounded General MLP AI-N2 stack and the independently replayed K233 repair evidence. It does not prove Tensor Genome, general Autodiff, AdamW, Transformer, language-model training, accelerator lowering, distributed training, competitive performance or K400 completion.

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

Status: `ENGINE_E1_TENSOR_BORROWED_INPUT_CANDIDATE_LOCAL_WINDOWS`. It changes Rust execution ownership only; Tensor Plan and operation semantics remain RCL-owned.

| Evidence | Result |
|---|---:|
| Exact baseline | clean detached worktree at `9805956dfd24834d650534a8186ab53eb084f8b5` |
| Production workload | unchanged `6,112,741-byte / 29,980-node` generic SSA Plan |
| Borrowed input bindings | `54,964 / 54,964` |
| Historical storage clone traffic avoided | `314,521 elements / 2,516,168 bytes` |
| Candidate Plan input clones | `0 elements / 0 bytes` |
| Controlled Plan medians | `250.081 ms` baseline / `207.332 ms` borrowed |
| Controlled workload speedup | `1.206x` (`17.094%` runtime reduction) |
| General MLP peak Working Set medians | `38,400,000 / 37,609,472 bytes`; `2.059%` lower |
| Clone-stress peak Working Set medians | `20,230,144 / 18,608,128 bytes`; `8.018%` lower |
| Semantic parity | one output root per workload across all baseline/candidate samples |
| Evidence report root | `aabcb994619b190431d4cf2f012e1c7f89cb29a4156ec6222bf67ea6674c9276` |
| GitHub replay | pending |

The tracked sampler reads the exact child process `PeakWorkingSet64` while it is alive. The result includes all child-process memory and is deliberately separate from K08-E logical Plan-store telemetry. The 200,000-element-per-input stress isolates the historical `3,200,000`-byte storage clone boundary; neither result grants portable/general RSS reduction, VRAM reduction, buffer reuse, compact lowering, Autodiff or K400 promotion.

Reproduction:

```text
npm run test:k08-tensor
npm run evidence:k08-tensor-mlp
npm run evidence:k08-tensor-borrowed-input -- --baseline-binary <exact-main-release-binary> --baseline-repository <clean-exact-main-worktree>
```
