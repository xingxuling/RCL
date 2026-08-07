# K01 — RCL Self-hosting Compiler Stress Campaign v0.1

**Campaign status:** CANDIDATE / execution evidence pending on the universal-stress branch  
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

This distinction is necessary to prevent the stress suite from silently changing the task from "self-hosting compiler" into "all implementation layers are self-hosted".

## 2. Existing evidence that K01 can reuse

The repository already contains `tests/general-selfhost-fixedpoint.test.mjs`. Its current test contract includes:

- JS bootstrap `C0`;
- RCL compiler `C1` reproducing the bootstrap artifact;
- RCL compiler `C2` reproducing `C1` byte-for-byte;
- the same fixed point through native `rclc`;
- representative source fixtures whose RCL-self-hosted RBC must match the JS bootstrap oracle byte-for-byte;
- malformed and unsupported source rejection parity;
- a declared native C0 → C1 → C2 wall-clock budget.

`tests/selfhost-toolchain.test.mjs` is part of the same fixed-point evidence contract used by `scripts/verify-rcl-selfhost-all.mjs`.

The K01 adapter intentionally consumes these existing receipts instead of inventing a second self-host definition.

## 3. K01 nine-gate interpretation

### EXPRESS

PASS only if the general compiler is itself represented as an RCL artifact and the artifact emits compiler RBC.

### COMPILE

PASS only if the compiler reaches a fixed point after bootstrap.

### LOWER

PASS only if the RCL compiler artifact actually lowers source into RBC. Whole-language/runtime ownership is not required for this gate.

### EXECUTE

PASS only if the self-hosted compiler executes through the declared native compiler/VM boundary.

### CORRECT

PASS only if fixed-point/parity tests and staged compiler lineage succeed.

### ROBUST

For K01 v0.1, the minimum robustness contract is malformed/unsupported-source rejection parity plus positive differential parity fixtures. Later campaigns may strengthen this with fuzzing and mutation testing.

### PERFORMANCE

For K01 v0.1, a declared wall-clock budget counts as the minimum performance gate. Competitive dominance against other compilers is tracked separately and will be required by higher universal-maturity levels.

### AI_GENERATE

This is deliberately the remaining AI-era gate. The goal is not "AI can write Hello World in RCL". The goal is:

> an AI can make bounded, evidence-bearing changes to the RCL-owned compiler itself, preserve fixed point, preserve regression tests, and avoid opaque delegation.

The contract currently requires at least three successful compiler-evolution / compiler-repair trials. See:

```text
examples/universal-stress/k01-ai-generation-contract.json
```

### EVIDENCE

PASS only when command receipts, fixed-point receipts, and stage evidence are attached. Missing execution evidence stays UNVERIFIED/BLOCKED.

## 4. Expected current shape

Once the existing self-host verifier is actually executed on this branch, the intended interpretation is:

```text
EXPRESS      likely PASS if current fixed-point artifact evidence remains valid
COMPILE      likely PASS if current native fixed-point tests remain valid
LOWER        likely PASS if current RBC self-emission evidence remains valid
EXECUTE      likely PASS if native rclc execution remains valid
CORRECT      likely PASS if fixed-point/parity/stage evidence remains valid
ROBUST       likely PASS under the v0.1 negative/parity contract
PERFORMANCE  likely PASS under the declared 240 s fixed-point budget
AI_GENERATE  UNVERIFIED until three AI compiler-evolution trials have receipts
EVIDENCE     likely PASS if the verifier emits its summary
```

"Likely" is intentional: no gate is promoted until the branch runner actually executes.

## 5. Why this is useful for the universal-language project

The previous interpretation made K01 depend on complete RCL runtime ownership. That would test a different and much larger proposition.

The corrected K01 isolates one capability:

```text
Can RCL host a compiler for RCL that reproduces itself and compiles other RCL programs correctly?
```

This is scientifically cleaner. Whole-runtime self-hosting can be a separate killer task or a stronger future K01 tier.

## 6. Execution command

```bash
node scripts/run-universal-stress-k01.mjs
```

The runner:

1. executes `scripts/verify-rcl-selfhost-all.mjs`;
2. reads `output/selfhost/selfhost-summary.json`;
3. converts existing evidence into the universal nine-gate model;
4. reads the AI-generation contract;
5. writes an evidence-rooted K01 JSON and Markdown report.

A BLOCKED report is a valid result. The runner exits non-zero only for a hard FAIL, not merely for still-unverified AI evidence.
