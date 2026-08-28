# K331 Compiler Realtime Campaign v0.1

## Current verdict

`PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_LOGICAL_TIME_AUTHORITY_BOUND`

This campaign freezes one bounded `compiler-runtime::realtime` logical-time profile. RCL source owns event representation, total ordering, monotonic advance, event-budget atomicity, acceleration projection and explicit external-time admission. The salvaged JavaScript `LogicalTimeScheduler` is an auxiliary Runtime and differential Oracle; it does not own Canonical semantics or receive K400 credit by itself.

## Reality Audit and No Silent RCL Bypass

- Open draft PR #56 supplied a mature deterministic logical scheduler Donor with 13 focused tests, rooted snapshots and explicit external-time authority. Its original checks were stale/failing against a much older base, and its own evidence boundary correctly denied K04/K400 credit.
- The Donor was replayed on exact `main` and its 13 tests passed. Its implementation was then absorbed as an auxiliary Runtime on the candidate branch, preserving RCL ownership.
- Existing RCL `Sequence`, recursion, comparison, Boolean and `choose` semantics express the frozen logical-time profile without a new Core primitive or realtime-special opcode.
- Native `rclc` and `rclvm` execute the Canonical profile. JavaScript only provides an independent order/budget/authority differential.
- `RCL_GAP_K331_PHYSICAL_TIME_INTERRUPT_PROTOCOL` remains open for monotonic physical clocks, deadlines, timers/interrupts, jitter bounds, durable event logs, distributed clock/consensus and hardware real-time admission.

No wall-clock call or provider result enters Canonical state. This is deterministic logical time, not a hard real-time system.

| No-Silent-Bypass field | Recorded value |
|---|---|
| task | K331 compiler-runtime realtime bounded profile |
| missing capability | physical monotonic clock binding, deadline/timer/interrupt semantics, jitter and durable/distributed time guarantees |
| workaround | deterministic logical time plus explicit non-authoritative external-time proposals |
| donor | repository PR #56 JavaScript `LogicalTimeScheduler` |
| gap type | Runtime / Physical-Time / Interrupt Protocol Gap |
| generality | cross-game, simulation, automation, realtime and distributed runtimes |
| candidate absorption | RCL Canonical logical ordering/admission; JS retained as Auxiliary Runtime/Oracle |
| affected K400 cells | K331 directly; future realtime-runtime, game-runtime, simulation-runtime, automation-runtime and distributed-runtime realtime cells |

## Frozen profile

- total order: logical instant, then lower numeric priority, then stable event identity;
- monotonic logical advance with backward-time rejection;
- event-budget preflight that rejects atomically before time or events commit;
- invalid schedule rejection;
- external time remains observational unless exact temporal commit capability is present;
- time scaling changes wall-duration projection, not event order.

## Current nine-gate state

| Gate | Current result | Evidence |
|---|---|---|
| EXPRESS | PASS | logical-time semantics are canonical RCL source |
| COMPILE | PASS | bootstrap and native compiler emit byte-identical RBC |
| LOWER | PASS | generic Sequence/control-flow bytecode; no realtime-special opcode |
| EXECUTE | PASS | native VM completed 20/20 rounds; GitHub Windows replay passed |
| CORRECT | PASS | auxiliary scheduler matches frozen order, budget and authority projection |
| ROBUST | PASS | priority, monotonicity, budget, authority and corrupt-RBC controls fail closed |
| PERFORMANCE | PASS | P95 compile `311.980 ms`, execute `40.656 ms`, combined `349.274 ms`, under frozen budgets |
| AI_GENERATE | PASS | three unique read-only sessions restored exact Canonical bytes; GitHub focused replay passed |
| EVIDENCE | PASS | local roots are bound to exact GitHub push-run, job, step and source identities |

Canonical roots:

- source `8c4de600d4aebae91bb6b05b6e34575f03e8daaeb1a8f52f7793329628fd3953`;
- RBC `0c98e9a13b5cf84c52ffde8677317d4b8702e07323edce091cad7800cda6339d`;
- semantic state `41fa543355ad9212ec22e8b10f2c979ee8137395c44c62a3bb9e995cf7005847`;
- runtime report `94f6597d73c38a44568128081d2c1ead9c105068a42ef0a2e5e158f615c9895d`;
- successful AI report `16c4f920c2a59d69a9935061da079e0886082143b3879420c27d8b52b63eb2a7`.
- GitHub authority `033010acf7f2f0005466b1ff53ed1cf324f9e613ab25c783404e24d8e084408d`.

The first independent acquisition produced an honest `2/3` result because the external-authority mutation was ambiguous about the rejection branch. That failed receipt remains preserved under `k331-compiler-realtime-ai-generate-failed-01`. After freezing the clearer `!= 0` mutation, three new unique sessions restored priority ordering, event-budget atomicity and exact capability admission to Canonical bytes.

## Multi-civilization Integration Court

| Civilization | Artifact consequence |
|---|---|
| Founder Twin | reuses the existing scheduler Donor but assigns Canonical ownership to RCL |
| 柳清莲 Gate | admits only the bounded profile after exact hosted Linux and Windows replay |
| 洞哥 Grounding | distinguishes logical time from physical clocks and hard real-time claims |
| Product | exposes stable rejection codes for backward time, budget, authority and invalid schedules |
| UX | deterministic ordering makes replay and event inspection explainable |
| Engineering / Code | keeps mature snapshot/runtime machinery in the auxiliary JS organ and generic semantics in RCL |
| Test | covers order, boundaries, corrupt RBC, rooted snapshots, negative mutations and differential parity |
| Security | external time cannot become authoritative without explicit temporal capability |
| Release / Evidence Ledger | binds GitHub run `33141180858`, focused job `98752173946`, Windows job `98752173843` and source `43d195d98e1bbd4066922bb47a1e24eed816f86b` |

Integration Court verdict: `PASS_BOUNDED_LOGICAL_TIME_PROFILE`. K331 is admitted for this profile only; physical-time and hard-real-time semantics remain outside the claim.

## License and diff audit

The donor implementation comes from the same repository and author history; no third-party package, external model, dataset or binary was added. The branch adds no dependency. The diff is scoped to the salvaged logical-time auxiliary Runtime, RCL source/contracts/evidence/tests/scripts, workflow/package wiring, K400 builder and documentation.

## Claim boundary

No wall-clock precision, deadline scheduling, interrupt handling, jitter guarantee, hard real-time behavior, distributed consensus, persistent event log, physical-clock synchronization, K04 game execution, unrelated K400 cell or K400 completion is claimed.
