# RBC 1.3 DOMAIN_CALL Domain Organ ABI v0.1

Status: `CANDIDATE`

This document defines the second salvage slice for historical RBC 1.3 `DOMAIN_CALL` (`opcode 45`). The goal is not to restore the stale VM wholesale. The goal is to recover a reusable execution shape that can become a general native organ slot for Capability Metabolism and Native Promotion.

## Decision

`DOMAIN_CALL` is split into three independently governed layers:

1. **RBC candidate encoding** — `src/rbc13-domain-bytecode-candidate.mjs` can materialize literal and dynamic opcode-45 programs under a 1.3 header. It does not modify `compileRealityToBytecode`, so canonical RCL lowering remains RBC 1.1/1.2.
2. **Domain Organ contract** — `src/domain-operation-organ.mjs` gives every operation a content-addressed semantic identity, implementation identity and evidence tier.
3. **Native Organ ABI** — `native/rcl_domain_organ.h/.c` supplies a bounded C registry and fail-closed invocation gate. A native candidate cannot be invoked through a `native-verified` gate.

## Evidence tiers

The organ lifecycle is non-compensatory:

`quarantined → differential-verified → native-candidate → native-verified`

A later tier cannot be inferred from registration, naming, implementation language or historical branch status.

- `quarantined`: known historical or extracted operation, no current parity claim.
- `differential-verified`: current differential evidence exists, but no native artifact claim.
- `native-candidate`: differential evidence may be bound to an implementation candidate; Native Promotion is still required.
- `native-verified`: a Native Promotion report has bound the declared cases to a concrete implementation/native receipt.

Canonical language admission is a separate decision even after `native-verified`.

## Why the organ is not the old builtin table

The historical `agent/advanced-runtime-rcl` branch hard-wired 18 operations into `native/rclvm.c`. That shape was too easy to mistake for native Foundation coverage. The modern organ ABI instead makes the operation registry explicit and attaches evidence state to each operation.

The first admitted semantic set remains only:

- `core.echo`
- `quantity.make`
- `quantitative.measure`
- `knowledge.claim`

The remaining 14 historical native-only operations stay quarantined until separate current equivalence evidence exists.

## Candidate bytecode boundary

`assembleRbc13DomainCallProgram()` writes RBC `1.3` and opcode `45` for experiments. Current canonical `decodeBytecode()` intentionally sees opcode 45 as unknown; the candidate decoder overlays the experimental meaning. This is deliberate: the repository can create and inspect future bytecode without silently changing the canonical compiler or current native loader.

The next native-VM integration must therefore be a fresh source patch against current `native/rclvm.c`, not a copy from the stale branch.

## Native ABI boundary

The C ABI uses a bounded registry (`RCL_DOMAIN_ORGAN_MAX=128`) and requires:

- ABI version 1;
- non-empty domain / operation / semantic identity / implementation identity;
- a declared evidence tier;
- an invocation function;
- duplicate rejection;
- fail-closed minimum-tier checks before invocation.

The v0.1 C organ carries JSON request/response envelopes rather than exposing internal VM `Value` layout. This intentionally keeps the organ ABI decoupled from native heap representation while the opcode experiment is still a candidate.

## Promotion bridge

`promoteDifferentialToDomainOrganCandidate()` accepts only a passed, promotion-eligible differential report and can produce **only** `native-candidate`.

`admitNativeVerifiedDomainOrgan()` requires an explicit existing `native-verified` Native Promotion report. It does not manufacture native evidence.

This yields the intended chain:

`Capability Metabolism / salvage semantics`
→ `Independent Differential`
→ `Domain Organ native-candidate`
→ `fresh opcode-45 native implementation`
→ `Native Promotion`
→ `native-verified organ`
→ `separate canonical RBC 1.3 governance decision`

## Local evidence for this slice

Executed against the uploaded RCL source snapshot whose `src/bytecode.mjs`, `src/quantity.mjs` and `src/knowledge.mjs` blobs match current `main`:

- Domain Organ JS contract tests: 3/3 PASS.
- Candidate RBC 1.3 bytecode tests: 3/3 PASS.
- Native C Organ ABI compile + smoke execution: PASS.
- Combined focused suite: 7/7 PASS.
- Existing bytecode/native ABI/typed-bytecode focused regression: 18 PASS, 2 platform skips, 0 failures.

A full `npm test` run exceeded the available execution window and is not claimed as passed.

## Not claimed

This slice does not claim:

- current `native/rclvm.c` executes opcode 45;
- canonical RBC has moved to 1.3;
- all 18 historical operations are restored;
- Provider Bridge and Domain Organ semantics are equivalent;
- whole-language native execution;
- cross-platform native verification.

## Next gate

The next implementation slice is to patch current `native/rclvm.c` to understand the RBC 1.3 header and dispatch opcode 45 into the Domain Organ registry, initially with no default registered organ. That VM patch must first prove loader/version/flags/arity failure closure, then bind only evidence-approved organs and run semantic-root + differential + replay + Native Promotion checks.
