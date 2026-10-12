# Session integrity maintenance — 2026-10-12

RCL remains at package/native version **2.0.0**. This maintenance fills concrete
session reliability and usability gaps on top of canonical main
`edf09e670566b4259b64ca68054f88eb61a5e395`.

## Changes

| Gap | Result |
|---|---|
| An invalid native reply could leave a committed VM running and permit further commands. | Every successful reply binds program/source, mandatory record arrays, requested rule/mode/actor, observations, changes, witnesses and transition roots. Invalid evidence closes the process before accepting state. Durable transport/evidence failures poison the writer; reopen and replay before retrying. |
| Durable commands read caller-owned request objects after entering the queue. | Request identity, revision and normalized scalar observations are captured synchronously. Later object edits do not change execution or idempotent retry identity. Returned states do not alias native cached state. |
| CLI callers could not use API history pins; unknown flags were silently ignored. | inspect/verify/invoke/recover expose `--expected-root` and `--minimum-revision`, with optional `--reference`. Strict parsing rejects unknown, duplicate, malformed and inappropriate flags before execution/storage mutation. Recovery validates pins before saving/truncating an incomplete tail. |
| Repeated alterations of one field produced different reference/native session receipts. | Session receipts retain one change per field in first-appearance order, with the last proposed value, matching existing native transactions. Both expressions still read the same decision state. Native/reference durable replay now agrees. |

`RCL_SESSION_NATIVE_EVIDENCE_INVALID` closes a native session. Its cached snapshot
is the last independently verified state. Durable invocation then reports
`RCL_SESSION_DURABILITY_UNCERTAIN`, and that writer rejects further reads/calls.
Structured VM preserve/authority failures keep their existing rollback behavior
and leave the writer usable. These checks establish reply continuity and shape;
they do not substitute a host interpreter for RCL execution or authenticate a
malicious native process.

## Development route and reused owners

The local DWAC four-mode router selected **DEEP_DEVELOPMENT** for the audited
session bottleneck. Federation planning returned a candidate plan; it was not
used as execution or publication authority. Laya's finite priority suggestion
returned **ABSTAIN** and was not treated as a decision.

| Decision | Asset |
|---|---|
| REUSE | Existing RCL/native compiler, RBC 1.3, native session-step ABI, exact state-root v2, OS writer locks and pure replay. |
| ADAPT | JavaScript native-session boundary, durable command queue/journal, public CLI, shared session receipt normalization and source bindings. |
| KEEP_SEPARATE | Test-only fault transport linked to the real VM DLL; historical 2.0 release receipts; DWAC/Laya advisory planning evidence. |

The fault fixture executes a genuine native VM commit before damaging one reply.
It intentionally does not implement the production writer lock. Separate tests
with the real daemon verify writer exclusion, process death, lock release and
durable recovery. No generic DWAC/TaoX executor capability is claimed here.

## Evidence and reproduction

- Before repair, 14 selected checks failed against the base implementation.
- A separate repeated-alteration comparison failed because its receipt lists differed.
- After repair, **61 PASS / 0 FAIL / 0 SKIP** across nine focused files, including
  **37 session checks**. Negative replies, real process death, immutable queued
  requests, anchored recovery, strict CLI parsing, native/bootstrap compilation,
  ordinary rejections, resonance/Sequence compatibility and restart/retry are covered.
- Stage0 binds all 18 current source modules. Package/native/component versions
  and root/bytecode formats remain unchanged.

The [JSON record](session-integrity-2026-10-12.json) binds source files, test files,
native artifacts and retained execution logs. Reproduce the session portion with
`npm run test:sessions`; the fault harness needs a local C compiler (Windows: Zig
plus the existing import library/DLL). The full nine-file command is in the JSON.

This is local Windows evidence. The initial full suite, fixed point and independent
package installation were not repeated: compiler/native sources did not change.
Their [original 2.0 verification](../v2.0/verification.json) remains frozen.
Fresh Linux, Android hardware and remote deployment remain outside this
maintenance. GitHub Actions were not run under the user's instruction.

## Remaining engineering gaps

Journal compaction and migration remain absent; the existing 64 MiB / 10,000-command
bound still applies. A checkpoint design must preserve admitted state, immutable
source binding, writer ownership and independently trusted history anchors before
it can replace full replay. Broader compiler admission diagnostics and platform
acceptance retain their separate work and evidence scopes.
