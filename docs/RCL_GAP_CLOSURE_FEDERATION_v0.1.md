# RCL Gap Closure Federation v0.1

**Status:** CANDIDATE / SCOPE-BOUND LOCAL EVIDENCE  
**Base:** `xingxuling/RCL@924b130455cc0118fe2971c1c73c5e7f018a347f`  
**Branch:** `codex/rcl-gap-closure-federation-v01`  
**Date:** 2026-09-01

## 0. Target ruling

This batch does **not** redefine every missing provider, device, dataset, browser engine, database engine, GPU kernel, or production model as an RCL Core feature.

The closure rule is:

```text
RCL-owned semantic / governance / compiler seam
→ implement as an executable candidate in RCL
→ negative controls + deterministic roots
→ preserve Canonical Owner boundaries

provider / device / production-data / performance reality
→ keep as Provider / RNCS / external Evidence gap
→ do not fake closure inside RCL
```

This follows the RCL role as the language / IR / governed-transition Canonical owner rather than a monolithic execution provider.

## 1. Multi-civilization federation used

```text
Founder Twin
→ scope: close real RCL gaps, not inflate capability claims

柳清莲 Gate
→ reject owner theft, simulated evidence laundering and fake PASS

洞哥 Grounding
→ exact base binding, baseline/candidate differential, executable tests

Product / UX
→ N/A for this semantic/runtime batch; no user-visible UI changed

Engineering
→ split Core semantics from Provider/runtime obligations

Code
→ implement bounded contracts / state machines / verifier surfaces

Test
→ positive + negative + regression tests

Security
→ authority, idempotency, fencing, kill-switch, root and owner checks

Release
→ Draft PR only, no Canonical promotion

Integration Court
→ 26 new targeted tests + 5 existing regression tests

Evidence Ledger
→ this document + machine-readable receipt + Parent Tool differential
```

## 2. Child-built Parent Engineering Kit usage

The child-built `Parent Engineering Kit v0.1 candidate` was used as a real engineering organ rather than a narrative reference:

- `repo_ground.py` reconstructed candidate and baseline repository state without network or writes.
- `failure_replay.py` executed the same caller-declared K337 test command in candidate and baseline worktrees with `shell=false`.
- Candidate: `2/2 PASS`.
- Baseline: `1/2 PASS`, where the missing-warrant negative control was incorrectly accepted.
- Parent tool verdict: `CANDIDATE_IMPROVEMENT`.

This is direct evidence that the K337 change closes a real behavior gap instead of merely adding a new test around already-correct behavior.

## 3. Gap disposition

### 3.1 `RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION`

**Disposition:** `CANDIDATE_CLOSED / FIXED-POINT REPLAY PENDING`

The self-host compiler now performs an additional static warrant pass after parsing and before canonicalization / bytecode emission.

Rules:

- `*` grants all targets for the declared capability;
- exact target grants exact scope;
- `source` grants hierarchical `source.*` scope;
- a governed rule `need` with a non-empty actor must have a matching warrant;
- missing warrant fails before RBC emission.

Files:

- `selfhost/compiler-main.rcl`
- `tests/k337-selfhost-warrant-static-validation.test.mjs`

Evidence:

- candidate K337 targeted: `2/2 PASS`;
- baseline targeted: `1/2 PASS`;
- Parent differential: `CANDIDATE_IMPROVEMENT`;
- existing K337/K338 + K340 regression suite: `5/5 PASS` in the scoped batch used for the primary receipt; a later alternate compiler-main-only replay additionally produced `7/7 PASS` when K337 targeted cases were included with those existing suites.

Boundary:

- the long self-host fixed-point command exceeded the available bounded execution window; no fresh fixed-point PASS is claimed;
- Canonical promotion remains separate.

### 3.2 `RCL_GAP_AI_019 / RCL_GAP_ASIL_GOVERNED_ENVELOPE`

**Disposition:** `CANDIDATE_CLOSED_FOR_RCL_OWNED_SEMANTIC_SLICE`

Added `src/asil-governed-envelope.mjs`:

```text
ASIL-owned Meaning Root
→ immutable input
→ RCL governed envelope
   evidence roots
   unknown refs
   condition
   effect scope
   proposal-only transition
   authority boundary
   rollback
```

Invariants:

- ASIL remains meaning owner;
- RCL owns the governed envelope only;
- meaning alone grants no authority;
- no Evidence Commit / World Fact / RNCS commit is performed;
- invalid root or owner drift fails closed.

