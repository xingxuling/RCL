# K21 GPU-native reduction backward evidence v0.1

## Current ruling

`PASS_LOCAL_AND_HOSTED_GPU_NATIVE_REDUCTION_BACKWARD_CANDIDATE`

K21 extends the existing RCL-owned generic Tensor Autodiff and AdamW path with
an explicit `gpuNonMatmulMode: "reduction-v0.1"` opt-in for bounded rank-2
`mean` nodes on axis `0` or `1`. The graph uses BF16 storage with FP32
accumulation and gradients, one persistent AMD OpenCL provider session and the
existing `session-arena-v0.1` temporary-buffer pool. `reshape` remains an
explicit RCL CPU-reference operation and CPU fallback is forbidden.

The real local AMD `gfx1152` run has exact CPU differential, deterministic
replay, checkpoint-resume parity and fail-closed mode, placement, axis,
arena, provider and backend boundaries. PR #162 passed the exact-head K21
Ubuntu and Windows jobs, and its Canonical, Universal and Authority checks
passed. The PR merged as `main@f435fcb`. The post-merge Canonical, Universal,
Authority and K09-K18 workflows for that exact merge commit also passed.
This is a bounded candidate, not a general reduction, full-graph GPU-training
or production-model claim.

## Local evidence

- Device: AMD `gfx1152`, OpenCL `2.0 AMD-APP (3661.0)`, driver `3661.0
  (PAL,LC)`.
- Fixture: generic RCL Tensor SSA `matmul -> mean(axis 0) -> reshape ->
  mean(axis 1)`; rank-2 `[2,2]` matmul and reductions, two repeated steps,
  BF16 storage / FP32 accumulation and gradients, FP32 master weights and
  AdamW state.
- Explicit placements: GPU `matmul` and both `mean` nodes; CPU-reference
  `reshape`; mode `reduction-v0.1`; no fallback.
- Arena telemetry: 30 provider requests, 27 dispatches, 13 allocations /
  69 reuses / 13 releases, 146 allocated bytes, zero pooled buffers and bytes
  at close, and a peak pool of 13 buffers / 146 bytes.
- The per-kernel baseline used 82 allocations / 856 bytes with zero reuse.
  Arena and per-kernel runs shared checkpoint root
  `sha256:923decbf054c5e21a551de3043be519696343d78851368720a7b596a8d77f0fe`.
- Loss moved from `0.94921875` to `0.6484375`; the final receipt records one
  GPU matmul node, two GPU reduction nodes, two GPU reverse matmul nodes and
  two GPU reverse reduction nodes. CPU loss, parameters, optimizer states,
  checkpoint root, deterministic replay and checkpoint resume matched exactly.
- The focused K21 suite is `3/3 PASS`; K20 and K19 regressions are each
  `3/3 PASS`; Python syntax, locked Rust cargo check, Node syntax,
  `git diff --check` and the license audit passed. No new dependency or donor
  code was introduced.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K21 bounded rank-2 GPU `mean` forward and reverse over the existing persistent session arena |
| Missing capability | Generic RCL reduction backward lowering with reusable accelerator transport while retaining RCL semantic ownership |
| Prior workaround | K19/K20 kept reduction nodes on explicit CPU-reference placements; GPU lowering covered matmul and selected elementwise rules |
| Donor | Existing RCL Tensor/Autodiff/AdamW semantics plus the K09-K20 OpenCL session, batch, gradient and arena transports |
| Gap type | Backend / lowering / performance integration gap |
| Generality | Cross-model rank-2 `mean` reductions on axis 0 or 1 |
| Candidate absorption | RCL-owned contract/genome and tests bind explicit opt-in, rank-2 axis-0/1 `mean` forward and reverse kernels, two-step stateful training, persistent transport, bounded reuse/release accounting, exact CPU differential and fail-closed boundaries |
| K400 impact | K233 performance and future scale evidence only; matrix remains `23 PASS / 0 BLOCKED / 377 UNTESTED` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT_CPU_DIFFERENTIAL |
| ROBUST | PASS_LOCAL_FAIL_CLOSED_BOUNDARIES |
| PERFORMANCE | ARENA_REUSE_TELEMETRY_ONLY; NO THROUGHPUT OR VRAM CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | PASS_HOSTED_EXACT_HEAD_AND_POST_MERGE_REPLAY |

Only the bounded rank-2 GPU `mean` forward and reverse candidate claims in the
evidence JSON are granted. Broadcast, arbitrary-rank or arbitrary-axis
reductions, softmax/logsumexp, general non-matmul coverage, full-graph
training semantics, GPU training, throughput, VRAM, generic GPU portability,
RCL-10M/RCL-1B, distributed training, production model claims and K400
completion remain closed.

## Hosted and post-merge receipts

PR #162 exact head `7993601d8c299b0cedb779742f28e0cf974c8941` passed K21 Ubuntu
job `101187035418` and Windows job `101187035503`. The same head passed
Canonical run `33923569775` / job `101187038001`, Universal run
`33923569709` / focused job `101187038106` / K01 Windows job `101187037870`,
and Authority run `33923569457` / job `101187037823`. The PR merged to `main`
as `f435fcb9a9a1245049cad2044a4eb173f901ba40`.

Post-merge checks for that exact commit passed Canonical run `33924571163` /
job `101190152686`, Universal run `33924571164` / focused job
`101190152971` / K01 Windows job `101190152763`, and Authority run
`33924571102` / job `101190152525`. K09-K18 regression
workflows `33924571103`, `33924571114`, `33924571134`, `33924571143`,
`33924571150`, `33924571155`, `33924571162`, `33924571176`, `33924571226`
and `33924571236` passed. The unrelated Vercel status remained externally
rate-limited and is not an RCL gate.

## Authority files

- `examples/native-ai/gpu-reduction-backward-contract.v0.1.json`
- `examples/native-ai/gpu-reduction-backward-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `native/tensor-engine/src/autodiff.rs`
- `native/tensor-engine/src/bin/rcl-bf16-autodiff-adamw.rs`
- `tests/k21-gpu-reduction-backward.test.mjs`
- `examples/native-ai/evidence/gpu-reduction-backward-v0.1/k21-gpu-reduction-backward-local-evidence.json`

Reproduction: `npm run test:k21-gpu-reduction-backward`.
