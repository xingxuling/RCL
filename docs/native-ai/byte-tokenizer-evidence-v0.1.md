# K08-L Byte Tokenizer Evidence v0.1

Status: `BYTE_TOKENIZER_SUBSTRATE_CANDIDATE_GITHUB_REPLAY_BOUND`

## Target ruling

Admit the first governed text-to-token substrate for the RCL-1B campaign. This candidate establishes a deterministic, lossless UTF-8 byte tokenizer and rooted token-stream artifact. It does **not** claim BPE, a trained 64K vocabulary, tokenizer quality, RoPE, RCL-10M, accelerator training, or RCL-1B completion.

## Canonical semantics

- Canonical owner: RCL.
- Tokenizer id: `rcl.byte-tokenizer.utf8.v0.1`.
- Text encoding: UTF-8.
- Unicode normalization: `NONE`; source byte reality is preserved rather than silently normalized.
- Byte token ids: `0..255`.
- Special ids: `PAD=256`, `BOS=257`, `EOS=258`.
- Vocabulary size: `259`.
- Frozen token stream encoding: little-endian u32 (`u32-le`).
- Execution organ: native Rust tokenizer engine.

## Positive / differential evidence

Focused suite validates exact UTF-8 byte identity for ASCII, Chinese, Japanese and emoji. A mixed Chinese/English/Japanese/code sample round-trips losslessly. Composed `é` and decomposed `e + combining acute` remain distinct token realities because normalization is explicitly disabled.

BOS/EOS insertion is explicit. Special-token decoding requires `allowSpecial=true` and cannot silently disappear through a normal decode request.

## Provenance evidence

`encode-file` materializes a binary u32 token stream and receipt containing:

- tokenizer id/root,
- source SHA-256,
- token-stream SHA-256,
- normalization policy,
- stream encoding,
- byte/token counts,
- BOS/EOS policy,
- receipt root.

Two runs over identical source bytes produce identical token bytes and identical receipts.

## Negative / boundary evidence

The candidate fails closed for:

- token ids outside the frozen vocabulary,
- special tokens decoded without explicit permission,
- invalid UTF-8 token byte sequences,
- invalid UTF-8 source files,
- malformed request shapes or unsupported operations.

## Self-host / native evidence

The RCL `byte-tokenizer-genome.rcl` source compiles through the native self-hosted compiler with byte-identical RBC compared with the bootstrap compiler, and the resulting program passes strict native semantic-state-root verification.

## Hosted replay

Implementation replay `32843693302`:

- Ubuntu job `97788554585`: PASS, 9/9.
- Windows job `97788554412`: PASS, 9/9.

Frozen-dependency replay `32843968034` at source commit `01ad5e4629e32293a1db4d5f70c980b268cf6130`:

- Ubuntu job `97789402476`: PASS, 9/9.
- Windows job `97789402174`: PASS, 9/9.

The admitted replay uses the Cargo-generated lockfile frozen in the branch and builds with `--locked`.

## Failure / repair ledger

Two pre-admission failures remain part of the evidence history:

1. `32843356457`: a manually copied Cargo lockfile contained an invalid checksum and was rejected by Cargo. No tokenizer claim was admitted from that run.
2. `32843538671`: after allowing Cargo to resolve the real dependency graph, Rust exposed a type-inference error around `unwrap_or_else(fail)`. The fail path was changed to a generic terminating function; tokenizer semantics were unchanged.

After the code fix, Cargo generated the real lockfile, that exact lock was frozen, `--locked` was restored, and the final Ubuntu/Windows replay passed.

## Claims granted

- `LOSSLESS_UTF8_BYTE_TOKENIZER_SUBSTRATE`
- `GOVERNED_U32_TOKEN_STREAM_ARTIFACT`

## Claims explicitly closed

- BPE / SentencePiece-class learned segmentation
- `RCL_64K_VOCABULARY`
- tokenizer training
- tokenizer compression/efficiency quality
- RoPE
- multi-head/GQA
- RCL-10M or larger scale
- BF16/GPU/distributed training
- RCL-1B completion
- K400 promotion

## Next absorption

Use this 259-token byte vocabulary as the lossless base alphabet for K08-M. Train a deterministic merge vocabulary from rooted multilingual/code corpus artifacts, freeze the vocabulary/merge table as an identity-bearing asset, and preserve byte fallback so every valid UTF-8 source remains representable.