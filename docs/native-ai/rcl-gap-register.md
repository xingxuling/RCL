# Native AI RCL Gap Register

No workaround below may be silently counted as RCL-native capability.

| Gap | Missing capability | Current workaround/donor | Type | Generality | Candidate absorption | K400 impact |
|---|---|---|---|---|---|---|
| `RCL_GAP_AI_001` | Canonical Tensor shape/dtype/layout/broadcast/matmul/reduction semantics | Typed Tensor candidate plus scalar reference lowering | Canonical Semantic Gap | cross-model | Locally absorbed in K08-C candidate; promotion and self-host typed lowering remain open | K233 and future GPU/scientific ML cells |
| `RCL_GAP_AI_002` | General computation graph and reverse-mode Autodiff | K08-G RCL Autodiff Genome plus Rust reverse-mode execution organ; JS remains analytic/finite-difference oracle only | Canonical Semantic Gap | cross-model | Absorbed as a GitHub-bound ENGINE-E2 candidate for the recorded primitive set; broader graph corpus and canonical promotion remain open | K233 and future learnable-system cells |
| `RCL_GAP_AI_003` | Tensor-connected execution of RCL-owned Momentum/Adam/AdamW semantics | K08-K lowers generic Tensor parameters + native Autodiff gradients into the K08-H AdamW state/update contract through a Rust execution organ | Backend / Lowering Gap | cross-model | **AdamW absorbed as hosted ENGINE-E3 Tensor bridge candidate** with scalar-reference parity, exact checkpoint/resume and K08-J Tiny-LM training; Momentum/Adam Tensor bridge variants remain optional follow-ons | Tiny/large-model training quality and convergence |
| `RCL_GAP_AI_004` | Native peak RSS telemetry | K08-F adds a Windows child-process `PeakWorkingSet64` evidence organ; portable RSS/VRAM and an in-process telemetry ABI remain absent | Tooling Gap | cross-runtime | locally evidenced for exact Windows child processes; retain gap for portable/device telemetry | PERFORMANCE evidence depth |
| `RCL_GAP_AI_005` | Optimized CPU Tensor kernels | Rust CPU Dense organ plus generic Tensor Plan gives `5.720x` accepted local end-to-end General MLP speedup, but remains `15.863x` slower than the accepted JS oracle boundary | Backend / Performance Gap | cross-model | Partially absorbed; K08-E reclaims dead values and K08-F removes Plan input clones, while JSON/SSA dispatch, buffer reuse and kernel optimization remain | K233 PERFORMANCE competitiveness |
| `RCL_GAP_AI_006` | RCL-owned checkpoint file serialization and atomic persistence | Candidate checkpoint writes decimal display values plus exact f64 Storage bits; `32 == save(16)+reload+16` is bit exact | Backend / Tooling Gap | cross-model | exact-value encoding locally absorbed; atomic persistence and RCL-owned storage profile remain | K233 model lifecycle |
| `RCL_GAP_AI_007` | Independent model generation available without hosted credentials | Ephemeral Codex CLI generator; frozen candidates replay offline | Auxiliary Organ | evidence-only | remain external verification organ | K233 AI_GENERATE |
| `RCL_GAP_AI_008` | Self-host compiler lowering for linked typed Tensor records | JS typed linker emits typed RBC that runs in the native VM | Compiler Gap | cross-domain typed programs | absorb linked type-module parsing/lowering into self-host compiler | Tensor promotion and typed K400 cells |
| `RCL_GAP_AI_009` | General MLP lowering to Tensor backend | JS auxiliary lowerer emits a source/contract-rooted generic Tensor SSA Plan; Rust computes all training values | Lowering Gap | cross-model | Locally absorbed as K08-D candidate; promotion requires GitHub replay and self-hosted/typed lowering ownership | K233 performance |
| `RCL_GAP_AI_010` | Cross-runtime semantic state-root parity for scientific-notation numbers | Integer performance corpus preserves strict root verification; floating probe remains rejected | Evidence Gap | cross-runtime numeric workloads | unify canonical f64 JSON/number encoding in native and verifier | Tensor/scientific K400 evidence |
| `RCL_GAP_AI_011` | Compact self-hosted Tensor execution planning and liveness | K08-E reduces logical live storage to 1,856 bytes; K08-F borrows `54,964` inputs and eliminates `2,516,168` bytes of historical cumulative storage cloning, but the JS organ still emits a 6.11 MB scalar-dispatch JSON Plan | Compiler / IR / Memory Gap | cross-model | liveness and borrowed inputs are tested candidates; next absorb liveness-safe buffer reuse and RCL-owned compact loop/graph lowering | K233 performance and future Transformer scale |
| `RCL_GAP_AI_012` | Self-hosted lowering from RCL model topology to complete Tensor/Autodiff graphs | K08-I/K08-J RCL semantic genomes own decoder/LM topology and invariants while hosted JavaScript evidence organs construct the generic Tensor SSA graphs | Compiler / Lowering Gap | Transformer-family and future graph models | ENGINE-E4 decoder block and ENGINE-E5 Tiny LM are hosted-evidence bound; absorb graph construction into RCL-owned model/lowering infrastructure before canonical promotion | Transformer scale and AI_GENERATE ownership |
| `RCL_GAP_AI_013` | General learned tokenization and vocabulary lifecycle | K08-L now provides a GitHub-bound lossless UTF-8 byte tokenizer (`0..255` + PAD/BOS/EOS), deterministic tokenizer identity, governed u32 token-stream artifacts and source/token SHA-256 provenance | Canonical Semantic / Tooling Gap | language and multimodal sequence models | **Byte substrate absorbed**; next train and freeze a deterministic merge vocabulary with byte fallback, rooted corpus provenance and reproducible encode/decode semantics. BPE/SentencePiece-class vocabulary training and the final ~64K RCL vocabulary remain open | Real-corpus LM cells and RCL-10M gate |
| `RCL_GAP_AI_014` | General positional semantics | K08-J freezes a zero positional reference profile to isolate the LM lifecycle | Canonical Semantic Gap | sequence/attention models | Evaluate learned position, RoPE and other donor strategies; absorb the smallest general position/frame semantics rather than GPT-specific syntax | Context-sensitive LM quality and long-context cells |
| `RCL_GAP_AI_015` | Multi-head and multi-block Transformer composition | K08-I/J prove a one-head, one-block causal decoder path | Model / Lowering Gap | Transformer-family | Generalize head partition/merge and repeated block construction without model-special opcodes | Modern LLM architecture coverage |
| `RCL_GAP_AI_016` | Accelerator and mixed-precision AI execution | Current admitted Tiny LM executes CPU f64 | Backend / Performance Gap | cross-model | Lower canonical Tensor/Autodiff semantics to GPU/NPU and f32/bf16/fp16 organs with bounded numerical parity | Large-model feasibility |

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
- `STRESS_AI_OPTIMIZER_STATE_PARITY`: scalar RCL SGD/Momentum/Adam/AdamW state must agree with an independent oracle and preserve exact checkpoint/reload continuation.
- `STRESS_AI_CAUSAL_MASK`: a decoder block must suppress future-token attention and reject an incompatible mask shape rather than silently broadcasting it.
- `STRESS_AI_TRANSFORMER_GRADIENT`: every admitted Transformer parameter path must receive reverse-mode gradients that agree with finite-difference probes.
- `STRESS_AI_TRANSFORMER_NO_MODEL_OPCODE`: injecting a Transformer-special operation into the Tensor graph must fail closed; the admitted block must use generic Tensor operations only.
- `STRESS_AI_NEXT_TOKEN_CROSS_ENTROPY`: next-token loss must be built from generic Softmax/Log/Mul/Sum/Mean Tensor semantics and differentiate through the full model.
- `STRESS_AI_TINY_LM_TRAINING`: a bounded decoder LM must lower its next-token loss under native training while preserving finite gradients.
- `STRESS_AI_AUTOREGRESSIVE_GENERATION`: trained parameters must be reused in a new forward loop to generate subsequent tokens rather than replaying the target corpus externally.
- `STRESS_AI_LM_DETERMINISM`: the frozen CPU-f64 Tiny LM training profile must reproduce an identical parameter/loss root across independent runs.
- `STRESS_AI_LM_NO_MODEL_OPCODE`: injected GPT/LM-special Tensor operations must fail closed.
- `STRESS_AI_TENSOR_ADAMW_REFERENCE`: Tensor AdamW must reproduce the frozen scalar Optimizer Genome parameter/moment fixture before it can claim semantic continuity.
- `STRESS_AI_TENSOR_ADAMW_RESUME`: uninterrupted Tensor AdamW must equal checkpoint + optimizer-state reload + continuation exactly in the frozen CPU-f64 profile.
- `STRESS_AI_TENSOR_ADAMW_LM`: the admitted Tiny Decoder LM must lower next-token loss, update every trainable Tensor and preserve autoregressive generation under AdamW rather than Batch SGD.
- `STRESS_AI_UTF8_BYTE_IDENTITY`: ASCII, Chinese, Japanese and emoji source bytes must map exactly to the canonical byte-token ids and decode back without hidden normalization.
- `STRESS_AI_TOKENIZER_UNICODE_REALITY`: canonically composed and decomposed Unicode spellings must remain distinct when the tokenizer declares normalization `NONE`.
- `STRESS_AI_TOKEN_STREAM_PROVENANCE`: the same source bytes plus tokenizer identity/options must reproduce identical u32 token bytes, source hash, token-stream hash and receipt root across replays.
- `STRESS_AI_TOKENIZER_FAIL_CLOSED`: invalid UTF-8, out-of-range token ids and unpermitted special-token decoding must be rejected rather than repaired silently.

## Next absorption order

`learned vocabulary/BPE + ~64K tokenizer -> positional genome (RoPE candidate) -> multi-head/GQA -> multi-block parametric LM -> GPU/mixed precision -> DistributedTensor -> RCL-10M -> RCL-100M -> RCL-300M -> RCL-1B`.