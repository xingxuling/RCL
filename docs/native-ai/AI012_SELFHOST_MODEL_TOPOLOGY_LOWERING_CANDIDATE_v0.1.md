# AI012 Self-Hosted Model Topology Lowering Candidate

**Status:** `PASS_SCOPE_BOUND_LOCAL_CANDIDATE`

**Canonical semantic owner:** RCL

**Execution owners:** the native RCL self-host compiler/VM owns admission; the existing JavaScript graph builder and Rust Tensor/Autodiff backend remain separate execution organs.

## What this closes

The K08-I through K08-P genomes already expressed decoder, GQA, RoPE and multi-block semantics, but a hosted JavaScript builder still assembled the complete Tensor/Autodiff graph. This candidate adds a rooted RCL-owned topology-to-graph admission seam.

For the frozen two-block decoder topology it verifies:

- decoder dimensions, even head geometry and query-to-KV grouping;
- contiguous block order and block-scoped parameter identity;
- embedding, every decoder block, language-model head and loss stage coverage;
- exact graph parameter-set binding in both directions;
- a generic Tensor operation vocabulary with required graph primitives;
- graph cardinality and operation-total consistency;
- independent topology and graph-manifest roots before native admission.

The candidate does not move the full graph constructor into self-hosted RCL and does not execute Tensor values. It is therefore a topology/graph admission candidate, not a completed self-hosted Transformer compiler.

## Local verification

```text
npm run test:selfhost-model-topology-lowering
3/3 PASS
```

The positive fixture has two decoder blocks, fourteen trainable parameter identities and a twenty-four-node generic Tensor graph. Negative cases reject a missing parameter, missing block stage, model-special operation and root drift. Native semantic-state-root verification passed.

## Evidence boundary

This candidate grants only the RCL-owned topology-to-generic-graph admission slice. It does not grant typed/shape-aware graph construction, numeric Tensor/Autodiff execution, backend performance, GPU execution, production Transformer training, autoregressive quality or K400 promotion.

The next RCL-owned step is to replace this manifest admission with self-hosted typed/shape-aware graph construction and bind its generated graph to the existing AI002 reverse-graph governance and AI011 compact-plan/liveness contracts.
