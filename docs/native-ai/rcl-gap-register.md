# Native AI RCL Gap Register

No workaround below may be silently counted as RCL-native capability.

| Gap | Missing capability | Current workaround/donor | Type | Generality | Candidate absorption | K400 impact |
|---|---|---|---|---|---|---|
| `RCL_GAP_AI_001` | Canonical Tensor shape/dtype/layout/broadcast/matmul/reduction semantics | Typed Tensor candidate plus scalar reference lowering | Canonical Semantic Gap | cross-model | Locally absorbed in K08-C candidate; promotion and self-host typed lowering remain open | K233 and future GPU/scientific ML cells |
| `RCL_GAP_AI_002` | General computation graph and reverse-mode Autodiff | K08-G RCL Autodiff Genome plus Rust reverse-mode execution organ; JS remains analytic/finite-difference oracle only | Canonical Semantic Gap | cross-model | Absorbed as a GitHub-bound ENGINE-E2 candidate for the recorded primitive set; broader graph corpus and canonical promotion remain open | K233 and future learnable-system cells |
| `RCL_GAP_AI_003` | Tensor-connected execution of RCL-owned Momentum/Adam/AdamW semantics | K08-K lowers generic Tensor parameters + native Autodiff gradients into the K08-H AdamW state/update contract through a Rust execution organ | Backend / Lowering Gap | cross-model | **AdamW absorbed as hosted ENGINE-E3 Tensor bridge candidate** with scalar-reference parity, exact checkpoint/resume and K08-J Tiny-LM training; multi-block AdamW replay remains to bind before the first RCL-10M training run | Tiny/large-model training quality and convergence |
| `RCL_GAP_AI_004` | Native peak RSS telemetry | K08-F adds a Windows child-process `PeakWorkingSet64` evidence organ; portable RSS/VRAM and an in-process telemetry ABI remain absent | Tooling Gap | cross-runtime | locally evidenced for exact Windows child processes; retain gap for portable/device telemetry | PERFORMANCE evidence depth |
| `RCL_GAP_AI_005` | Optimized CPU Tensor kernels | Rust CPU Dense organ plus generic Tensor Plan gives `5.720x` accepted local end-to-end General MLP speedup, but remains `15.863x` slower than the accepted JS oracle boundary | Backend / Performance Gap | cross-model | Partially absorbed; K08-E reclaims dead values and K08-F removes Plan input clones, while JSON/SSA dispatch, buffer reuse and kernel optimization remain | K233 PERFORMANCE competitiveness |
| `RCL_GAP_AI_006` | RCL-owned checkpoint file serialization and atomic persistence | Candidate checkpoint writes decimal display values plus exact f64 Storage bits; `32 == save(16)+reload+16` is bit exact | Backend / Tooling Gap | cross-model | exact-value encoding locally absorbed; atomic persistence and RCL-owned storage profile remain | K233 model lifecycle |
| `RCL_GAP_AI_007` | Independent model generation available without hosted credentials | Ephemeral Codex CLI generator; frozen candidates replay offline | Auxiliary Organ | evidence-only | remain external verification organ | K233 AI_GENERATE |
| `RCL_GAP_AI_008` | Self-host compiler lowering for linked typed Tensor records | JS typed linker emits typed RBC that runs in the native VM | Compiler Gap | cross-domain typed programs | absorb linked type-module parsing/lowering into self-host compiler | Tensor promotion and typed K400 cells |
| `RCL_GAP_AI_009` | General MLP lowering to Tensor backend | JS auxiliary lowerer emits a source/contract-rooted generic Tensor SSA Plan; Rust computes all training values | Lowering Gap | cross-model | Locally absorbed as K08-D candidate; promotion requires GitHub replay and self-hosted/typed lowering ownership | K233 performance |
| `RCL_GAP_AI_010` | Cross-runtime semantic state-root parity for scientific-notation numbers | Integer performance corpus preserves strict root verification; floating probe remains rejected | Evidence Gap | cross-runtime numeric workloads | unify canonical f64 JSON/number encoding in native and verifier | Tensor/scientific K400 evidence |
| `RCL_GAP_AI_011` | Compact self-hosted Tensor execution planning and liveness | K08-E reduces logical live storage to 1,856 bytes; K08-F borrows `54,964` inputs and eliminates `2,516,168` bytes of historical cumulative storage cloning, but the JS organ still emits a 6.11 MB scalar-dispatch JSON Plan | Compiler / IR / Memory Gap | cross-model | liveness and borrowed inputs are tested candidates; next absorb liveness-safe buffer reuse and RCL-owned compact loop/graph lowering | K233 performance and future Transformer scale |
| `RCL_GAP_AI_012` | Self-hosted lowering from RCL model topology to complete Tensor/Autodiff graphs | K08-I through K08-P RCL semantic genomes own decoder/LM/GQA/RoPE/multi-block topology and invariants while hosted JavaScript evidence organs still construct complete generic Tensor SSA graphs | Compiler / Lowering Gap | Transformer-family and future graph models | ENGINE-E4/E5 and K08-O/P hosted candidates establish bounded semantics; absorb graph construction into RCL-owned model/lowering infrastructure before canonical promotion and large-scale compilation | Transformer scale and AI_GENERATE ownership |
| `RCL_GAP_AI_013` | Production learned tokenization and final ~64K vocabulary lifecycle | K08-L supplies the lossless byte substrate; K08-M supplies a GitHub-bound deterministic byte-BPE trainer, rooted learned-vocabulary artifact, canonical tie-break/merge rules and permanent byte fallback | Canonical Semantic / Tooling / Data Gap | language and multimodal sequence models | **Trainer + artifact semantics absorbed.** Remaining work is corpus admission and actual production vocabulary training/evaluation: multilingual+code source provenance, licensing/privacy/poison review, target ~64K completion, per-domain compression/coverage evidence and frozen production vocabulary root | Real-corpus LM cells and RCL-10M gate |
| `RCL_GAP_AI_014` | Production-scale positional semantics integration | K08-N owns pairwise RoPE semantics/rooted position frames; K08-O applies those frames independently inside every Q/K head; K08-P composes them through repeated decoder blocks | Canonical Semantic / Model Integration Gap | sequence/attention models | **Bounded per-head and multi-block RoPE integration absorbed as hosted candidate.** Remaining work is long-context scale evidence, BF16/GPU numerical envelopes, cached decoding position offsets and final RCL-1B configuration binding | Context-sensitive LM quality and long-context cells |
| `RCL_GAP_AI_015` | Production-scale multi-block training and packed/fused attention representation | K08-P provides GitHub-bound parametric ordered 1/2-block decoder-LM composition over K08-O GQA + K08-N RoPE with cross-block Reverse Autodiff and independent forward/finite-difference evidence | Model / Lowering / Training / Performance Gap | Transformer-family | **Multi-head/GQA + bounded multi-block forward/loss/autodiff semantics absorbed.** Remaining work is Tensor AdamW replay across multiple blocks, activation/checkpoint memory strategy, and packed/fused head/block execution that differentially matches canonical selector/embedder composition | Modern LLM architecture coverage and scale |
| `RCL_GAP_AI_016` | Accelerator and mixed-precision AI execution | Bounded AMD OpenCL BF16 matmul lowerer is now bound into explicit RCL BF16 Autodiff + AdamW hybrid graphs, including an ordered two-matmul chain; non-matmul nodes remain explicitly RCL CPU reference | Backend / Performance Gap | cross-model | Partially reduced by real local AMD execution, exact CPU loss/parameter/state/checkpoint differential and fail-closed placement/provider boundaries for one and two ordered matmul nodes. Full-graph GPU, GPU backward/optimizer kernels, multi-block GQA/RoPE GPU, throughput and generic GPU portability remain open | Large-model feasibility |

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
- `STRESS_AI_BPE_DETERMINISM`: identical corpus bytes and config must generate a byte-identical ordered merge artifact and identical artifact root.
- `STRESS_AI_BPE_TIE_BREAK`: equal-frequency pairs must resolve by the frozen lowest numeric `(left,right)` ordering rather than map/runtime iteration order.
- `STRESS_AI_BPE_BYTE_FALLBACK`: text unseen during tokenizer training must remain losslessly representable through the original byte vocabulary.
- `STRESS_AI_BPE_ARTIFACT_TAMPER`: any merge/config/provenance change without recomputing identity must be rejected on artifact load.
- `STRESS_AI_BPE_64K_HONESTY`: requesting target `65536` must not grant `RCL_64K_VOCABULARY` unless actual vocabulary size reaches the target on an admitted production corpus.
- `STRESS_AI_ROPE_POSITION_ZERO`: position zero must be exact identity and must not perturb Q/K values.
- `STRESS_AI_ROPE_NORM`: each adjacent even/odd pair must preserve squared norm under rotation within the frozen numerical envelope.
- `STRESS_AI_ROPE_GRADIENT`: reverse-mode gradient through generic RoPE lowering must agree with finite difference without a RoPE-specific backward rule.
- `STRESS_AI_ROPE_FRAME_BOUNDARY`: odd head dimensions, invalid base, zero sequence and out-of-range position frames must fail closed.
- `STRESS_AI_ROPE_NO_SPECIAL_OPCODE`: injecting `rope-special` must be rejected; admitted RoPE execution uses generic Tensor primitives only.
- `STRESS_AI_GQA_KV_SHARING`: multiple query heads assigned to one KV group must consume the same K/V path while retaining independent Q projections and attention distributions.
- `STRESS_AI_GQA_GRADIENT`: all admitted Q/K/V/O projection paths must receive finite reverse-mode gradients and selected entries must agree with central finite difference.
- `STRESS_AI_GQA_GEOMETRY`: MHA, GQA and the frozen RCL-1B `16Q/4KV/128D/2048H` geometry must validate while non-divisible head counts, width mismatch and odd head dimensions fail closed.
- `STRESS_AI_GQA_NO_SPECIAL_OPCODE`: injected `gqa-special` / model-special operations must be rejected; canonical GQA uses generic Tensor primitives only.
- `STRESS_AI_MULTIBLOCK_ORDER`: swapping otherwise valid block parameter sets must alter the multi-block result, proving ordered composition is not commutative bookkeeping.
- `STRESS_AI_MULTIBLOCK_CROSS_GRADIENT`: a first-block parameter gradient in a two-block loss graph must traverse the second block and agree with finite difference; later blocks must observably alter earlier-block gradients.
- `STRESS_AI_MULTIBLOCK_PARAMETER_IDENTITY`: block-index-scoped parameter identities must be unique and invalid/duplicate identities must fail closed before formal execution.
- `STRESS_AI_MULTIBLOCK_NO_SPECIAL_OPCODE`: repeated decoder construction must remain generic Tensor/Autodiff; injected `multiblock-special` must be rejected.
- `STRESS_AI_EXPLICIT_ACCELERATOR_PLACEMENT`: a hybrid graph must declare every node placement; matmul must be GPU and non-matmul host reference, with no implicit CPU fallback.
- `STRESS_AI_GPU_CPU_TRAINING_DIFFERENTIAL`: an explicitly hybrid BF16 Autodiff + AdamW run must preserve CPU-reference loss, parameters, optimizer states and checkpoint root for the admitted matmul profile.
- `STRESS_AI_GPU_MULTI_BLOCK_ORDERED_CHAIN`: an explicitly hybrid BF16 Autodiff + AdamW graph must execute two ordered GPU matmul blocks, retain explicit host placement for every other node and preserve canonical parameter order.
- `STRESS_AI_GPU_MULTI_BLOCK_CHECKPOINT_DIFFERENTIAL`: the ordered multi-matmul hybrid must preserve CPU-reference parameters, optimizer states and checkpoint root across direct replay and checkpoint resume.

## Next absorption order

`GPU/mixed precision -> ordered multi-block GPU coverage -> GQA/RoPE GPU coverage + GPU-native backward/optimizer kernels -> production multilingual/code corpus + actual ~64K vocabulary artifact -> RCL-10M -> DistributedTensor -> RCL-100M -> RCL-300M -> RCL-1B`.
