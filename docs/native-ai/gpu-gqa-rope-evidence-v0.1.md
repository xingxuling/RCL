# GPU GQA + RoPE Evidence v0.1

## Ruling

`PASS_LOCAL_GPU_HYBRID_GQA_ROPE_FORWARD_CANDIDATE_HOSTED_REPLAY_PENDING`

This candidate binds a minimal generic RCL GQA + RoPE Tensor SSA graph to the
existing AMD OpenCL matmul lowerer. Two query heads use independent Q paths but
share the same K and V paths; the RCL `rcl-rope-frame` organ supplies the
position frame. RCL owns the graph topology, shared-KV binding, RoPE
composition, BF16 RNE, FP32 accumulation, reverse Autodiff, FP32 masters,
AdamW state and exact checkpoint identity.

The placement policy is explicit:

- every matmul node, including projections, RoPE rotations, attention scores and context products, uses `placement: "gpu"`;
- masking, softmax, transpose, elementwise composition and loss use `placement: "cpu-reference"`;
- missing placement, CPU placement for matmul, unavailable provider and backend/graph mismatch fail closed.

This is a bounded GQA + RoPE forward-matmul hybrid candidate. It is not full
GPU training, full-graph GPU execution, GPU-native attention, or GPU backward /
optimizer execution.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract compile | PASS |
| Native RCL RoPE frame receipt | PASS |
| Two query heads share one K/V path | PASS |
| AMD OpenCL matmul nodes execute on current host | PASS, AMD gfx1152, 11 nodes per forward |
| Explicit host-reference placement | PASS, 21 nodes per forward |
| CPU reference differential for loss, parameters, optimizer state and checkpoint root | exact PASS |
| Loss decrease and all four trainable projections update | PASS |
| Direct replay and checkpoint resume | exact PASS |
| Provider/placement/backend negatives | fail-closed PASS |
| Local Node evidence suite | 3/3 PASS |

The auxiliary provider owns only the OpenCL lowering. The Rust organ validates
each admitted BF16 result and imports its exact output bits into the RCL tape;
RoPE composition, softmax and masking remain generic RCL reference operations.
`gpuClaim` remains false.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL contract expresses generic GQA shared-KV and RoPE topology |
| COMPILE | PASS_LOCAL | RCL genome, native RoPE frame and provider-backed graph compile |
| LOWER | PASS_LOCAL_CANDIDATE | graph matmuls lower to AMD OpenCL; non-matmul nodes remain explicit host reference |
| EXECUTE | PASS_LOCAL | current host executed projection, RoPE, score and context matmuls |
| CORRECT | PASS_LOCAL | CPU BF16 reference matches training and checkpoint outputs exactly |
| ROBUST | PASS_LOCAL | placement, provider and backend negatives fail closed |
| PERFORMANCE | NOT_EVALUATED | process-per-node provider dispatch is not a throughput result |
| AI_GENERATE | NOT_APPLICABLE | no learned model generation claim |
| EVIDENCE | CANDIDATE | local receipt is bound; hosted replay is pending |

## Hosted boundary

PR #91 runs the dedicated workflow on Ubuntu and Windows. Hosted runners may
prove compilation, replay and explicit unavailable-device behavior; they do not
inherit the local AMD device receipt and cannot promote this candidate to GPU
training.

## Open gaps

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` | PARTIALLY REDUCED | implement or separately admit GPU-native backward and optimizer kernels, then measure on a real GPU |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN / BLOCKED_USER_CORPUS | user-owned multilingual/code corpus, provenance review, tokenizer freeze and deterministic real-data shards |

Claims not granted: `GPU_TRAINING`, `OPENCL_BF16_FULL_GRAPH`, GPU-native
backward or optimizer kernels, `BF16_GQA_ROPE_GPU` full training, generic GPU
portability, RCL-10M, RCL-1B, distributed training and K400 promotion.

Authority files:

- `examples/native-ai/gpu-gqa-rope-genome.rcl`
- `examples/native-ai/gpu-gqa-rope-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-gqa-rope-v0.1/k08-gpu-gqa-rope-local-evidence.json`
- `native/tensor-engine/src/autodiff.rs`
- `native/tensor-engine/amd_opencl_bf16_provider.py`

Reproduction: `npm run test:k08-gpu-gqa-rope`.
