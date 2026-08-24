# RCL — Reality Compiler Language

> A self-hosting language and compiler for expressing, validating, and lowering governed state transitions into executable software.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Package](https://img.shields.io/badge/package-v0.94.0--alpha.1-orange.svg)](package.json)
[![Status](https://img.shields.io/badge/status-active%20research-6f42c1.svg)](CURRENT-STATUS.md)

**RCL** is an evidence-bearing, permission-constrained programming language, compiler, native VM, provider runtime, and verification toolchain.

It is designed around a simple idea:

```text
intent
→ explicit state and authority
→ candidate transition
→ validation / invariants
→ lowering or execution
→ evidence
→ governed result
```

RCL currently has a self-hosted native-core compiler path, a native VM, Web and Android lowering paths, a platform-neutral Native UI semantic model, and a permanent cross-environment stress harness.

It does **not** claim to be a universal programming language today. The repository instead defines a falsifiable process for testing how far that objective can be pushed.

**Website / playground:** https://rcl-rncs-mcp.vercel.app  
**Current authority snapshot:** [`CURRENT-STATUS.md`](CURRENT-STATUS.md)  
**Machine-readable capability contract:** [`VERSION-CONTRACT.json`](VERSION-CONTRACT.json)

---

## Why RCL?

Most programming systems start from operations: call a function, mutate state, send a request.

RCL makes the transition itself a first-class object:

- **who** is acting;
- **what authority** permits the action;
- **which state** may change;
- **which invariants** must remain true;
- **what evidence** proves the transition;
- **what happens when validation fails**.

That makes RCL useful as both a programming language experiment and a research platform for governed software, multi-runtime lowering, reproducible execution, and evidence-bound state transitions.

### Minimal example

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

This says more than “increment a number”. It declares a subject, authority, proposed state change, invariant, and witness.

---

## What is verified today?

The package baseline remains **`v0.94.0-alpha.1`**. Exact current evidence lives in [`CURRENT-STATUS.md`](CURRENT-STATUS.md).

| Area | Current state |
|---|---|
| RCL-authored general compiler | **Verified** |
| Native-core compiler fixed point `C0 == C1 == C2` | **Verified** |
| Native VM / compiler path | **Present and tested** |
| Whole-language runtime self-hosting | **Not claimed** |
| Complete Web vertical slice | **8/9 stress gates evidenced; AI generation gate open** |
| Android project / APK generation | **Verified build path** |
| Android installed-device behavior | **Not yet verified in the recorded campaign** |
| Native UI semantic root shared by Web / Android | **Verified for current candidate slices** |
| Native UI navigation + width-profile adaptation | **Candidate, self-hosted slices verified** |
| Universal Program Stress | **Active; most of the 400-cell matrix intentionally remains unknown** |

### Self-hosting

RCL contains a compiler written in RCL, a checked-in fixed-point compiler artifact, and a native compiler / VM path.

```text
RCL compiler source
      ↓
     C0
      ↓
compile compiler with itself
      ↓
     C1
      ↓
compile again
      ↓
     C2

C0 == C1 == C2
```

The project distinguishes **native-core self-hosting** from **whole-language runtime self-hosting**. The former is verified; the latter is not claimed.

---

## Native UI Genome

RCL is developing a platform-neutral UI semantic layer rather than treating Web and Android as unrelated frontends.

Current candidate semantics include:

- state and derived expressions;
- lifecycle and restore policy;
- themes and style rules;
- recursive view trees;
- bindings;
- local events with typed / inferred parameters;
- governed `reality-transaction` declarations;
- fixed sizing intent;
- in-app navigation;
- available-width adaptation profiles.

The same rooted UI program can lower into Web and Android backends.

```text
.rcl source
    ↓
canonical Native UI IR
    ↓
semantic root
   ┌───────────────┐
   ↓               ↓
 Web backend    Android backend
   ↓               ↓
HTML/CSS/JS      Java Views / Gradle
```

A real Chrome run has verified width-profile adaptation for the current candidate, and the Android backend has produced a real Gradle debug APK build from the same semantic root.

Important boundary: Android installation, configuration-change behavior, interaction, and performance on a real device are still unverified in the recorded campaign.

See:

- [`docs/ui-native-genome/current-state-audit.md`](docs/ui-native-genome/current-state-audit.md)
- [`docs/ui-native-genome/native-ui-architecture.md`](docs/ui-native-genome/native-ui-architecture.md)
- [`docs/ui-native-genome/evidence-ledger.md`](docs/ui-native-genome/evidence-ledger.md)

---

## Governed UI events

RCL intentionally separates local UI mutation from reality-affecting actions.

```text
UI-local event
→ local candidate state
→ local validation
→ local commit
```

A governed reality action follows a different path:

```text
UI intent
→ CandidateReality
→ external governed Gateway
→ authority / validation
→ execution
→ evidence
```

The UI layer cannot directly commit external reality. Unknown rule references and mixed-authority handlers fail closed in the verified candidate slices.

---

## Universal Program Stress

RCL's main research harness is a permanent **20 × 20 = 400** environment / program matrix.

### 20 environment families

WASM/VM, Linux, Windows, browser, Android, server, serverless, database, GPU, game runtime, scientific runtime, AI runtime, distributed runtime, real-time runtime, embedded runtime, dataflow runtime, compiler runtime, automation runtime, simulation runtime, and RNCS runtime.

### 20 program families

Algorithm, CLI, GUI, Web, mobile, database, compiler, game, simulation, distributed, real-time, scientific, machine learning, agent, media, automation, security-sensitive, reactive, self-hosting, and mixed-paradigm.

Each evidence-bearing cell is checked through nine **non-compensatory** gates:

1. `EXPRESS`
2. `COMPILE`
3. `LOWER`
4. `EXECUTE`
5. `CORRECT`
6. `ROBUST`
7. `PERFORMANCE`
8. `AI_GENERATE`
9. `EVIDENCE`

A missing required gate blocks the cell. A failed required gate fails the cell. No weighted score can hide a missing hard requirement.

### Current killer-task frontier

| Task | Target | Coverage mode | Current result |
|---|---|---|---|
| **K01** | Self-hosting compiler | native semantic | `BLOCKED (8/9)` |
| **K02** | Complete Web application | lowered execution | `BLOCKED (8/9)` |
| **K03** | Native Android application | lowered execution | `BLOCKED` |
| **K04** | 2D game | next campaign | not yet claimed |

See [`docs/RCL_UNIVERSAL_PROGRAM_STRESS_TEST_v0.1.md`](docs/RCL_UNIVERSAL_PROGRAM_STRESS_TEST_v0.1.md).

---

## Capability modes

RCL uses three explicit modes so integration is not confused with language ownership.

### `native-semantic`

RCL owns the relevant computational semantics in its language, IR, or runtime model.

### `lowered-execution`

RCL owns the relevant semantics and deliberately lowers them into another execution substrate such as a browser, Android runtime, SQL engine, GPU runtime, or other backend organ.

### `opaque-delegation`

RCL delegates the hard problem to an external tool or language and receives a result.

Opaque delegation may be useful, but it does **not** count as native RCL capability.

---

## Frontier research: compiling unknowns into experiments

RCL also contains an experimental Frontier research line for turning unknown-law or unknown-knowledge questions into explicit, falsifiable experiment contracts.

The current structure includes:

```text
unknown question
→ machine-readable hypothesis
→ design grammar
→ preregistration
→ instrument / observation contract
→ independent acquisition
→ scorer
→ evidence ledger
→ candidate tournament
→ evidence court
```

This stack is deliberately conservative about claims. Sandbox success validates protocol behavior under constructed worlds; it does **not** establish new physics, external information channels, or other unsupported real-world conclusions.

Relevant material is under [`docs/`](docs/) with the `FRONTIER_` prefix.

---

## Architecture

```text
                    RCL source
                        │
                parser / type / IR
                        │
              governed semantics
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   native RBC       Web lowering    Android lowering
        │               │                │
        ▼               ▼                ▼
 native VM/runtime   browser host    Android host
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                   evidence
                        │
                        ▼
                 governed result
```

Foundation semantics, provider bridges, Native UI, RNCS bindings, and research organs sit around this core while retaining explicit capability boundaries.

---

## Quick start

### Requirements

- Node.js 22+ for the JavaScript / reference toolchain;
- a supported C/C++ toolchain for native builds;
- Android tooling only if you want to build the Android targets.

### Install and test

```bash
npm install
npm test
```

### Run an example

```bash
node src/cli.mjs run examples/hello-reality.rcl
```

### Build and verify the native toolchain

```bash
npm run build:native
npm run build:selfhost-compiler
npm run verify:selfhost-fixedpoint
npm run verify:selfhost-examples
```

### Verify Foundation bridge coverage

```bash
npm run test:foundation-native-batch-a
npm run test:foundation-native-meta-batch-b
npm run test:foundation-native-batch-c
npm run test:foundation-native-batch-d
npm run test:foundation-native-batch-e
npm run conformance:foundation
```

### Run Universal Program Stress

```bash
node --test tests/universal-program-stress.test.mjs
node scripts/universal-program-stress-report.mjs
node scripts/run-universal-stress-k01.mjs
```

### Build the Web vertical slice

```bash
node scripts/build-k02-web-app.mjs output/universal-stress-k02/index.html
```

### Generate the Android vertical slice

```bash
node scripts/build-k03-android-app.mjs \
  examples/universal-stress/k03-native-android-app.rcl \
  examples/universal-stress/k03-native-android-app.android.json \
  output/universal-stress-k03
```

---

## Anti-cheating rules

RCL's research program explicitly rejects several easy ways to manufacture impressive-looking results:

- **Artifact ≠ execution.** Generated source, HTML, an APK project, SQL, a shader, or config file is not runtime evidence.
- **Provider coverage ≠ native language capability.** Delegating the whole problem does not make that problem native RCL semantics.
- **No special-case inflation.** A failed cell should reveal a reusable missing primitive, not trigger a one-off keyword added only for the demo.
- **No regression inheritance.** New capability cannot be promoted by silently breaking previously verified behavior.
- **No self-certifying AI gate.** The same development session cannot invent a trivial task, reveal the oracle patch to itself, and count that as independent AI-generation evidence.

---

## Maturity ladder

```text
PRE-U0  insufficient broad evidence
U0      Expressive
U1      Generative
U2      Executable
U3      Native-General
U4      Dominant
U5      Universal Mother
```

`U5` is intentionally difficult and is always scoped to measured environments and tasks. It is not a claim about uncomputable problems, unavailable hardware, violations of physical law, or bypassing legal / authority constraints.

---

## Project map

```text
src/                         language / runtime / reference implementation
selfhost/                    RCL-authored compiler sources + fixed-point artifact
native/                      native VM / compiler / provider boundary
examples/                    runnable examples and evidence fixtures
tests/                       conformance, regression and stress tests
scripts/                     build, verification and stress runners
docs/                        architecture, campaigns, evidence and governance
CURRENT-STATUS.md            human-readable current authority snapshot
VERSION-CONTRACT.json        machine-readable release / capability boundary
COMPONENT-VERSIONS.json      governed component identities
```

---

## Development model

RCL does not grow by simply adding features. The intended loop is:

```text
Stress
→ Failure
→ Missing primitive / unabsorbed advantage
→ Candidate design
→ Semantic + execution tests
→ Regression
→ Evidence
→ Selection
→ Inheritance
→ Full matrix rerun
```

A failed experiment is useful when it reveals a real boundary that the language must either absorb, lower correctly, or continue to admit it does not own.

---

## Contributing

RCL is now public and contributions are welcome.

Good contribution targets include:

- minimal reproducible failures in existing semantics;
- missing primitives revealed by the Universal Program Stress matrix;
- backend lowering improvements that preserve RCL-owned semantics;
- differential tests between reference, self-hosted, and native paths;
- performance work on the self-host compiler / VM;
- Native UI semantics, resources, accessibility, and real-device verification;
- documentation that makes evidence boundaries clearer;
- independent AI-generation / repair evaluations for K01 and K02.

Please keep one principle in mind: **a stronger claim requires stronger evidence, not stronger wording.**

---

## Non-claims

This repository currently does **not** claim that:

- RCL can write every possible program;
- the whole language runtime is self-hosted;
- every Foundation domain is native;
- Android device execution is already verified for the current campaign;
- a generated artifact is equivalent to a verified runtime result;
- Frontier sandbox experiments establish new natural laws or external physical effects.

The point of the project is to make those boundaries explicit and testable.

---

## License

Apache-2.0. See [`LICENSE`](LICENSE).
