# RBC 1.3 DOMAIN_CALL Domain Organ ABI v0.1

Status: `CANDIDATE`

This document defines the second/third salvage slices for historical RBC 1.3 `DOMAIN_CALL` (`opcode 45`). The goal is not to restore the stale VM wholesale. The goal is to recover a reusable execution shape that can become a general native organ slot for Capability Metabolism and Native Promotion.

## Decision

`DOMAIN_CALL` is split into four independently governed layers:

1. **RBC candidate encoding** — `src/rbc13-domain-bytecode-candidate.mjs` can materialize literal and dynamic opcode-45 programs under a 1.3 header. It does not modify `compileRealityToBytecode`, so canonical RCL lowering remains RBC 1.1/1.2.
2. **Domain Organ contract** — `src/domain-operation-organ.mjs` gives every operation a content-addressed semantic identity, implementation identity and evidence tier.
3. **Domain Value ABI** — `native/rcl_domain_value.h/.c` defines an owned, recursive, bounded value representation for Null / Number / Truth / Text / Sequence / typed Record values without exposing the private `native/rclvm.c` `Value` layout.
4. **Native Organ ABI** — `native/rcl_domain_organ.h/.c` supplies a bounded C registry and fail-closed invocation gate over Domain Values. A native candidate cannot be invoked through a `native-verified` gate.

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

## Domain Value ABI

Directly exposing the VM-private `Value *` to external organs would couple every organ to the native heap, typed-object IDs and GC/layout changes. Using JSON instead would preserve isolation but force opcode 45 to serialize and parse every typed value, and would risk degrading Quantity/Measurement/Knowledge results into opaque text.

The candidate therefore introduces `RclDomainValueV1` as the membrane between VM and organ.

Supported value families in v0.1:

- Null;
- finite Number;
- Truth;
- length-bearing Text;
- recursive Sequence;
- typed Record with a `type_name`, optional `semantic_type` and named fields.

The ABI owns its memory and supplies init/free/clone/validate/equality operations. Record equality is field-name based rather than insertion-order based.

Fail-closed bounds are part of the ABI:

- maximum nesting depth: 64;
- maximum sequence/record items: 65,536;
- maximum text/type/name payload: 16 MiB;
- duplicate record field names rejected;
- non-finite Number rejected;
- all nested values recursively ABI-validated at the organ boundary.

This is intentionally smaller than the complete current VM `Value` universe. Typed unions/references, compiler AST values and other specialized internal values remain outside the candidate until a real pressure case requires them.

## Native Organ ABI boundary

The C organ registry is bounded (`RCL_DOMAIN_ORGAN_MAX=128`) and requires:

- Organ ABI version 1;
- non-empty domain / operation / semantic identity / implementation identity;
- a declared evidence tier;
- a deterministic declaration;
- a Domain-Value invocation function;
- duplicate operation rejection;
- fail-closed minimum-tier checks before invocation;
- initialized output ownership;
- recursive argument/result Domain Value validation.

A callback receives an array of `RclDomainValueV1` arguments and returns an owned `RclDomainValueV1`. No JSON parser and no raw VM pointer is part of this ABI.

## Promotion bridge

`promoteDifferentialToDomainOrganCandidate()` accepts only a passed, promotion-eligible differential report and can produce **only** `native-candidate`.

`admitNativeVerifiedDomainOrgan()` requires an explicit existing `native-verified` Native Promotion report. It does not manufacture native evidence.

This yields the intended chain:

`Capability Metabolism / salvage semantics`
→ `Independent Differential`
→ `Domain Organ native-candidate`
→ `Domain Value ABI`
→ `fresh opcode-45 VM membrane`
→ `Native Promotion`
→ `native-verified organ`
→ `separate canonical RBC 1.3 governance decision`

## Local evidence

Earlier source/bytecode slice:

- Domain Organ JS contract tests: 3/3 PASS.
- Candidate RBC 1.3 bytecode tests: 3/3 PASS.
- Existing bytecode/native ABI/typed-bytecode focused regression: 18 PASS, 2 platform skips, 0 failures.

Domain Value slice was compiled independently with `cc -std=c11 -Wall -Wextra -pedantic` and executed successfully. The smoke program proved:

- evidence-tier denial occurs before invocation;
- Text crosses the organ boundary losslessly;
- a typed `Quantity`-shaped record with semantic type `Temperature`, numeric value and `°C` unit crosses the boundary by owned deep clone;
- recursive validation and field-name-independent value equality complete without warnings or runtime failure.

A full `npm test` run is still not claimed for this branch because the previous full-suite attempt exceeded the available execution window.

## Not claimed

This slice does not claim:

- current `native/rclvm.c` executes opcode 45;
- canonical RBC has moved to 1.3;
- all 18 historical operations are restored;
- Provider Bridge and Domain Organ semantics are equivalent;
- Domain Value ABI already covers every current RCL internal value family;
- whole-language native execution;
- cross-platform native verification.

## Next gate

The next implementation slice is now narrow and safe: define a **private VM ↔ Domain Value membrane** for the subset needed by the four admitted operations, then patch current `native/rclvm.c` so an RBC 1.3 opcode 45 can dispatch only through the evidence-gated registry.

The first VM integration must ship with **no implicitly trusted operation**. Loader/version/flags/arity/value-conversion failure closure must pass before any organ is registered. Only after that should the four admitted operations be attached one-by-one and subjected to semantic-root, differential, replay and Native Promotion checks.
