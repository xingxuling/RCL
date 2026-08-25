# K08-L Byte Tokenizer Integration Court v0.1

## Founder Twin target

Close the first text-ingestion substrate required by the RCL-1B campaign without pretending that a 259-token byte alphabet is the final 64K tokenizer.

## 柳清莲 Gate

PASS for bounded candidate admission. The change is additive, has explicit claim boundaries, and does not seize Tensor, Model, Dataset, or Compiler canonical ownership.

## Grounding Court

PASS.

Observed reality:

- UTF-8 bytes map exactly to token ids `0..255`.
- PAD/BOS/EOS are explicit ids `256/257/258`.
- normalization is `NONE`.
- mixed Chinese/English/Japanese/code text round-trips losslessly.
- source and token-stream artifacts receive deterministic hashes.
- the final admitted Cargo dependency graph is frozen and replayed with `--locked`.

No BPE or trained 64K vocabulary claim is admitted.

## Product civilization

PASS / backend-only milestone. Product value is a deterministic raw-text ingestion substrate for subsequent model training. No UI changed.

## UX / design civilization

N/A. No user-facing interaction surface changed.

## Engineering civilization

PASS.

Boundary is clean:

`UTF-8 source bytes -> RCL byte-tokenizer semantics -> native tokenizer organ -> rooted u32 token-stream artifact`.

Byte fallback guarantees representability before a learned merge vocabulary exists.

## Code civilization

PASS after repair.

Initial dependency-lock and Rust fail-path compilation failures were retained as negative evidence. The admitted branch uses the Cargo-generated dependency truth and a generic terminating error function; no semantic shortcut was introduced.

## Test civilization

PASS.

Final locked hosted replay `32843968034`:

- Ubuntu `97789402476`: 9/9 PASS.
- Windows `97789402174`: 9/9 PASS.

Coverage includes positive, Unicode boundary, permission, negative, deterministic identity, artifact provenance, self-host RBC parity and native state-root verification.

## Security civilization

PASS for bounded scope.

- malformed token ids fail closed;
- invalid UTF-8 fails closed;
- special tokens require explicit decode authority;
- tokenizer/stream identity is content-rooted;
- normalization policy is explicit, preventing silent source rewriting.

This is not a corpus licensing/security audit and does not grant dataset admission.

## Release civilization

PASS as candidate-only infrastructure. Rollback is additive: revert K08-L files and the gap-register update. No existing Tensor, Autodiff, Optimizer or Tiny-LM behavior is replaced.

## Evidence Ledger verdict

`ADMIT_BYTE_TOKENIZER_SUBSTRATE_CANDIDATE_GITHUB_REPLAY_BOUND`

Next court target: deterministic learned vocabulary / BPE Genome with byte fallback and rooted training-corpus provenance.