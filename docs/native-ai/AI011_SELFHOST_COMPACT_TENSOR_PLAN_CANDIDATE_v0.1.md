# AI011 / K08-E-F: self-hosted compact Tensor plan candidate v0.1

This candidate absorbs a reusable execution-planning slice into executable RCL.
Given an ordered Tensor-style graph whose nodes declare an id, operation, input
ids and exact storage bytes, RCL now owns:

- duplicate-id, forward-reference, missing-output and positive-allocation checks;
- deterministic last-use calculation, including final-output retention;
- dead-value release and exact-size storage-slot reuse;
- slot count, allocated-byte and live-peak-byte accounting; and
- a fail-closed `ok` / `rejected` plan status.

The source executes through the native RCL VM and the JavaScript bridge only
renders graph input and decodes the resulting semantic state. A generic
JavaScript reference planner differentially checks the RCL result. The bounded
linear graph and dead-value / size-mismatch graph both match the reference;
duplicate, forward-reference and missing-output input is rejected before a
schedule is emitted.

## Evidence boundary

This is a `PASS_SCOPE_BOUND_LOCAL_CANDIDATE` for the RCL-owned ordered-plan
semantic slice. It is not a claim of a Tensor execution backend, buffer alias
safety for arbitrary kernels, process-RSS reduction, GPU residency,
throughput, autodiff, model training or K400 promotion.

Still open under AI011:

- shape/stride/layout-aware reuse safety beyond exact byte-size equality;
- compact graph IR and loop lowering for large real Tensor plans;
- backend proof that a reused slot is not observed after its RCL last-use point;
- persistent buffers, activation checkpointing and multi-device residency; and
- canonical self-host compiler promotion and broader K400 replay.

The execution backend remains an external lowering/provider concern. RCL owns
the plan semantics and the evidence boundary, not the backend's allocator or
kernel implementation.
