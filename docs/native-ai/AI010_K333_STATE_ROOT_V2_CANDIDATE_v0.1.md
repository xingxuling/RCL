# AI010 / K333 Semantic State-Root v2 Candidate v0.1

**Status:** `CANDIDATE_LOCAL_LINUX_REPLAY`

**Gap:** `RCL_GAP_AI_010` and `RCL_GAP_K333_FLOAT_STATE_ROOT_CANONICALIZATION`

## Closure scope

The v2 candidate now applies the exact IEEE754 binary64 tag representation to
every numeric value emitted by the native semantic serializer, including
numeric values nested in sequences and the numeric fields carried by semantic
Span, parser, symbol, IR, literal and typed-reference structures. The public
native state remains ordinary JSON so callers still receive Numbers rather
than hash-internal tags.

The candidate is selected only by
`RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2-candidate`.
The historical `rcl.semantic-state-root.v1` default and the checked Windows
prebuilt distribution remain unchanged.

## RCL / runtime boundary

RCL owns the versioned canonical representation, negative-zero normalization,
root algorithm selection and verification membrane. The native VM is the
lowering/runtime organ that materializes the same bytes. SHA-256 remains a
runtime primitive; it does not grant authority or promote the candidate.

This candidate does not claim that the RCL surface language accepts scientific
notation literals. The textual f64 primitive corpus covers equivalent decimal
and scientific input spellings; the structured VM test uses a supported
decimal literal and verifies nested state.

## Local evidence

- Candidate native VM tests: **5 passed, 0 failed, 0 skipped** in HermesUbuntu
  with Node 22 and GCC 13.
- Covered the frozen ten-case number corpus, adjacent max-safe integers,
  ordinary verification-membrane admission, nested numeric sequences, and
  unchanged v1 default selection.
- JavaScript syntax check and `git diff --check`: passed.

## Still open

- Windows candidate compiler/build and native parity replay;
- hosted CI authority binding for this new candidate source;
- a canonical v1 to v2 switch and migration of historical roots;
- full structured-value promotion beyond this candidate contract;
- performance evidence for large semantic states.

The result is therefore a stronger RCL-owned candidate closure, not a
canonical algorithm promotion.
