# GPU BF16 Autodiff AdamW Evidence v0.1

## Ruling

PASS_LOCAL_GPU_HYBRID_CANDIDATE_HOSTED_REPLAY_PENDING

This candidate binds one generic RCL BF16 Tensor graph to the existing AMD OpenCL BF16 matmul lowerer inside the real BF16 Reverse Autodiff + AdamW loop. RCL remains the owner of graph structure, BF16 RNE, FP32 accumulation, reverse rules, gradients, FP32 masters, AdamW state and exact checkpoint identity.

The placement policy is explicit:

- every matmul node must be placement: "gpu" and executes through the AMD OpenCL provider;
- every non-matmul node must be placement: "cpu-reference" and executes through the canonical RCL Rust BF16 reference;
- missing placement, CPU placement for matmul, unavailable provider and backend/graph mismatch fail closed.

This is a bounded hybrid execution candidate. It is not a claim that backward kernels or AdamW kernels execute on the GPU, and it is not full GPU training.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract compile | PASS |
| Generic BF16 Autodiff + AdamW loop reaches the accelerator placement | PASS |
| AMD OpenCL matmul executes on current host | PASS, AMD gfx1152 |
| Explicit host reference placement | PASS |
| CPU reference differential for loss, parameters, optimizer state and checkpoint root | exact PASS |
| Loss decrease | PASS |
| Provider/placement/backend negatives | fail-closed PASS |
| Silent CPU fallback | forbidden and not observed |
| Local Node evidence suite | 3/3 PASS |

The existing AMD provider remains an auxiliary Python ctypes lowerer. The Rust organ starts that provider for each explicitly GPU-placed matmul, validates its admitted result receipt and imports only exact BF16 output bits into the RCL tape. Gradients and AdamW updates continue through the existing RCL Rust implementation; telemetry reports the split.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL contract expresses a generic graph and explicit placement policy |
| COMPILE | PASS_LOCAL | RCL genome, Rust organ and provider test compile |
| LOWER | PASS_LOCAL_CANDIDATE | only matmul lowers to AMD OpenCL; host placements remain explicit |
| EXECUTE | PASS_LOCAL | current host executed the AMD OpenCL matmul node |
| CORRECT | PASS_LOCAL | CPU BF16 reference produced identical training/checkpoint results |
| ROBUST | PASS_LOCAL | provider, placement, descriptor and backend negatives fail closed |
| PERFORMANCE | NOT_EVALUATED | process-per-node provider dispatch is not a throughput result |
| AI_GENERATE | NOT_APPLICABLE | no learned model generation claim |
| EVIDENCE | CANDIDATE | local AMD receipt is bound; hosted replay is pending |

## Hosted boundary

The dedicated workflow is K08 GPU BF16 Autodiff AdamW. Hosted runners may prove compilation, replay and explicit unavailable-device behavior. They do not inherit the local AMD device receipt and cannot promote this candidate to generic GPU training.

## Open gaps

| Gap | Ruling | Next gate |
|---|---|---|
| RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION | PARTIALLY REDUCED | bind more than the single matmul profile, then implement GPU-native backward/optimizer kernels or preserve a separately admitted hybrid profile |
| RCL_GAP_RCL10M_TOKENIZER_DATASET | OPEN | user-owned multilingual/code corpus, provenance review, tokenizer freeze and deterministic 10M-token shards |

Claims not granted: GPU_TRAINING, OPENCL_BF16_FULL_GRAPH, OPENCL_BF16_BACKWARD_KERNELS, OPENCL_BF16_OPTIMIZER_KERNELS, generic GPU backend, BF16 GQA/RoPE GPU, RCL-10M, RCL-1B, distributed training and K400 promotion.

Authority files:

- examples/native-ai/gpu-bf16-autodiff-adamw-genome.rcl
- examples/native-ai/gpu-bf16-autodiff-adamw-contract.v0.1.json
- examples/native-ai/evidence/gpu-bf16-autodiff-adamw-v0.1/k08-gpu-bf16-autodiff-adamw-local-evidence.json
- native/tensor-engine/src/autodiff.rs
- native/tensor-engine/amd_opencl_bf16_provider.py

Reproduction: npm run test:k08-gpu-bf16-autodiff-adamw.
