# RCL Capability Metabolism v0.1

## Status

- Version: `0.1.0-alpha.1`
- Scope: bounded capability absorption, semantic-kernel extraction, RCL-native declaration generation, evidence assessment and compound-organ synthesis.
- Native claim: none. `native-candidate` is deliberately below native verification.

## Problem

RCL already contains dialect, effect, policy, lowering, store and self-hosting machinery. What was missing was a single bounded pipeline that answers:

1. What exactly is being absorbed from an external language, runtime or protocol?
2. Which semantic laws are retained?
3. Which provider or runtime dependency remains?
4. Which evidence is sufficient for each absorption stage?
5. Can two absorbed capabilities be synthesized without hiding conflicts?

The capability metabolism kernel turns those questions into typed artifacts instead of permanent black-box adapter claims.

## Pipeline

- Normalize an `rcl.external-capability-spec.v0.1` manifest.
- Extract a canonical semantic kernel.
- Generate compilable RCL dialect, effect, capability-policy and store declarations.
- Materialize the existing RCL absorption kernel.
- Evaluate declared-output equivalence with explicit evidence boundaries.
- Stage classification: `semantic-absorbed`, `bridge-verified`, `native-candidate`, `native-verified`, or `rejected`. `native-verified` is issued only by the separate native promotion gate.
- Store content-addressed objects, evidence, event, tree and candidate commit.
- Synthesize multiple accepted reports into a compound capability organ.

## Evidence boundary

Declared equivalence compares canonical roots of outputs supplied in the manifest. It is useful for design and fixtures, but it is not independent source/runtime differential execution.

A `native-candidate` requires:

- declared equivalence passed;
- no provider dependency;
- an explicit native-lowering witness;
- a compilable RCL representation.

It still does not prove executable RBC lowering or native VM parity. Promotion requires independent source/runtime differential execution, executable RCL/RBC evidence, negative controls and native parity receipts.

## Initial fixtures

- SQL serializable transaction semantics.
- Rust-style ownership and lifetime semantics.
- Compound synthesis: transactional state with exclusive ownership and evidence-bound transfer.
