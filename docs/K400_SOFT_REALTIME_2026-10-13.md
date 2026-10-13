# RCL local soft realtime runtime

The full 400-cell K400 goal remains active. This continuation adds an actual
monotonic-clock runtime with release waiting, native process execution,
sampled-deadline publication, cancellation and source-owned failure settlement.
Acquisition alone does not grant matrix credit until all nine gates verify.

The completed local acquisition and strict admission add **16 unique cells**,
bringing the matrix to **277 PASS / 0 BLOCKED / 123 UNTESTED (69.25%)**.
The consolidated report root is
`87e3372f41c2ea13537fc9f26948335ef73776f29f87ac782ad36aedeeeb784f`.
The verdict remains **INCOMPLETE**, maturity **U3**; the full goal remains active.

## Ownership and timing scope

`createPortableRealtimeTarget()` reuses the checked Windows native compiler/VM,
RCL-authored session compiler and native session daemon. The new
`examples/runtime-hosts/realtime-gate.rcl` owns conditional dispatch/publication
warrants, monotonic admission, deadline fields, active-job exclusion, accounting,
failure settlement and pause/resume. Node observes actual clocks and transports
inputs; it never grants publication by merely setting a JavaScript success flag.

Execution waits with actual timers, then spawns the native VM asynchronously.
Completed output retains independently verified typed v2 roots. The RCL
publication rule requires the sampled completion time to be inside the deadline
and the job to remain enabled and uncancelled. A late, failed or cancelled job
settles as failure and cannot increment the completed-job counter.

