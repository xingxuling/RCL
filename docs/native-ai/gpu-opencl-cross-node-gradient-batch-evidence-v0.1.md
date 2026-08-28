# K12 AMD OpenCL cross-node gradient batch evidence v0.1

## Ruling

`PASS_LOCAL_AND_HOSTED_OPENCL_CROSS_NODE_GRADIENT_BATCH_CANDIDATE_POSTMERGE_PENDING`

RCL remains the canonical owner of Tensor, BF16, reverse-mode Autodiff, gradient accumulation and AdamW semantics. K12 adds an opt-in bounded planner for a contiguous ready frontier of independent GPU matmul nodes. RCL fixes canonical reverse-node order and each node's `left-gradient`, `right-gradient` child order; the AMD OpenCL provider remains an auxiliary ordered transport organ. A singleton falls back to K11's same-node pair path. No new model-special or accelerator-special core opcode was added.

## Local evidence

- Real AMD OpenCL `gfx1152` protocol smoke passed for two node-local gradient pairs in one four-operation transport message. Child output bits and execution roots matched individual execution exactly.
- The complete bounded two-block GQA+RoPE GPU-native backward/AdamW differential passed `3/3`. Same-node and cross-node modes produced identical forward roots, backward roots, losses, parameters, optimizer states and checkpoint root; CPU checkpoint parity also remained exact.
- One-step training preserved `338` logical provider requests and `108` logical node-gradient batches. Cross-node planning grouped `36` nodes into `18` frontier batches, reducing transport dispatches from `217` to `199` and total batches from `109` to `91`.
- Unknown modes fail with `RCL_ACCELERATOR_GRADIENT_BATCH_MODE_UNSUPPORTED`; CPU/non-persistent use fails with `RCL_ACCELERATOR_CROSS_NODE_GRADIENT_BATCH_UNAVAILABLE`. The planner is capped at `32` nodes / `64` child operations.
- Rust Tensor tests passed `7/7`; the K08 Tensor suite passed `16` with one declared skip; K11, K10 and K09 regressions each passed `1/1`.
- License audit: no dependency, external source, generated asset or donor code was added. K10/K11 are internal semantic/transport donors only.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K12 bounded cross-node reverse-matmul gradient batching |
| Missing capability | RCL-owned ready-frontier selection and ordered multi-node gradient transport |
| Prior workaround | one K11 transport dispatch per GPU matmul node |
| Donor | internal K10 bounded ordered transport and K11 same-node gradient pair |
| Gap type | lowering / backend / performance gap |
| Generality | cross-model generic Tensor Autodiff graphs |
| Candidate absorption | opt-in graph binding plus Rust lowering organ; no new Core opcode |
| K400 impact | K233 performance stress evidence only; matrix remains `23/400` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT |
| ROBUST | PASS_LOCAL |
| PERFORMANCE | DISPATCH_COUNT_ONLY_NO_THROUGHPUT_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE_HOSTED_BOUND |

The candidate grants only `OPENCL_AMD_CROSS_NODE_GRADIENT_BATCHED_DISPATCH_CANDIDATE`. It does not grant batched kernels, device-buffer residency, parallel execution, wall-time or training-throughput improvement, generic GPU portability, GPU training promotion, RCL-10M, RCL-1B or K400 PASS. The real RCL-10M corpus/tokenizer gate remains `BLOCKED_USER_CORPUS`.

Authority files:

- `examples/native-ai/gpu-opencl-cross-node-gradient-batch-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-cross-node-gradient-batch-genome.rcl`
- `examples/native-ai/evidence/gpu-opencl-cross-node-gradient-batch-v0.1/k12-opencl-cross-node-gradient-batch-local-evidence.json`

Hosted replay passed for exact head `f7257091c8178d6c8f813d8d0ba8faaf34543ac8`:
K12 run `33186294873` passed Ubuntu job `98900043188` and Windows job
`98900043219`; K11 `33186294809`, K10 `33186294821`, K09 `33186294829`,
Universal Stress `33186294878` (focused job `98900043321`, Windows K01 job
`98900042950`), Canonical Verification `33186294825` and Authority
`33186294855` also passed. Post-merge verification remains pending.

Reproduction: `npm run test:k12-opencl-cross-node-gradient-batch`, `npm run test:k11-opencl-gradient-pair-batch`, `npm run test:k10-opencl-batched-dispatch`, `npm run test:k09-opencl-persistent-dispatch` and `npm run test:k08-tensor`.
