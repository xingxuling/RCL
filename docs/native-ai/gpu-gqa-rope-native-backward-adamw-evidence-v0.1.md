# GPU-Native Multi-Block GQA + RoPE Backward + AdamW Evidence v0.1

## Ruling

`PASS_LOCAL_GPU_NATIVE_GQA_ROPE_BACKWARD_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`

The merged RCL candidate extends the prior GPU-native reverse/optimizer
primitives into the complete bounded K08-R-style two-block GQA + RoPE Tensor
SSA graph. RCL remains canonical for the graph, shared-K/V topology, RoPE
composition, reverse rules, BF16 RNE, FP32 accumulation, FP32 master weights,
AdamW state, checkpoint identity and admission decisions.

The Python organ remains an auxiliary lowering provider only:

- every `matmul` node is explicitly placed on `gpu`;
- every non-matmul node is explicitly placed on `cpu-reference`;
- GPU forward matmul, both reverse matmul-gradient directions and AdamW
  elementwise updates use explicit AMD OpenCL provider primitives;
- missing placement, CPU placement for a required GPU matmul, missing provider,
  missing provider binding and backend mismatch reject the request;
- provider failure cannot fall back to CPU execution.

This is a bounded GPU-native GQA/RoPE reverse-and-optimizer candidate. It does
not establish full GPU training, full-graph GPU execution, generic accelerator
portability, throughput, RCL-10M, RCL-1B, distributed training or K400
promotion.

## Local execution

The current Windows host executed the real AMD OpenCL path on `gfx1152`:

| Evidence | Result |
|---|---:|
| RCL genome and contract compile | PASS |
| Two-block GQA with two query heads and shared K/V per block | PASS |
| Native RCL RoPE frame composition | PASS |
| Generic graph without model-special opcode | PASS |
| GPU forward matmul nodes per step | `36` |
| GPU reverse matmul-gradient calls per step | `72` |
| Explicit host CPU reference nodes per step | `>40` |
| Canonical parameter groups / elements | `14 / 208` |
| Real AMD OpenCL forward, reverse-left, reverse-right and AdamW | PASS |
| CPU loss/parameter/state/checkpoint differential | exact PASS |
| Direct replay and `1 + 1` checkpoint resume | exact PASS |
| Placement/provider/backend negative controls | fail-closed PASS |
| Candidate Node suite | `3/3 PASS` |
| Existing GPU hybrid and CPU multi-block regressions | `15/15 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |

The one-step differential run took `234474.7675 ms`; the two-step replay,
resume and negative-boundary run took `1095830.0468 ms`. These are process-per-
primitive correctness-run timings, not throughput evidence. A two-step replay
covered `416` optimizer elements and `28` optimizer execution roots.

The device receipt is:

```text
platform: AMD Accelerated Parallel Processing
vendor: Advanced Micro Devices, Inc.
device: gfx1152
OpenCL: 2.0 AMD-APP (3661.0)
driver: 3661.0 (PAL,LC)
extensions: cl_khr_fp16, cl_khr_fp64, cl_khr_subgroups,
             cl_amd_device_attribute_query
```

`gpuClaim=false` and `cpuFallback=false` remain explicit in the result. The
provider's GPU receipt is evidence of this host's execution only.

## Hosted and total verification

The dedicated workflow passed on both hosted targets at exact branch head
`beb57db4e0b5e330cdc736a030e92eebeac4cc0a`:

- run `33089637536`, Ubuntu job `98578654811` — PASS;
- run `33089637536`, Windows job `98578655228` — PASS.

The repository-wide canonical verification first exposed an environment-
sensitive existing Android package assertion: `tests/package-compiler.test.mjs`
reported expected `verified` and actual `rejected` at line 124. The same job
was rerun at the identical head and passed the complete `1045/1045` suite in
job `98582383466`. This transient failure is preserved in the evidence JSON;
it is not converted into a source PASS by omission.

The implementation was merged as PR #97 into main at
`d0af3cbaee6613665a3352b885f638e49540b666`.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL expresses the generic graph and lowering contract |
| COMPILE | PASS_LOCAL | genome, Rust organ, provider and workflow compile |
| LOWER | PASS_LOCAL_CANDIDATE | four bounded provider primitive classes lower to AMD OpenCL |
| EXECUTE | PASS_LOCAL | current AMD GPU executed forward, reverse and optimizer kernels |
| CORRECT | PASS_LOCAL | CPU reference and checkpoint outputs match exactly |
| ROBUST | PASS_LOCAL | placement/provider/backend negatives fail closed |
| PERFORMANCE | NOT_EVALUATED | process-per-primitive dispatch is not throughput evidence |
| AI_GENERATE | NOT_APPLICABLE | no learned generation claim |
| EVIDENCE | CANDIDATE | local receipt and hosted replay are bound |

No K400 cell is promoted. Hosted runners do not inherit the local AMD device
receipt, and this candidate does not transfer semantic or mutation authority to
the Python provider.

## Open gaps

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` | PARTIALLY REDUCED | batched/persistent GPU dispatch and larger real-GPU training evidence |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN / BLOCKED_USER_CORPUS | user-owned multilingual/code bytes, review, tokenizer freeze and deterministic shards |

Claims granted only:

- `OPENCL_AMD_BF16_GQA_ROPE_FORWARD_MATMUL_LOWERING`
- `OPENCL_AMD_BF16_MATMUL_GRADIENT_LOWERING`
- `OPENCL_AMD_FP32_ADAMW_LOWERING`
- `OPENCL_GPU_NATIVE_GQA_ROPE_BACKWARD_ADAMW_CANDIDATE`

Claims not granted: `GPU_TRAINING`, `OPENCL_BF16_FULL_GRAPH`,
`OPENCL_BF16_FULL_GRAPH_BACKWARD`, generic GPU backend portability,
throughput, RCL-10M, RCL-1B, distributed training and K400 promotion.

Authority files:

- `examples/native-ai/gpu-gqa-rope-native-backward-adamw-genome.rcl`
- `examples/native-ai/gpu-gqa-rope-native-backward-adamw-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-gqa-rope-native-backward-adamw-v0.1/k08-gpu-gqa-rope-native-backward-adamw-local-evidence.json`
- `native/tensor-engine/src/autodiff.rs`
- `native/tensor-engine/src/bin/rcl-bf16-autodiff-adamw.rs`
- `native/tensor-engine/amd_opencl_bf16_provider.py`

Reproduction: `npm run test:k08-gpu-gqa-rope-native-backward-adamw`.
