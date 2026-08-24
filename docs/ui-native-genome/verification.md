# Native UI Verification

## Reproduction

```text
npm run test:native-ui
npm run evidence:native-ui
npm run evidence:native-ui:browser
npm run evidence:native-ui:android-build
npm run evidence:native-ui:selfhost
npm run evidence:native-ui:navigation
npm run benchmark:native-ui
```

The evidence generator compiles `examples/native-ui/counter.rcl`, asserts one shared UI root, compares Web and Android semantic fields, and writes canonical IR, lowering reports and traces. Generated projects live under ignored `output/native-ui-genome-v0.1`; compact receipts live under `examples/native-ui/evidence`.

## Verified through 2026-08-24

- Native UI focused suite: 26/26 pass, including one-root fixed-size and navigation Web/Android lowering.
- Canonical self-host suite: 6/6 pass, including JS and native C0 → C1 → C2 byte identity, minimal/Counter/parameterized/governed/fixed/navigation UI differential evidence, valid mutations, numeric normalization and fail-closed negative controls. The navigation compiler artifact is 249,866 bytes at SHA-256 `836fd9dd246915411a7ccc4f0b09be59591c1a63de90d6a01b1425098aef079b`; each native generation executed 82,329,281 instructions, leaving 217,670,719 of the 300 million cap.
- Canonical cross-backend comparison: pass; final state `{count: 0}` after increment, increment, reset.
- Real browser: pass in Chrome `151.0.7922.173`; three real DOM click events.
- Android project generation: pass.
- Android Gradle build: pass with Gradle 8.10.2, Android Gradle Plugin 8.7.3, compile SDK 35 and JBR 21.0.8.
- APK SHA-256: `db5c14dbc008eb509e585e0dfb5064c5821af42e372a8866c74160c0ae19e755`; a build receipt is evidence of build, not installation or behavior.
- Local performance: compile median about 0.53 ms, Web lowering 0.97 ms and Android lowering 0.91 ms on this machine. The generic rooted semantic runtime was about 170× slower than a task-specific JavaScript trace counter, and the real-browser evidence path was about 56× slower than a plain DOM Counter. These are recorded donor advantages, not parity claims.
- Full repository regression: 724 tests, 723 pass, 0 fail and 1 skip in 375.7 seconds for the navigation generation. An initial run had one transient Windows `EPERM` at the RCLApp atomic directory rename; the exact file passed 3/3 immediately afterward and the unchanged full suite then passed cleanly. The navigation tokenizer survived the ordinary Node heap without increasing it. The skip is the existing external import-library/runtime-load case covered by the checked Windows native distribution because Zig is unavailable on this machine.

## Blocked / unverified

- `adb devices -l` returned no connected device.
- The installed AVD is incomplete and has no usable initial system image, so emulator execution is blocked.
- Real APK installation, event interaction, recreation, screenshots/logcat and device timings are not verified.
- Independent AI-generation evidence is not provided by the same development run.
- Canonical self-host parity is verified for the minimal UI, exact Counter slice, typed or standard-inferred UI-local event parameters, governed `reality-transaction` declarations, fixed width/height intent and canonical in-app navigation. Invalid parameter signatures, unknown governed-rule references, mixed-authority handlers, invalid fixed values, unknown size modes, invalid routes/targets and multiple transitions fail closed; runtime reality dispatch requires an external Gateway and produces only `CandidateReality`. Resource and device-adaptation extensions remain unabsorbed.
- No pre-registered performance acceptance budget exists, so the performance Matrix gate remains unverified despite measured receipts.

Full repository regression results are also recorded in `evidence-ledger.md`; a missing or historically failing test is reported as blocked/fail rather than silently omitted.

The SHA-bound Integration Court report for `native-ui-genome-v0.1-candidate-7-selfhost-navigation` records 5 `BLOCKED`, 395 `UNTESTED`, 0 `PASS` and maturity `U0`, with report root `48ba5bc4cdd070280b126dd3fb78e04c1ab1b17cef6c9a5e011d32b975eac1f7`. Navigation and compiler-performance evidence do not compensate for the independent browser-performance, Android-device or `AI_GENERATE` gaps.