Remaining external gate: live ASIL adapter + cross-repository root differential.

### 3.3 `RCL_GAP_AI_020 / RCL_GAP_SEMANTIC_DECOMPRESSION`

**Disposition:** `CANDIDATE_CLOSED_FOR_RCL_OWNED_TRANSITION_SEMANTICS`

Added `src/semantic-decompression.mjs`.

A C3 → C2 → C1 → C0 transition now preserves:

- one semantic genome root;
- explicit revealed / withheld / unknown partitions;
- monotonically non-decreasing revealed information;
- monotonically non-increasing withheld information;
- invariant unknown set during pure decompression;
- no information introduction;
- Capability Recovery Ratio;
- rollback roots.

Retrieval, inference or training that introduces new information remains a separate rooted transition.

### 3.4 `RCL_GAP_AI_021 / RCL_GAP_ELASTIC_NEURAL_ORGAN_RUNTIME`

**Disposition:** `CANDIDATE_CLOSED_FOR_RCL_OWNED_LIFECYCLE_SLICE`

Added `src/elastic-neural-organ-runtime.mjs`.

Lifecycle:

```text
UNLOADED
→ STAGED
→ ACTIVE
↔ SUSPENDED
→ UNLOADED
or
→ QUARANTINED → UNLOADED
```

Bound to:

- stable organ identity root;
- artifact and dependency roots;
- capability list;
- semantic owner;
- provider settlement root;
- atomicity requirement;
- CPU / RAM / VRAM / network budget;
- fail-closed stale-plan and authority-escalation checks.

RCL owns lifecycle governance, not the neural capability's meaning.

Remaining Provider/runtime gates include real partial checkpoint IO, adapter/expert load, device residency, telemetry and production rollback.

### 3.5 `RCL_GAP_K331_PHYSICAL_TIME_INTERRUPT_PROTOCOL`

**Disposition:** `PARTIALLY_REDUCED`

Added `src/physical-time-protocol.mjs`:

- monotonic physical-time observations;
- clock/provider identity;
- uncertainty;
- deadline + jitter budget;
- idempotent interrupt contract;
- provider settlement with measured lateness.

Explicit non-claim: no hard-real-time or distributed-clock guarantee is created by RCL.

### 3.6 `RCL_GAP_K334_EXTERNAL_AGENT_IO_PROTOCOL`

**Disposition:** `PARTIALLY_REDUCED`

Added `src/external-agent-io-protocol.mjs`:

- agent/provider/capability identity;
- input/model-provenance/session roots;
- sequence and idempotency;
- token/tool budgets;
- response/session continuation receipts;
- no external effect, memory commit or world-fact promotion.

External model/provider execution remains external.

### 3.7 `RCL_GAP_K336_EXTERNAL_EFFECT_PROTOCOL`

**Disposition:** `PARTIALLY_REDUCED`

Added `src/external-effect-protocol.mjs`:

```text
Effect Plan
→ approval + kill-switch gate
→ provider execution
→ rooted settlement
→ optional compensation requirement
```

Includes idempotency and authority checks.

Explicit non-claim: binding an idempotency key is not proof of a durable exactly-once queue. `durableQueueProven=false` remains explicit.

## 4. Second World / URRF architecture gaps absorbed as RCL candidates

These are architecture-derived candidates and are not promoted as Canonical RCL merely by this batch.

### 4.1 Reality Property & World Law

Added `src/physical-property-law.mjs`:

- `PhysicalQuantity` with value / unit / dimension / uncertainty / frame / validity / provenance / authority;
- dimension-safe add/multiply;
- `PhysicalPropertySet`;
- `WorldLawSet`;
- property/law binding;
- provider-produced property transition proposal.

Ownership remains:

```text
RCL = quantity / property / law / constraint / transition semantics
RNCS = canonical world/property truth
Physics Provider = numerical execution
```

### 4.2 Representation Governance

Added `src/representation-governance.mjs`:

- `RepresentationRef`;
- `RepresentationPolicy`;
- evidence-bound multi-dimensional equivalence;
- candidate representation transition;
- visual equivalence cannot silently imply physical equivalence;
- Provider cannot own canonical world truth.

This is the bounded candidate for the earlier representation-policy gap, not proof of full URRF runtime execution.

### 4.3 Second World Runtime Governance

