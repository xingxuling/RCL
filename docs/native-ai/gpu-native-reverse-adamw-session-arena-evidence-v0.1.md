# K19 GPU-native reverse/AdamW persistent session arena evidence v0.1

## Current ruling

`PASS_LOCAL_AND_HOSTED_GPU_NATIVE_REVERSE_ADAMW_SESSION_ARENA_CANDIDATE`

K19 exercises the existing RCL-owned generic Tensor Autodiff and AdamW path for
two repeated optimizer steps while one persistent AMD OpenCL provider session
uses the bounded `session-arena-v0.1` temporary-buffer pool. The graph contains
one explicitly GPU-placed BF16 matmul; subtraction, multiplication and mean
remain explicit RCL CPU-reference operations. RCL owns graph, BF16/FP32 numeric,
reverse-mode, master-weight, optimizer-state, checkpoint and differential
semantics. The provider owns only OpenCL lowering, transport and temporary
buffer reuse. CPU fallback is forbidden.

This is a real local AMD `gfx1152` candidate with exact CPU differential,
deterministic replay and checkpoint-resume parity. Arena reuse is measured, but
this does not grant full-graph GPU training, GPU-native non-matmul Autodiff,
throughput, VRAM, portability, production Transformer training or K400
promotion. Hosted runners may replay the contract or report an unavailable
AMD backend; they do not inherit the local device receipt.

## Local evidence

- Device: AMD `gfx1152`, OpenCL `2.0 AMD-APP (3661.0)`, driver `3661.0
  (PAL,LC)`.
- Fixture: generic RCL Tensor SSA `[2,1]` matmul followed by host-reference
  `sub -> mul -> mean`, BF16 forward with FP32 gradients, FP32 master weights
  and FP32 AdamW state; two repeated training steps.
- Persistent arena telemetry: 14 provider requests, 11 dispatches, 10
  allocations / 40 reuses / 10 releases, 46 allocated bytes, zero pooled
  buffers and bytes at close, and a peak pool of 10 buffers / 46 bytes.
- The per-kernel baseline used 50 allocations / 232 bytes with zero reuse.
  Arena and per-kernel runs produced the same checkpoint root
  `sha256:a9a5481ee0c3406385cad7ce2d7f855b48d1bcbb81a9017771ddbca5fc2394e8`.
- Loss moved from `0.045166016` to `0.020629883`; the final receipt records
  one GPU forward matmul node, two GPU reverse matmul-gradient calls and two
  optimizer elements across the two steps. CPU loss, parameters, optimizer
  states, checkpoint root, deterministic replay and one-step checkpoint resume
  all matched exactly.
- The focused K19 suite is `3/3 PASS`; Python syntax, locked Rust cargo check,
  Node syntax and `git diff --check` passed. No new dependency or donor code
  was introduced.
- Hosted PR #145 run `33905917746` passed the K19 suite on both Ubuntu
  (`101130689327`) and Windows (`101130689995`). The push-triggered rerun
  `33905846815` also passed on both platforms after its initial Windows
  dependency-build timeout was rerun.
- After merge commit `aae15df9d26ea5b749682b212d1c0925553be6dc` reached
  `main`, Authority (`33906897287`), Canonical (`33906897338`), Universal
  Stress (`33906897331`) and the K12-K18 regression workflows all passed.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K19 repeated GPU-native reverse/AdamW steps over a persistent session arena |
| Missing capability | Preserve a reusable accelerator transport/buffer envelope across generic reverse and optimizer steps without moving semantic ownership out of RCL |
| Prior workaround | K08 reverse/AdamW already lowered GPU primitives, while K13's arena proof was exercised separately and K18's residency proof covered forward graph resources only |
| Donor | Existing RCL Tensor/Autodiff/AdamW semantics plus K09-K13 persistent/batch/gradient/arena transports |
| Gap type | Backend / lowering / performance integration gap |
| Generality | Cross-model generic Tensor matmul training paths |
| Candidate absorption | RCL-owned K19 contract/genome and test bind explicit GPU/host placements, two-step stateful training, persistent provider transport, bounded reuse/release accounting, exact CPU differential and fail-closed boundaries |
| K400 impact | K233 performance and future scale evidence only; matrix remains `23/400` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT_CPU_DIFFERENTIAL |
| ROBUST | PASS_LOCAL_FAIL_CLOSED_BOUNDARIES |
| PERFORMANCE | ARENA_REUSE_TELEMETRY_ONLY_NO_THROUGHPUT_OR_VRAM_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | PASS_HOSTED_REPLAY_BOUNDARY |

Only the three bounded K19 persistent-session/arena candidate claims in the
evidence JSON are granted. GPU training, full-graph training semantics,
GPU-native non-matmul Autodiff, throughput, VRAM reduction, portability,
RCL-10M/RCL-1B, distributed training, production model claims and K400
completion remain closed.

## Authority files

- `examples/native-ai/gpu-native-reverse-adamw-session-arena-contract.v0.1.json`
- `examples/native-ai/gpu-native-reverse-adamw-session-arena-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `native/tensor-engine/src/bin/rcl-bf16-autodiff-adamw.rs`
- `tests/k19-gpu-native-reverse-adamw-session-arena.test.mjs`
- `examples/native-ai/evidence/gpu-native-reverse-adamw-session-arena-v0.1/k19-gpu-native-reverse-adamw-session-arena-local-evidence.json`

Reproduction: `npm run test:k19-gpu-native-reverse-adamw-session-arena`.
