# RCL Native Capability Promotion Gate v0.1

## Purpose

The native promotion gate is the final bounded step after capability metabolism and independent differential execution. It prevents `native-candidate` from being treated as a native-runtime claim until the candidate is bound to deterministic RCL artifacts and reproduced by the selected native VM.

## Required chain

A capability can become `native-verified` only when all of the following refer to the same capability id:

1. a capability metabolism report at `native-candidate`;
2. a passed and promotion-eligible independent differential report;
3. a content-addressed native implementation manifest;
4. exact case-id alignment between differential and native evidence;
5. differential absorbed-adapter artifact roots bound to the implementation manifest root;
6. deterministic recompilation to the same Program Root and RBC SHA-256;
7. JavaScript reference-runtime and native-VM parity;
8. reference and native observations matching the absorbed observation already recorded by differential execution.

## Implementation manifest

Every case commits to:

- RCL source text root;
- compiled program name and Program Root;
- RBC SHA-256;
- byte length;
- instruction count.

Promotion recompiles every source and rejects any drift before execution.

## Native observation

The standard native observation projects a runtime result into the same semantic envelope used by differential absorption:

- final state plus compact projections and history;
- realized effects and state changes;
- witnesses as evidence;
- resource deltas;
- authority needs and active warrants;
- exit code.

Runtime receipts, VM metrics and program identifiers remain attached as receipts but are excluded from the semantic root. This permits different runtime envelopes while requiring identical observable laws.

## Statuses

- `native-verified`: every evidence and parity gate passed;
- `native-rejected`: the VM ran, but one or more semantic or parity checks failed;
- `native-blocked`: the selected native VM was unavailable, so no native claim was attempted.

## Evidence integrity

The gate recomputes nested content roots for metabolism reports, differential cases, execution observations, adapter runs, comparisons, negative controls and implementation manifests. A field changed under a stale root is rejected before native execution.

## Evidence boundary

`native-verified` is case-bounded. It proves the declared cases across external/source differential evidence, the RCL reference runtime, deterministic RBC compilation and one selected native VM binary. It does not prove complete semantics outside the cases, compiler correctness in the formal-verification sense, or cross-platform parity on hosts that were not executed.

The artifact-root binding remains an observed-output plus declared-artifact binding: the differential report declares the implementation manifest root, while the promotion gate proves that the recorded absorbed outputs match the actual manifest programs. Stronger future levels should execute adapters in isolated processes and sign artifact/runtime receipts.
