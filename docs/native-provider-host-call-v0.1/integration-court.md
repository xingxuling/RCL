# Native Provider Host Call Integration Court v0.1

**Decision:** `CANDIDATE_NATIVE_REALIZE_HOST_CALL_SUBSET`

- Founder Twin: rule authority remains ahead of device/provider execution.
- 柳清莲 Gate: requires warrant check, provider call, staged response and receipt continuity.
- 洞哥 Grounding: native executable success and missing-warrant failure are mandatory.
- Engineering: reuses Provider ABI v1 and existing transaction opcodes; no second provider runtime is invented.
- Security: direct ungoverned `provider_call(...)` remains available for low-level code but is not accepted as the Android device contract.
- Test: checks instruction order, native response, authority, witness, request root, denial, literal request shape and simulation rejection.
- Release: candidate only; Provider Runtime v2 parity and canonical promotion remain blocked.
- Compiler court: JavaScript reference lowering is evidenced; the checked-in RCL-owned self-host compiler silently drops the rule call, so self-host parity is `BLOCKED_SEMANTIC_DRIFT`.

No K400 cell is promoted by this repository-local candidate.
