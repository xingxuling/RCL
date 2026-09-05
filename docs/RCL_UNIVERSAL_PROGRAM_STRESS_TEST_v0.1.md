# RCL Universal Program Stress Test v0.1

**Status:** Candidate research infrastructure  
**Goal:** Build a falsifiable natural-selection environment for RCL's long-term goal of becoming a dominant universal computational reality language.

## 1. Core proposition

RCL is not considered universal because it has many keywords, domains, providers, or demos. The target is:

```text
Intent
→ RCL semantics
→ appropriate computational model(s)
→ lowering / provider organs
→ real target environment
→ execution
→ correctness / robustness / performance evidence
→ governed result
```

For a target environment `E` with an available execution interface and a physically/legal realizable computable program `P`, the long-run research objective is:

```text
EXPRESS(P, RCL)
AND LOWER(P, E)
AND EXECUTE(P, E)
AND VERIFY(P, E)
```

This is a research objective, not a current capability claim.

## 2. Permanent 20 × 20 stress matrix

The matrix is deliberately larger than current RCL evidence. Empty cells are valuable: they are explicit unknowns rather than hidden optimism.

### Environment families (20)

`wasm-vm`, `linux`, `windows`, `browser`, `android`, `server`, `serverless`, `database`, `gpu`, `game-runtime`, `scientific-runtime`, `ai-runtime`, `distributed-runtime`, `realtime-runtime`, `embedded-runtime`, `dataflow-runtime`, `compiler-runtime`, `automation-runtime`, `simulation-runtime`, `rncs-runtime`.

### Program families (20)

`algorithm`, `cli`, `gui`, `web`, `mobile`, `database`, `compiler`, `game`, `simulation`, `distributed`, `realtime`, `scientific`, `machine-learning`, `agent`, `media`, `automation`, `security-sensitive`, `reactive`, `self-hosting`, `mixed-paradigm`.

Total permanent cells:

```text
20 × 20 = 400
```

The row-major matrix assigns stable campaign identities `K001` through `K400` in addition to semantic coordinates such as `browser::web`. Killer-task labels `K01` through `K12` remain a separate compatibility namespace and are always accompanied by their matrix coordinate.

A cell is not PASS merely because RCL can describe the task.

## 3. Nine non-compensatory gates

Every evidence-bearing cell is evaluated through nine gates:

1. `EXPRESS` — can RCL represent the required semantics without hiding the hard part in prose?
2. `COMPILE` — does real RCL compilation succeed?
3. `LOWER` — can the semantics lower to the target execution model?
4. `EXECUTE` — did it run in the claimed environment?
5. `CORRECT` — did observable outputs satisfy the acceptance oracle?
6. `ROBUST` — did declared boundary/error/adversarial cases survive?
7. `PERFORMANCE` — is performance measured against an appropriate reference or declared budget?
8. `AI_GENERATE` — can an AI generate/repair the solution from intent under a reproducible prompt/task contract?
9. `EVIDENCE` — are build/run/test/measurement receipts attached and rooted?

A single `FAIL` fails the cell. Missing evidence blocks it. No weighted average can compensate for a failed required gate.

## 4. Three capability modes

### Native Semantic

RCL owns the relevant computational semantics in its language/IR/runtime model.

### Lowered Execution

RCL owns the semantics and deliberately lowers them into a backend such as Rust, WASM, SQL, CUDA, CPython, a database engine, or another execution organ.

### Opaque Delegation

RCL hands the whole hard problem to an external tool/language and only receives a result.

Opaque delegation is useful provider coverage, but it does **not** count as native RCL language capability and does not qualify RCL for `Native-General` maturity.

## 5. Anti-cheating rules

### No special-case inflation

Failure of `Android × GUI` must not be 'solved' by adding an `android_button` primitive solely for that cell. The preferred response is to identify a more general missing primitive, such as reactive state, UI event graphs, lifecycle semantics, or capability binding, and then rerun every affected cell.

### No regression inheritance

A candidate genome that improves new tasks but damages previously verified tasks is not automatically promotable. Old capability evidence is a regression constraint.

### Artifact ≠ execution

Generated source, IR, APK project, SQL, shader, or config file is not execution evidence. `EXECUTE`, `CORRECT`, `ROBUST`, and `PERFORMANCE` require real environment receipts.

