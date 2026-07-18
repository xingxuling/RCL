# RCL Foundation Conformance

- status: **pass**
- contract: taowind.rcl-foundation-contract.v0.1 0.1.0
- contract root: `34e508fe3b6587e630cc32a075edbad87323c7359434b2a2aaf01cf7e250f7e1`
- reference runtime: native
- native VM: bridge
- Batch A provider: `rcl.foundation.batch-a` through `RclVmProviderV1`
- Batch A domains: quantitative, knowledge, perception, natural-language-reality, understanding-reality, creative-reality
- deterministic receipt: `0ec9121a4c0367e51de068b06d294d4ba2bec4f4a8f5e76ba5c0d253a2288b3d`

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
| native-boundary-explicit | pass |

Batch A is counted as bridge mode. Unsupported declared-domain lowering remains explicit and is not counted as native mode.
