# RCL Native Execution Tier Model v0.1

Status: `VERIFIED` measurement protocol; `CANDIDATE` architecture proposal; no canonical ABI promotion.

## Why three paths

The benchmark separates the cost of a primitive instruction, an evidence-gated native organ, and a provider-shaped boundary. It does not assume that one path wins every workload and it does not treat a fast local call as proof of semantic parity.

| Tier | Path | Measured identity | Intended fit |
| --- | --- | --- | --- |
| 1 | Primitive Opcode | direct in-process scalar echo; no Domain Value membrane | high-frequency kernel operations |
| 2 | `DOMAIN_CALL` Native Organ | real `rcl_domain_organ_invoke` through the registry and Domain Value ABI v1 | bounded, evidence-backed, replayable absorbed capabilities |
| 3 | Provider Bridge | provider-shaped JSON text boundary with request allocation; no network latency | external models, services, network, and heavyweight adapters |

## Current measurement

Protocol: fixed seed `RBC13-PERFORMANCE-2026-08-09`, Number input `9007199254740991`, warmup 1,000, seven repetitions, and 1,000/10,000/100,000 iterations. The latest report root is `014abc49fc58d5d916e254f32fcfb3913acaa4e3232878962cc664901c30cad4`; the C host root is `51d37188584830c147ebe9d1ff4538add9341ff5606c0d2223fccdf6b1ba067f`.

Median nanoseconds per operation:

| Iterations | Primitive | Native Organ | Provider-shaped |
| ---: | ---: | ---: | ---: |
| 1,000 | 1.700 | 89.700 | 413.600 |
| 10,000 | 1.220 | 99.240 | 492.680 |
| 100,000 | 1.312 | 89.507 | 413.364 |

At 100,000 iterations the allocation proxy recorded 0 primitive allocations, 700,000 native-organ clone calls, and 700,000 provider request allocations totaling 35,700,000 bytes. RSS deltas were recorded as a process working-set proxy; process-startup samples were also recorded. The harness records median, p95, mean, variance, replay output, and error status for each path.

The measured result supports a cost model, not a universal performance ranking: primitive is the smallest path, Native Organ adds registry/ABI conversion cost, and the provider-shaped path adds text and allocation cost. No network or remote-model latency is included. The report deliberately sets `competitiveRankingClaim` to false.

## Architectural comparison

### A. Specialized opcodes

Specialized opcodes can minimize hot-path overhead, but every new capability becomes VM/compiler/version surface. They are difficult to generate from an external capability and create a long-term hard-wired builtin inventory. This route remains appropriate only for genuinely universal kernel primitives.

### B. `DOMAIN_CALL` plus Native Organ

The operation name, typed value membrane, registry, evidence tier, authority, causal parent, receipt, and replay identity remain explicit. A capability can be proposed and metabolized without changing the bytecode opcode for every new domain. The current implementation is still experimental and must retain its candidate boundary until legacy, Universal Stress, and AI gates close.

### C. Provider-only extension

Provider bridges are the right boundary for network, model, and heavy external work. They carry larger serialization and allocation costs and need stronger external-delivery evidence. Making every capability provider-only would discard the bounded native-organ path and weaken local replayability.

The evidence therefore supports a proposed hybrid model: Primitive + Evidence-Gated Native Organ + External Provider. It does not prove that the hybrid should yet become canonical.

## Scope limits

This round benchmarks a Number echo path. It does not claim complete measurements for Text, Sequence, nested Sequence/Record, semantic-root generation, every error path, or a network provider. Those are explicit follow-up cases before using this report as a release-performance claim. Authority and evidence semantics are verified separately by Native Promotion and the focused RBC13 suite.

Reproduce with:

```text
npm run verify:rbc13-execution-benchmark
```
