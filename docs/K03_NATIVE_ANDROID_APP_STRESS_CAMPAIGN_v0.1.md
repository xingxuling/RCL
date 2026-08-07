# K03 — Native Android Application Stress Campaign v0.1

**Cell:** `android::mobile`  
**Current result:** `BLOCKED`  
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

## Nine gates

```text
EXPRESS      PASS
COMPILE      PASS
LOWER        PASS
EXECUTE      UNVERIFIED
CORRECT      UNVERIFIED
ROBUST       PASS
PERFORMANCE  UNVERIFIED
AI_GENERATE  UNVERIFIED
EVIDENCE     PASS

OVERALL      BLOCKED
```

The missing Android gates are intentional. The current execution environment has Java but no Android SDK, Gradle, `adb` or emulator. Host replay proves the generated semantic plan, not the APK's real device behavior.

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
- not verified APK installation or emulator behavior in this campaign;
- not independent AI generation evidence;
- not universal-language maturity from one Android cell.

## Next evidence closure

1. Build the generated project with Gradle/Android SDK.
2. Install the APK on an emulator or physical device.
3. Exercise input observation, increment, reset, preserve failure and activity recreation.
4. Record APK hash, device image, timings, screenshots/logcat and replay results.
5. Run an independent AI generation/repair trial before changing `AI_GENERATE`.
