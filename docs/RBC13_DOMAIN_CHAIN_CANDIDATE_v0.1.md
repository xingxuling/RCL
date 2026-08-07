# RBC 1.3 Domain Organ Chain Candidate v0.1

Status: `CANDIDATE / NOT NATIVE-VERIFIED`

This document records the first end-to-end candidate execution chain built from the salvaged RBC 1.3 `DOMAIN_CALL` concept without modifying canonical `src/bytecode.mjs`, `native/rclvm.c` or `native/rclvm.h`.

## Architecture now exercised

`RBC 1.3 candidate encoding`
→ `opcode 45`
→ `candidate VM materialization`
→ `public candidate registration ABI`
→ `evidence-tiered Domain Organ registry`
→ `VM ↔ Domain Value membrane`
→ `external candidate organ`
→ `native typed Value`
→ `state / semantic root`

The candidate VM defaults its minimum accepted organ tier to `native-verified`. The test host must explicitly lower that minimum for experimental candidate execution. Therefore merely linking or registering an organ is insufficient to make it executable under the default gate.

## Four admitted candidate implementations

The original stale branch contained 18 hard-wired native operations. The modern salvage admits C implementations only for the four operations that already had a reconstructable source/reference meaning:

1. `core.echo`
2. `quantity.make`
3. `quantitative.measure`
4. `knowledge.claim`

The other 14 historical operations remain quarantined.

## Candidate composition vocabulary

The candidate RBC assembler now supports:

- finite Number;
- Truth;
- Text;
- recursive Sequence values lowered through existing sequence builtins;
- `{ $state: "path" }` references that load results from earlier calls.

This is enough to test actual cross-operation composition rather than isolated function calls.

## Executed local chain

The following chain was executed against the uploaded native source snapshot:

1. `quantity.make("Temperature", 25, "") → q.value`
2. `quantity.make("Temperature", 0.5, "") → q.uncertainty`
3. `quantitative.measure("Temperature", q.value, q.uncertainty, 0.9, "", "ratio", ["sensor:e1", "sensor:e1", "sensor:e2"], "sensor-A") → measure.temp`
4. `knowledge.claim("Temperature", q.value, 0.8, ["e1", "e1", "e2"], "lab", "local", "provisional", ["dep:a", "dep:a", "dep:b"], 1, "root-1") → knowledge.temp`

Execution result:

- exit code: `0`;
- RBC version: `1.3`;
- instructions executed: `51`;
- peak stack depth: `10`;
- typed objects allocated/registered: `7 / 7`;
- state entries: `4`.

The Measurement output preserves repeated evidence because the current `measurement()` oracle does so. The Knowledge output deduplicates evidence and dependencies because the current `knowledgeClaim()` oracle uses set semantics.

## Semantic parity result

The candidate native state was normalized by removing native heap/layout metadata and compared with objects produced independently by current:

- `src/quantity.mjs::quantity`;
- `src/quantity.mjs::measurement`;
- `src/knowledge.mjs::knowledgeClaim`.

The complete four-entry native candidate state and current JavaScript oracle state were semantically identical after normalization.

Both independently canonicalize to:

`736b336eecb96c4fb3a02eaa7d4b9d6e07fd126d65de31d541cf47444bc33509`

The uploaded native VM predates PR #29 native state-root emission, so this local run did not claim a VM-emitted root. The checked-in exact-current-source test requires the materialized current VM to emit that same semantic root.

## Negative controls executed locally

The candidate VM also failed closed for:

- candidate organ under the default `native-verified` minimum tier;
- missing domain operation;
- unknown quantity type;
- measurement confidence above 1;
- measurement value/base-type mismatch;
- knowledge confidence above 1;
- knowledge value/base-type mismatch;
- unsupported VM value kinds at the Domain Value membrane.

Legacy RBC 1.1 execution remained functional in the candidate VM.

## Public candidate registration ABI

The candidate VM now exposes an experimental host boundary through `native/rcl_domain_vm_candidate.h`:

- `rclvm_instance_register_domain_organ`;
- `rclvm_instance_set_domain_minimum_tier`;
- `rclvm_instance_domain_organ_count`;
- `rclvm_instance_domain_minimum_tier`.

The host no longer needs to access `instance->vm.domain_organs` or any other private `RclVmInstance` field. Domain organ identity strings are owned by the registry, so a host may release temporary registration descriptors after registration.

## What this proves

This slice proves that the salvaged `DOMAIN_CALL` idea can be reconstructed as a general, external, evidence-gated native organ mechanism rather than an 18-builtin VM patch.

It also proves a nontrivial typed chain can cross the candidate membrane while retaining current Quantity / Measurement / Knowledge semantics on the executed cases.

## What this does not prove

It does **not** prove:

- any organ is `native-verified` under the existing Native Promotion system;
- formal operation-specific Independent Differential reports have executed on the current branch;
- canonical RBC should become 1.3;
- canonical `rclvm.h` should expose this API yet;
- the other 14 historical operations should be restored;
- complete Domain Value coverage for unions, references, compiler AST values or every RCL type;
- whole-language native execution.

## Promotion gate

The next valid promotion sequence is per operation, not aggregate:

`operation-specific differential corpus`
→ `negative-control detection`
→ `implementation artifact binding`
→ `candidate VM execution receipt`
→ `semantic-root parity`
→ `deterministic replay`
→ `Native Promotion`
→ `native-verified Domain Organ`

Only after those gates should canonical RBC 1.3 / opcode 45 admission be considered.
