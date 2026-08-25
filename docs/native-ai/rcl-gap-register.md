# Native AI RCL Gap Register

No workaround below may be silently counted as RCL-native capability.

| Gap | Missing capability | Current workaround/donor | Type | Generality | Candidate absorption | K400 impact |
|---|---|---|---|---|---|---|
| `RCL_GAP_AI_001` | Canonical Tensor shape/dtype/layout/broadcast/matmul/reduction semantics | Typed Tensor candidate plus scalar reference lowering | Canonical Semantic Gap | cross-model | Locally absorbed in K08-C candidate; promotion and self-host typed lowering remain open | K233 and future GPU/scientific ML cells |
| `RCL_GAP_AI_002` | General computation graph and reverse-mode Autodiff | Bounded analytic two-layer backprop; JS only checks differential parity | Canonical Semantic Gap | cross-model | Autodiff Genome after Tensor | K233 |
| `RCL_GAP_AI_003` | Adam/AdamW state and update semantics | Batch SGD only | Canonical Semantic Gap | cross-model | Optimizer Genome | K233 |
| `RCL_GAP_AI_004` | Native peak RSS telemetry | Explicitly `UNMEASURED`; runtime/instruction/stack metrics recorded | Tooling Gap | cross-runtime | add native process telemetry ABI | PERFORMANCE evidence depth |
| `RCL_GAP_AI_005` | Optimized CPU Tensor kernels | Rust CPU Dense organ plus generic Tensor Plan gives `5.720x` local end-to-end General MLP speedup, but remains `15.863x` slower than JS oracle | Backend / Performance Gap | cross-model | Partially absorbed; remove JSON/SSA dispatch and retained-intermediate overhead, then evaluate SIMD/threading/BLAS donors | K233 PERFORMANCE competitiveness |
| `RCL_GAP_AI_006` | RCL-owned checkpoint file serialization and atomic persistence | Candidate checkpoint writes decimal display values plus exact f64 Storage bits; `32 == save(16)+reload+16` is bit exact | Backend / Tooling Gap | cross-model | exact-value encoding locally absorbed; atomic persistence and RCL-owned storage profile remain | K233 model lifecycle |
| `RCL_GAP_AI_007` | Independent model generation available without hosted credentials | Ephemeral Codex CLI generator; frozen candidates replay offline | Auxiliary Organ | evidence-only | remain external verification organ | K233 AI_GENERATE |
| `RCL_GAP_AI_008` | Self-host compiler lowering for linked typed Tensor records | JS typed linker emits typed RBC that runs in the native VM | Compiler Gap | cross-domain typed programs | absorb linked type-module parsing/lowering into self-host compiler | Tensor promotion and typed K400 cells |
| `RCL_GAP_AI_009` | General MLP lowering to Tensor backend | JS auxiliary lowerer emits a source/contract-rooted generic Tensor SSA Plan; Rust computes all training values | Lowering Gap | cross-model | Locally absorbed as K08-D candidate; promotion requires GitHub replay and self-hosted/typed lowering ownership | K233 performance |
| `RCL_GAP_AI_010` | Cross-runtime semantic state-root parity for scientific-notation numbers | Integer performance corpus preserves strict root verification; floating probe remains rejected | Evidence Gap | cross-runtime numeric workloads | unify canonical f64 JSON/number encoding in native and verifier | Tensor/scientific K400 evidence |
| `RCL_GAP_AI_011` | Compact self-hosted Tensor execution planning and liveness | JS emits a 6.11 MB / 29,980-node SSA JSON Plan and backend retains 1.66 MB cumulative intermediates | Compiler / IR / Memory Gap | cross-model | add RCL-owned compact loop/graph lowering, liveness and buffer reuse without changing operation semantics | K233 performance and future Transformer scale |

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
- `STRESS_AI_TENSOR_PLAN_SSA`: missing inputs, duplicate outputs, descriptor drift, node/resource overflow and model-special operations must fail closed.
- `STRESS_AI_EXACT_F64_CHECKPOINT`: decimal JSON may move one ULP across runtimes; exact Storage bits must preserve checkpoint identity without accepting non-finite values.

## Next absorption order

`Tensor Plan liveness/buffer reuse and compact lowering -> native process RSS telemetry -> typed self-host lowering -> scientific-number root closure -> native Autodiff`.
