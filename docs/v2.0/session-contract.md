# Governed and durable sessions

RCL 2.0 adds persistent program execution. A session initializes once and invokes
named rules against the current state. The native VM executes warrants, guards,
changes and preserves. The JavaScript reference session supplies an independent
differential implementation of the same bounded core profile.

## Source-declared observations

```rcl
input event.delta : Number = 0
input event.label : Text = ""
```

An input is a typed facet whose observation boundary belongs to the source.
External callers can supply only declared inputs. Other facets can change only
through program rules. Inputs admit finite binary64 Number, Truth and
Unicode-scalar Text, with no NUL and at most 1 MiB of UTF-8 text per value.
The total input frame is bounded to 2 MiB. Session state supports Number, Truth,
Text and Sequence in the eligible native-core profile. Provider calls, external
host effects and typed Ref operations are rejected for deterministic replay.

Each invocation combines the previous committed state with its observations,
reevaluates conditional warrants, evaluates the guard and computes the proposed
changes. A failed command, false guard or projection does not commit observations
or state. A successful realize commits both observations and rule changes.
Journal/result beforeRoot denotes the preceding committed state; a transition's
beforeRoot denotes the decision state after applying the proposed observations.
The distinction is explicit in the rooted result.

Session creation runs initialization only. Fixed top-level realize/foresee
directives are not automatically executed; callers select a declared rule.
Ordinary runReality/runRealityNative retain their existing directive semantics.
Ordinary native programs now also reevaluate conditional warrants between rules.
The rule's cause/from selects its declared RCL subject. Host authentication and
mapping an authenticated caller to permitted rule names remain application
responsibilities; this local program API does not authenticate outside identities.

## APIs

```js
import {
  createRealitySession, createNativeRealitySession,
  openDurableRealitySession, verifyDurableRealitySession,
} from '@taowind/rcl-reality-forge';

const session = await openDurableRealitySession('./counter-state', { source });
const result = await session.invoke({
  requestId: 'event-001', expectedRevision: 0, rule: 'increment',
  inputs: { 'event.delta': 3, 'event.label': 'first event' },
});
console.log(result.result.state, result.receipt.root);
await session.close();

const recovered = await openDurableRealitySession('./counter-state');
console.log(recovered.snapshot());
await recovered.close();
```

Volatile reference/native sessions expose snapshot/invoke; the native session also
requires close. Durable invocation returns receipt/result/replayed. A request ID
binds the normalized command and its expected revision. An identical retry
returns its original receipt; a conflicting reuse or stale revision rejects.
Every accepted invocation, including a projection or false guard, advances the
journal revision once. Rejected rules do not append a journal record.

Invocation captures the normalized command, request ID and expected revision
before queuing it. Later edits to the caller's request or returned state cannot
rewrite the queued operation or the last independently verified native state.
Each successful native reply must identify the bound program/source and contain
the required history/projection arrays. Its transition must match the requested
rule, mode, actor, observations, declared changes, witnesses and state roots.
This verifies reply structure and continuity; it does not replace native guard,
warrant or preserve evaluation or optional independent reference replay.

Invalid reply evidence closes the native process with
RCL_SESSION_NATIVE_EVIDENCE_INVALID. Its cached snapshot remains the last verified
state. A durable writer receiving such evidence or losing its native transport
closes with RCL_SESSION_DURABILITY_UNCERTAIN and rejects further reads/invocations.
Reopen it to verify the durable prefix before retrying the same request. Ordinary
structured VM rejections retain their rollback contract and leave the writer usable.

When a rule alters the same field more than once, each expression reads the same
decision state and the last proposed value wins. Session receipts now retain one
change per field in first-appearance order, matching the existing native
transaction representation. Both native and reference session replay therefore
produce identical receipts for this profile; ordinary runReality history is unchanged.

