# RCL AI Assimilation Intelligence Threshold v0.1

Historical/superseded report. The current research surface is `docs/RCL_CAPABILITY_ASSIMILATION_COMPATIBILITY_SURFACE_v0.1.md`. This threshold report is retained as prior evidence and must not be read as a global autonomous-growth level or as Native Promotion evidence.

- Status: **NEGATIVE_RESULT**
- Evidence root: `a53e9fd74f733bc5d8d996f5ae780fc6b297c8116a399fd729bf97231e756f38`
- Donor spec root: `bc05b4a9df5f3bdf71af6c4cc9660dba90c4ce61c2a69683f56b65a3666630a5`
- Prompt root: `c9165f68465ed1ffa5bbf4730308bd072eefd3660e08c8ecf4293e7407725ebe`
- Protocol: same-json-schema-donor-v0.1; temperature=0; seed=13013; format=json
- Human interventions: 0

## Tier results

| Tier | Model | Ollama version | Status | Level | Human repair | Candidate | Native candidate | Promotion |
|---|---|---|---|---|---:|---|---|---|
| small | aetherseed-tinyllama-runtime:latest | ca5641fd566c | NEGATIVE_RESULT | L0 | 0 | semantic-absorbed | BLOCKED | BLOCKED |
| medium | aetherseed-trained-smoke:latest | 5cd5d497f398 | NEGATIVE_RESULT | L2 | 0 | semantic-absorbed | BLOCKED | BLOCKED |
| strong | qwen3.5:latest | 6488c96fa5fa | NEGATIVE_RESULT | L0 | 0 | none | BLOCKED | BLOCKED |

## Threshold levels

- L0: donor response unavailable or contract invalid
- L1: contract plus extraction/corpus not complete
- L2: semantic candidate exists but independent differential is unavailable or failed
- L3: independent differential exists but native candidate or promotion is incomplete
- L4: native candidate and promotion evidence are independently verified with zero human repair

## Required chain

Donor Spec → Extraction → Signature → Contract → Positive/Negative Corpus → Candidate → Differential → Mutant Detection → Repair Attempt → Native Candidate → Promotion Attempt

## Conclusion

No tested tier reached L4; no native promotion credit is granted. Minimum observed level: **L0**; maximum observed level: **L2**. This threshold conclusion is scoped to the declared JSON Schema donor, protocol, and listed local Ollama models. It is not a general claim about AI capability.

## Boundary

No implementation code, hidden tests, expected outputs, or human repair were sent to or applied to any model. A failed model is not repaired or upgraded.

Current strict-growth interpretation: the retained result supports at most `Level 2 VERIFIED` when independent differential evidence is present; `Level 3 CANDIDATE/BLOCKED` requires an AI-generated implementation plus independent differential verification. Formal A10 remains `NEGATIVE_RESULT` until the Native Candidate → Native Process → Semantic Root → Replay → Promotion chain is independently verified.
