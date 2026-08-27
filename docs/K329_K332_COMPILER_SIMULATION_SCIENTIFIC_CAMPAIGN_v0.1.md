# K329/K332 Compiler Simulation + Scientific Campaign v0.1

**Status:** `PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_SIMULATION_SCIENTIFIC_AUTHORITY_BOUND`; K329 and K332 are admitted only for the frozen bounded profile.

## Reality Audit

- Integrated base: `origin/main@359a12c831bb8e3c32853d67163b25c1481da209`.
- Coordinates: `K329 compiler-runtime::simulation` and `K332 compiler-runtime::scientific`.
- Canonical semantic owner: RCL.
- Execution boundary: native `rclc` with the checked-in self-host compiler, then native `rclvm`.
- No auxiliary provider, external solver or model-special opcode participates.

The shared profile is not credited merely as another recursive algorithm. RCL owns a multi-step physical state, its trajectory, constant-acceleration transition law, zero/one-step boundaries, a closed-form position/velocity oracle and the discrete work invariant induced by the update scheme. K329 is bound to state evolution and trajectory evidence; K332 is bound to closed-form and invariant agreement. Both are admitted only through their complete nine-gate receipts and share no authority with adjacent cells.

## Frozen local evidence

The contract was frozen after bootstrap/self-host RBC byte parity and strict native state-root verification established:

- source SHA-256: `70a98620ec97336fa4a80e47d77f061e8e32f421899073cb3ef6cdfa1a19d849`
- RBC SHA-256: `e8aa1d1349db6496cf179b9e48886d2a0603f6484718cddd410aec639dce06c3`
- semantic state root: `7e8b4fa76cb4e420ecc7a81d4f2d1df8671dffca0976b45c2a35f7b6530ce70b`
- final position/velocity: `120 / 23`
- trajectory: `[0,3,8,15,24,35,48,63,80,99,120]`

Formal acquisition passed 20/20 native rounds with one artifact hash and one state root. An independent JavaScript iterative simulation plus closed-form oracle matched the complete frozen state. Five controls passed: position update, velocity sign, closed-form term, zero-step boundary and corrupt RBC. Windows-local p95 was `82.9242 ms` compile, `29.5375 ms` execute and `110.2666 ms` combined against `5000/1000/6000 ms` budgets. Runtime report root: `4a6f45ae3365f61a0f83fa7bf4f790de8258a64918898282c8b9ba9b6cefad9c`.

## Evidence boundary

Local evidence is `CANDIDATE` only. It grants no floating-point solver, arbitrary physics, chaotic-system accuracy, GPU/HPC performance, arbitrary AI generation, unrelated K400 cell or K400 completion. No new dependency or donor code was added, so there is no new license surface and no silent RCL bypass.

## Independent AI repair candidate

Three fresh ephemeral read-only sessions repaired separately mutated state-transition, closed-form and zero-step boundary semantics. Each restored exact canonical bytes and passed native replay:

- `K329-K332-AI-REPAIR-01`: `01a03f37-9e89-7591-aae9-6ace0a4d5fc8`
- `K329-K332-AI-REPAIR-02`: `01a03f3a-f79c-7a93-a0c7-f8f04e65717e`
- `K329-K332-AI-REPAIR-03`: `01a03f3e-1954-74f0-8a99-cc089528fce8`

Aggregate receipt root: `527ab8dd0c452dd98696be85a2a514b3ef77b628cd51e861573d813a43a26bab`. GitHub run `33087711271` then replayed the checked-in receipt on exact source commit `311dcc56d0553a0784a3fe44bdbe3ac05931b961`: focused Linux job `98571828813` and Windows native job `98571829415` both passed their exact K329/K332 steps. The resulting authority root is `3bd66c8f780345d688b381ba7364e6308fb9652f597439a8e9a1004f079d590c`.

The checked-in receipt verifier independently reconstructs all three mutations, applies only each saved edit in a fresh temporary file, reruns native evaluation, validates rooted runtime and generator receipts, and requires three unique session identities. It also tests rooted runtime tampering and exact GitHub focused/Windows step names. With the checked-in authority receipt, the verdict is `PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_SIMULATION_SCIENTIFIC_AUTHORITY_BOUND`.

The conditional K400 builder now admits `compiler-runtime::simulation` and `compiler-runtime::scientific`, with all nine non-compensatory gates PASS only for the frozen bounded profile. The current report remains `INCOMPLETE`, maturity `U3`, with `19 PASS / 381 UNTESTED`; report root `6ae437359107339c1a939cfbe1550689b9b5504449d22f0ce11787b987e292f2`.
