# GPU BF16 Ordered Multi-Block Evidence v0.1

## Ruling

`PASS_LOCAL_GPU_HYBRID_ORDERED_MULTI_MATMUL_CANDIDATE_GITHUB_REPLAY_BOUND`

This candidate binds a generic RCL BF16 Tensor SSA graph containing two ordered
matmul blocks to the existing AMD OpenCL matmul lowerer. RCL remains the owner
of graph order, BF16 RNE, FP32 accumulation, reverse Autodiff, FP32 masters,
AdamW state and exact checkpoint identity.

The placement policy is explicit:

- both matmul nodes must use `placement: "gpu"` and execute through the AMD OpenCL provider;
- every non-matmul node must use `placement: "cpu-reference"` and execute through the RCL Rust BF16 reference;
- missing placement, CPU placement for matmul, unavailable provider and backend/graph mismatch fail closed.

This is a bounded ordered multi-matmul hybrid candidate. It is not full GPU
training: backward math, FP32 masters, AdamW state and optimizer updates remain
in the RCL Rust organ, and no GPU backward or optimizer kernel is claimed.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract compile | PASS |
| Ordered generic graph contains two GPU matmul nodes | PASS |
| AMD OpenCL matmul nodes execute on current host | PASS, AMD gfx1152 |
| Explicit host-reference placement | PASS, 8 nodes per forward |
| CPU reference differential for loss, parameters, optimizer state and checkpoint root | exact PASS |
| Loss decrease | PASS |
| Direct replay and checkpoint resume | exact PASS |
| Provider/placement/backend negatives | fail-closed PASS |
| Local Node evidence suite | 3/3 PASS |

The auxiliary provider is launched once per explicitly GPU-placed matmul node
per forward. The Rust organ validates each admitted BF16 result and imports its
exact output bits into the RCL tape; reverse Autodiff and AdamW remain generic
RCL execution. `gpuClaim` remains false.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL contract expresses ordered generic graph and explicit placement |
| COMPILE | PASS_LOCAL | RCL genome, Rust organ and provider-backed test compile |
| LOWER | PASS_LOCAL_CANDIDATE | ordered matmuls lower to AMD OpenCL; host nodes remain explicit |
| EXECUTE | PASS_LOCAL | current host executed both GPU-placed matmul nodes |
| CORRECT | PASS_LOCAL | CPU BF16 reference matches training and checkpoint outputs exactly |
| ROBUST | PASS_LOCAL | placement, provider and backend negatives fail closed |
| PERFORMANCE | NOT_EVALUATED | process-per-node provider dispatch is not a throughput result |
| AI_GENERATE | NOT_APPLICABLE | no learned model generation claim |
| EVIDENCE | CANDIDATE | local receipt and Ubuntu/Windows hosted replay are bound |

## Hosted boundary

PR #90 dedicated workflow run `33000754805` passed on Ubuntu job
`98281650727` and Windows job `98281650452`. Hosted runners prove replay and
explicit unavailable-device behavior; they do not inherit the local AMD device
receipt and cannot promote this candidate to GPU training.

## Open gaps

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` | PARTIALLY REDUCED | add GPU coverage for GQA/RoPE and then implement or separately admit GPU-native backward/optimizer kernels |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN | user-owned multilingual/code corpus, provenance review, tokenizer freeze and deterministic real-data shards |

Claims not granted: `GPU_TRAINING`, `OPENCL_BF16_FULL_GRAPH`, GPU backward or
optimizer kernels, generic GPU portability, GQA/RoPE GPU, RCL-10M, RCL-1B,
distributed training and K400 promotion.

Authority files:

- `examples/native-ai/gpu-bf16-multiblock-genome.rcl`
- `examples/native-ai/gpu-bf16-multiblock-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-bf16-multiblock-v0.1/k08-gpu-bf16-multiblock-local-evidence.json`
- `native/tensor-engine/src/autodiff.rs`
- `native/tensor-engine/amd_opencl_bf16_provider.py`

Reproduction: `npm run test:k08-gpu-bf16-multiblock`.
