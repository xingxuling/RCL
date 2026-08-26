# K340 Compiler Mixed-Paradigm Campaign v0.1

**Status:** contract frozen; formal runtime acquisition pending.

## Reality Audit

- Base: `origin/main@609fbc57baf7aa7b60eeb8974ba5843dfaec4e10`.
- Coordinate: `K340 compiler-runtime::mixed-paradigm`.
- Canonical semantic owner: RCL.
- Execution boundary: native `rclc` with the checked-in self-host compiler artifact, followed by native `rclvm`.
- No provider or auxiliary language owns the tested computation, authority, transaction or trigger semantics.

K340 cannot be inferred by adding the separate K321 algorithm and K337/K338 governance receipts. The candidate therefore places four paradigms in one RCL program: recursive functional `sum_squares`, declarative warrants/needs, transactional state changes with preserves, and a second rule enabled by the first rule's committed phase and digest.

The pre-contract design probe produced bootstrap/self-host byte parity and the expected final native state (`digest=204`, `phase=2`, `accepted=true`, `emitted=true`) with continuous transaction roots. It is feasibility evidence only and is not entered as a nine-gate receipt.

The frozen formal contract requires 20 rounds, exact state/history/authority/witness checks, performance budgets, corrupt-RBC rejection and four semantic controls covering recursion, phase triggering, missing authority and inactive input. `AI_GENERATE`, hosted Linux/Windows replay and K400 admission remain `UNVERIFIED`.

No new dependency, donor code, provider or runtime opcode is introduced. The candidate reuses general RCL semantics and therefore opens no new `RCL_GAP` at the design gate.
