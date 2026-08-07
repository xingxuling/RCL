# K01 — RCL Self-hosting Compiler Stress Campaign v0.1

**Campaign status:** BLOCKED — 8/9 gates directly evidenced; `AI_GENERATE` remains UNVERIFIED  
**Killer task:** `compiler-runtime::self-hosting`

## 1. Important correction

K01 tests a **self-hosting compiler**. It does not require the entire RCL runtime, VM, operating-system boundary, or every RCL language feature to be implemented in RCL.

A conventional trusted bootstrap is allowed. The relevant fixed-point shape is:

```text
bootstrap compiler C0
        ↓ compiles RCL compiler source
RCL compiler C1
        ↓ compiles the same RCL compiler source
RCL compiler C2

C1 == C2 byte-for-byte
```

The native VM / `rclc` remains part of the declared execution substrate. Therefore repository fields such as:

```text
fullSelfHosting = false
rclOwnedRuntimeComplete = false
```

are important whole-toolchain boundaries, but they are **not automatic K01 failures**.

## 2. Direct execution evidence captured on 2026-08-07

A local extracted snapshot was first bound back to GitHub `main` by comparing Git blob SHAs for the critical compiler and verification files. The local files matched the repository tree at main commit:

```text
13ce6deb9467af36797340937ba99e67203c6d06
```

Critical blob matches include:

```text
selfhost/compiler.rbc                         7d523237abf9ae64c4b6b7c5f7b938bd5c9ae890
selfhost/compiler-core.rcl                    ea7b27005b35edcc30d1b8fc9da14b18ffc49652
selfhost/compiler-main.rcl                    2d91f0b86390e3998305c742220ac8cdf9178035
scripts/verify-rcl-selfhost-all.mjs           c26632f336fbfa790faa9b58e85cbc2287d8365d
tests/selfhost-toolchain.test.mjs             8e3b987e544c5d813ae910489459bf4618a9fb38
tests/general-selfhost-fixedpoint.test.mjs    f48b0cb07b102cdfcaf085313c831f4d3159be5e
```

### Native build

```text
node scripts/build-native.mjs
```

completed successfully on Linux. The produced `native/rclc` had:

```text
bytes   = 103904
sha256  = 946ad5b7adb86727576d2972f4d68032d376062a6ed11273d82413a9dae7d476
```

### Native self-host fixed point

The compiler source was formed exactly as the production helper does: `compiler-core.rcl + newline + compiler-main.rcl`.

```text
compiler source bytes   = 127825
compiler source sha256  = 662818d50f0fefab3d05b1b6096451231733ce19debc71d23a1549387a93672a
compiler RBC bytes      = 160572
compiler RBC sha256     = a2e9cd44c9afb0a488ef797431f6bbf53e621c756d5b9906ad85bc3fa350789c
```

Direct native runs:

```text
C0 -> C1
elapsed            = 18.93 s
peak RSS           = 99304 KB
peak stack depth   = 880
peak call frames   = 217
C1 sha256          = a2e9cd44c9afb0a488ef797431f6bbf53e621c756d5b9906ad85bc3fa350789c
C1 == C0           = true

C1 -> C2
elapsed            = 19.96 s
peak RSS           = 99304 KB
peak stack depth   = 880
peak call frames   = 217
C2 sha256          = a2e9cd44c9afb0a488ef797431f6bbf53e621c756d5b9906ad85bc3fa350789c
C2 == C1           = true
```

Measured C0 → C1 → C2 total:

```text
38.89 s
```

which is below the existing declared 240 s native fixed-point budget.

### Production self-host toolchain

After building the native compiler:

```text
node --test --test-concurrency=1 tests/selfhost-toolchain.test.mjs
```

returned:

```text
4 tests
4 pass
0 fail
```

The suite verifies the checked-in compiler artifact, native self-host compilation of core/transactional fixtures, invalid-source rejection, and RBC 1.2 feature selection.

### Differential positive parity

Nine representative source fixtures were compiled through the self-hosted native compiler and independently through the JS bootstrap oracle. Result:

```text
9 / 9 exact RBC byte matches
```

Fixtures covered literals, truth/text, reckon/choose, warrants, emergence, resonance, absorption, whole-language parser target, and dynamic provider lowering.

### Negative controls

Eight malformed/unsupported sources were directly submitted to the production self-hosted compiler. Result:

```text
8 / 8 rejected
0 unexpected accepts
```

The failures included misspelled top-level reality syntax, trailing source, unclosed reality, unknown top-level construct, unknown path, unknown call, type mismatch, and currently unsupported native-domain syntax.

Full direct evidence is stored at:

```text
examples/universal-stress/k01-direct-evidence-2026-08-07.json
```

Evidence root:

```text
a3f49b866c736f70e9ddf13d633903574be8ddb7e351d7bc18f47e307f03e7dc
```

## 3. Current nine-gate result

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

Therefore:

```text
K01 overall = BLOCKED
```

not FAIL, and not yet PASS.

## 4. Why `AI_GENERATE` is still blocked

The AI-era gate is intentionally stronger than "this project was developed with AI assistance".

The remaining requirement is reproducible evidence that an AI can make bounded changes to the **RCL-owned compiler itself** and preserve:

```text
self-host fixed point
+ source parity
+ negative controls
+ native execution
+ regression closure
```

The current contract requires at least three evidence-bearing compiler-evolution / compiler-repair trials. It also forbids the same AI session from inventing a trivial mutation, revealing the oracle repair to itself, restoring the known original, and self-certifying success.

See:

```text
examples/universal-stress/k01-ai-generation-contract.json
```

At least one successful trial must come from an independently specified change request or hidden mutation whose oracle patch is unavailable to the generating AI.

## 5. K01 nine-gate interpretation

### EXPRESS

PASS if the general compiler is itself represented as an RCL artifact and emits compiler RBC.

### COMPILE

PASS if the compiler reaches a byte-identical fixed point after bootstrap.

### LOWER

PASS if the RCL compiler artifact lowers source into RBC. Whole-language/runtime ownership is not required for this gate.

### EXECUTE

PASS if the self-hosted compiler executes through the declared native compiler/VM boundary.

### CORRECT

PASS if fixed-point and differential parity evidence hold.

### ROBUST

For K01 v0.1, malformed/unsupported-source rejection plus positive differential parity is the minimum robustness contract.

### PERFORMANCE

For K01 v0.1, the declared fixed-point wall-clock budget is the minimum performance requirement. Competitive compiler dominance is reserved for higher universal-maturity levels.

### AI_GENERATE

PASS only after the independent AI compiler-evolution contract closes.

### EVIDENCE

PASS only with machine-checkable build/run/test receipts and rooted results.

## 6. Execution commands

Focused branch campaign:

```bash
node scripts/run-universal-stress-k01.mjs
```

Existing self-host evidence:

```bash
node scripts/build-native.mjs
node --test --test-concurrency=1 tests/selfhost-toolchain.test.mjs
```

## 7. Next action

K01 is no longer blocked on uncertainty about whether the compiler can self-host. Direct native evidence says it can.

The remaining attack surface is now narrow:

```text
AI_GENERATE
```

The next K01 work should therefore construct an independent AI compiler-evolution trial rather than keep adding self-host compiler features merely to satisfy a test that is already evidenced.
