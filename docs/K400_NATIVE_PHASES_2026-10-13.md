# Native RCL phase controllers: 166-cell checkpoint

Verified checkpoint: **166 PASS / 234 UNTESTED**, verdict INCOMPLETE, maturity U3. This campaign adds **24 distinct coordinates** to the prior 142. Consolidated checkpoint root: `b5cc016ddd32110a316b69a6b0f3eea6f6a852f167ed3d52b2f71a7e315ffa87`. Package/native identity remains 2.0.0 with version advancement frozen.

## Actual execution

`createPhaseContextTarget` compiles and executes two source-bound native RCL session controllers around the existing native compiler/VM kernel:

- `simulation-runtime`: the RCL clock projects and commits a monotonically increasing logical frame bound to the kernel program root. A failed kernel leaves the clock unchanged. Backward time and disabled dispatch are rejected by the controller.
- `automation-runtime`: RCL admission and completion rules bind each local kernel job to its program root. The ledger balances admitted jobs against completed and failed jobs, with no active job left after a failure. Paused dispatch is rejected by source-declared authority.

The controllers are `examples/runtime-hosts/simulation-clock.rcl` and `automation-gate.rcl`. Compilation reuses the RCL session compiler with its declared JavaScript compiler bootstrap and native target-byte parity. The kernel independently uses the RCL-owned C2 compiler artifact and native VM. This is bounded logical simulation and local automation; it grants no physical time/world, external tool effects, canonical RNCS ownership, whole-runtime self-hosting or OS sandbox claim.

Every controller call, including failures, records its command, result or error, and before/after snapshot. Admission replays this complete ledger with the independent reference session. It checks actors, authority, changes, typed semantic roots, clock projection/commit agreement, kernel source binding and pause/denial/resume controls. Rehashing a manipulated receipt does not bypass these checks.

## Frozen campaign and independent generation

Nine profiles cover learning, agent deliberation, workflow, logical events, governance/reactive, mixed paradigms, relations, simulation/scientific checks and algorithms/CLI. Their twelve family coordinates across the two new hosts add 24 unique cells. Contracts, ten oracle cases per profile, controller/compiler source hashes and three mutations were frozen before three fresh proposal-only contexts.

Each profile executes twenty actual rounds per host, ten sealed inputs, three effective semantic mutations and three unchanged independent repairs. Noncanonical repair spellings additionally replay every sealed case on each target; this proves agreement over the frozen input domain, not unrestricted semantic equivalence. The frozen p95 budgets are 5,000 ms compilation and 2,000 ms execution. They are bounded acceptance ceilings, not competitive performance or hard real-time guarantees.

Original responses are retained in `examples/universal-stress/phase-contexts/independent-batch.json`; each proposal receipt binds its frozen contract. Requested isolation limits the agent tools and provided material. `osIsolationClaimed` remains false.

## Receipts and verification

The nine `*-runtime.json` receipts under `examples/universal-stress/phase-contexts/` bind all kernel/controller source files and artifacts. Every environment passes the nine non-compensatory K400 gates. Admission never substitutes a generic transport error for a semantic negative control. Historical profiles and authority requirements remain intact.

```text
node scripts/run-k400-phases.mjs --verify
node --test tests/k400-phase-admission.test.mjs tests/phase-context-targets.test.mjs
npm run evidence:k400
```

Seven admission tests check replayed ledger tampering, kernel-root substitution, missing controls, omitted environments, false binary hashes, incomplete noncanonical repairs and generic errors. Two actual controller/control tests pass. No new hosted CI was run.

Development reused the installed TaoX archive's `FourDevelopmentModeRouter`, which selected `DEEP_DEVELOPMENT` for the central, evidence-rich admission bottleneck. That advisory route has no write or K400 admission authority; no live federated development service is claimed.
