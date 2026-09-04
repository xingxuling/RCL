# K20 GPU-native elementwise backward evidence v0.1

## Current ruling

`PASS_LOCAL_AND_HOSTED_GPU_NATIVE_ELEMENTWISE_BACKWARD_CANDIDATE`

K20 extends the existing RCL-owned generic Tensor Autodiff and AdamW path with
an explicit `gpuNonMatmulMode: "elementwise-v0.1"` opt-in for same-shape
`sub` and `mul` nodes. A bounded two-step BF16 forward / FP32 reverse graph
uses one persistent AMD OpenCL provider session and the existing
`session-arena-v0.1` temporary-buffer pool. `mean` remains an explicit RCL
CPU-reference operation. RCL owns graph, shape, numeric, reverse-mode,
optimizer-state, checkpoint and differential semantics; the provider owns only
OpenCL lowering, transport and temporary-buffer reuse. CPU fallback is
forbidden.

The real local AMD `gfx1152` run has exact CPU differential, deterministic
replay, checkpoint-resume parity and fail-closed opt-in/provider/backend
boundaries. PR #153 passed the exact-head K20 Ubuntu and Windows jobs, and its
Canonical, Universal and Authority checks passed. The PR was merged as
`main@0013c524`. The subsequent post-merge Canonical, Universal and Authority
checks for that merged commit also passed. This is a bounded candidate, not a
full-graph GPU-training or general non-matmul portability claim.

## Local evidence

- Device: AMD `gfx1152`, OpenCL `2.0 AMD-APP (3661.0)`, driver `3661.0
  (PAL,LC)`.
- Fixture: generic RCL Tensor SSA `matmul -> sub -> mul -> mean -> mean`;
  `[2,1]` matmul output and same-shape elementwise nodes, two repeated steps,
  BF16 storage / FP32 elementwise compute and gradients, FP32 master weights
  and AdamW state.
- Explicit placements: GPU `matmul`, `sub` and `mul`; CPU-reference `mean`
  nodes; mode `elementwise-v0.1`; no fallback.
- Arena telemetry: 38 provider requests, 27 dispatches, 10 allocations /
  104 reuses / 10 releases, 46 allocated bytes, zero pooled buffers and bytes
  at close, and a peak pool of 10 buffers / 46 bytes.
- The per-kernel baseline used 114 allocations / 616 bytes with zero reuse.
  Arena and per-kernel runs shared checkpoint root
  `sha256:a9a5481ee0c3406385cad7ce2d7f855b48d1bcbb81a9017771ddbca5fc2394e8`.
- Loss moved from `0.045166016` to `0.020629883`; the final receipt records
  one GPU matmul node, two GPU elementwise nodes, two GPU reverse matmul
  nodes and four GPU reverse elementwise nodes. CPU loss, parameters,
  optimizer states, checkpoint root, deterministic replay and checkpoint
  resume all matched exactly.
- The focused K20 suite is `3/3 PASS`; the K19 session-arena regression is
  `3/3 PASS`; Python syntax, locked Rust cargo check, Node syntax,
  `git diff --check` and the license audit passed. No new dependency or donor
  code was introduced.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K20 same-shape GPU `sub`/`mul` forward and reverse over the existing persistent session arena |
| Missing capability | Generic RCL non-matmul backward lowering with reusable accelerator transport while retaining RCL semantic ownership |
| Prior workaround | K19 kept `sub`, `mul` and `mean` on explicit CPU-reference nodes; the GPU path covered matmul and its reverse/AdamW transport only |
| Donor | Existing RCL Tensor/Autodiff/AdamW semantics plus the K09-K19 OpenCL session, batch, gradient and arena transports |
| Gap type | Backend / lowering / performance integration gap |
| Generality | Cross-model same-shape generic Tensor elementwise paths |
| Candidate absorption | RCL-owned contract/genome and test bind explicit opt-in, same-shape `sub`/`mul` forward and reverse kernels, two-step stateful training, persistent transport, bounded reuse/release accounting, exact CPU differential and fail-closed boundaries |
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

Only the bounded same-shape GPU `sub`/`mul` forward and reverse candidate
claims in the evidence JSON are granted. Broadcast, general non-matmul
coverage, full-graph training semantics, GPU training, throughput, VRAM,
generic GPU portability, RCL-10M/RCL-1B, distributed training, production
model claims and K400 completion remain closed.

## Hosted and post-merge receipts

PR #153 exact head `43066124987b4d1be0652b3e88bc72b214d15434` passed K20 on
Ubuntu job `101150937092` and Windows job `101150937334`. The same head passed
Canonical job `101150936665`, Authority job `101150936997`, Universal focused
job `101154886576` and the rerun-attempt-2 Universal K01 Windows job
`101154885107`. The PR merged to `main` as
`0013c5244a86bf7422bdfb9972cbda4dab4e29ed`.

Post-merge checks for that exact merged commit passed Canonical run
`33914184965` / job `101157415895`, Universal run `33914184882` / focused job
`101157415697` / K01 Windows job `101157416025`, and Authority run
`33914184884` / job `101157415760`. K09-K18 post-merge regression workflows
also passed. These hosted runners prove exact-head repository replay only;
they do not inherit the local AMD device receipt. The unrelated Vercel status
was rate-limited by an external build quota.

## Authority files

- `examples/native-ai/gpu-native-elementwise-backward-contract.v0.1.json`
- `examples/native-ai/gpu-native-elementwise-backward-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `native/tensor-engine/src/autodiff.rs`
- `native/tensor-engine/src/bin/rcl-bf16-autodiff-adamw.rs`
- `tests/k20-gpu-native-elementwise-backward.test.mjs`
- `examples/native-ai/evidence/gpu-native-elementwise-backward-v0.1/k20-gpu-native-elementwise-backward-local-evidence.json`

Reproduction: `npm run test:k20-gpu-native-elementwise-backward`.

