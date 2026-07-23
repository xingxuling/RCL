# RCL Foundation Conformance

- status: **pass**
- contract: taowind.rcl-foundation-contract.v0.1 0.1.0
- contract root: `34e508fe3b6587e630cc32a075edbad87323c7359434b2a2aaf01cf7e250f7e1`
- reference runtime: native
- native VM: bridge
- Batch A provider: `rcl.foundation.batch-a` through `RclVmProviderV1`
- Batch A domains: quantitative, knowledge, perception, natural-language-reality, understanding-reality, creative-reality
- Batch A receipt: `0ec9121a4c0367e51de068b06d294d4ba2bec4f4a8f5e76ba5c0d253a2288b3d`
- Meta Batch B provider: `rcl.foundation.meta-batch-b` through `RclVmProviderV1`
- Meta Batch B domains: meta-spacetime, meta-acceleration, meta-compression
- Meta Batch B receipt: `1d22b8565c04538abe431b5d644d3776d0e0322cf546e61ce23afc6859741318`

| Check | Status |
| --- | --- |
| manifest-completeness | pass |
| manifest-schema-fields | pass |
| version-compatibility | pass |
| runtime-invocation:examples/eight-domain-foundation.rcl | pass |
| runtime-result-shape:examples/eight-domain-foundation.rcl | pass |
| runtime-invocation:examples/foundation-closure.rcl | pass |
| runtime-result-shape:examples/foundation-closure.rcl | pass |
| runtime-invocation:examples/cognitive-creation-agent.rcl | pass |
| runtime-result-shape:examples/cognitive-creation-agent.rcl | pass |
| runtime-invocation:examples/meta-runtime-foundation.rcl | pass |
| runtime-result-shape:examples/meta-runtime-foundation.rcl | pass |
| module-existence | pass |
| runtime-coverage | pass |
| behavior-mutation | pass |
| deterministic-replay | pass |
| evidence-production | pass |
| negative-authority | pass |
| invariant-rejection | pass |
| root-consistency | pass |
| native-batch-a-runtime-invocation | pass |
| native-batch-a-result-shape | pass |
| native-batch-a-selfhost | pass |
| native-batch-a-deterministic-replay | pass |
| native-batch-a-behavior-mutation | pass |
| native-batch-a-causal-chain | pass |
| native-batch-a-negative-authority | pass |
| native-batch-a-invariant-rejection | pass |
| native-batch-a-evidence-rejection | pass |
| native-batch-a-provider-degradation | pass |
| native-batch-a-performance | pass |
| native-meta-batch-b-runtime-invocation | pass |
| native-meta-batch-b-result-shape | pass |
| native-meta-batch-b-selfhost | pass |
| native-meta-batch-b-deterministic-replay | pass |
| native-meta-batch-b-behavior-mutation | pass |
| native-meta-batch-b-causal-chain | pass |
| native-meta-batch-b-spacetime-semantics | pass |
| native-meta-batch-b-acceleration-semantics | pass |
| native-meta-batch-b-compression-semantics | pass |
| native-meta-batch-b-negative-authority | pass |
| native-meta-batch-b-invariant-rejection | pass |
| native-meta-batch-b-evidence-rejection | pass |
| native-meta-batch-b-provider-degradation | pass |
| native-meta-batch-b-semantic-rejection | pass |
| native-meta-batch-b-performance | pass |
| native-boundary-explicit | pass |

Batch A and Meta Batch B are counted as bridge mode. Unsupported declared-domain lowering remains explicit and is not counted as native mode.
