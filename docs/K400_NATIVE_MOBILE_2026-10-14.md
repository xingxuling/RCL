# Native Android mobile continuation

**Status: PARTIAL_ACQUISITION. The mobile profile grants no new K400 credit.**

The Android frontend now uses actual native `TextView` and `Button` instances.
RCL owns each event mutation, derived label and render projection through the
selected backend. The Java client transports snapshots and renders them; it
does not implement the counter arithmetic. The existing UI IR, Android emitter,
event lowering and target adapters are reused.

The frozen integer counter has an initial value, a configurable step, increment
and reset. The API35 x86_64 Android emulator receives real touch events. The
server backend has passed 20 complete four-touch flows, ten sealed input flows,
three effective semantic mutations and three unchanged independent repairs.
Rotation recreates the activity in the same process; force-stop/relaunch creates
a new process. Both recover the same state from the still-running RCL backend.
Invalid credentials, stale state, unknown events and denied RCL authority leave
the committed state unchanged. Installed APK bytes, native hierarchy, accessible
labels, button bounds, process IDs and screenshot bytes are bound to the receipt.

![Actual native Android counter](assets/native-mobile-counter.png)

The frozen campaign requires all nineteen selected backends. Eighteen remain;
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
- [Current server runtime receipt](../examples/universal-stress/mobile-native/native-counter-server-runtime.json)
- [Historical Windows receipt](../examples/universal-stress/mobile-native/acquisition-before-ready-fix/native-counter-windows-runtime.json)
- [Historical WASI receipt](../examples/universal-stress/mobile-native/acquisition-before-ready-fix/native-counter-wasm-vm-runtime.json)
- [Independent proposals](../examples/universal-stress/mobile-native/native-counter-proposals.json)
- [Admission checks](../tests/k400-mobile-admission.test.mjs)

Contract root: `4cc02f1bc5e314ce3848ae7e085da52ef82ac1c212dd7aca268cf05c4a4b86dd`.
Current server report root: `e42fbbc552ccacafee802571c62475b1a99fc8d6bf0db3b917e8f05a9d32f7f5`.
APK SHA256: `b1b315afdb70e518de73d7597cc70fcb3b58687dffb9d5dbed4273131939135c`.

The targeted bridge/admission checks reject forged APK, display,
touch, authority, hierarchy, screenshot and lifecycle evidence. Server native
compile/execute P95 is approximately 466/493 ms. Android startup, hierarchy and
touch overhead is retained separately from these native backend measurements.

An actual server acquisition exposed a ready-file publication race: the parent
could observe the file before its JSON write had finished. Separate HTTP and
replica adapters now publish readiness with an atomic rename. Existing frozen
adapters are preserved. The previous Windows/WASI/Linux/Android mobile receipts
and their acquisition policy snapshots are retained in the historical archive,
with zero current credit. All nineteen mobile environments are reacquired
against exact current source bindings. A focused twenty-startup regression
checks readiness, real process identities, authentication and cleanup.

This is a connected emulator counter with cooperative in-memory backend state.
It does not establish offline RCL execution inside the APK, backend crash
persistence, physical-device acceptance or completion of the whole mobile
platform. No hosted Actions run is requested; version advancement stays frozen.
