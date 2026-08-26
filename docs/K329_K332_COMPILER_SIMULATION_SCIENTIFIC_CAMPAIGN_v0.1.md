# K329/K332 Compiler Simulation + Scientific Campaign v0.1

**Status:** local runtime and 3/3 independent AI repair candidate; hosted Linux/Windows replay and K400 admission remain `UNVERIFIED`.

## Reality Audit

- Base: `origin/main@e6833a32f55f1989b004ba8fe00180adf9e62d35`.
- Coordinates: `K329 compiler-runtime::simulation` and `K332 compiler-runtime::scientific`.
- Canonical semantic owner: RCL.
- Execution boundary: native `rclc` with the checked-in self-host compiler, then native `rclvm`.
- No auxiliary provider, external solver or model-special opcode participates.

The shared profile is not credited merely as another recursive algorithm. RCL owns a multi-step physical state, its trajectory, constant-acceleration transition law, zero/one-step boundaries, a closed-form position/velocity oracle and the discrete work invariant induced by the update scheme. K329 is bound to state evolution and trajectory evidence; K332 is bound to closed-form and invariant agreement. Both still require their own complete nine-gate receipt before admission.

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

Aggregate receipt root: `527ab8dd0c452dd98696be85a2a514b3ef77b628cd51e861573d813a43a26bab`. This is local `CANDIDATE` evidence only; checked-in independent receipt replay and GitHub Linux/Windows authority remain mandatory before either K329 or K332 can enter K400.
