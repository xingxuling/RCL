# Complete compiler in the original native RCL game runtime

The public `createGameCompilerTarget()` API accepts actual caller-supplied compiler
generations and native program bytes in `game-runtime`. It reuses the original
source-owned game controller, native program hooks, physics rules and SVG scene
projection. Their source and binary bindings remain unchanged. Package identity
stays `2.0.0`; version promotion remains frozen and whole-language release is false.

Compilation snapshots both compiler and source bytes before awaiting. The existing
native RCL `advanceFrame` rule first runs in `foresee` mode, checking the current
plugin root and `frame.advance` authority while the game is enabled. Its proposed
result root binds the source SHA256; it writes no scene state. Then the resident
native C ABI actually runs the supplied RCL compiler generation. Compilation
failure leaves the game scene unchanged.

Successful compilation projects actual artifact bytes and executed instructions
through the original explicit modulo-17 transport. This finite metric is a scene
input, with no claim of program understanding or compiler-quality prediction.
The native controller previews publication against its real frame rule before
loading the source SHA256 as a plugin root. Three actual native RCL frame commits
then apply the original jump, horizontal motion, gravity and collision rules,
binding the generated artifact SHA256 as the result root. Only after those commits
does the API write the compiled bytes to the requested output file. The compiler
source, execution-program root and artifact SHA256 are separate identities.

Program execution snapshots the supplied bytecode and performs a native frame
authority preview before invoking the original game runtime. Three real native
program hooks produce independently verified semantic-state-root-v2 results;
their verified state drives three actual native RCL physics frames and the
unchanged scene projection. Repeated execution produces the same state and scene.
This is a deterministic local game integration; browser execution and physical
timing are unclaimed.

Pause denies both compilation and program execution before native dispatch.
A foreign admission root is denied before compilation. An invalid publication
metric is rejected after actual native compilation but before scene load, frame
commits or output publication, preserving the prior scene. Malformed source and
a corrupt compiler also preserve scene state. Bounded backpressure rejects
overlapping requests, followed by healthy full compilation and native game replay.
The public API additionally checks wrong source-root rejection before scene load.
The API does not provide a durable transaction spanning filesystem publication
and scene commits; output I/O failures are not claimed to roll back committed
physics. General engine functionality and arbitrary game generation are separate.

The [frozen contract](../examples/universal-stress/selfhost-game/general-compiler-game-contract.json)
preserves twenty byte-identical C0-to-C20 complete compiler generations, ten
sealed native programs and three unchanged fresh repairs. Each complete generation
executes 101897504 instructions under the original 300000000-instruction budget
and returns the pinned 297957-byte compiler. The three independent proposal-only
contexts received only their exact frozen candidate and task requirements;
canonical source, oracle edits and hidden tests were withheld. Their
[raw replies and input hashes](../examples/universal-stress/selfhost-game/independent-batch.json)
are retained; OS isolation and independent implementation agreement are unclaimed.

Final acquisition measures compile P95 **3994.8323 ms** and execute P95
**550.3948 ms**, inside the original 50000/5000 ms limits. The actual public API
test and thirty-one admission checks pass, with zero failures or skips. The
receipt binds 58 outer operations, 306 actual native controller commands, 156
actual physics frame commits and 46 compiler/native-hook exit records.

The [profile index](../examples/universal-stress/selfhost-game/general-compiler-game-runtime.json)
can grant only K199, `game-runtime::self-hosting`. Admission independently replays
every native controller command and checks original game/compiler provenance,
raw C ABI replies, compiler identity and metrics, no-write authority previews,
source/artifact/result roots, unchanged failure scenes, sealed program semantics,
native frame physics, SVG projection, all three hook statuses, recovery and
shutdown. Rehashed forged records cannot omit native preflight, publication,
load, frames or exits, mutate physics, substitute predictor authority, or hide a
paused native call. Detailed delivery evidence is retained in the
[verification receipt](evidence/game-selfhost/verification.json).

The native compiler and program hooks expose actual zero exits. Controller
termination is observed; the unchanged session API does not return its exit code,
so the receipt preserves `UNAVAILABLE_FROM_REUSED_SESSION_API`. No external effect,
security sandbox, independent device/OS or whole-language release is claimed.

The actual pinned DWAC router chose
[`DEEP_DEVELOPMENT`](evidence/game-selfhost/dwac-mode.json). Laya's low-risk gap
[classification](evidence/game-selfhost/laya-classification.json) returned
`ABSTAIN` at confidence 0.2196; its tentative version-gap choice was not accepted.
Source inspection establishes the runtime integration gap. Codex retains the
implementation and acceptance decisions; neither tool authorizes publication.
Profile engine/admission headers identify exact reused donor sources and hashes.
No hosted Actions are requested.

```js
import {createGameCompilerTarget, compileReality} from './src/index.mjs';

const target = await createGameCompilerTarget();
try {
  // hello.rcl contains: reality Hello { facet value : Number = 9 + 2 }
  const compiled = await target.compile('c1.rbc', 'hello.rcl', 'hello.rbc');
  const source = 'reality Hello { facet value : Number = 9 + 2 }';
  const executed = await target.execute('hello.rbc', compileReality(source).programRoot);
  console.log(compiled.gameCompilerTrace.frames, executed.gameTrace.frames);
} finally {
  await target.dispose();
}
```

`c1.rbc` is the caller's actual preceding compiler generation. Use
`npm run test:selfhost-game` for the focused public API and admission checks.
