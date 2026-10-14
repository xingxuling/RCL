# Complete compiler under native RCL soft deadlines

The public `createRealtimeCompilerTarget()` API admits actual caller-supplied
compiler generations and native programs through the original native RCL realtime
controller. The compiler, source and program bytes are snapshotted before awaiting.
The controller source, native binary owners and previously admitted soft realtime
profiles remain unchanged. Package identity stays `2.0.0`; version promotion is
frozen and whole-language release remains false.

Both compilation and program execution wait for an actual monotonic timer release,
then invoke the source-owned native RCL `admit` rule. Compilation binds SHA256
source bytes; execution binds the RCL program root. Only a realized admission
starts native work. Every compilation owns a fresh process of the pinned native
compiler ABI, with a real ready reply, context token and `COMPILE` request carrying
the supplied full compiler artifact. It reads the actual output bytes, requests
normal shutdown and awaits the process exit. This profile claims no resident
compiler reuse. Native program execution reuses the original asynchronous VM
process transport, with raw stdout/stderr and independently checked state roots.

Publication invokes the original native RCL `publish` rule using the actual
monotonic completion sample. The source-owned warrant requires an enabled active
job, no cancellation and a completion sample within the admitted deadline. Only
then are compiled bytes written to the caller's output file. This is sampled
local soft realtime. It establishes no worst-case hard timing, OS interrupt or
atomic filesystem/controller transaction guarantee. File I/O after the accepted
sample is outside the timing guarantee.

The full compiler deadline and cancellation controls actually dispatch the frozen
complete compiler. While it runs, host timer heartbeats continue. A 500 ms deadline
or an external abort requests termination, awaits the native process close event,
records its real signal/status, then invokes the original native RCL `fail` rule.
The failed job remains unpublished and is inactive afterward. A fresh healthy full
compilation subsequently reproduces the complete artifact. Native program timeout
and cancellation also execute the frozen spin program and await observed exits.
Interrupted processes honestly record `SIGTERM` and null/nonzero status as observed;
they do not receive invented zero exits.

Expired compilation is rejected before native dispatch. Pause denies compilation
and execution before native calls. Actual clock reversal is rejected without
changing state. A program source-root mismatch and malformed/corrupt compiler
inputs settle admitted failures without increasing completed jobs. Bounded
backpressure rejects overlap; released healthy compilation and repeated native
program execution recover.

The [frozen contract](../examples/universal-stress/selfhost-realtime/general-compiler-realtime-contract.json)
preserves twenty byte-identical C0-to-C20 generations, ten sealed native programs
and three unchanged fresh repairs. Each complete compilation executes 101897504
instructions under the unchanged 300000000-instruction budget and reproduces the
pinned 297957-byte compiler. Compile/execute P95 limits remain 50000/5000 ms.
The three independent proposal-only contexts received their exact frozen candidate
and task requirement; canonical source, oracle edits and hidden tests were withheld.
Their [raw replies and input hashes](../examples/universal-stress/selfhost-realtime/independent-batch.json)
are retained. OS isolation and independent implementation agreement are unclaimed.

Final acquisition measures compile P95 **2966.7113 ms** and execute P95
**169.8498 ms**. The actual public API test and thirty-seven admission checks pass,
with zero failures or skips. The receipt binds 62 outer operations, 124 actual
native controller commands and 59 native exits, including four observed interrupted
exits. The full compiler timeout control records 34 responsive host timer samples.

The [profile index](../examples/universal-stress/selfhost-realtime/general-compiler-realtime-runtime.json)
can grant only K279, `realtime-runtime::self-hosting`. Admission independently
replays every native RCL command, verifies the original controller/compiler/clock
bindings, checks exact ready/request/reply bytes and native identities, source and
artifact roots, native semantic results, release/deadline samples, rejected
dispatch, failure settlement, actual interruption/exit, backpressure and recovery.
Rehashed forged evidence cannot omit a native request/exit, change a deadline,
accept late publication, suppress a stop signal, inflate completed failures,
invent hard realtime guarantees or hide a paused call. Raw native Windows compiler
stdout retains its actual CRLF bytes. The first acquisition was rejected by an LF
assumption in the evaluator; it received no credit. After correcting exact wire
comparison, the entire profile was freshly acquired under the final bound policy.

Native processes expose actual zero exits on ordinary success. Controller
termination is observed, while its unchanged session API exposes no exit code;
the receipt preserves `UNAVAILABLE_FROM_REUSED_SESSION_API`. No external effect,
security sandbox, independent OS/device or whole-language release is claimed.
Detailed measurements, rejected first acquisition, retained owner hashes and
relocated-source delivery are in the
[verification receipt](evidence/realtime-selfhost/verification.json).

The first relocated-source API attempt, while the full collector was running,
hit the actual default two-second native program deadline. The child was stopped
and its failed job settled; that failed attempt is retained. The same tracked
snapshot and unchanged budgets are rechecked after collector completion. This
does not turn local soft deadlines into a cold-start or system-load guarantee.

The actual pinned DWAC router chose
[`DEEP_DEVELOPMENT`](evidence/realtime-selfhost/dwac-mode.json). Laya's low-risk
scope [classification](evidence/realtime-selfhost/laya-classification.json) returned
`ABSTAIN` at confidence 0.2749. Codex retains the implementation and admission
decisions; these tools authorize no publication or K400 credit. The API and profile
headers identify reused donor files and hashes. No hosted Actions are requested.

```js
import {createRealtimeCompilerTarget, compileReality} from './src/index.mjs';

const target = await createRealtimeCompilerTarget();
try {
  // hello.rcl contains: reality Hello { facet value : Number = 9 + 2 }
  const compiled = await target.compile('c1.rbc', 'hello.rcl', 'hello.rbc', {
    notBeforeMs: 20, deadlineMs: 50000
  });
  const source = 'reality Hello { facet value : Number = 9 + 2 }';
  const executed = await target.execute('hello.rbc', compileReality(source).programRoot);
  console.log(compiled.realtimeTrace.nativeTrace, executed.result.state);
} finally {
  await target.dispose();
}
```

Supply `signal: abortController.signal` to cancel a job. `c1.rbc` is the caller's
actual preceding compiler generation. Use `npm run test:selfhost-realtime` for the
focused public API and admission checks.
