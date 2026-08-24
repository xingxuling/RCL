# Native AI RCL Gap Register

No workaround below may be silently counted as RCL-native capability.

| Gap | Missing capability | Current workaround/donor | Type | Generality | Candidate absorption | K400 impact |
|---|---|---|---|---|---|---|
| `RCL_GAP_AI_001` | Canonical Tensor shape/dtype/layout/broadcast/matmul/reduction semantics | Nested immutable `Sequence` values | Canonical Semantic Gap | cross-model | Tensor Genome is next candidate | K233 and future GPU/scientific ML cells |
| `RCL_GAP_AI_002` | General computation graph and reverse-mode Autodiff | Bounded analytic two-layer backprop; JS only checks differential parity | Canonical Semantic Gap | cross-model | Autodiff Genome after Tensor | K233 |
| `RCL_GAP_AI_003` | Adam/AdamW state and update semantics | Batch SGD only | Canonical Semantic Gap | cross-model | Optimizer Genome | K233 |
| `RCL_GAP_AI_004` | Native peak RSS telemetry | Explicitly `UNMEASURED`; runtime/instruction/stack metrics recorded | Tooling Gap | cross-runtime | add native process telemetry ABI | PERFORMANCE evidence depth |
| `RCL_GAP_AI_005` | Optimized CPU Tensor kernels | Recursive scalar/Sequence execution; JS oracle is `118.300x` faster in the final authority-bound local run | Backend / Performance Gap | cross-model | BLAS/Rust/C++ organ after Tensor IR | K233 PERFORMANCE competitiveness |
| `RCL_GAP_AI_006` | RCL-owned checkpoint file serialization and atomic persistence | Host runner serializes rooted native checkpoint state | Backend / Tooling Gap | cross-model | checkpoint storage lowering profile | K233 model lifecycle |
| `RCL_GAP_AI_007` | Independent model generation available without hosted credentials | Ephemeral Codex CLI generator; frozen candidates replay offline | Auxiliary Organ | evidence-only | remain external verification organ | K233 AI_GENERATE |

## Stress cases extracted

- `STRESS_AI_GENERAL_TOPOLOGY`: the same RCL training primitives must handle `2-2-1` and `3-3-1` models.
- `STRESS_AI_INVALID_SHAPE`: adjacent layer width mismatch must fail closed.
- `STRESS_AI_INVALID_DATASET`: feature width mismatch must fail closed.
- `STRESS_AI_CHECKPOINT_RESUME`: 32 direct epochs must equal 16+16 resumed epochs exactly.
- `STRESS_AI_CANONICAL_NUMBER`: long decimal initialization exposed self-host/reference `programRoot` divergence despite instruction parity.
- `STRESS_AI_INDEPENDENT_REPAIR`: three hidden semantic mutations must be repaired by separate read-only generator sessions and replay natively.

## Next absorption order

`Tensor object and shape law -> scalar CPU reference backend -> differential corpus -> broadcast/matmul/reduction negatives -> performance ledger -> Tensor IR lowering`.
