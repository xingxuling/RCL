# Native Android mobile continuation

**Status: PARTIAL_ACQUISITION. The mobile profile grants no new K400 credit.**

The Android frontend now uses actual native `TextView` and `Button` instances.
RCL owns each event mutation, derived label and render projection through the
selected backend. The Java client transports snapshots and renders them; it
does not implement the counter arithmetic. The existing UI IR, Android emitter,
event lowering and target adapters are reused.

The frozen integer counter has an initial value, a configurable step, increment
and reset. The API35 x86_64 Android emulator receives real touch events. The
nineteen-backend campaign is being reacquired with asynchronous ADB transport.
Previous acquisitions are archived with zero current credit.
Rotation recreates the activity in the same process; force-stop/relaunch creates
a new process. Both recover the same state from the still-running RCL backend.
Invalid credentials, stale state, unknown events and denied RCL authority leave
the committed state unchanged. Installed APK bytes, native hierarchy, accessible
labels, button bounds, process IDs and screenshot bytes are bound to the receipt.

![Actual native Android counter](assets/native-mobile-counter.png)

The frozen campaign requires all nineteen selected backends;
acquisition is
still in progress, so its profile index is not admitted and no mobile coordinate
is added yet. When every frozen environment passes, eighteen currently open
coordinates may gain credit; the existing Android coordinate receives an
additional profile. GPU remains outside this contract because its current RBC
interpreter lacks the required Text operations.

The independent contexts received only frozen mutated candidates and task
requirements. Canonical source, oracle edits and sealed inputs were withheld.
They returned exact proposals; the evaluator applied and checked them unchanged.
This uses separate model contexts and makes no operating-system isolation claim.

## Run the native application

With the configured Android emulator and ADB available, after the acquisition
has finished:

```text
npm run demo:native-mobile
```

The command installs the frozen client, starts the local Windows RCL backend and
opens the application. The increment and reset controls can be operated directly.
Ctrl+C closes the owned bridge and removes its ADB reverse mapping. An optional
environment argument selects another supported backend.

```text
npm run demo:native-mobile -- browser
npm run build:native-mobile-bridge
npm run test:native-mobile
npm run run:k400-mobile
npm run verify:k400-mobile
```

The rebuild uses the local offline Gradle/Android SDK setup. Changing the client
requires a new frozen contract and fresh runtime acquisition; existing receipts
cannot be silently rebound. Avoid launching the demo while the serial campaign
is operating the same package and emulator.

## Evidence

- [Frozen contract](../examples/universal-stress/mobile-native/native-counter-contract.json)
- [APK](../examples/universal-stress/mobile-native/native-counter-client.apk)
- [Build receipt](../examples/universal-stress/mobile-native/native-counter-build.json)
- [Historical server runtime receipt](../examples/universal-stress/mobile-native/acquisition-before-async-driver/native-counter-server-runtime.json)
- [Historical Windows receipt](../examples/universal-stress/mobile-native/acquisition-before-ready-fix/native-counter-windows-runtime.json)
- [Historical WASI receipt](../examples/universal-stress/mobile-native/acquisition-before-ready-fix/native-counter-wasm-vm-runtime.json)
- [Independent proposals](../examples/universal-stress/mobile-native/native-counter-proposals.json)
- [Admission checks](../tests/k400-mobile-admission.test.mjs)

Contract root: `4cc02f1bc5e314ce3848ae7e085da52ef82ac1c212dd7aca268cf05c4a4b86dd`.
Historical server report root: `e42fbbc552ccacafee802571c62475b1a99fc8d6bf0db3b917e8f05a9d32f7f5`.
APK SHA256: `b1b315afdb70e518de73d7597cc70fcb3b58687dffb9d5dbed4273131939135c`.

The targeted bridge/admission checks reject forged APK, display,
touch, authority, hierarchy, screenshot and lifecycle evidence. Historical
flows remain independently checkable, while their stale acquisition policies
cannot obtain current admission. The missing-gate regression requires a fresh
receipt and is explicitly skipped until one exists. Android startup, hierarchy
and touch overhead remains separate from native backend measurements.

An actual server acquisition exposed a ready-file publication race: the parent
could observe the file before its JSON write had finished. Separate HTTP and
replica adapters now publish readiness with an atomic rename. Existing frozen
adapters are preserved. The previous Windows/WASI/Linux/Android mobile receipts
and their acquisition policy snapshots are retained in the historical archive,
with zero current credit. All nineteen mobile environments are reacquired
against exact current source bindings. A focused twenty-startup regression
checks readiness, real process identities, authentication and cleanup.

A complete embedded acquisition later failed the unchanged 2000 ms native
execution P95 gate. Synchronous ADB commands also block the Node event loop
that receives asynchronous RCL daemon replies. An actual paired four-touch
flow on the same embedded backend and APK preserved all five state roots;
the four event measurements were 1.14–1.61 s with synchronous transport and
39–50 ms with asynchronous transport. This single pair is diagnostic evidence,
not a general speedup or a K400 pass. Its [raw flows and comparison](evidence/mobile-async-driver/diagnostic.json)
are retained separately from formal receipts.

The separate asynchronous driver preserves actual touch, native hierarchy,
installed APK hashing, screenshot bytes and scoped cleanup. A delayed child
command regression proves the in-process bridge responds before the child
exits. Binary transport and actual command errors are checked. Cold handlers
now reuse the atomic-ready adapter and verify distinct process identities and
real exit. Eight focused bridge/transport/event checks and one actual cold-
handler check pass. All nineteen formal environments are reacquired under the
same frozen source, client, independent proposals and 5000/2000 ms budgets.

This is a connected emulator counter with cooperative in-memory backend state.
It does not establish offline RCL execution inside the APK, backend crash
persistence, physical-device acceptance or completion of the whole mobile
platform. No hosted Actions run is requested; version advancement stays frozen.
