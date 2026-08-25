# Native Single-Snapshot RBC Load Integration Court v0.1

**Decision:** `CANDIDATE_SINGLE_SNAPSHOT_NATIVE_LOAD`

- Founder Twin: RCL owns bytecode admission and must bind validation to the bytes actually executed.
- 柳清莲 Gate: an accepted snapshot cannot be silently replaced by a second read; invalid bytes remain fail-closed.
- 洞哥 Grounding: the trigger is a real 24/25 Android final-gate result followed by clean reruns, not a fabricated deterministic failure claim.
- Product: no retry loop is added to Aether and the product remains blocked until it passes with the upstream candidate.
- Engineering: one bounded file snapshot feeds both validation and construction; public ABI and RBC format stay unchanged.
- Test: an intercepted-open native harness presents a valid first file and a truncated hypothetical second file, then requires exactly one open.
- Security: removing the validation/use gap reduces path-replacement exposure; this is not a complete hostile-filesystem security proof.
- Performance: one file read replaces two, while peak transient memory includes the bounded snapshot; no performance gate is claimed.
- Release: promotion requires full local regression, hosted required checks and downstream Android replay.

No RCL Core semantic or K400 promotion is granted by this candidate.

