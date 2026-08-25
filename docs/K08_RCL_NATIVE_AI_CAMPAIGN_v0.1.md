# K08 RCL-Native AI Campaign v0.1

**Native-learning milestone:** `PASS_NATIVE_AI_N2_GITHUB_AI_GENERATE_BOUND`
**K400 cell:** `K233 ai-runtime::machine-learning = PASS`
**Maturity:** `AI-N2` for the bounded two-Dense-layer General MLP profile
**Evidence report root:** `1335a812fd5162511f32fae054d945c5deaf2bd63026aec8495a6a21611de9b2`
**Date:** 2026-08-25

## 1. Audit boundary

The existing RCL Neuro Forge trains its MLP in `src/forge/neuro-forge.mjs`. RCL authorizes the provider result and governs deployment, but it does not execute that training math. Neuro Forge is therefore frozen as `OPAQUE_DELEGATION_PROVIDER_ORACLE_ONLY`; it is not Native AI evidence.

K08-A uses this pure execution path:

```text
examples/native-ai/pure-rcl-xor.rcl
  -> native/rclc.exe executing selfhost/compiler.rbc
  -> pure-rcl-xor.rbc
  -> native/rclvm.exe
  -> forward / loss / backprop / Batch SGD / training / inference state
```

No Python, JavaScript trainer, ML framework, external autodiff, optimizer, model API or provider opcode participates in the parameters used by this path. The JavaScript implementation in the campaign runner is a post-run differential oracle only.

## 2. Frozen contract

The contract was written before the first native run:

- XOR dataset: `(0,0)->0`, `(0,1)->1`, `(1,0)->1`, `(1,1)->0`;
- architecture: fully connected `2-2-1` MLP;
- activation: `0.5 + 0.5*x/(1+abs(x))` with its analytic derivative;
- loss: mean half-squared error;
- optimizer: Batch SGD;
- seed: `42`, with nine materialized initialization values;
- epochs: `512`;
- learning rate: `4`;
- acceptance: accuracy `1`, loss `<= 0.03`, maximum prediction error `<= 0.25`;
- robustness: three byte-identical/native-state deterministic replays;
- differential tolerance: `1e-9`.

Softsign-01 was selected because it is nonlinear and differentiable while lowering entirely through existing RCL arithmetic, comparison, `choose`, recursive `reckon` and immutable `Sequence` semantics. K08-A adds no XOR or ML-special-case VM primitive.

## 3. Measured result

The local Windows receipt records:

| Evidence | Result |
|---|---:|
| RBC bytes | `11,640` |
| RBC instructions | `671` |
| Training execution instructions | `13,965,818` |
| Native replay semantic root | `9d395b42a0c93c5fbe29174aa8308e1cabd6d346c1543a5aa65d185741f321c2` |
| Deterministic replays | `3 / 3` |
| Accuracy | `1.0` |
| Loss | `0.0157034488743931` |
| Outputs | `[0.182866, 0.825711, 0.825717, 0.177304]` |
| Maximum parameter drift vs oracle | `4.44e-15` |
| Local median Native VM time | `188.705 ms` |

Native peak RSS is not emitted by the current VM and remains explicitly `UNMEASURED`. The JavaScript oracle remains faster and is recorded as an `UNABSORBED_ADVANTAGE`; K08-A proves `Can Compute`, not competitive performance.

The post-change full repository regression passed `844 tests / 843 pass / 0 fail / 1 skip` in `467,206.9122 ms`. The single skip is the existing external DLL import-library load check when Zig is unavailable; the checked Windows native distribution remains source/hash-manifest verified.

## 4. Gate verdict

