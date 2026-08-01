# RCL Independent Differential Absorption Runner v0.1

## Purpose

Capability Metabolism v0.1 can compare outputs declared inside a capability manifest. That is useful for specification work, but the same author may have supplied both sides. The Independent Differential Absorption Runner replaces that trust assumption with repeated execution through two separately described adapters.

## Execution contract

Each adapter has:

- an adapter id;
- a runtime identity;
- an optional artifact root and provenance set;
- a distinct `execute(input, context)` function.

An executor may return a plain value or an `rcl.execution-observation.v0.1` record. The observation separates semantic evidence from runtime receipts:

- status and output;
- normalized error code, message and details;
- ordered effects;
- semantic evidence claims;
- resource delta;
- authority record;
- exit code;
- runtime-specific receipts and metadata.

The semantic root excludes receipts and metadata so two independent runtimes may issue different receipt envelopes while still proving the same observable law.

## Verification dimensions

For every case, the runner checks:

1. canonical semantic equality between source and absorbed executions;
2. deterministic replay for both adapters across repeated runs;
3. success and error behavior;
4. effect, evidence, resource and authority observations;
5. negative controls that deliberately mutate the candidate and must be detected.

A report is promotion-eligible only when all required cases pass, all required negative controls are detected, adapter separation is satisfied and the evidence score reaches 0.8.

A negative control counts as detected only when its semantic root differs from the source observation. Timeout, nondeterminism or another infrastructure failure is recorded separately and cannot satisfy the mutation-detection gate.

## Independence boundary

The current proof level is `declared-separate-adapters`. Distinct descriptors and JavaScript function references prevent accidental self-comparison, but do not cryptographically prove that two adapters use different processes, binaries or implementations. Stronger levels require external process isolation, artifact hashing, signed runtime receipts and independently controlled execution environments.

## Native boundary

An independent differential pass does not prove:

- RCL IR or RBC generation;
- compiler correctness;
- execution inside the native RCL VM;
- native parity across Windows and POSIX hosts;
- complete semantic coverage outside the supplied cases.

The report therefore attaches to a capability metabolism candidate as `independent-differential` evidence rather than promoting it directly to native-verified status.
