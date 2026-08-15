# RCL — Reality Compiler Language

**Current package:** `v0.94.0-alpha.1`  
**Canonical source:** `xingxuling/RCL@main`  
**License:** Apache-2.0

> RCL is an evidence-bearing, permission-constrained reality transaction language, compiler, native VM, provider runtime, and verification toolchain.
>
> Its current research program asks a harder question: **can one language evolve toward broad computational universality without hiding missing semantics behind wrappers, prose, or opaque delegation?**

RCL does **not** claim to be a universal language today. The repository now contains a falsifiable research harness that makes that claim progressively testable.

---

## Current era: Universal Program Stress

The main development line has moved beyond “can RCL self-host its compiler?” into a permanent cross-environment stress program.

```text
Intent
→ RCL semantics
→ computational model / lowering organ
→ real target environment
→ execution
→ correctness / robustness / performance evidence
→ governed result
```

The long-run research objective is:

```text
For a physically/legal realizable computable program P
and a target environment E with an execution interface:

EXPRESS(P, RCL)
AND COMPILE(P, RCL)
AND LOWER(P, E)
AND EXECUTE(P, E)
AND VERIFY(P, E)
```

This is a **research objective**, not a current capability claim.

See [`docs/RCL_UNIVERSAL_PROGRAM_STRESS_TEST_v0.1.md`](docs/RCL_UNIVERSAL_PROGRAM_STRESS_TEST_v0.1.md).

---

## 20 × 20 permanent stress matrix

RCL now maintains a machine-defined matrix of:

- **20 environment families** — WASM/VM, Linux, Windows, browser, Android, server, serverless, database, GPU, game runtime, scientific runtime, AI runtime, distributed runtime, real-time runtime, embedded runtime, dataflow runtime, compiler runtime, automation runtime, simulation runtime, RNCS runtime.
- **20 program families** — algorithm, CLI, GUI, Web, mobile, database, compiler, game, simulation, distributed, real-time, scientific, machine learning, agent, media, automation, security-sensitive, reactive, self-hosting, mixed-paradigm.

```text
20 × 20 = 400 permanent cells
```

An empty or blocked cell is useful evidence. It is an explicit unknown, not a hidden success claim.

### Nine non-compensatory gates

Every evidence-bearing cell must pass the required gates independently:

1. `EXPRESS`
2. `COMPILE`
3. `LOWER`
4. `EXECUTE`
5. `CORRECT`
6. `ROBUST`
7. `PERFORMANCE`
8. `AI_GENERATE`
9. `EVIDENCE`

A failed required gate fails the cell. Missing evidence blocks it. No weighted score can compensate for a missing hard requirement.

---

## Current killer-task frontier

| Task | Target | Coverage mode | Current result | Main remaining blocker |
|---|---|---:|---:|---|
| **K01** | Self-hosting compiler | native semantic | `BLOCKED (8/9)` | independent `AI_GENERATE` evidence |
| **K02** | Complete Web application | lowered execution | `BLOCKED (8/9)` | independent `AI_GENERATE` evidence |
| **K03** | Native Android application | lowered execution | `BLOCKED` | real APK/device execution, correctness, performance and independent AI evidence |
| **K04** | 2D game | not yet claimed | `NEXT` | stress campaign not yet closed |

Detailed campaign records:

- [`K01_SELFHOSTING_COMPILER_STRESS_CAMPAIGN_v0.1.md`](docs/K01_SELFHOSTING_COMPILER_STRESS_CAMPAIGN_v0.1.md)
- [`K02_COMPLETE_WEB_APP_STRESS_CAMPAIGN_v0.1.md`](docs/K02_COMPLETE_WEB_APP_STRESS_CAMPAIGN_v0.1.md)
- [`K03_NATIVE_ANDROID_APP_STRESS_CAMPAIGN_v0.1.md`](docs/K03_NATIVE_ANDROID_APP_STRESS_CAMPAIGN_v0.1.md)

### Three-axis scorecard

Universal Stress cell status is retained for compatibility, but it is no longer the only summary of a killer task:

```text
Capability    = all Universal Stress gates except AI_GENERATE
Dominance     = comparable raw candidate/reference arena results
Authorability = the independent AI_GENERATE evidence contract
```

For example, K01 can be `Capability: PASS`, `Dominance: UNVERIFIED` and `Authorability: UNVERIFIED` while its legacy nine-gate cell remains `BLOCKED (8/9)`. This prevents an authoring experiment from hiding direct compiler evidence.

The executable comparison contract is documented in [`RCL_DOMINANCE_ARENA_v0.1.md`](docs/RCL_DOMINANCE_ARENA_v0.1.md).

### K01 — self-hosting compiler

RCL has a general compiler written in RCL, a checked-in fixed-point compiler artifact, a native compiler/VM path, and direct fixed-point evidence.