| Gate | Status | Boundary |
|---|---|---|
| EXPRESS | PASS | dataset, parameters, activation, forward, loss, gradients, backward update, training, prediction and evaluation are `.rcl` reckons/facets |
| COMPILE | PASS | native `rclc` + `compiler.rbc` produced the target |
| LOWER | PASS | native target is byte-identical to the JS reference compiler output |
| EXECUTE | PASS | target executed in native `rclvm` |
| CORRECT | PASS | all four XOR outputs and frozen loss/error thresholds passed |
| ROBUST | PASS | three exact state replays and one semantic root |
| PERFORMANCE | PASS | measured locally; no parity claim |
| AI_GENERATE | UNVERIFIED | requires an independent receipt |
| EVIDENCE | PASS | roots cover contract, dataset, model, initialization, trace, final parameters, checkpoint, evaluation, source, compiler and RBC |

This permits the scoped statement:

```text
RCL Native Learning: PROVEN AT MINIMAL MLP SCALE
```

K08-A alone does not permit claims of a general MLP, Tensor Genome, native autodiff, general optimizer genome, Transformer, language model, GPU/NPU lowering, production model lifecycle or self-generating RCL. K08-B below separately establishes only its bounded AI-N2 General MLP profile.

## 5. Reproduction

```text
npm run build:native
npm run evidence:k08-native-ai
node --test tests/k08-pure-rcl-xor.test.mjs
npm run evidence:k400
```

Tracked receipt files live under `examples/native-ai/evidence/`. CI reruns the native campaign and uploads its generated evidence separately.

## 6. K08-B General MLP closure

K08-B now represents `Model`, `Layer`, `Parameter`, `Activation`, `Loss`, `Optimizer`, `Dataset` and `Checkpoint` as tagged RCL semantic values. One generic-width two-Dense-layer profile trains both the original XOR task and a structurally different three-input Majority task.

The accepted local native receipt records:

- XOR `2-2-1`: accuracy `1`, loss `0.0157034488743931`;
- Majority-3 `3-3-1`: accuracy `1`, loss `0.0111015956287353`;
- exact `32 == 16 + resume(16)` checkpoint parity;
- invalid adjacent layer width and invalid dataset width rejected;
- three identical native state roots;
- native/self-host and JS reference RBC byte parity;
- maximum parameter drift below `5.4e-15`;
- zero provider opcode and no task-specific VM opcode.

Three independent, read-only Codex sessions also repaired three distinct hidden K08-A semantic mutations. Their exact edits restore canonical source bytes and replay locally. GitHub Actions focused verification replayed all three successfully at source commit `4686184d6790ec08b213a0176279f646a0919beb`; run `32780097954`, job `97600047380`, and authority root `bb42598a6d656aab0d19da52491e820c24145aeb0233d3299abca6b171ea6b82` bind the external replay.

Evidence and decisions: `docs/native-ai/evidence-ledger.md`, `docs/native-ai/integration-court.md`, and `docs/native-ai/rcl-gap-register.md`.

## 7. K08-C Tensor / CPU Engine candidate

K08-B removed XOR-specific topology assumptions without adding an `xor_special` primitive. K08-C now begins the Tensor/engine path without granting K233 any new authority:

- `tensor::Tensor` is a typed RCL record containing shape, rank, dtype, layout, strides, Storage Identity, device intent and gradient identity; numeric data is not part of the Tensor record;
- a separate `tensor::CpuDenseStorage` object establishes the replaceable storage boundary;
- the scalar RCL reference covers elementwise add/sub/mul/div, rank-2 broadcast/MatMul/reshape/transpose/slice, sum/mean/max, bounded exp/log/sqrt approximations and row-wise softmax;
- `native/tensor-engine` is a Rust CPU execution organ reached through the existing general `RclVmProviderV1` ABI; no Tensor, MLP or Transformer-special VM opcode was added;
- the backend covers f64 row-major elementwise, general trailing-dimension broadcast, rank-2 blocked MatMul, reductions, unary math, Softmax, LayerNorm and RMSNorm with fail-closed shape/dtype/device/domain/resource controls.

The first accepted local Windows measurement used exact integer MatMul parity:

