# RCL Foundation Conformance

- status: **pass**
- contract: taowind.rcl-foundation-contract.v0.1 0.1.0
- contract root: `34e508fe3b6587e630cc32a075edbad87323c7359434b2a2aaf01cf7e250f7e1`
- reference runtime: native
- native VM: none

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
| native-boundary-explicit | pass |

Native boundary is recorded explicitly; unsupported Native VM lowering is not counted as native conformance.
