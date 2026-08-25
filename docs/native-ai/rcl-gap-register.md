# Native AI RCL Gap Register

No workaround below may be silently counted as RCL-native capability.

| Gap | Missing capability | Current workaround/donor | Type | Generality | Candidate absorption | K400 impact |
|---|---|---|---|---|---|---|
| `RCL_GAP_AI_001` | Canonical Tensor shape/dtype/layout/broadcast/matmul/reduction semantics | Typed Tensor candidate plus scalar reference lowering | Canonical Semantic Gap | cross-model | Locally absorbed in K08-C candidate; promotion and self-host typed lowering remain open | K233 and future GPU/scientific ML cells |
| `RCL_GAP_AI_002` | General computation graph and reverse-mode Autodiff | Bounded analytic two-layer backprop; JS only checks differential parity | Canonical Semantic Gap | cross-model | Autodiff Genome after Tensor | K233 |
| `RCL_GAP_AI_003` | Adam/AdamW state and update semantics | Batch SGD only | Canonical Semantic Gap | cross-model | Optimizer Genome | K233 |
| `RCL_GAP_AI_004` | Native peak RSS telemetry | Explicitly `UNMEASURED`; runtime/instruction/stack metrics recorded | Tooling Gap | cross-runtime | add native process telemetry ABI | PERFORMANCE evidence depth |
| `RCL_GAP_AI_005` | Optimized CPU Tensor kernels | Rust CPU Dense organ achieves exact-parity local MatMul speedups, but General MLP remains scalar | Backend / Performance Gap | cross-model | Partially absorbed; lower MLP to Tensor IR, then consider SIMD/threading/BLAS donors | K233 PERFORMANCE competitiveness |
| `RCL_GAP_AI_006` | RCL-owned checkpoint file serialization and atomic persistence | Host runner serializes rooted native checkpoint state | Backend / Tooling Gap | cross-model | checkpoint storage lowering profile | K233 model lifecycle |
| `RCL_GAP_AI_007` | Independent model generation available without hosted credentials | Ephemeral Codex CLI generator; frozen candidates replay offline | Auxiliary Organ | evidence-only | remain external verification organ | K233 AI_GENERATE |
| `RCL_GAP_AI_008` | Self-host compiler lowering for linked typed Tensor records | JS typed linker emits typed RBC that runs in the native VM | Compiler Gap | cross-domain typed programs | absorb linked type-module parsing/lowering into self-host compiler | Tensor promotion and typed K400 cells |
| `RCL_GAP_AI_009` | General MLP lowering to Tensor backend | Existing K08-B remains recursive scalar RCL | Lowering Gap | cross-model | lower generic Dense forward/backward through Tensor IR without changing model source | K233 performance |
| `RCL_GAP_AI_010` | Cross-runtime semantic state-root parity for scientific-notation numbers | Integer performance corpus preserves strict root verification; floating probe remains rejected | Evidence Gap | cross-runtime numeric workloads | unify canonical f64 JSON/number encoding in native and verifier | Tensor/scientific K400 evidence |

## Stress cases extracted

- `STRESS_AI_GENERAL_TOPOLOGY`: the same RCL training primitives must handle `2-2-1` and `3-3-1` models.
- `STRESS_AI_INVALID_SHAPE`: adjacent layer width mismatch must fail closed.
- `STRESS_AI_INVALID_DATASET`: feature width mismatch must fail closed.
- `STRESS_AI_CHECKPOINT_RESUME`: 32 direct epochs must equal 16+16 resumed epochs exactly.
- `STRESS_AI_CANONICAL_NUMBER`: long decimal initialization exposed self-host/reference `programRoot` divergence despite instruction parity.
- `STRESS_AI_INDEPENDENT_REPAIR`: three hidden semantic mutations must be repaired by separate read-only generator sessions and replay natively.
- `STRESS_AI_STORAGE_IDENTITY`: backend reference and optimized MatMul must produce the same content-derived Storage Identity.
- `STRESS_AI_PROVIDER_BOUNDARY`: native RBC must reach a general Tensor provider without adding model-special VM opcodes.
- `STRESS_AI_SCIENTIFIC_NUMBER_ROOT`: generated floating matrices exposed native/JS semantic-state-root mismatch at scientific-notation formatting boundaries.

## Next absorption order

`General MLP Tensor lowering -> end-to-end 118.300x gap remeasurement -> native memory telemetry -> typed self-host lowering -> scientific-number root closure -> native Autodiff`.
