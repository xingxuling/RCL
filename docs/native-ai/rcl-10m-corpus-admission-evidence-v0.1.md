# RCL-10M Corpus Admission Gate Evidence v0.1

## Ruling

`CANDIDATE_SCHEMA_ONLY_BLOCKED_USER_CORPUS`

The tokenizer audit found two usable RCL-owned building blocks: the lossless UTF-8 byte substrate (`K08-L`) and the deterministic byte-BPE trainer/artifact (`K08-M`). It did not find an admitted multilingual/code corpus, a production vocabulary artifact, source-license decisions, privacy review, poisoning review or deterministic real-data shard manifest. No real corpus is fabricated by this gate.

The new RCL-owned admission validator freezes the minimum RCL-10M manifest shape and rejects incomplete or tampered manifests. It is a schema and evidence gate, not a dataset.

## Required manifest

- Exactly `10,000,000` target tokens.
- A rooted tokenizer artifact with explicit byte fallback.
- Chinese, English, Japanese and code mixture entries with integer ppm proportions summing exactly to `1,000,000`.
- Per-source URI, byte hash, byte count and license/privacy/poison review references.
- Rooted filtering and deduplication policies.
- Contiguous deterministic shards bound to the tokenizer root, source IDs, token-stream hashes and shard roots.
- An admission decision that stays blocked until user-owned corpus bytes are independently verified and all reviews pass.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract compile | PASS |
| Complete synthetic manifest shape | PASS, schema only |
| Deterministic manifest root | PASS |
| Pending review blocks admission | fail-closed PASS |
| Missing mixture/provenance/shard bindings | fail-closed PASS |
| Tampered manifest root | fail-closed PASS |
| Local Node evidence | `5/5 PASS` |
| Hosted Ubuntu + Windows schema replay | PASS, run `32995055906`, jobs `98261962473` / `98261962226` |
| Real user corpus bytes | BLOCKED_USER_CORPUS |

The local fixture uses `development://` references and synthetic hashes solely to exercise the validator. Those values are not corpus provenance and grant no training or quality claim. Hosted replay confirms the same schema gate on both platforms; it does not provide corpus bytes or user review decisions.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL genome expresses the admission invariants |
| COMPILE | PASS_LOCAL | genome compiles through the RCL compiler |
| LOWER | CANDIDATE | JavaScript validator is an evidence/tooling organ, not semantic owner |
| EXECUTE | PASS_LOCAL | validator executes on the synthetic manifest fixture |
| CORRECT | PASS_LOCAL | root, mixture and required-field checks pass |
| ROBUST | PASS_LOCAL | admission, tamper and missing-binding negatives fail closed |
| PERFORMANCE | NOT_APPLICABLE | no dataset throughput claim |
| AI_GENERATE | NOT_APPLICABLE | no model generation claim |
| EVIDENCE | CANDIDATE_BLOCKED | real corpus and user review remain absent |

## Gap register

| Gap | Ruling | Required next evidence |
|---|---|---|
| `RCL_GAP_USER_CORPUS_LICENSE_PRIVACY_POISON_REVIEW` | BLOCKED_USER_INPUT | owner supplies admissible source set and review records |
| `RCL_GAP_RCL10M_CORPUS_BYTES_AND_SHARDS` | BLOCKED_USER_INPUT | source bytes, hashes, token streams and deterministic shard roots |
| `RCL_GAP_RCL10M_TOKENIZER_FREEZE` | OPEN | train/evaluate a real approximately 64K artifact and freeze its root |

Claims not granted: production corpus admission, production tokenizer, RCL-10M training/quality, RCL-1B and K400 promotion.

Authority files:

- `src/native-ai-corpus-admission.mjs`
- `examples/native-ai/rcl-10m-corpus-admission-genome.rcl`
- `examples/native-ai/rcl-10m-corpus-admission-contract.v0.1.json`
- `examples/native-ai/evidence/rcl-10m-corpus-admission-v0.1/k08-rcl10m-corpus-admission-local-evidence.json`

Reproduction: `npm run test:rcl-10m-corpus-admission`.
