# K08-M BPE Tokenizer Integration Court v0.1

## Founder Twin target

Advance the RCL-1B tokenizer gate from lossless byte ingestion to a reproducible learned vocabulary without falsely relabeling a toy vocabulary as the final 64K production tokenizer.

## 柳清莲 Gate

PASS for bounded candidate admission. Canonical tokenizer semantics remain RCL-owned; Rust is an execution organ. Claims are explicitly bounded.

## Grounding Court

PASS.

Observed hosted reality:

- same corpus/config -> byte-identical artifact;
- deterministic pair tie-break;
- training fixture reaches requested bounded vocabulary;
- training-domain token count falls below raw byte-token count;
- unseen text remains exactly representable through byte fallback;
- artifact-root tampering fails closed;
- the 65,536 target can be requested but remains incomplete on insufficient corpus and is reported as such.

No production tokenizer quality or real 64K vocabulary is claimed.

## Product civilization

PASS / infrastructure milestone. This produces a reusable model asset rather than a transient preprocessing script: corpus provenance, ordered merges and vocabulary identity travel together.

## UX / design civilization

N/A. No user-facing surface changed.

## Engineering civilization

PASS.

Execution boundary:

`admitted UTF-8 corpus bytes -> RCL BPE semantics -> deterministic native trainer -> rooted vocabulary artifact -> encode/decode with byte fallback`.

The base-byte vocabulary is never discarded.

## Code civilization

PASS after one compile repair. Initial Rust cast/comparison parsing failure is preserved in the failure ledger; the accepted repair adds parentheses only and changes no tokenizer semantics.

## Test civilization

PASS.

Accepted run `32846199977`:

- Ubuntu `97796348277`: 8/8 PASS.
- Windows `97796348031`: 8/8 PASS.

Tests cover self-hosting, deterministic replay, deterministic tie-break, compression, multilingual/code roundtrip, unseen-text fallback, artifact tamper rejection, invalid boundaries and honest 64K-target exhaustion.

## Security civilization

PASS for bounded artifact integrity:

- artifact roots are verified on every load;
- forward/invalid merge references are rejected;
- unknown token ids fail closed;
- invalid UTF-8 training corpus fails closed;
- byte fallback does not silently normalize input.

Corpus licensing, privacy and poisoning review remain a separate production-corpus admission problem.

## Release civilization

PASS as candidate-only infrastructure. Rollback is additive: revert K08-M source/contract/trainer/test/evidence files and Gap Register changes. K08-L byte tokenizer remains intact.

## Evidence Ledger verdict

`ADMIT_BPE_TOKENIZER_GENOME_CANDIDATE_GITHUB_REPLAY_BOUND`

## Next court target

Two independent gates now follow:

1. **Production tokenizer artifact**: admitted multilingual/code corpus -> actual ~64K vocabulary -> coverage/compression evaluation -> frozen root.
2. **Model positional semantics**: RoPE Genome -> differential/autodiff evidence -> decoder integration.
