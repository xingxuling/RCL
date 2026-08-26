# K340 Compiler Mixed-Paradigm Campaign v0.1

**Status:** local runtime candidate; `AI_GENERATE` and GitHub-hosted replay remain `UNVERIFIED`.

## Reality Audit

- Base: `origin/main@609fbc57baf7aa7b60eeb8974ba5843dfaec4e10`.
- Coordinate: `K340 compiler-runtime::mixed-paradigm`.
- Canonical semantic owner: RCL.
- Execution boundary: native `rclc` with the checked-in self-host compiler artifact, followed by native `rclvm`.
- No provider or auxiliary language owns the tested computation, authority, transaction or trigger semantics.

K340 cannot be inferred by adding the separate K321 algorithm and K337/K338 governance receipts. The candidate therefore places four paradigms in one RCL program: recursive functional `sum_squares`, declarative warrants/needs, transactional state changes with preserves, and a second rule enabled by the first rule's committed phase and digest.

The pre-contract design probe produced bootstrap/self-host byte parity and the expected final native state (`digest=204`, `phase=2`, `accepted=true`, `emitted=true`) with continuous transaction roots. It is feasibility evidence only and is not entered as a nine-gate receipt.

The frozen formal contract requires 20 rounds, exact state/history/authority/witness checks, performance budgets, corrupt-RBC rejection and four semantic controls covering recursion, phase triggering, missing authority and inactive input. `AI_GENERATE`, hosted Linux/Windows replay and K400 admission remain `UNVERIFIED`.

Formal acquisition passed 20/20 native rounds with one RBC artifact hash and one final semantic state root. All five controls passed: recursive-term corruption and broken authority were rejected, a wrong reactive phase committed only the first transaction, zero input committed nothing, and corrupt RBC was rejected. Windows-local p95 was `63.6461 ms` compile, `49.6164 ms` execute and `110.2470 ms` combined against frozen `5000/1000/6000 ms` budgets. Runtime receipt root: `6a41466ff811dc047d771fc6c84762ec52fe8be91dd1ffa1b1dff66ef1be049a`.

The missing-warrant control again exposes `RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION`: the self-host compiler emits the negative artifact, but native `rclvm` rejects it with `RCL_AUTHORITY_DENIED` before commit. This is recorded as a compiler validation gap rather than misreported as compile-time rejection.

No new dependency, donor code, provider or runtime opcode is introduced. The candidate reuses general RCL semantics and therefore opens no new `RCL_GAP` at the design gate.
