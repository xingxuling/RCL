# Native UI Verification

## Reproduction

```text
npm run test:native-ui
npm run evidence:native-ui
npm run evidence:native-ui:browser
npm run evidence:native-ui:android-build
npm run benchmark:native-ui
```

The evidence generator compiles `examples/native-ui/counter.rcl`, asserts one shared UI root, compares Web and Android semantic fields, and writes canonical IR, lowering reports and traces. Generated projects live under ignored `output/native-ui-genome-v0.1`; compact receipts live under `examples/native-ui/evidence`.

## Verified on 2026-08-23

- Native UI focused suite: 19/19 pass.
- Canonical cross-backend comparison: pass; final state `{count: 0}` after increment, increment, reset.
- Real browser: pass in Chrome `151.0.7922.173`; three real DOM click events.
- Android project generation: pass.
- Android Gradle build: pass with Gradle 8.10.2, Android Gradle Plugin 8.7.3, compile SDK 35 and JBR 21.0.8.
- APK SHA-256: `14625e0071cfc66f79971d9db147080c5b4291f27b62a9e201d49ef7e6fba3b7`; a build receipt is evidence of build, not installation or behavior.
- Local performance: compile median about 0.97 ms, Web lowering 1.85 ms and Android lowering 1.54 ms on this machine. The generic rooted semantic runtime was about 116× slower than a task-specific JavaScript trace counter, and the real-browser evidence path was about 47× slower than a plain DOM Counter. These are recorded donor advantages, not parity claims.
- Full repository regression: 716 tests, 715 pass, 0 fail and 1 skip in 350.5 seconds. The skip is the existing external import-library/runtime-load case covered by the checked Windows native distribution because Zig is unavailable on this machine.

## Blocked / unverified

- `adb devices -l` returned no connected device.
- The installed AVD is incomplete and has no usable initial system image, so emulator execution is blocked.
- Real APK installation, event interaction, recreation, screenshots/logcat and device timings are not verified.
- Independent AI-generation evidence is not provided by the same development run.
- Canonical self-host parser/lowerer parity is not implemented.
- No pre-registered performance acceptance budget exists, so the performance Matrix gate remains unverified despite measured receipts.

Full repository regression results are also recorded in `evidence-ledger.md`; a missing or historically failing test is reported as blocked/fail rather than silently omitted.