The clock is Node's [high-resolution process-relative performance clock](https://github.com/nodejs/node/blob/main/doc/api/perf_hooks.md).
Deadline and cancellation controls request a stop on the owned native child,
then wait for its actual `close` event and terminal status. Sending a signal
alone is not treated as exit evidence, consistent with the
[official child-process API](https://github.com/nodejs/node/blob/main/doc/api/child_process.md).
The receipt records process id, start/end/stop samples, exit code/signal,
stdout/stderr hashes, source/artifact identity and complete RCL control history.

This is local **soft realtime**. The deadline policy is evaluated on observed
admission/completion samples. Process startup, native-session IPC and result
delivery can add latency; no hard operating-system interrupt, exact callback
deadline or production hard-real-time guarantee is claimed. The parent event
loop remains responsive while the actual native process is busy.

## Frozen controls and independent evidence

Thirteen program contracts freeze ten input cases each, twenty baseline rounds,
5000/2000 ms compile/execute p95 budgets and three independent candidate repairs.
Three fresh proposal-only contexts receive only their frozen mutated programs
and intentions. Root retains canonical code, oracles, runtime controls and
admission. Returned edits remain unchanged; noncanonical repairs replay every
pre-sealed input.

Each profile must demonstrate a 20 ms release wait, one-slot backpressure,
past-deadline rejection before native dispatch, a rejected backwards observation,
source-authority pause/resume, a 150 ms deadline on a genuine spinning RCL
program, cancellation requested after 20 ms, actual native-process exits and
successful recovery. A real 5 ms parent heartbeat is observed during the long
native run; no worker sleep or fabricated VM result substitutes for execution.
The complete controller transcript is independently replayed against the RCL
reference session and bound to exact source/compiler/daemon bytes.

The first acquisition caught timer truncation: a fractional timer delay could
fire before the mathematical deadline. The implementation now re-reads the
actual monotonic clock and rearms when time remains; the verifier keeps its
strict no-early-timeout condition. Numeric budgets and pre-sealed cases are
unchanged. Native errors retain their original diagnostic codes, and failed
semantic-mutant rows keep their own independently rooted values.

## Verified acquisition

All thirteen profiles pass 260 baseline rounds, 130 pre-sealed input executions
and 39 unchanged independent repairs. One noncanonical member-boundary repair
also passes all ten frozen cases. Each profile records real timeout and
cancellation exits: 26 actual spinning native child processes terminate, with
failure settlement and subsequent healthy execution. Thirty-five focused
runtime, evidence-admission and matrix-policy checks pass locally.

Observed per-profile compile p95 spans **87.700–314.454 ms**, and execution p95
spans **106.140–417.712 ms**, including release waiting and native controller
transport. These measurements pass the pre-frozen 5000/2000 ms budgets; they
do not establish tighter production latency or a hard deadline guarantee.

| Frozen profile | New cells | Runtime receipt root |
| --- | --- | --- |
| algorithm-cli | K261, K262 | `27a27e7f3c0ef5e9780ffc246fe540ff72eaf462f2560bac2e5e3609b0363e98` |
| relations | K266 | `56ab6ba94591d171cc61ef56a96798bab2c3ffb950c0bd684ee613b5a8ecfe9f` |
| compiler | K267 | `bbabce9c70a46c1644ac128554ac8c21d257610555dcdbc2b90f5baf8110a798` |
| game | K268 | `dfa81067b92e239b52a3d954ed848c21957f249a5ca4b381f49a33f3ae68023b` |
| simulation-scientific | K269, K272 | `e09525ddcb6f869bd6c5a355292908c37fade9d2edf2ecd0f14dcb185fcc9297` |
| replicated-counter | K270 | `1b8c6607a2e4f670356911751f14f90cd325e03de906a69c91bc1be9ad4420d8` |
| logical-events | K271 | `31f847d90e2aeaed226d92022830e3162ed78d222759ee4d8563df10a0878d00` |
| learning | K273 | `fb280ae0dfaef808b1b0812ff56707160f8845f150fbd94dc35db53402751757` |
| agent | K274 | `053ae17f599c9c8c1796dbbd3633c7a275c64eae8d0cb6adf831dc866fa472aa` |
| media | K275 | `7ee52a891dd531293ed4488ff942f30b694ff9a9587d10c548de304a4de79156` |
| automation | K276 | `433cb2ff2db630bfd5a61144f7b277ea689e2e95aa3875bc4c6f565d27d18adf` |
| governance-reactive | K277, K278 | `b2e690a0878fbc0d9eb8d52b318df4760bd646a4490fe48badc4cf15507a12d4` |
| mixed-paradigm | K280 | `774c7b3043fdffad2d97be66f531caaa4eed47e30936eb2aed03115743064fa8` |

Each file under `examples/universal-stress/realtime-native/` retains its frozen
contract/cases, original independent response and complete runtime/controller
receipt. The builder admits these receipts only after their full source and
artifact bindings, controls and all nine gates verify.

A fresh export of staged Git tree
`cdab2917509f306640e422d2da16cc295e95d51b` independently rebuilds every
registered receipt into the same 277-cell report root and passes all 35 focused
checks, including actual native timeout/cancellation controls. This excludes
ignored development output from delivery and verifies the staged builder and
public runtime. This note is added after that verification; bound runtime and
receipt files are unchanged.

The actual archived DWAC router selected `DEEP_DEVELOPMENT`, source SHA256
`feec830b66b404c243f3bb4c3d2c66706429c670a0f4c396dee6246d5363ee44`.
That routing is advisory and grants no execution or admission authority.
No new GitHub Actions run is requested; the historical package identity remains
frozen at `2.0.0` while the whole-language status stays research preview.

## Run

```text
node scripts/run-realtime-native.mjs examples/universal-stress/genomes/learning.rcl
node scripts/run-k400-realtime.mjs --verify
npm run evidence:k400
```

The asynchronous API exposes `compile`, `execute`, `pause`, `resume`,
`verifyRuntimeControl`, `controllerLedger`, `snapshotController` and `dispose`.
`execute` accepts `notBeforeMs`, `deadlineMs` and an abort signal. The default
verified setup is the local Windows native runtime; no extra npm installation,
physical timing device or external-effect provider is required.
