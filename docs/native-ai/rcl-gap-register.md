# Native AI RCL Gap Register

No workaround below may be silently counted as RCL-native capability.

| Gap | Missing capability | Current workaround/donor | Type | Generality | Candidate absorption | K400 impact |
|---|---|---|---|---|---|---|
| `RCL_GAP_AI_001` | Canonical Tensor shape/dtype/layout/broadcast/matmul/reduction semantics | Typed Tensor candidate plus scalar reference lowering | Canonical Semantic Gap | cross-model | Locally absorbed in K08-C candidate; promotion and self-host typed lowering remain open | K233 and future GPU/scientific ML cells |
| `RCL_GAP_AI_002` | General computation graph and reverse-mode Autodiff | K08-G RCL Autodiff Genome plus Rust reverse-mode execution organ; JS remains analytic/finite-difference oracle only | Canonical Semantic Gap | cross-model | Absorbed as a GitHub-bound ENGINE-E2 candidate for the recorded primitive set; optimizer integration, broader graph corpus and canonical promotion remain open | K233 and future learnable-system cells |
| `RCL_GAP_AI_003` | Adam/AdamW state and update semantics | Batch SGD only | Canonical Semantic Gap | cross-model | Optimizer Genome | K233 |
| `RCL_GAP_AI_004` | Native peak RSS telemetry | K08-F adds a Windows child-process `PeakWorkingSet64` evidence organ; portable RSS/VRAM and an in-process telemetry ABI remain absent | Tooling Gap | cross-runtime | locally evidenced for exact Windows child processes; retain gap for portable/device telemetry | PERFORMANCE evidence depth |
| `RCL_GAP_AI_005` | Optimized CPU Tensor kernels | Rust CPU Dense organ plus generic Tensor Plan gives `5.720x` accepted local end-to-end General MLP speedup, but remains `15.863x` slower than the accepted JS oracle boundary | Backend / Performance Gap | cross-model | Partially absorbed; K08-E reclaims dead values and K08-F removes Plan input clones, while JSON/SSA dispatch, buffer reuse and kernel optimization remain | K233 PERFORMANCE competitiveness |
| `RCL_GAP_AI_006` | RCL-owned checkpoint file serialization and atomic persistence | Candidate checkpoint writes decimal display values plus exact f64 Storage bits; `32 == save(16)+reload+16` is bit exact | Backend / Tooling Gap | cross-model | exact-value encoding locally absorbed; atomic persistence and RCL-owned storage profile remain | K233 model lifecycle |
| `RCL_GAP_AI_007` | Independent model generation available without hosted credentials | Ephemeral Codex CLI generator; frozen candidates replay offline | Auxiliary Organ | evidence-only | remain external verification organ | K233 AI_GENERATE |
| `RCL_GAP_AI_008` | Self-host compiler lowering for linked typed Tensor records | JS typed linker emits typed RBC that runs in the native VM | Compiler Gap | cross-domain typed programs | absorb linked type-module parsing/lowering into self-host compiler | Tensor promotion and typed K400 cells |
| `RCL_GAP_AI_009` | General MLP lowering to Tensor backend | JS auxiliary lowerer emits a source/contract-rooted generic Tensor SSA Plan; Rust computes all training values | Lowering Gap | cross-model | Locally absorbed as K08-D candidate; promotion requires GitHub replay and self-hosted/typed lowering ownership | K233 performance |
| `RCL_GAP_AI_010` | Cross-runtime semantic state-root parity for scientific-notation numbers | Integer performance corpus preserves strict root verification; floating probe remains rejected | Evidence Gap | cross-runtime numeric workloads | unify canonical f64 JSON/number encoding in native and verifier | Tensor/scientific K400 evidence |
| `RCL_GAP_AI_011` | Compact self-hosted Tensor execution planning and liveness | K08-E reduces logical live storage to 1,856 bytes; K08-F borrows `54,964` inputs and eliminates `2,516,168` bytes of historical cumulative storage cloning, but the JS organ still emits a 6.11 MB scalar-dispatch JSON Plan | Compiler / IR / Memory Gap | cross-model | liveness and borrowed inputs are tested candidates; next absorb liveness-safe buffer reuse and RCL-owned compact loop/graph lowering | K233 performance and future Transformer scale |

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
- `STRESS_AI_TENSOR_PLAN_LIVENESS`: last-use reclamation must preserve requested intermediates, repeated operands and global SSA uniqueness while retaining cumulative and peak-live fail-closed resource gates.
- `STRESS_AI_TENSOR_PLAN_BORROWED_INPUT`: repeated and distinct Plan operands must bind to live Storage without copying it, preserve public-request validation, fail closed for zero inputs, and retain exact output roots.
- `STRESS_AI_PROCESS_PEAK_MEMORY`: process-memory evidence must sample the exact child while alive and remain distinct from logical Tensor-store accounting.
- `STRESS_AI_REVERSE_ACCUMULATION`: repeated paths to one TensorValue must merge through a shape-checked GradientAccumulator rather than overwrite a prior contribution.
- `STRESS_AI_EXACT_GRADIENT_CHECKPOINT`: exact f64 checkpoint bits must be materialized into mutable parameter storage before the first resumed update, not used only for forward validation.
- `STRESS_AI_STOP_GRADIENT`: explicit StopGradient and the `stop-gradient` primitive must block reverse propagation without changing forward Tensor values.
- `STRESS_AI_AUTODIFF_NO_MODEL_OPCODE`: XOR and Majority-3 must train through the same generic graph operations without MLP/task/Transformer backward opcodes.

## Next absorption order

`Optimizer Genome (SGD/Momentum/Adam/AdamW) with rooted optimizer-state checkpoint parity -> Transformer primitives -> first Decoder block -> Tiny LM`.
