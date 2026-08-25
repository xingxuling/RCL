# RCL-1B Campaign v0.1

Status: `NORTH_STAR_FROZEN`

## Objective

Train and release the first approximately 1.2B-parameter decoder language model whose architecture, training semantics, checkpoints, evidence lineage and inference lifecycle are owned by RCL.

This is not a fine-tune of an existing model. The target path is:

`random initialization -> RCL tokenizer artifact -> governed corpus -> RCL model definition -> RCL Tensor/Autodiff/Optimizer semantics -> accelerated training -> checkpoint lineage -> evaluation -> RCL inference -> autoregressive generation`.

## Target model profile

- Working name: `RCL-1B v1`
- Architecture: decoder-only Transformer
- Parameters: approximately `1.2B`
- Layers: `24`
- Hidden size: `2048`
- Attention heads: `16`
- KV heads: `4`
- FFN: SwiGLU-class candidate, subject to RCL semantic admission
- Normalization: RMSNorm
- Position: RoPE candidate
- Context: `8192`
- Vocabulary: approximately `64K`
- Training precision: BF16 target
- Optimizer: AdamW
- Primary corpus mixture: Chinese + English + Japanese + code

The exact parameter count may move within a bounded engineering envelope if vocabulary or tied-weight decisions change, but the milestone must remain a genuine ~1B-class model.

## Mandatory scale ladder

The following are engineering gates, not substitute milestones:

1. `RCL-10M` — tokenizer/RoPE/multi-head/multi-block/Tensor-AdamW correctness rehearsal.
2. `RCL-100M` — GPU/BF16/checkpoint/dataset pipeline and sustained training rehearsal.
3. `RCL-300M` — end-to-end scale rehearsal, memory planning, throughput and resume evidence.
4. `RCL-1B` — final first-generation model.

Passing an earlier rung does not close the campaign.

## Current starting point

The campaign begins after K08-J / ENGINE-E5, where the repository already has a bounded decoder LM lifecycle with token IDs, embedding, one decoder block, next-token cross-entropy, native reverse-mode Autodiff, Batch SGD and autoregressive generation.

The 1B campaign must replace the bounded reference shortcuts rather than relabel them as scale-ready capability.

## Hard gates before RCL-10M

### G1 — General tokenizer artifact

Minimum path:

`byte tokenizer -> governed vocabulary artifact -> optional BPE/SentencePiece-class donor evaluation`.

Tokenizer identity, version, training corpus provenance and encode/decode determinism must be rooted.

### G2 — Positional genome

Admit general positional semantics. RoPE is the leading candidate, but RCL must own the semantic contract rather than a GPT-specific surface syntax.

### G3 — Multi-head / GQA composition

Generalize the current single-head path to head partition/merge and grouped-query attention without model-special Tensor or VM operations.

### G4 — Multi-block model construction

The same RCL model definition must instantiate variable layer count, hidden size, head count, FFN width, context and vocabulary dimensions.

### G5 — Tensor-connected AdamW

The existing ENGINE-E3 Optimizer Genome must be lowered onto Tensor parameter/gradient/state tuples. Checkpoint/reload must preserve model and optimizer state.

### G6 — Accelerator backend

At least one real accelerator path must execute canonical Tensor/Autodiff semantics with bounded numerical parity. Preferred order is environment-driven: CUDA first when available, otherwise the most mature practical backend.

### G7 — Mixed precision

BF16 is the training target. f32/f64 remain reference profiles. Loss scaling or other stability policy must be explicit if required.

### G8 — Dataset pipeline

Corpus ingestion must preserve source provenance, language/domain mixture accounting, filtering decisions, deduplication identity and deterministic shard manifests.

### G9 — Checkpoint lineage

Every checkpoint must bind model config, tokenizer identity, optimizer state, step, data cursor/shard identity, RNG state and parent checkpoint root.

### G10 — Evaluation baseline

Before scale promotion, freeze a reproducible evaluation suite covering at least perplexity/loss, Chinese, English, Japanese and code behavior, plus memorization/leakage checks appropriate to the admitted corpus.

## RCL-specific advantage requirement

RCL-1B is not successful merely because it reproduces a conventional Transformer training script.

The final release must demonstrate at least these RCL-native properties:

- model architecture is a canonical semantic object rather than an opaque framework class;
- training actions produce evidence-bearing state transitions;
- checkpoint lineage is rooted and replayable;
- accelerator backends may change without changing canonical model meaning;
- invalid shape/authority/state transitions fail closed;
- external execution organs are explicit and cannot silently become semantic owners;
- all persistent donor advantages are recorded as `UNABSORBED_ADVANTAGE` or `RCL_GAP` rather than hidden.

## Anti-cheating rules

Do not count any of the following as RCL-1B completion:

- fine-tuning an existing third-party checkpoint;
- invoking PyTorch/JAX as the hidden semantic owner of model or optimizer behavior;
- using a model-special `gpt`, `transformer`, `attention`, `llm` VM opcode as a substitute for general Tensor/model semantics;
- generating text from an external model while presenting it as RCL inference;
- skipping checkpoint/evidence provenance;
- calling a 10M/100M/300M rehearsal the final milestone.

Mature numerical kernels, collectives and device runtimes may remain specialist execution organs when their semantic boundary is explicit and differential parity is maintained.

## Final acceptance

`RCL_1B_V1_RELEASE_CANDIDATE` requires all of the following:

- approximately 1B-class randomly initialized model trained by this campaign;
- real multilingual/code corpus, with provenance and shard manifests;
- RCL-owned tokenizer/model/training/checkpoint semantics;
- multi-layer decoder Transformer training on accelerator hardware;
- AdamW training with restart/resume evidence;
- 8K-context inference path;
- final weights, tokenizer, config, dataset provenance summary, checkpoint lineage, training receipts, evaluation report and inference runner;
- reproducible generation from the released checkpoint;
- no claim of general intelligence or competitive frontier quality unless separately evidenced.

## Immediate execution order

`Tensor AdamW bridge -> byte/general tokenizer -> positional genome -> multi-head/GQA -> multi-block parametric model -> accelerator + BF16 -> RCL-10M -> RCL-100M -> RCL-300M -> RCL-1B`.

The campaign remains open until the 1B-class release candidate exists or an explicit evidence-backed blocker is recorded.