### Provider coverage ≠ language capability

`RCL → Python → entire program in Python` is interoperability evidence unless RCL owns and verifies the relevant semantics before lowering.

## 6. Twelve killer tasks for the first campaign

1. Self-hosting compiler
2. Complete Web application
3. Native Android application
4. 2D game
5. Database service
6. Distributed Actor service
7. GPU numerical program
8. ML training + inference
9. Real-time event system
10. Scientific computing program
11. Agent tool runtime
12. RNCS candidate reality transaction

These deliberately attack different weaknesses: computation, state, UI, concurrency, persistence, distribution, performance, AI, deadlines, numerical semantics, tool execution, authority/evidence/commit.

### K01 direct evidence update — 2026-08-07

K01 was executed directly against a local snapshot whose critical compiler/test files were bound back to GitHub `main` by matching Git blob SHAs. Native `rclc` was built successfully; the RCL-authored compiler reached a byte-identical C0 → C1 → C2 fixed point; 9/9 positive fixtures matched the JS bootstrap oracle byte-for-byte; 8/8 malformed/unsupported negative controls were rejected; and the focused production self-host toolchain returned 4/4 PASS.

Current K01 result:

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

OVERALL      BLOCKED
```

The detailed evidence lives in:

```text
examples/universal-stress/k01-direct-evidence-2026-08-07.json
docs/K01_SELFHOSTING_COMPILER_STRESS_CAMPAIGN_v0.1.md
```

K01 means compiler self-hosting after a trusted bootstrap; it does not silently require the entire RCL runtime/VM/toolchain to be implemented in RCL. Whole-runtime self-hosting is a stronger, separate proposition.

## 7. Evolution loop

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

A donor feature has five possible outcomes:

- `REJECT`
- `ORGAN_ONLY`
- `AUXILIARY_LANGUAGE`
- `EXPERIMENTAL_GENOME`
- `CANONICAL_RCL_GENOME`

`AUXILIARY_LANGUAGE` is reserved for a verified local optimum that keeps its own surface or domain implementation while explicitly declining canonical RCL semantic ownership. It is not opaque provider credit and it does not bypass regression, evidence, or identity-genome gates.

Language Genomics supplies variation. Universal Stress supplies selection pressure.

## 8. Unabsorbed Advantage ledger

If a donor language/runtime repeatedly outperforms RCL on the same task class by a declared margin across multiple generations, record:

```text
UNABSORBED_ADVANTAGE
```

The long-run target is not to claim that RCL already has no weaknesses. It is to drive the set of durable unabsorbed computational advantages toward zero while preserving RCL identity and evidence boundaries.

## 9. Maturity levels

- `PRE-U0`: insufficient evidence even for broad expressibility.
- `U0 Expressive`: broad task semantics can be expressed.
- `U1 Generative`: AI can reproducibly generate solutions for broad expressed tasks.
- `U2 Executable`: real cross-environment execution evidence exists.
- `U3 Native-General`: most passed capability is native-semantic or explicit lowered execution, not opaque delegation.
- `U4 Dominant`: RCL is competitive against appropriate reference languages/stacks across a broad task sample.
- `U5 Universal Mother`: broad matrix coverage, low kernel churn on novel tasks, competitive evidence, and no persistent unabsorbed advantages in the measured scope.

`U5` is intentionally difficult and scoped to measured environments/tasks. It is not a claim about solving uncomputable problems, bypassing unavailable hardware, or overriding physical/legal constraints.

## 10. Evidence format

The baseline evidence file is:

```text
examples/universal-stress/v0.1-baseline-evidence.json
```

It intentionally contains **zero capability claims**. This prevents the research harness from laundering existing architectural aspirations into test results.

A real claim must identify a matrix cell and include:

```json
{
  "id": "linux::cli",
  "coverageMode": "native-semantic",
  "gates": {
    "EXPRESS": {"status": "PASS", "evidence": ["..."]},
    "COMPILE": {"status": "PASS", "evidence": ["..."]},
    "LOWER": {"status": "PASS", "evidence": ["..."]},
    "EXECUTE": {"status": "PASS", "evidence": ["..."]},
    "CORRECT": {"status": "PASS", "evidence": ["..."]},
    "ROBUST": {"status": "PASS", "evidence": ["..."]},
    "PERFORMANCE": {"status": "PASS", "evidence": ["..."]},
    "AI_GENERATE": {"status": "PASS", "evidence": ["..."]},
    "EVIDENCE": {"status": "PASS", "evidence": ["..."]}
  }
}
```

The report runner never upgrades a missing gate to PASS.

## 11. Commands

```bash
node --test tests/universal-program-stress.test.mjs
node scripts/universal-program-stress-report.mjs
node scripts/run-universal-stress-k01.mjs
npm run evidence:k400
```

Optional evidence and output paths:

```bash
node scripts/universal-program-stress-report.mjs path/to/evidence.json output/universal-stress
```

## 12. v0.1 acceptance boundary

v0.1 is complete only when:

- the 400-cell matrix is machine-defined;
- all cells have stable `K001`–`K400` identities and a machine-audited completion verdict;
- duplicate, unknown or coordinate-conflicting evidence claims fail closed before reporting;
- the 9-gate non-compensatory evaluator is tested;
- native/lowered/opaque coverage cannot be conflated;
- special-case inflation and regression are explicit gates for evolution;
- persistent donor advantages can be recorded;
- the four genome-admission outcomes are machine-defined;
- an evidence-empty baseline produces no false capability claims;
- CI runs the focused test suite and emits a report artifact.

It does **not** claim that any of the twelve killer tasks already pass.

## 13. Current K400 campaign state

`examples/universal-stress/k400-current-evidence.json` consolidates current Native UI, admitted K01/K02/K03, bounded Server Web/Reactive, the K04 fixed-step game profile, independently admitted K327 Compiler, K334 Agent and K336 Automation, and K233 evidence without upgrading historical dates or gates. The generated report currently records:

```text
PASS      24
BLOCKED    0
UNTESTED 376
VERDICT    INCOMPLETE
```

K331 `compiler-runtime::realtime` is admitted for one bounded deterministic logical-time profile. Its 20 native rounds, auxiliary scheduler differential, fail-closed controls and 3/3 exact independent repairs are bound to GitHub focused and Windows replay for exact source commit `43d195d98e1bbd4066922bb47a1e24eed816f86b`. Physical clocks, deadlines, interrupts and hard real-time guarantees remain outside the profile.

The twenty-four admitted cells are K063, K064, K078, K083, K085, K098, K124, K138, K188, K233, K321, K322, K326, K327, K329, K331, K332, K333, K334, K336, K337, K338, K339 and K340. K124/K138 are limited to the generated Node loopback profile; K188 is limited to the deterministic K04 fixed-step 2D game profile and generated Canvas projection; K233 is limited to the bounded two-Dense-layer General MLP profile; K321/K322 are limited to the frozen recursive-algorithm native CLI profile; K326 is limited to one bounded in-memory relational query and atomic-insert profile; K327 is limited to its three builtin-lowering repairs and separately admitted compiler-runtime binding; K329/K332 are limited to one integer constant-acceleration trajectory, closed-form oracle and discrete invariant; K331 is limited to deterministic logical time with explicit external-time admission; K333 is limited to its bounded integer-perceptron advisory profile; K334 is limited to one bounded deterministic deliberation/capability/budget/risk/approval/memory profile; K336 is limited to one bounded deterministic dependency/retry/approval/kill-switch/compensation workflow; K337/K338 are limited to the bounded two-transaction compiler-governance profile; K340 is limited to its frozen recursive + declarative + transactional + reactive native profile. The K04 arbitrary-engine/game-generation gap, K326 durable/concurrent relational-runtime gap, K331 physical-time/interrupt gap, K333 floating-point state-root gap, K334 external-agent-I/O gap, K336 external-effect protocol gap and self-host static warrant-validation gap remain open. SQL engines, persistence, concurrency, authenticated external actions, durable agent memory, durable workflow queues, floating-point solvers, arbitrary physics, Tensor Genome promotion, optimizer genome, Transformer, accelerated backends, public server deployment and the remaining 376 matrix cells remain outside this evidence. See `docs/K400_COMPLETION_CAMPAIGN_v0.1.md` and `docs/K08_RCL_NATIVE_AI_CAMPAIGN_v0.1.md`.
