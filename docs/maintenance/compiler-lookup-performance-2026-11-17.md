# Compiler instruction-headroom repair

The independent suite exposed a genuine failure of the existing minimum 180-million-instruction headroom gate. Typed rule/facet/function admission subsequently reached 216,584,049 instructions per native self-compilation, within the hard 300-million limit but below that headroom requirement.

The default compiler now adapts the existing indexed-core prototype's pure bucket/tree lookup idea for validation names, emitted string indices and function addresses. These are explicit derived contexts passed through existing owners; they do not introduce compiler-global facets, reorder canonical pools/functions, or replace the frozen indexed-core artifact. Identifier/number scan ends are computed once per token, and JSON escaping inspects each character once. Session emission receives the same explicit lookup context while serialization retains the original dense pool.

Native C0=C1=C2 is `9bf6dfd03d83091fd50609b6c4b026b4b9e470159ac837ff82546e05f9531a29` (425,716 bytes). Each generation executes 108,186,522 instructions, leaving 191,813,478; the unchanged minimum-headroom threshold is satisfied. Fifty focused compiler/type/session/host/lexical checks and three adversarial lookup controls pass. Controls include 72 equal-length names, reversed declaration order, Unicode/escaped pool values, repeated source names and lookup misses retaining output. The 233-example audit retains 195 byte-identical admitted examples, 38 reference-unsupported and zero failures.

The independent JavaScript RBC/full native headroom suite is running against this exact compiler snapshot; its result is not yet counted here. The earlier failed suite remains recorded in the diagnostic checkpoint. No Actions, publication, changed instruction budget, lowered performance gate or full-platform performance claim.

## Independent suite completed

The full independent suite subsequently passed all six tests against the `9bf6dfd03d83091fd50609b6c4b026b4b9e470159ac837ff82546e05f9531a29` compiler snapshot: JS RBC C0/C1/C2 equality, native C0/C1/C2 equality with the unchanged 180-million minimum instruction headroom, core/rule rejection controls, UI semantic-root fixtures and provider lowering. The JavaScript host's flat immutable Sequence emulation still takes about fifteen minutes for this suite; the measured improvement above is RCL instruction count, not a claim of equivalent wall-clock speedup in that host. Later rule-header and control-character increments have separate source-bound verification.