| Boundary | Reference median | Optimized median | Speedup |
|---|---:|---:|---:|
| RCL native scalar vs RCL native provider, 24x24x24, warm process per run | `180.608 ms` | `29.635 ms` | `6.094x` |
| Rust scalar reference vs blocked CPU kernel, 192x192x192, kernel only | `7.229 ms` | `2.362 ms` | `3.061x` |

Both comparisons have exact output parity for the recorded corpus. Timings are local candidate evidence, not portable thresholds. K08-C itself did not lower the General MLP and therefore did not relabel the inherited `118.300x` Native/JS gap.

## 8. K08-D General MLP Tensor lowering candidate

K08-D keeps `examples/native-ai/general-mlp.rcl` and its contract as the semantic source. A JS auxiliary compiler organ lowers that unchanged bounded training profile into a rooted generic Tensor SSA Plan. The lowerer computes no training parameters; every forward, backward and update value is executed by the Rust Tensor organ reached through native self-host compilation, RBC, the native VM and `RclVmProviderV1`.

The accepted local Windows receipt records:

- `29,980` SSA nodes, `40` initial tensors and `18` requested outputs;
- only `abs/add/div/matmul/mul/sub/sum/transpose`; no XOR, Majority, MLP, train or model-special operation;
- XOR and Majority-3 accuracy `1`, with maximum parameter drift below `4.5e-15` against both the JS oracle and scalar RCL path;
- three identical output roots and three identical native semantic state roots;
- exact `32 == save(16) + reload + 16` checkpoint parity, including exact f64 Storage bits across JSON serialization;
- a missing-input negative control plus fail-closed plan shape, identity, descriptor and resource validation in the backend suite;
- report root `f4982380f9d7d05bd85a838fa7b65f37bfee12c2a401abb95a31b0fff677f70d`.

The same-machine end-to-end measurement excludes compilation but includes native VM startup, root verification, plan hash/load, Provider dispatch, Tensor Plan execution and response serialization:

| Boundary | Scalar Native median | Tensor Plan median | Result |
|---|---:|---:|---:|
| General MLP campaign | `2537.360 ms` | `443.592 ms` | `5.720x` speedup |
| Tensor Plan vs JS oracle | - | `443.592 / 27.964 ms` | `15.863x` ratio |

This reduces the prior measured `118.300x` ratio by a factor of `7.458x`; it does not close the performance gap. Peak process RSS is still unmeasured. The 6.11 MB JSON plan and 29,980-node scalar dispatch identify compact planning and operand/buffer reuse as remaining performance gates; K08-E below separately addresses logical plan-value liveness.

K08-D is `ENGINE_E1_GENERAL_MLP_TENSOR_LOWERING_CANDIDATE_GITHUB_REPLAY_BOUND`. GitHub run `32810795935` replayed portable correctness on Ubuntu and the real Windows Provider, CPU performance and General MLP Tensor evidence paths for exact implementation commit `8b53c60321345fdcc9449c1a5b7b522a3e7939a9`. It grants no Autodiff, AdamW, Transformer, GPU, distributed Tensor or K400 promotion claim.

## 9. K08-E Tensor Plan liveness candidate

K08-E preserves the K08-D generic plan and Tensor operation semantics. It adds whole-plan SSA definition/use validation, last-use reclamation, requested-intermediate pinning, cumulative-allocation compatibility telemetry, and separate peak-live plan-store telemetry. The old cumulative resource ceiling remains fail-closed, and a peak-live ceiling is additive rather than a weaker replacement.

For the exact 6,112,741-byte / 29,980-node K08-D plan:

| Plan-store boundary | Pre-liveness retained | K08-E |
|---|---:|---:|
| Cumulative allocated | `1,657,080 bytes` | `1,657,080 bytes` |
| Logical peak live | `1,657,080 bytes` | `1,856 bytes` |
| Final requested outputs | included in all retained values | `440 bytes` |
| Reclaimed values / elements | `0 / 0` | `30,002 / 207,080` |

