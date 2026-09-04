# K13 AMD OpenCL session buffer arena evidence v0.1

## Ruling

`PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_SESSION_BUFFER_ALLOCATION_REUSE_CANDIDATE`

RCL owns the explicit allocation mode, exact-size/flags reuse rule, resource bounds and no-residency claim. The AMD OpenCL provider remains an auxiliary execution organ and owns `cl_mem` creation, reuse and release. Inputs are still copied host-to-device for every operation and outputs are still read back after every operation. K13 therefore reduces allocation churn only; it is not Tensor value residency or transfer elision.

## Local evidence

- Real AMD OpenCL `gfx1152` executed the two-operation protocol smoke. Per-kernel mode used six allocations/releases; the arena used three allocations plus three reuses, preserved output bits and execution roots exactly, then returned a close receipt with all three buffers released and the pool at zero.
- The bounded two-block GQA+RoPE GPU-native backward/AdamW differential preserved `338` logical requests, `18` cross-node batches and `36` cross-node nodes. The same `1070` buffer acquisitions changed from `1070` new allocations to `41` allocations plus `1029` exact-size/flags reuses.
- Cumulative newly allocated bytes changed from `31,828` to `1,804`; the arena peak was `41` buffers / `1,804` bytes, below the declared `64` buffers / `2,097,152` bytes bounds.
- Per-kernel, arena and CPU paths matched forward/backward roots, losses, parameters, optimizer state and checkpoint root exactly.
- Unknown modes fail with `RCL_ACCELERATOR_BUFFER_ALLOCATION_MODE_UNSUPPORTED`; CPU/non-persistent use fails with `RCL_ACCELERATOR_BUFFER_ARENA_UNAVAILABLE`. Missing, non-monotonic, out-of-bounds or value-residency provider receipts fail closed in Rust.
- K13 passed `6/6`; Rust Tensor passed `7/7`; K08 Tensor passed `16` with one declared skip; K12 passed `4/4`; K11/K10/K09 each passed `1/1`.
- Strict Clippy remains blocked by eight pre-existing repository warnings. Compilation and runtime suites pass; no Clippy PASS is claimed.
- License audit: no dependency, external source, generated asset or donor code was added. K09-K12 are internal runtime donors only.
- Hosted exact-head PR #115 replay passed on head `0840e9d83a05a9a4b69e99059c42aace82860f51`, including K13 on Ubuntu and Windows, Universal, Canonical, Authority and K09-K12 regressions.
- Post-merge main replay passed on merge `251b20a758326fd3a17056c424584145dde15e89`, including K13 on Ubuntu and Windows, K09-K12, Canonical and Authority. Universal passed on official attempt 3; attempts 1 and 2 hit the existing Windows K01 `native C0 -> C1 -> C2 exceeded 240000 ms` timeout before the same workflow passed.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K13 bounded OpenCL session buffer allocation reuse |
| Missing capability | reuse accelerator allocations without weakening Tensor identity or cleanup |
| Prior workaround | create/release isolated input and output `cl_mem` for every kernel |
| Donor | internal K09 persistent session and conventional exact-size allocation arena pattern |
| Gap type | memory / backend / performance gap |
| Generality | cross-model accelerator execution |
| Candidate absorption | opt-in RCL graph binding plus bounded provider arena and close receipt |
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
| PERFORMANCE | ALLOCATION_COUNT_ONLY_NO_WALL_TIME_OR_THROUGHPUT_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE_HOSTED_AND_POSTMERGE |

The candidate grants only `OPENCL_AMD_SESSION_BUFFER_ALLOCATION_REUSE_CANDIDATE`. It does not grant Tensor value residency, transfer elision, parallel execution, wall-time or training-throughput improvement, generic GPU portability, GPU training promotion, RCL-10M, RCL-1B or K400 PASS. The real RCL-10M corpus/tokenizer gate remains `BLOCKED_USER_CORPUS`.

Authority files:

- `examples/native-ai/gpu-opencl-buffer-arena-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-buffer-arena-genome.rcl`
- `examples/native-ai/evidence/gpu-opencl-buffer-arena-v0.1/k13-opencl-buffer-arena-local-evidence.json`

Hosted and post-merge verification passed. The two initial post-merge Universal attempts were retained as retry history because the existing Windows K01 fixed-point test exceeded its declared `240000 ms` budget; official attempt 3 passed without a source change. This does not alter the K13 allocation-reuse boundary.

Reproduction: `npm run test:k13-opencl-buffer-arena`, `npm run test:k12-opencl-cross-node-gradient-batch`, `npm run test:k11-opencl-gradient-pair-batch`, `npm run test:k10-opencl-batched-dispatch`, `npm run test:k09-opencl-persistent-dispatch` and `npm run test:k08-tensor`.
