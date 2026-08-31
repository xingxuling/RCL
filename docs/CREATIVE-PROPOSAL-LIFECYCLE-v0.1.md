# RCL Creative Proposal Lifecycle v0.1

Status: `CANDIDATE_SEMANTIC_CLOSURE / NOT_CANONICAL_PROMOTION`

## Problem

RCL already owns `Create<T>` / Creative Reality, but the current `creationCandidate(...)` constructor scores novelty, utility, feasibility and risk immediately. External candidate generators such as SGA deliberately do not own those judgments.

Calling `creationCandidate(...)` with default scores would therefore fabricate evaluator output and create a silent semantic bypass.

Candidate gap:

`RCL_GAP_UNSCORED_EXTERNAL_CREATION_PROPOSAL`

## Proposed lifecycle

```text
external candidate value
→ CreationProposal<T>
→ independent evaluator supplies novelty/utility/feasibility/risk
→ scoreCreation(...)
→ Create<T> candidate
→ selectCreation(...)
```

### CreationProposal<T>

Carries:

- base type + candidate value
- target
- evidence
- donor provenance / basedOn roots
- formedAtRoot
- `status = proposal`
- no score and no aesthetic/scientific/future judgment

### scoreCreation(...)

The scoring step is explicit. It converts a proposal into the existing scored `Creation` candidate shape and applies the existing weighted score formula. The evaluator, not the donor, supplies the four score dimensions.

### selectCreation(...)

Selection continues to accept only scored Creation candidates. An unscored proposal is not confidence-bearing and cannot be selected.

## Ownership

- RCL owns proposal/scored/selected Creative Reality semantics.
- Candidate generators own candidate value generation only.
- Evaluator organs own their declared judgments only.
- USCE owns final route choice.
- RNCS owns reality-state execution/commit.

## Non-goals

This does not prove imagination quality, aesthetics, scientific truth, or future success. It only closes the semantic seam needed to ingest external candidate values without inventing scores.
