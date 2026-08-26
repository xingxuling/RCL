# K340 Compiler Mixed-Paradigm Campaign v0.1

**Status:** local runtime and independently replayed AI candidate; GitHub-hosted authority and K400 admission remain `UNVERIFIED`.

## Reality Audit

- Base: `origin/main@4c7b3f9c1c90da710903487df8d1e766a8b0afc1`.
- Coordinate: `K340 compiler-runtime::mixed-paradigm`.
- Canonical semantic owner: RCL.
- Execution boundary: native `rclc` with the checked-in self-host compiler artifact, followed by native `rclvm`.
- No provider or auxiliary language owns the tested computation, authority, transaction or trigger semantics.

K340 cannot be inferred by adding the separate K321 algorithm and K337/K338 governance receipts. The candidate therefore places four paradigms in one RCL program: recursive functional `sum_squares`, declarative warrants/needs, transactional state changes with preserves, and a second rule enabled by the first rule's committed phase and digest.

The pre-contract design probe produced bootstrap/self-host byte parity and the expected final native state (`digest=204`, `phase=2`, `accepted=true`, `emitted=true`) with continuous transaction roots. It is feasibility evidence only and is not entered as a nine-gate receipt.

The frozen formal contract requires 20 rounds, exact state/history/authority/witness checks, performance budgets, corrupt-RBC rejection and four semantic controls covering recursion, phase triggering, missing authority and inactive input. `AI_GENERATE`, hosted Linux/Windows replay and K400 admission remain `UNVERIFIED`.

Formal acquisition passed 20/20 native rounds with one RBC artifact hash and one final semantic state root. All five controls passed: recursive-term corruption and broken authority were rejected, a wrong reactive phase committed only the first transaction, zero input committed nothing, and corrupt RBC was rejected. Windows-local p95 was `63.6461 ms` compile, `49.6164 ms` execute and `110.2470 ms` combined against frozen `5000/1000/6000 ms` budgets. Runtime receipt root: `6a41466ff811dc047d771fc6c84762ec52fe8be91dd1ffa1b1dff66ef1be049a`.

The missing-warrant control again exposes `RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION`: the self-host compiler emits the negative artifact, but native `rclvm` rejects it with `RCL_AUTHORITY_DENIED` before commit. This is recorded as a compiler validation gap rather than misreported as compile-time rejection.

The frozen AI contract acquired three successful independent ephemeral read-only repairs spanning recursive computation, phase triggering and declarative authority. All three restored exact canonical bytes and passed native replay in unique sessions `01a03ef6-f5a9-7d03-98be-b5cfe5558098`, `01a03efc-3666-7051-b285-1f61a08a9112` and `01a03f01-37c0-7da3-bd8c-2d5d3c52065b`. Aggregate receipt root: `3e0258d10b0040bbb73cc93d9df5251565c5e1ff0fbf75b77ea108dead9313cc`.

The independent receipt verifier reconstructed every frozen mutation, applied only the saved schema edit in a fresh temporary file, reran native evaluation, checked the three unique generator sessions, rebound the 20-round runtime receipt and passed three receipt tests plus the three base tests. It fails closed on rooted runtime tampering. The result is `PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED`: local admission is true, but `AI_GENERATE` remains `UNVERIFIED` until the exact focused Linux step and Windows native step succeed in the push workflow and their run identity is bound in `github-replay.json`.

The K400 builder is candidate-aware: it records the local runtime and AI receipts as sources but creates no K340 claim without the hosted authority receipt. The current report remains `INCOMPLETE`, maturity `U3`, with `11 PASS / 389 UNTESTED`; report root `a7a14db232825ded6d48d79bb3746f01c15a038f22d905ee46996b10f50ff40d`.

No new dependency, donor code, provider or runtime opcode is introduced. The candidate reuses general RCL semantics and therefore opens no new `RCL_GAP` at the design gate.