The public durable path compiles through the RCL-authored native session compiler
and verifies byte parity with the bootstrap compiler. The ordinary RCL compiler
core, session compiler core and session compiler main are separate source assets.
The compiler is initially bootstrapped into executable RCL bytecode by JavaScript;
the target program is compiled by RCL running in the native VM. This does not
claim whole-language or whole-runtime self-hosting. compileRealitySessionBytecode
and an explicit compiler:'bootstrap' option expose the bootstrap path separately.

## Durable local contract

The directory stores immutable source.rcl/session.rbc, a hash-linked journal.jsonl
and an OS writer lock held by the native daemon. A committed command is
acknowledged only after appending its complete record and fsync. Startup checks
asset roots and the full journal chain, executes every accepted command in a new
native process and compares exact semantic/result roots. verifyReference:true
also replays through the independent reference runtime. Recovery executes no
provider or external effect.

Windows LockFileEx and POSIX flock exclude a second cooperative writer and are
released on process death. There is no PID-based lock deletion or timeout lease.
Incomplete tails fail closed by default. repairIncompleteTail:true first verifies
the complete prefix, saves the tail bytes in a separate recovery file, and only
then truncates that incomplete suffix. Corrupt complete records are never repaired
this way. An uncertain append poisons/closes the writer; reopen and request retry
resolve whether the command was persisted. Journals are bounded to 64 MiB and
10,000 accepted commands; compaction/migration is not implemented in this profile.

Hashing plus replay checks consistency, not authenticity of an entire replaced
history. Supply an externally trusted expectedJournalRoot or minimumRevision to
detect replacement with a valid older prefix. A journal is not a distributed
database, an external-effects exactly-once protocol, a malicious-writer security
sandbox or proof of hardware power-loss behavior. Filesystem behavior and external
history anchors retain their separate evidence/authority boundaries.

## CLI and example

```text
rcl session init examples/sessions/governed-counter.rcl ./counter-state
rcl session invoke ./counter-state examples/sessions/increment-command.json
rcl session inspect ./counter-state
rcl session verify ./counter-state --reference
rcl session inspect ./counter-state --expected-root <trusted-journal-root> --minimum-revision 1
rcl session compile examples/sessions/governed-counter.rcl ./counter-session.rbc
node examples/sessions/persistent-counter-demo.mjs
```

The command file's expectedRevision must match the observed current revision for
a new request. session compile uses the RCL-authored native compiler by default;
--bootstrap selects the bootstrap implementation explicitly. The output is
created without overwriting an existing artifact. For an incomplete tail use
session recover <directory> --repair-incomplete-tail.

inspect, verify, invoke and recover accept --expected-root <lowercase-sha256> and
--minimum-revision <nonnegative-safe-integer>, matching the API's
expectedJournalRoot and minimumRevision. Keep these anchors outside the session
directory in a trusted application or record. Checking a root read from the same
possibly rolled-back history does not supply an independent anchor. Pins refer
to the current complete prefix before an invocation or incomplete-tail repair.
These four operations also accept --reference for independent reference replay.
Unknown, duplicate, malformed or operation-inappropriate flags fail before any
native execution or storage mutation; --bootstrap belongs only to compile and
--repair-incomplete-tail belongs only to recover.

The [2026-10-12 maintenance evidence](../maintenance/session-integrity-2026-10-12.json)
records these integrity fixes at package 2.0.0. The original
[release verification](verification.json) remains a frozen record of its tested source.

The C embedding ABI adds rclvm_instance_session_initialize and
rclvm_instance_session_step with RclVmInputV1 observations. Existing run/reset and
provider ABIs remain available. The native daemon adds INIT and STEP to its
existing protocol. Session entries, input declarations and warrant refresh use
RBC 1.3 opcodes 45–47 and the independent session flag 4. Legacy programs continue
to emit RBC 1.1/1.2 when none of these new features is needed. State-root v2 and
the typed-reference ABI are unchanged independent contracts.
