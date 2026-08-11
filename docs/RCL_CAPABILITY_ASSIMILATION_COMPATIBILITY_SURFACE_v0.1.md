# RCL Capability Assimilation Compatibility Surface v0.1

- Status: **NEGATIVE_RESULT**
- Evidence root: `569a1891cec305c01e1e30c45ef62fe47f17ac5c9c0878f65ceb31f3eca754f7`
- Donor contract root: `bdb2f80b8f840acacfe3d6a9c85b4b2f34f0ab673d1d873232d94548b6df57d5`
- Corpus root: `c9c5d4938c71a1e10b106dbb00d6265b69288b544f22c1c4765138034cbf0f67`; cases=100; positive=40; negative=40; boundary=20
- Independent oracle: **Ajv2020 ajv@8.20.0**, separate process
- Human repairs: **0**; automatic repairs: **4**

## Model results

| Tier | Model | Ollama version | Status | ACL | Human repair | Auto repair | Differential | Native Promotion |
|---|---|---|---|---|---:|---:|---|---|
| tiny | aetherseed-tinyllama-runtime:latest | ca5641fd566c | NEGATIVE_RESULT | ACL0 | 0 | 2 | NOT_RUN | BLOCKED |
| medium | aetherseed-trained-smoke:latest | 5cd5d497f398 | CANDIDATE | ACL2 | 0 | 0 | VERIFIED | BLOCKED |
| strong | qwen3.5:latest | 6488c96fa5fa | NEGATIVE_RESULT | ACL0 | 0 | 2 | NOT_RUN | BLOCKED |

## ACL ruling

- **ACL0**: invalid donor contract or unavailable donor response
- **ACL1**: valid contract but candidate fails independent differential
- **ACL2**: candidate passes independent differential, mutation controls, and replay
- **ACL3**: Native Organ candidate contract separately verified
- **ACL4**: Native Promotion separately verified

Best observed ACL: **ACL2**. Strict global growth assessment: **Level 2 VERIFIED**; next level: **Level 3 CANDIDATE/BLOCKED**.

## Differential contract

The comparison projection is exact over valid, errors[].keyword, errors[].instancePath, errors[].schemaPath, errors[].params. Mutation controls: ignore-required, minimum-comparison, additional-properties-true, array-item-bypass, enum-equality-bug. Compatibility is alignment-sensitive and donor/protocol scoped; model scale alone does not establish monotonic assimilation.

## Formal A10

- Status: **NEGATIVE_RESULT**
- Requires Native Promotion: **true**
- Chain: AI-generated donor → contract → independent positive/negative differential → mutation controls → replay → Native Candidate → Native Process → Semantic Root → Replay → Promotion
- Conclusion: No Native Promotion proof is present; formal A10 is not VERIFIED.

## Boundary

- This is a domain/protocol compatibility result, not a general intelligence ranking.
- The candidate adapter is not the independent oracle and the oracle imports no RCL candidate helper.
- No model receives the hidden corpus, oracle implementation, mutation controls, previous candidate, or human repair.
- No ACL2 result grants native execution, canonical permission, or promotion authority.