Added `src/second-world-governance.mjs` with RCL semantic contracts for:

- World Time / Causal Clock reference;
- Representation Flow Time;
- Fact World Tree reference;
- Reality Consistency Profile;
- Authority Lease / Epoch / Fencing;
- Subject Reality Horizon;
- Multi-Domain Interest Graph;
- State Replication Policy;
- transport QoS requirement;
- Reality Power Budget;
- Reality Resource Governor Policy.

RNCS remains Canonical world/runtime owner. Transport, storage, power and distributed-runtime implementations remain external providers/infrastructure.

## 5. USCE / Parent-facing verification surface

Added a bounded RCL candidate-verification surface:

```text
candidate.verify.v1
```

It checks:

- candidate root;
- expected owner;
- evidence roots;
- declared claim scope;
- non-escalation flags.

It does **not** certify:

- semantic truth;
- scientific truth;
- aesthetic quality;
- forecast quality;
- ArtifactIR acceptance.

This prevents USCE from using `RCL verification` as a hidden universal evaluator.

## 6. Scope-bound tests

Primary candidate batch:

```text
node --test --test-concurrency=1 \
  tests/candidate-verifier.test.mjs \
  tests/k337-selfhost-warrant-static-validation.test.mjs \
  tests/rcl-governance-gap-closure.test.mjs \
  tests/rcl-external-protocol-gap-closure.test.mjs \
  tests/rcl-reality-property-representation-gap-closure.test.mjs \
  tests/rcl-second-world-governance-gap-closure.test.mjs
```

Result: **26 / 26 PASS**.

Existing focused regression:

```text
node --test --test-concurrency=1 \
  tests/k337-k338-compiler-governance-reactive.test.mjs \
  tests/k340-compiler-mixed-paradigm.test.mjs
```

Result: **5 / 5 PASS**.

No hosted CI PASS is claimed here.

## 7. What remains genuinely open

The instruction “fill the RCL gaps” cannot honestly mean copying every external implementation into RCL. The remaining high-value gaps now split into:

### RCL-owned work still open

- AI001/011/012: Canonical promotion/self-host lowering breadth for Tensor/Autodiff/model topology;
- AI002: graph-governance candidate now owns ordered graph validation, reverse-edge rules, StopGradient filtering and deterministic per-parameter contribution grouping; numeric reverse execution, shape-aware rules, broader corpus and promotion remain open;
- AI009: RCL-owned generic operation admission and manifest binding now have a native self-host candidate; typed/shape-aware graph construction, canonical promotion and backend performance remain open;
- AI008: bounded raw `.rcltype` parsing now has a native RCL candidate with reference-parser parity; multi-module linking, union/nested typed-expression lowering, fixed-point inclusion and promotion remain open;
- AI010 + K333: canonical cross-runtime float/scientific-number state roots. The v2 candidate now covers nested semantic numeric serialization and preserves the v1 default; Windows replay, historical-root migration and canonical promotion remain open;
- AI022: missing production lifecycle semantics not already represented by bounded candidates;
- UI001/UI004: stable Web/native-UI profile semantics still needing broader absorption;
- K326: the reusable semantic contract for rooted snapshots, serializable optimistic conflicts, atomic write sets and Provider durable/recovery receipt admission is now a local candidate; durable storage, isolation implementation, query planning and crash recovery remain Provider-owned and open.

### Provider / infrastructure / data evidence, not Core semantics

- optimized CPU/GPU kernels and throughput;
- device-buffer residency;
- real GPU portability and full-graph accelerator execution;
- production tokenizer corpus admission and licensed multilingual/code data;
- sustained training + final model weights;
- browser standards completeness;
- real Android/device receipts beyond existing bounded profiles;
- durable queues/external actions;
- hard-real-time hardware/clock guarantees;
- durable concurrent database engine;
- real RCL↔ASIL/RNCS/Provider cross-repository execution receipts.

These should be closed by federation/provider evidence rather than by adding fake Core opcodes.

## 8. Promotion rule

This branch remains a **Draft candidate** until:

1. exact GitHub branch/source scope is replayed;
2. self-host fixed-point or a narrower accepted compiler promotion gate completes for the K337 source change;
3. Integration Court reviews owner boundaries;
4. gap-register wording is updated to distinguish candidate-closed semantic slices from external runtime gaps;
5. no Canonical promotion occurs implicitly.
