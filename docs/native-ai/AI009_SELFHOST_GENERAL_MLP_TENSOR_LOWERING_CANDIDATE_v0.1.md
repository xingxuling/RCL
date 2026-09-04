# AI009 Self-Hosted General MLP Tensor Lowering Candidate

**Status:** `PASS_SCOPE_BOUND_LOCAL_CANDIDATE`

**Canonical semantic owner:** RCL

**Execution owners:** native RCL self-host compiler/VM for admission; the existing Rust Tensor engine remains the execution backend.

## What this closes

The former K08-D Tensor lowering path could produce a generic Tensor SSA plan, but the operation-policy decision lived in a JavaScript auxiliary lowerer. This candidate adds an RCL-authored admission genome that is compiled by `selfhost/compiler.rbc` and executed by the native VM before backend consumption.

For the frozen General MLP contract it verifies:

- the declared plan format and positive plan cardinalities;
- exact operation-inventory cardinality (`29,980` nodes);
- the complete generic operation vocabulary: `abs`, `add`, `div`, `matmul`, `mul`, `sub`, `sum`, `transpose`;
- rejection of model-special operations and `provider_call`;
- a canonical manifest hash binding the model-source and contract roots.

The existing JavaScript builder still emits the large plan, and Rust still computes Tensor values. Therefore this is an RCL-owned lowering-admission candidate, not a claim that the entire Tensor plan emitter or backend has moved into RCL Core.

## Local verification

```text
npm run test:selfhost-general-mlp-tensor-lowering
3/3 PASS
```

The positive case uses the existing `29,980`-node General MLP Tensor plan. Native state-root verification passed. Negative cases reject a model-special operation and a mutated manifest root before admission.

## Evidence boundary

This candidate does not grant Tensor backend performance, GPU execution, Autodiff, AdamW, Transformer training, production model generation, or K400 promotion. The next RCL-owned step is to replace the manifest-only bridge with self-hosted typed/shape-aware graph construction while retaining the same generic-operation and root-binding gates.
