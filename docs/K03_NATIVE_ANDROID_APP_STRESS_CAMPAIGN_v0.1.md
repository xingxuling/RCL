# K03 — Native Android Application Stress Campaign v0.1

**Cell:** `android::mobile`  
**Current result:** `PASS (9/9)` for the bounded K03 transaction UI
**Coverage mode:** `lowered-execution`

## Goal

K03 asks whether an RCL program can own an interactive mobile application's state, authority and transactional behavior, then lower that program into a native Android Activity with a real Gradle project boundary.

It is stronger than emitting a WebView or an APK seed with a static label. The generated Activity contains:

- RCL state initialization and observation;
- authority checks for every governed rule;
- proposed-state evaluation before commit;
- preserve failure closure;
- witness-bearing transaction history;
- native Android View projection;
- Android lifecycle state save/restore.

## Vertical slice

```text
RCL source
├─ facets: app.count / app.input / app.last_action
├─ subject + warrant: user → app.write on app
└─ emergence rules: increment / reset
        ↓
RCL Native Android Application Compiler
        ↓
rcl.android-runtime-manifest.v0.1
        ↓
generated MainActivity.java + Gradle project
        ↓
Android APK / emulator execution
```

The compiler owns the application semantics. Android is the execution organ, so the current claim is `lowered-execution`, not `native-semantic`.

## Implemented evidence

- RCL source compiled into a rooted Android runtime manifest;
- native Java Activity emitted with `TextWatcher`, buttons, transaction dispatch, authority and preserve checks;
- Gradle project emitted with `AndroidManifest.xml`, app module, styles and RCL/RBC assets;
- host semantic replay: observe `first` → increment → reset;
- preserve negative: `RCL_ANDROID_PRESERVE_FAILED:increment` with no commit;
- authority negative: `RCL_ANDROID_AUTHORITY_DENIED:increment:app.write`;
- generated evidence: `examples/universal-stress/k03-direct-evidence-2026-08-08.json`.
- real API 35 emulator install, transaction, lifecycle and timing receipt: `examples/universal-stress/evidence/k03-android-emulator-v0.1.json`.
- Android numeric lowering regression: integer arithmetic now emits `Long` without Java ternary numeric promotion; the rebuilt UI renders `1`, not `1.0`.

## Nine gates

```text
EXPRESS      PASS
COMPILE      PASS
LOWER        PASS
EXECUTE      PASS
CORRECT      PASS
ROBUST       PASS
PERFORMANCE  PASS
AI_GENERATE  PASS
EVIDENCE     PASS

OVERALL      PASS
```

The local Android runtime gates are bounded to `Rcl_Aether_API35_ATD` (API 35, x86_64). Five end-to-end ADB/UIAutomator transaction observations measured p95 `2981.554 ms` against the frozen `5000 ms` budget, and rotation preserved the committed count/action state. Three independent read-only sessions repaired transaction, reactive binding and lifecycle mutations; GitHub run `32871776578`, focused job `97880272426`, bound their saved receipt to the emulator evidence. Physical-device, production-fleet, frame-rendering parity and arbitrary Android generation remain unverified.

## Reproduction

Generate the project:

```bash
node scripts/build-k03-android-app.mjs \
  examples/universal-stress/k03-native-android-app.rcl \
  examples/universal-stress/k03-native-android-app.android.json \
  output/universal-stress-k03
```

Run the compiler and evidence campaign:

```bash
node scripts/run-k03-direct-evidence.mjs
```

With a real Android toolchain, build the APK:

```bash
cd output/universal-stress-k03
./gradle-build.sh
```

The focused GitHub Actions workflow provides the same remote build path and uploads the debug APK artifact. A hosted-runner result must not be inferred until the workflow actually executes and produces the artifact.

## What K03 does not claim

- not a complete Android framework implementation;
- not a native RCL VM running inside the APK;
- not physical-device or production-fleet behavior;
- not arbitrary Android app generation beyond the three frozen independent repair classes;
- not universal-language maturity from one Android cell.

## Next evidence closure

1. Reuse this adapter for adjacent Android program families without silently copying K03 PASS.
2. Preserve physical-device and broader performance work as separate evidence rather than inflating the bounded emulator claim.
3. Keep every new matrix cell subject to all nine non-compensatory gates.