The logical peak reduction factor is `892.823x`. This excludes allocator overhead, transient operand clones, serialization buffers and process RSS. A controlled Windows A/B used the same plan, warm release binaries and alternating process-level execution for seven rounds:

| Exact backend | Median | Result |
|---|---:|---:|
| pre-liveness commit `ccfab802...` | `331.937 ms` | baseline |
| K08-E liveness candidate | `286.367 ms` | `1.159x`, `13.729%` lower runtime |

Every baseline and candidate output root was identical. The result is specific to this General MLP plan and does not establish general Tensor-workload speedup. Local evidence root: `0db5ef574caad46d22549c64e0f695d6e423bc9642965a85ca25b3d8cdf52629`.

K08-E is `ENGINE_E1_TENSOR_PLAN_LIVENESS_CANDIDATE_GITHUB_REPLAY_BOUND`. GitHub run `32815298348` passed focused Ubuntu job `97702229003` and real Windows job `97702228815` for exact implementation commit `8073482a57cb4ac096cd8545dcd15d01e87c228b`. The hosted replay binds portable liveness semantics, K400 non-promotion, the native Provider, Tensor performance path and General MLP Tensor execution; it does not replace the local controlled A/B timing receipt.

## 10. K08-F borrowed Tensor Plan inputs and process-memory evidence

K08-F preserves the RCL Tensor Plan, kernel operations, SSA identities, Storage identities and resource gates. The Rust execution organ now constructs borrowed `BoundTensor` views directly from the live-value map. It no longer clones per-node `TensorDescriptor` or `DenseStorage` inputs into an intermediate `ExecutionRequest`; the public Provider request path remains unchanged and validated through the same kernels.

For the unchanged 6,112,741-byte / 29,980-node K08-D Plan, deterministic telemetry records `54,964` borrowed input bindings and avoids the exact historical storage-clone path for `314,521` elements / `2,516,168` bytes of cumulative copy traffic. `clonedInputElements` and `clonedInputBytes` are both zero. This is cumulative avoided copying, not simultaneously resident memory.

A controlled Windows A/B used clean exact-main baseline `9805956dfd24834d650534a8186ab53eb084f8b5`, warm Release binaries and alternating child processes:

| Boundary | Baseline | K08-F | Result |
|---|---:|---:|---:|
| unchanged General MLP Plan median | `234.698 ms` | `192.423 ms` | `1.220x`; `18.013%` lower |
| General MLP child peak Working Set median | `38,445,056 bytes` | `38,445,056 bytes` | no reduction observed |
| 200,000-element-per-input clone stress peak | `20,234,240 bytes` | `18,636,800 bytes` | `1,597,440 bytes`; `7.895%` lower |

All baseline/candidate roots matched for both workloads. Peak Working Set is sampled from the exact Windows child process while alive, so it includes executable, allocator, JSON plan/input/output and Rust allocations. It is not portable RSS, VRAM, logical Tensor-store size or a general workload claim. Accepted local evidence root: `9bc62c3b126a9428f6213989d0cb184ff0787cbeec989c51d130cbedad8720fe`.

K08-F is currently `ENGINE_E1_TENSOR_BORROWED_INPUT_CANDIDATE_LOCAL_WINDOWS`; GitHub-hosted replay remains the next admission gate.

## 11. Next gate

The next highest-value sequence is:

1. replay K08-F portable semantics and Windows process-memory evidence on GitHub;
2. add liveness-safe output-buffer reuse and compact plan lowering, then remeasure the full Native/JS boundary;
3. close the typed-source self-host compiler gap before Tensor promotion;
4. resolve scientific-notation number canonicalization in semantic-state-root evidence;
5. begin a separate general Autodiff candidate only after the execution-plan bottleneck is evidenced.
