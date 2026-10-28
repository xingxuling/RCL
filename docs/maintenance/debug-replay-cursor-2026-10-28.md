# Bound replay cursor navigation

The existing trace debugger now supports a private advancing cursor over admitted
recorded events. Continue moves to the next pause; reverse-continue moves to the
previous pause; previous/stepBack moves one frame back. Rewinding rebuilds the
variable/watch window from the corresponding recorded prefix. No VM execution,
provider calls, process pause or live DAP server is added by cursor navigation.

```js
import { createDebugReplayCursor } from '@taowind/rcl-reality-forge';

const cursor = createDebugReplayCursor(session, {
  trace, expectedSessionRoot: trustedSessionRoot, expectedTraceRoot: trustedTraceRoot,
});
const step = cursor.step('continue');
const saved = cursor.snapshot(); // rcl.debug-replay-cursor.v1
const resumed = createDebugReplayCursor(session, {
  trace, cursorSnapshot: saved, expectedCursorRoot: saved.cursorRoot,
  expectedSessionRoot: trustedSessionRoot, expectedTraceRoot: trustedTraceRoot,
});
resumed.step('reverse-continue');
```

Session self-roots, supported trace format/version, complete event roots/counts,
strictly ordered event sequences and reconstructed session/frame/window bindings
are checked before stepping. A cursor snapshots its admitted inputs; caller
mutations of inputs, reports or checkpoints do not mutate its private position.
Checkpoint position/sequence/done fields must reproduce the checkpoint root for
that session and trace. External pins are optional consistency anchors supplied
by the caller; roots read from the same untrusted files are not publisher
authentication or proof of actual external execution.

The stateless stepDebugSession API still produces one report without modifying
its input session. It now validates commands, explicit origins and sequence
targets, and reports traceEvidenceVerified=false for frame-only reports without
trace data. The stateful factory requires a trace. Invalid steps do not advance
the cursor or write reports. CLI debug-step accepts reverse-continue; DAP-shaped
request plans include stepBack and reverseContinue using the same commands.

Prototype-like facet identifiers use a null-prototype variable index. Missing
constructor/__proto__ watches remain unavailable, while real facets with these
names retain their own recorded native values.

Five pre-change integrity controls all failed; after the change, fifteen new
checks and twenty-four existing debugger/IDE/profiler checks pass. These include a
real public CLI process and real native trace production for prototype-like
names. `node examples/debug-session/replay-cursor-demo.mjs` exercises advancing,
serialized checkpoint resume and reverse navigation through the public API.
