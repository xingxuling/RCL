# Native UI Verification

## Reproduction

```text
npm run test:native-ui
npm run evidence:native-ui
npm run evidence:native-ui:browser
npm run evidence:native-ui:android-build
npm run evidence:native-ui:selfhost
npm run evidence:native-ui:navigation
npm run evidence:native-ui:device
npm run benchmark:native-ui
```

The evidence generator compiles `examples/native-ui/counter.rcl`, asserts one shared UI root, compares Web and Android semantic fields, and writes canonical IR, lowering reports and traces. Generated projects live under ignored `output/native-ui-genome-v0.1`; compact receipts live under `examples/native-ui/evidence`.

## Verified through 2026-08-24

- Native UI focused suite: 30/30 pass, including one-root fixed-size, navigation and available-width adaptation Web/Android lowering.
- Canonical self-host suite: 6/6 pass, including JS and native C0 → C1 → C2 byte identity, minimal/Counter/parameterized/governed/fixed/navigation/device-adaptation UI differential evidence, valid mutations, numeric normalization and fail-closed negative controls. The adaptation compiler artifact is 265,286 bytes at SHA-256 `00321946e2b4651b4a05b229e7ec650c76375b394afebbc89fb7e095fc28779b`; each native generation executed 88,744,649 instructions, leaving 211,255,351 of the 300 million cap.
- Canonical cross-backend comparison: pass; final state `{count: 0}` after increment, increment, reset.
- Real browser: pass in Chrome `151.0.7922.173`; three real DOM click events plus computed compact/vertical behavior at 320 px and expanded/horizontal behavior at 840 px.
- Android project generation: pass.
- Android Gradle build: pass with Gradle 8.10.2, Android Gradle Plugin 8.7.3, compile SDK 35 and JBR 21.0.8.
- Device-adaptation APK SHA-256: `12d86d20ef4dc40f7cf8e9144389961684ea2fd26cc03adc404211fa9f894d7c`; a build receipt is evidence of build, not installation or behavior.
- Local performance: compile median about 0.53 ms, Web lowering 0.97 ms and Android lowering 0.91 ms on this machine. The generic rooted semantic runtime was about 170× slower than a task-specific JavaScript trace counter. A post-contract real Chrome acquisition completed the 50-sequence workload at 0.884 ms per sequence under the frozen 1.5 ms budget, while remaining about 49.1× slower than the plain DOM Counter. This is a local regression PASS and a recorded donor advantage, not parity.
- Full repository regression: 729 tests, 728 pass, 0 fail and 1 skip in 435.7 seconds for the device-adaptation generation. The clean run recorded byte-identical native C0/C1/C2 in 226.921 seconds. The skip is the existing external import-library/runtime-load case covered by the checked Windows native distribution because Zig is unavailable on this machine.
- Performance isolation: the dedicated self-host evidence script retains the predeclared `<240 seconds` two-generation gate and sealed a 228.989-second PASS. An independent focused run passed at 232.033 seconds; a hot full-suite sample reached 244.305 seconds and is retained in the evidence ledger as host variability. Ordinary regression enforces byte identity, instruction budget/headroom and a 150-second per-process runaway guard; it does not self-certify the dedicated wall-clock benchmark.

## Blocked / unverified

- `adb devices -l` returned no connected device.
- The installed AVD is incomplete and has no usable initial system image, so emulator execution is blocked.
- Real APK installation, event interaction, recreation, screenshots/logcat and device timings are not verified.
- Independent AI-generation evidence is not provided by the same development run.
- Canonical self-host parity is verified for the minimal UI, exact Counter slice, typed or standard-inferred UI-local event parameters, governed `reality-transaction` declarations, fixed width/height intent, canonical in-app navigation and available-width adaptive layout direction. Invalid parameter signatures, unknown governed-rule references, mixed-authority handlers, invalid fixed values, unknown size modes, invalid routes/targets, overlapping ranges and unknown profiles fail closed; runtime reality dispatch requires an external Gateway and produces only `CandidateReality`. Resources, broader adaptation and full accessibility remain unabsorbed or partial.
- The baseline-calibrated browser performance contract is frozen and its post-revision acquisition passed. This closes the local Counter performance gate for `browser::gui` and `browser::reactive`, but not competitive parity, production scale, cross-machine performance or Android-device performance.

Full repository regression results are also recorded in `evidence-ledger.md`; a missing or historically failing test is reported as blocked/fail rather than silently omitted.

The consolidated K400 report records 8 `BLOCKED`, 392 `UNTESTED`, 0 `PASS` and maturity `U0` after adding the separate K08-A native XOR receipt. Browser performance now passes for the declared local workload, but independent `AI_GENERATE` still blocks all browser claims; Android device gates remain separate and non-compensatory.
