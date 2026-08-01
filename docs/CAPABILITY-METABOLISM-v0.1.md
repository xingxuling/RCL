# RCL Capability Metabolism v0.1

## Purpose

Capability Metabolism is the first executable layer for RCL's capability-absorption path.
It does not treat an external language or framework as a permanent black-box provider.
Instead it records a bounded progression:

```text
external construct
→ normalized capability specification
→ semantic kernel
→ generated RCL dialect/effects/policy/store
→ declared equivalence evidence
→ absorption-stage assessment
→ candidate cross-domain synthesis organ
```

## What v0.1 implements

- A typed external-capability manifest.
- Semantic extraction for operations, effects, invariants, failure modes, resources, authority and lowering targets.
- Generation of compilable RCL declarations.
- Reuse of the existing native absorption kernel, capability verifier and content-addressed reality store.
- Declared-output equivalence checks with explicit evidence boundaries.
- Stage classification: `semantic-absorbed`, `bridge-verified`, `native-candidate`, or `rejected`.
- Cross-domain synthesis of multiple accepted capability reports.

## What v0.1 does not claim

- It does not automatically parse arbitrary external source code.
- It does not independently execute SQL, Rust or another external runtime.
- `native-candidate` does not mean the capability is already implemented in the native RCL VM.
- Canonical equality of supplied outputs is weaker than independent differential execution.

## Why this layer is necessary

Without a metabolism contract, "absorption" collapses into vague adapter integration.
The contract forces every candidate capability to expose:

1. the operation it contributes;
2. the semantic effects it causes;
3. the invariants it must preserve;
4. its failure and resource models;
5. authority requirements;
6. lowering and remaining provider dependencies;
7. evidence that survives translation;
8. explicit gaps before native status.

## Current examples

- `relational_transaction`: transaction, rollback and serialization evidence inspired by SQL semantics.
- `ownership_lifecycle`: exclusive ownership transfer and lifetime evidence inspired by Rust semantics.
- `transactional_owned_reality`: a compound candidate organ produced by synthesizing both reports.

## Next engineering gates

1. Add source-language front ends that produce the capability manifest from parsers or formal specifications.
2. Add independent differential runners for source runtime versus RCL candidate runtime.
3. Lower accepted semantic kernels into executable RBC rather than declaration-only RCL.
4. Promote a candidate to native only after native-VM parity, negative controls and replay evidence pass.
5. Add conflict-resolution rules for cross-domain synthesis.

## Verification

```bash
node --test --test-concurrency=1 tests/capability-metabolism.test.mjs
node examples/capability-metabolism-demo.mjs
```
