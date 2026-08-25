# K08-M BPE Tokenizer Evidence v0.1

Status: `BPE_TOKENIZER_GENOME_CANDIDATE_GITHUB_REPLAY_BOUND`

## Target ruling

Admit a deterministic learned-vocabulary trainer and identity-bearing BPE artifact format on top of the K08-L lossless UTF-8 byte substrate. This candidate deliberately does not admit a production ~64K tokenizer until a real admitted multilingual/code corpus actually trains and freezes one.

## Canonical semantics

- Canonical owner: RCL.
- Algorithm family: byte-BPE.
- Base tokenizer: `rcl.byte-tokenizer.utf8.v0.1`.
- Base vocabulary: 259 ids (bytes plus PAD/BOS/EOS).
- Maximum requested vocabulary size: 65,536.
- Merge selection: highest frequency, then lowest numeric `(left,right)` pair for deterministic ties.
- Merge application: non-overlapping left-to-right.
- Minimum merge frequency: at least 2.
- Byte fallback remains permanent, so unseen valid UTF-8 is always representable.

## Learned artifact

`rcl.bpe-tokenizer-artifact.v0.1` roots:

- source corpus SHA-256,
- corpus byte count,
- target vocabulary size,
- actual vocabulary size,
- minimum frequency,
- ordered merge table,
- algorithm/profile identity.

Artifact identity is SHA-256 over the canonical serialized artifact body. Every load recomputes and verifies the root before encoding or decoding.

## Hosted evidence

Accepted implementation run `32846199977`, source commit `61045dd5548640dfad52d80952ed737ebf159eab`:

- Ubuntu job `97796348277`: 8/8 PASS.
- Windows job `97796348031`: 8/8 PASS.

Coverage proves:

- RCL semantic genome self-host/bootstrap RBC byte parity;
- strict native semantic-state-root verification;
- deterministic trainer replay with byte-identical artifact files;
- deterministic frequency tie-breaking;
- bounded target vocabulary reached on a repeated multilingual/code fixture;
- encoded training-domain text uses fewer tokens than raw byte tokens;
- mixed Chinese/English/Japanese/code text round-trips exactly;
- unseen multilingual/code/emoji text round-trips through byte fallback;
- tampered merge metadata with an unchanged root is rejected;
- invalid target sizes, minimum frequency and invalid UTF-8 corpora fail closed;
- `65536` is an accepted target boundary but does not become an admitted 64K vocabulary unless the corpus actually supports/reaches it.

## Failure / repair ledger

Initial run `32846011891` failed before any semantic test because Rust parsed `merges.len() as u32 < target` as a generic-argument boundary. The repair parenthesized the cast. No algorithm or acceptance threshold changed. The failed run remains part of the evidence history and is not counted as admission.

## Claims granted

- `DETERMINISTIC_BYTE_BPE_TRAINER`
- `ROOTED_LEARNED_VOCABULARY_ARTIFACT`
- `BYTE_FALLBACK_BPE_ENCODING`

## Claims explicitly closed

- `RCL_64K_VOCABULARY`
- production tokenizer quality
- production corpus admission/licensing
- tokenizer quality advantage over external tokenizers
- RoPE
- multi-head/GQA
- multi-block LM scale
- RCL-10M or larger scale
- BF16/GPU/distributed training
- RCL-1B completion
- K400 promotion

## Next absorption

The infrastructure side of tokenization is now sufficient to train a real tokenizer artifact. The next production step is not to fabricate a 64K vocabulary from a toy fixture; it is to define/admit a real multilingual + code tokenizer corpus, train toward the frozen ~64K target, evaluate compression/coverage by language/domain, and freeze that concrete vocabulary root. In parallel, model-side scaling can proceed to RoPE and multi-head/GQA because byte fallback and learned-vocabulary semantics are now available.