```text
C0 == C1 == C2
RBC bytes: 160,572
SHA-256: a2e9cd44c9afb0a488ef797431f6bbf53e621c756d5b9906ad85bc3fa350789c
```

Representative source fixtures match the bootstrap oracle byte-for-byte; malformed/unsupported negative controls are rejected. K01 remains blocked only because the AI-era gate requires independent, reproducible compiler-evolution/repair evidence.

### K02 — complete Web application vertical slice

RCL can own application state, subject/warrant authority and governed transactions, then lower a structured Web morphology into a browser artifact and generated HTTP API.

Direct evidence includes real Chromium interaction, DOM projection, preserve-failure rollback behavior and loopback HTTP state/rule execution.

```text
EXPRESS      PASS
COMPILE      PASS
LOWER        PASS
EXECUTE      PASS
CORRECT      PASS
ROBUST       PASS
PERFORMANCE  PASS
AI_GENERATE  UNVERIFIED
EVIDENCE     PASS
```

K02 is therefore `BLOCKED (8/9)`, not PASS.

### K03 — native Android application vertical slice

RCL can compile an application into a rooted Android runtime manifest and emit a real Java Activity + Gradle project with:

- RCL-owned application state;
- subject/warrant authority checks;
- proposed-state evaluation before commit;
- preserve-failure closure;
- witness-bearing transaction history;
- native Android View projection;
- lifecycle save/restore.

The current repository evidence proves project generation and host semantic replay. It does **not** yet prove installed APK/device behavior, so the Android execution/correctness/performance gates remain unverified.

---

## What is verified today

### Native compiler and VM

The native-core compiler has escaped JavaScript after the one-time bootstrap used to produce the initial compiler artifact.

```text
native-core compiler self-hosting: VERIFIED
fixed-point compiler artifact: VERIFIED
native VM/compiler path: PRESENT
whole-language runtime self-hosting: NOT CLAIMED
```

Current native artifacts include the RCL VM/compiler family and provider bridge executables/libraries. The exact governed identities of package, VM, ABI and semantic-root components are tracked separately in [`COMPONENT-VERSIONS.json`](COMPONENT-VERSIONS.json) and [`VERSION-CONTRACT.json`](VERSION-CONTRACT.json).

### Foundation provider execution

A growing set of Foundation semantics executes through RBC 1.2 and `RclVmProviderV1` bridges. These paths are reported as **bridge mode**, not falsely relabeled as native Foundation syntax.

Uncovered/advanced declared-domain semantics still use the JavaScript Reference Runtime.

### Typed toolchain, debugging and packaging

The repository contains working paths for typed modules/packages, typed bytecode/reference/heap/GC experiments, trace/replay, profiler/debug UI, LSP/DAP/IDE bridges, package verification, provider runtime experiments and multiple build/package targets.

These capabilities are useful organs. They do not by themselves prove universal-language maturity.

---

## Capability modes

Universal Stress distinguishes three modes so interoperability cannot be confused with native language capability:

### `native-semantic`

RCL owns the relevant computational semantics in its language / IR / runtime model.

### `lowered-execution`

RCL owns the relevant semantics and deliberately lowers them into another execution substrate such as a browser, Android runtime, SQL engine, GPU runtime or other backend organ.

### `opaque-delegation`

RCL delegates the hard problem to an external tool/language and receives a result.

Opaque delegation can be valuable provider coverage, but it does **not** count as native RCL capability.

---

## Minimal language example

```rcl
reality Counter {
  facet app.count : Number = 0

  subject user {
    warrant app.write on app
  }

  emergence increment {
    cause user
    needs app.write on app
    alter app.count <- app.count + 1
    preserve app.count >= 0
    witness "counter:increment"
  }
}
```

RCL treats state change as a governed transaction: a subject acts under explicit authority, proposed changes must satisfy declared invariants, and successful transitions can carry evidence.

---

## Quick start

Requirements: Node.js 22+ for the JavaScript/reference toolchain; native builds additionally require the repository's supported C/C++ toolchain.

```bash
npm install
npm test
```

Run a simple RCL example:

```bash
node src/cli.mjs run examples/hello-reality.rcl
```

Build the native toolchain and verify the self-hosted compiler:

```bash
npm run build:native
npm run build:selfhost-compiler
npm run verify:selfhost-fixedpoint
npm run verify:selfhost-examples
```

Run Foundation bridge verification:

```bash
npm run test:foundation-native-batch-a
npm run test:foundation-native-meta-batch-b
npm run test:foundation-native-batch-c
npm run test:foundation-native-batch-d
npm run test:foundation-native-batch-e
npm run conformance:foundation
```

Run the Universal Program Stress harness:

```bash
node --test tests/universal-program-stress.test.mjs
node scripts/universal-program-stress-report.mjs
node scripts/run-universal-stress-k01.mjs
```

