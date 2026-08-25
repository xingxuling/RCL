# K08-E Tensor Plan Liveness Integration Court

## Decision

Admit last-use reclamation and plan-store telemetry as an `ENGINE_E1_TENSOR_PLAN_LIVENESS_CANDIDATE`. Do not promote Tensor, K233 or any K400 cell from this receipt.

## Canonical ownership

- RCL Tensor Plan remains the owner of tensor identities, SSA dependencies, requested outputs and resource-policy meaning.
- Rust remains the optimized execution organ.
- The JS General MLP lowerer remains an auxiliary compiler candidate and computes no model parameters.
- Reclamation changes storage lifetime only; it does not introduce model, training or operation-specific semantics.

## Admission evidence

- The complete definition/use graph is checked before execution, so dead-value removal cannot permit an SSA name to be redefined.
- Repeated operands decrement one use per operand occurrence.
- Requested intermediate outputs remain pinned even after their last downstream use.
- Unused initial values, last-used inputs and unrequested dead outputs are reclaimed.
- The cumulative `16,777,216`-element allocation gate remains in force; a separate simultaneous-live gate is additive.
- Rust tests, portable K08 execution and the unchanged General MLP differential/checkpoint campaign pass.
- The exact K08-D workload preserved one output root across 14 alternating old/new executions.
- Logical plan-store peak fell from `1,657,080` to `1,856` bytes; controlled median fell from `331.937` to `286.367 ms` (`1.159x`) on this workload.

## Evidence boundary

The memory figures cover values retained by the Tensor Plan map. They exclude allocator metadata, temporary operand/storage clones, file/JSON parsing, native VM state, response serialization and process RSS. The timing result is a same-host candidate comparison for one plan, not a general performance guarantee.

## Rejected claims

- `PROCESS_RSS_REDUCTION`
- `GENERAL_TENSOR_WORKLOAD_SPEEDUP`
- `BUFFER_REUSE`
- `COMPACT_SELF_HOSTED_LOWERING`
- `PERFORMANCE_PARITY_WITH_JAVASCRIPT`
- `NATIVE_AUTODIFF`
- `K400_PROMOTION_FROM_THIS_CANDIDATE`

## Next evidence gate

Measure process RSS and remove per-node operand/storage clones before attempting compact plan or buffer-reuse claims.
