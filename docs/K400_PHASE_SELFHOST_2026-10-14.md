# Native RCL controllers own complete compiler jobs

The public `createPhaseCompilerTarget(environment)` API adds dynamic complete
compiler jobs to the existing automation and simulation controllers. Both original
RCL sources, their native session owner, the resident compiler, and the compiler
stage/VM stage retain their previous source and binary identities. Each job enters
the actual native RCL controller before the compiler or VM worker is invoked.
Version advancement remains frozen and hosted Actions are not requested.

Each operation captures the caller's actual inputs in an owned temporary
directory before awaiting admission. Changes to the caller's compiler, source or
program file during that wait cannot substitute the bytes that will run.
Compilation binds the SHA256 of the source bytes. Program execution binds the
RCL program root. These two root kinds are explicit in the API binding. The
automation controller admits a job, then settles success or failure. The
simulation controller projects its next logical clock and commits that projection
only after native success. Compilation publishes its output file after successful
controller completion. Pause denies both compilation and execution before worker
invocation; denied compilation creates no output. A failed native compilation
increments the automation failure counter and clears the active job, while the
simulation clock and state root remain unchanged. Both recover a healthy complete
generation and identical native program results. The simulation also rejects a
reversed time input, and each API permits one operation in flight.

The [frozen contract](../examples/universal-stress/selfhost-phase/general-compiler-phase-contract.json)
preserves twenty complete C0-to-C20 generations, ten sealed native programs and
three unchanged fresh repairs **for each environment**, without relaxing the
300000000-instruction limit, 50000 ms compile P95 or 5000 ms execute P95. Every
complete generation returns the pinned 297957-byte compiler after 101897504
instructions. The three independent contexts received only the exact frozen
candidate and intent. Their [raw replies and input hashes](../examples/universal-stress/selfhost-phase/independent-batch.json)
are retained; canonical source, oracle edits, hidden inputs and OS isolation were
not supplied or claimed.

| Cell | Actual environment | Compile P95 ms | Execute P95 ms |
| --- | --- | ---: | ---: |
| K359 | native RCL automation controller | 3249.6150 | 213.9547 |
| K379 | native RCL simulation controller | 3532.3916 | 398.8068 |

The [profile index](../examples/universal-stress/selfhost-phase/general-compiler-phase-runtime.json)
binds both complete environment receipts. Admission independently replays every
controller command and state transition against the reference contract; reference
code is an evaluator, and actual jobs use the native controller/compiler/VM.
Worker roles, request order, binary/source hashes, process identity, native reply
bytes, bytecode hashes and semantic state roots are checked. The two public API
tests and twenty-nine admission checks reject rehashed forgeries of controller
identity, root kinds, commands, completions, paused dispatch, output publication,
failure settlement, bounded concurrency, shutdown and generation counts.

The native compiler and both worker stages expose actual zero exit codes. The
unchanged native session API awaits controller termination without returning its
exit code. This API checks process absence and records
`UNAVAILABLE_FROM_REUSED_SESSION_API`; a zero controller exit code is not asserted.
The phase API uses separately admitted compile and execution jobs; it does not
assert a shared compiler-to-VM flow identity for those two jobs. These are bounded
local Windows contexts, with no physical-clock/world, external automation,
security sandbox or whole-language release claim.

DWAC's actual local four-mode router chose `DEEP_DEVELOPMENT`, as recorded in
[its receipt](evidence/phase-selfhost/dwac-mode.json). The subsequent low-risk
Laya audit-priority request returned `ABSTAIN` at confidence 0.2854; Codex retains
the development and admission decisions. Source reuse and profile-engine donor
hashes are recorded in the implementation headers. Delivery checks and their
scopes are retained in [the verification receipt](evidence/phase-selfhost/verification.json).

```js
import {createPhaseCompilerTarget, compileReality} from './src/index.mjs';

const target = await createPhaseCompilerTarget('automation-runtime');
try {
  // c1.rbc is the caller's actual preceding compiler generation.
  const compiled = await target.compile('c1.rbc', 'hello.rcl', 'hello.rbc');
  const source = 'reality Hello { facet value : Number = 9 + 2 }';
  const executed = await target.execute('hello.rbc', compileReality(source).programRoot);
  console.log(compiled.phaseTrace, executed.result.state);
} finally {
  await target.dispose();
}
```

`hello.rcl` must contain the shown source. Select `simulation-runtime` to use
the logical-clock controller. Run `npm run test:selfhost-phase` for the focused
API/admission checks.
