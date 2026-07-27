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
- Batch C provider: `rcl.foundation.batch-c` through `RclVmProviderV1`
- Batch C domains: physical, embodiment
- Batch C receipt: `706b39f9731158570d2fe21a1f80cd532fa11308b04c3a6f1ad7052e279335e0`
- Batch D provider: `rcl.foundation.batch-d` through `RclVmProviderV1`
- Batch D domains: energy, elemental, neural
- Batch D receipt: `4877fe73b3ef8a7f209ce08843e043c590c6747c9a7ab783b9df0232854041e0`
- Batch E provider: `rcl.foundation.batch-e` through `RclVmProviderV1`
- Batch E domains: metacomputation, computation
- Batch E receipt: `51fcf086a3f4d575a36e6d8be9e0f7f2e5c99052d75fd689d97efb6345bec235`

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
| native-batch-c-runtime-invocation | pass |
| native-batch-c-result-shape | pass |
| native-batch-c-selfhost | pass |
| native-batch-c-deterministic-replay | pass |
| native-batch-c-behavior-mutation | pass |
| native-batch-c-causal-chain | pass |
| native-batch-c-physical-semantics | pass |
| native-batch-c-embodiment-semantics | pass |
| native-batch-c-negative-authority | pass |
| native-batch-c-invariant-rejection | pass |
| native-batch-c-evidence-rejection | pass |
| native-batch-c-provider-degradation | pass |
| native-batch-c-physical-rejection | pass |
| native-batch-c-embodiment-rejection | pass |
| native-batch-c-performance | pass |
| native-batch-d-runtime-invocation | pass |
| native-batch-d-result-shape | pass |
| native-batch-d-selfhost | pass |
| native-batch-d-deterministic-replay | pass |
| native-batch-d-behavior-mutation | pass |
| native-batch-d-causal-chain | pass |
| native-batch-d-energy-semantics | pass |
| native-batch-d-elemental-semantics | pass |
| native-batch-d-neural-semantics | pass |
| native-batch-d-negative-authority | pass |
| native-batch-d-invariant-rejection | pass |
| native-batch-d-evidence-rejection | pass |
| native-batch-d-provider-degradation | pass |
| native-batch-d-energy-rejection | pass |
| native-batch-d-elemental-rejection | pass |
| native-batch-d-neural-rejection | pass |
| native-batch-d-performance | pass |
| native-batch-e-runtime-invocation | pass |
| native-batch-e-result-shape | pass |
| native-batch-e-selfhost | pass |
| native-batch-e-deterministic-replay | pass |
| native-batch-e-behavior-mutation | pass |
| native-batch-e-causal-chain | pass |
| native-batch-e-metacomputation-semantics | pass |
| native-batch-e-computation-semantics | pass |
| native-batch-e-negative-authority | pass |
| native-batch-e-invariant-rejection | pass |
| native-batch-e-evidence-rejection | pass |
| native-batch-e-provider-degradation | pass |
| native-batch-e-metacomputation-rejection | pass |
| native-batch-e-computation-rejection | pass |
| native-batch-e-performance | pass |
| native-boundary-explicit | pass |

Batch A, Meta Batch B, Batch C, Batch D and Batch E are counted as bridge mode. Unsupported declared-domain lowering remains explicit and is not counted as native mode.
