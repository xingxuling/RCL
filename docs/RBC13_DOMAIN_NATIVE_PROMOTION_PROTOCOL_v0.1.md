# RBC 1.3 Domain Organ Native Promotion Protocol v0.1

Status: `IMPLEMENTED / EXECUTION RECEIPT PENDING`

This protocol exists because the canonical `native-capability-promotion.mjs` pipeline assumes canonical RCL source compiled by the canonical bytecode compiler. Experimental RBC 1.3 `DOMAIN_CALL` deliberately does not satisfy that assumption yet. The existing promotion system is therefore left unchanged rather than weakened to accept an experimental bytecode path.

## Promotion chain

Each admitted operation must pass its own chain:

`reconstructed historical/reference semantic`
→ `current JavaScript oracle`
→ `operation-scoped Independent Differential`
→ `native-candidate Domain Organ plan`
→ `deterministic RBC 1.3 candidate bytecode`
→ `external C candidate organ`
→ `candidate VM materialized from current native/rclvm.c`
→ `VM-emitted rcl.semantic-state-root.v1 verification`
→ `current-JS vs native-process differential`
→ `deterministic replay`
→ `Domain Organ Native Promotion report`
→ `native-verified Domain Organ`

Canonical RBC 1.3 admission remains a later and separate decision.

## Semantic error identity

Positive output equality is insufficient. Native Promotion compares normalized errors as semantic outputs as well.

The Domain Organ ABI therefore carries a structured error channel with stable `code` and `message` fields. The candidate VM owns dynamically supplied error codes rather than retaining stack pointers, and forwards organ errors without wrapping them in a generic `RCL_NATIVE_DOMAIN_ORGAN_FAILURE` code.

The first four candidate organs intentionally match current JavaScript error identity for the tested semantic failures, including:

- unknown quantity type → `TypeError`;
- measurement value/base mismatch → `RCL_MEASUREMENT_TYPE`;
- measurement uncertainty mismatch → `RCL_UNCERTAINTY_TYPE`;
- measurement confidence range → `RCL_CONFIDENCE_RANGE`;
- knowledge value/base mismatch → `RCL_KNOWLEDGE_TYPE`;
- knowledge confidence range → `RCL_KNOWLEDGE_CONFIDENCE_RANGE`.

RCL runtime errors retain the same code-prefixed message form produced by the current `RCLError` base class. Native error details used by the differential runner are reconstructed from the operation inputs so the semantic error envelope matches the current source oracle rather than a native-process receipt.

## Current-source native runtime harness

`src/rbc13-domain-native-runtime.mjs`:

1. reads the repository's actual current `native/rclvm.c`;
2. materializes the candidate opcode-45 VM in a temporary directory;
3. builds an external candidate host with strict C warnings;
4. content-addresses the host, materialized VM and all Domain Organ ABI/source inputs;
5. deterministically assembles a candidate RBC program per operation case;
6. executes the host in a separate process;
7. requires native `rcl.semantic-state-root.v1` evidence on successful executions;
8. strips native heap/layout metadata before comparing operation outputs;
9. preserves semantic error code/message/details on failing executions;
10. removes all temporary build material after the promotion suite.

The candidate host explicitly lowers its minimum organ tier to `native-candidate` only for the promotion experiment. The candidate VM itself defaults to `native-verified` and therefore does not implicitly trust linked or registered candidates.

## Operation-scoped semantic gate

`src/rbc13-domain-operation-differential.mjs` no longer treats the four admitted operations as one aggregate capability. Each operation receives its own cases, replay checks and mutation control.

The pure-internal operation boundary is represented explicitly rather than fabricated as an external authority/resource effect:

- authority required: false;
- external resources created: 0;
- external resources mutated: 0;
- persistent state mutation: false;
- effect class: internal-domain-evaluation;
- semantic-contract evidence is attached.

This lets the generic Independent Differential scorer see real evidence dimensions without inventing external side effects.

## Candidate implementation binding

`src/rbc13-domain-organ-candidate-plan.mjs` binds a passed operation differential to a named external C implementation but deliberately leaves:

- `artifactBindingPending: true`;
- `nativePromotionPending: true`;
- `canonicalAdmission: false`.

The runtime harness then creates deterministic source/materialized-VM/host roots. The promotion report derives an operation-specific implementation root from the shared implementation source plus operation identity.

## Native Promotion report

`src/rbc13-domain-native-promotion.mjs` emits `rcl.domain-organ-native-promotion-report.v0.1` only after checking all of the following non-compensatory conditions:

- operation semantic differential passed;
- operation semantic differential is promotion-eligible;
- current-JS vs native-process differential passed for every declared case;
- candidate RBC bytes are deterministic;
- native process replay is deterministic;
- every successful native case emits and verifies the current semantic state root;
- native host binary has a content root;
- candidate implementation source/materialized VM has a content root;
- case counts align and no case is silently omitted.

A report is `native-verified` only when every check is true. Otherwise it is `native-rejected`. Missing compiler infrastructure is reported as `native-blocked` by the suite rather than being relabeled as a semantic failure or success.

## Evidence runner

Run:

```bash
node scripts/run-rbc13-domain-native-promotion.mjs
```

The runner uses three semantic repetitions and three native repetitions by default and writes a JSON evidence report under `output/rbc13-domain-native-promotion/`.

A non-verified suite exits non-zero.

## Current status

The protocol, runtime harness, operation-scoped differential gate, deterministic candidate-bytecode manifests, structured error path and promotion tests are checked into the research branch.

The connected GitHub hosted runners are currently failing before job steps begin, so this document does **not** claim that the exact-current-source Native Promotion suite has executed successfully on GitHub.

Previous local evidence proves candidate execution against the uploaded native snapshot, including the nontrivial Quantity → Measurement → Knowledge chain, but that uploaded native VM predates the current native state-root producer. It is therefore insufficient by itself to upgrade any organ to `native-verified`.

## Canonical admission boundary

Even a successful four-organ Native Promotion suite would establish only four case-bounded, host-bounded `native-verified` Domain Organs. It would not by itself change:

- canonical bytecode version;
- canonical opcode table;
- canonical self-hosted compiler;
- canonical `native/rclvm.c`;
- canonical `native/rclvm.h`;
- the status of the other 14 quarantined historical operations;
- whole-language native execution.

Canonical RBC 1.3 / opcode 45 admission requires a separate governance change after promotion evidence is reviewed.
