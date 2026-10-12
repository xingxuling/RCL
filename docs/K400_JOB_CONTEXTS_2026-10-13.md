# Native job contexts, 2026-10-13

Verified checkpoint: **142 PASS / 258 UNTESTED**, verdict INCOMPLETE, maturity U3. This campaign adds **36 distinct coordinates** to the prior 106. Consolidated report root: `8c35778ed7750501e87f00fee0f8ce303582d846996a8ab8d86194872c7c190f`. The >=200 goal remains active; package version advancement stays frozen.

## Actual execution mechanisms

REUSE the unchanged RCL-authored compiler artifact, native C VM, nine source profiles and independent input oracles. ADAPT the local HTTP worker for cold requests; add SQLite SQL-function execution and an actual worker-thread pipeline. KEEP_SEPARATE all historical hosted-authority receipts and opaque provider/scenario-planner assets. No native opcode, task-specific VM patch or alternate RCL rule interpreter is added.

| Context | Observed mechanism | Required control | Scope ceiling |
|---|---|---|---|
| serverless | every compile and execute uses a fresh local HTTP handler | distinct identities, endpoint closure and an OS process-existence probe confirm termination | local cold-handler execution; no cloud FaaS |
| database | SQLite invokes native RCL through `rcl_execute` within a transaction | exactly one native SQL invocation, commit, connection reopen/recovery, rejected program-root rollback | local SQLite host; no arbitrary SQL/concurrency/isolation claim |
| dataflow-runtime | worker thread runs input binding, native operation and receipt sink | thread identity and artifact hash match, one in-flight request, excess work rejected | bounded pipeline; no external streams or arbitrary graphs |

The host Node executable is hash-bound in addition to every compiler/VM binary and implementation file. SQLite's engine version is read through an actual SQL query. Compilation and execution remain RCL/native-owned; SQLite and the thread/HTTP adapters provide hosting and transport.

The process-existence probe uses signal zero, which observes existence without terminating a process, as specified in the pinned [Node 24.15.0 process API](https://nodejs.org/download/release/v24.15.0/docs/api/process.html#processkillpid-signal). This supplements service endpoint closure with actual process termination evidence.

## Frozen profile campaign

Contracts, cases, original proposals and runtime receipts are under `examples/universal-stress/job-contexts/`. The nine profiles cover learning, finite agent deliberation, workflow control, logical events, governance/reactive composition, mixed paradigms, relations, simulation/scientific checks and algorithms/CLI. Their twelve family coordinates across three new hosts have no overlap with the earlier matrix.

Each target completes twenty canonical native compilation/execution rounds, ten input cases sealed before generation, three effective mutations and three repaired-source executions. Native bytecode must match bootstrap lowering exactly. State-root-v2 is independently recomputed, and transaction actors, requirements, witnesses and the complete before/after root chain are checked.

The human authorized three fresh candidate-only contexts. Original response objects, including indexed candidate IDs, are preserved unchanged. Neither canonical code nor evaluator/oracle cases was supplied. Requested tool policy does not claim hardened OS isolation. A noncanonical proposal additionally runs every frozen case on each target and retains its own source/program/artifact hashes. These finite-domain checks do not prove unrestricted semantic equivalence or whole-family competence.

Frozen local p95 ceilings remain 5000 ms compilation and 2000 ms execution. Cold-handler samples include startup, request, shutdown and termination checks. Passing these budgets does not establish competitive performance or hard real time.

```text
node scripts/run-k400-jobs.mjs
node scripts/run-k400-jobs.mjs --verify
npm run evidence:k400
```

Admission rejects rehashed missing process-exit/compile traces, false SQL invocation/recovery/rollback records, wrong thread/input bindings, absent noncanonical repair cases, generic transport errors and false host-binary hashes. Missing runtime receipts remain unclaimed.

Validation: six targeted admission checks, 27 maturity/matrix checks and five actual host/control checks pass. A fresh directory made only from the staged tracked tree admits all nine job receipts, passes the five actual controls and rebuilds the identical 142-cell report root. It does not claim to rerun the full twenty-round acquisitions. Full repository regression and new hosted CI were not run.

## Native RCL controllers awaiting full campaigns

`createPhaseContextTarget` adds two further reachable hosts whose state is owned by persistent native RCL sessions:

- `simulation-runtime`: RCL authorizes and forecasts a logical clock step for the requested kernel root. The kernel executes, then the RCL clock commits the matching projection. Failed kernels leave the clock unchanged; backwards time and disabled advancement are rejected.
- `automation-runtime`: RCL authorizes job admission, binds the requested kernel root and completes or fails the job with an audit balance. Disabling dispatch is enforced by the source warrant before kernel execution; rejected kernels complete the failure path without leaving an active job.

Their controller sources are `examples/runtime-hosts/simulation-clock.rcl` and `automation-gate.rcl`. Targeted controls pass on actual source-bound native daemons. Separate ten-case contracts and controller/compiler hashes were frozen before three new independent contexts; the original repair responses are retained under `examples/universal-stress/phase-contexts/`.

These controller hosts grant no new K400 cells before their separate full campaign. They claim no physical world/time, external tool effect, canonical RNCS-world ownership, full runtime self-hosting or hardened OS sandbox. Controller compilation reuses the RCL session compiler with its declared JavaScript compiler bootstrap and native target-byte parity.