Run the first vertical Dominance Arena baseline:

```bash
npm run evidence:dominance-arena
```

Run the matched RCL/rustc/CPython compiler microbenchmark:

```bash
npm run evidence:dominance-arena:microbench
```

Build the K02 standalone Web artifact:

```bash
node scripts/build-k02-web-app.mjs output/universal-stress-k02/index.html
```

Generate the K03 Android project:

```bash
node scripts/build-k03-android-app.mjs \
  examples/universal-stress/k03-native-android-app.rcl \
  examples/universal-stress/k03-native-android-app.android.json \
  output/universal-stress-k03
```

---

## Anti-cheating rules

The universal-language program deliberately forbids several easy ways to manufacture impressive-looking results:

- **Artifact ≠ execution.** Generated source, HTML, APK project, SQL, shader or config is not runtime evidence.
- **Provider coverage ≠ language capability.** Delegating the entire program to another language does not make that program native RCL.
- **Tool availability ≠ dominance.** A reference version probe or a successful process exit is not a competitive comparison.
- **No weighted dominance claims.** A losing required metric cannot be hidden by an average score.
- **No special-case inflation.** A failed cell should expose a general missing primitive, not cause one ad-hoc keyword to be added only for that demo.
- **No regression inheritance.** A new capability cannot be promoted by silently breaking already verified cells.
- **No self-certifying AI gate.** The same development session cannot invent a trivial task, reveal the oracle patch to itself and count that as independent AI generation evidence.

---

## Maturity ladder

Universal Stress uses the following research ladder:

```text
PRE-U0  insufficient broad evidence
U0      Expressive
U1      Generative
U2      Executable
U3      Native-General
U4      Dominant
U5      Universal Mother
```

`U5` is intentionally difficult and always scoped to measured environments/tasks. It is not a claim about uncomputable problems, unavailable hardware, physical-law violations or bypassing legal/authority constraints.

---

## Honest boundary

As of the current `v0.94.0-alpha.1` package baseline:

- Stage40 native-core self-hosting remains verified.
- Whole-language runtime self-hosting is **not** claimed.
- K01 and K02 each have 8/9 stress gates directly evidenced and remain blocked on independent AI-generation evidence.
- K03 has a real Android lowering/project-generation path, but real APK installation/device execution remains unverified in the recorded campaign.
- Native Foundation coverage is partial and bridge-based where documented.
- A large fraction of the 400-cell Universal Stress matrix remains unknown by design.
- The compiler Dominance Arena retains an executable RCL K01 baseline with tool probes only; that broad self-hosting comparison remains `UNVERIFIED`.
- The separate arithmetic-chain microbenchmark has real RCL/native-VM, rustc and CPython reference paths. RCL beats Rust on the required raw metrics but loses CPython on artifact footprint, so the multi-reference result is `Dominance: FAIL`; it does not establish whole-language, ecosystem, memory, authorability or commercial-product superiority.
- “RCL can write any program” is **not** a repository claim. The repository instead defines how that proposition must be attacked, measured and potentially falsified.

For the machine-readable current contract, use [`VERSION-CONTRACT.json`](VERSION-CONTRACT.json). For the human-readable authority snapshot, use [`CURRENT-STATUS.md`](CURRENT-STATUS.md).

---

## Project map

```text
src/                         language/runtime/reference implementation
selfhost/                    RCL-authored compiler sources + fixed-point artifact
native/                      native VM/compiler/provider boundary
examples/                    runnable examples and evidence fixtures
tests/                       conformance, regression and stress tests
scripts/                     build, verification and stress runners
docs/                        architecture, campaigns, evidence and governance
CURRENT-STATUS.md            human-readable current authority snapshot
VERSION-CONTRACT.json        machine-readable release/capability boundary
COMPONENT-VERSIONS.json      governed component identities
```

---

## Development principle

RCL's long-term strategy is not “add enough features until the language sounds universal.”

It is:

```text
Stress
→ Failure
→ Missing primitive / unabsorbed advantage
→ Gene search
→ Hybrid candidate
→ Semantic + execution tests
→ Regression
→ Selection
→ Inheritance
→ Full matrix rerun
```

A failed experiment is therefore a useful result: it identifies a real boundary that the language must either absorb, lower correctly, or continue to admit it does not own.

---

## Historical releases

Older v0.x sections previously embedded in this README were development history, not the current authority state. Git history preserves them permanently. Current status should be read from:

1. [`package.json`](package.json)
2. [`CURRENT-STATUS.md`](CURRENT-STATUS.md)
3. [`VERSION-CONTRACT.json`](VERSION-CONTRACT.json)
4. evidence-bearing campaign documents under [`docs/`](docs/)

---

## License

Apache-2.0.
