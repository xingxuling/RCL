# Native Provider Host Call Reality Audit v0.1

## Finding

Provider Runtime v2 owns policy, async invocation, simulation, budgets and rooted receipts in the JavaScript/reference runtime. Native Provider ABI v1 can invoke a registered provider from explicit `provider_call(...)` expressions. The ordinary bytecode lowering path nevertheless rejects every rule-level `call host.capability(...)`, while native result records print `hostCalls: []`.

Using direct `provider_call(...)` for Android device access would silently bypass the rule's actor, `needs`, warrant and transaction boundary. That route is rejected.

## Candidate slice

The v0.1 candidate lowers only rule-level host calls that contain exactly one Text literal request payload and are invoked by `realize`. It preserves this order:

```text
BEGIN_TX
-> CHECK_WARRANT for every need
-> staged ordinary alterations
-> CALL_PROVIDER
-> stage provider response
-> CHECK_PRESERVE
-> RECORD_WITNESS
-> COMMIT_TX
```

Successful calls are copied into the native transition record as provider ID, capability, request JSON and SHA-256 request root. Missing warrants, providers, provider failures, invalid request types and capacity overflow fail before commit.

## Explicitly not admitted

- no `foresee` provider simulation;
- no async Provider Runtime v2 parity, cancellation, timeout or concurrency budget;
- no dynamic or multi-argument/native structured request encoding;
- no rollback claim for provider-side effects after invocation; adopters must restrict this subset to read-only/idempotent providers until an effect protocol exists;
- no claim that Provider ABI v1 is the full Provider Runtime v2;
- no version-contract or canonical-language promotion without a separate court.

## Self-host compiler boundary

The checked-in `selfhost/compiler.rbc` does not yet absorb rule-level `call` syntax. A direct run through `native/rclc.exe selfhost/compiler.rbc` returned success but emitted RBC 1.1 whose transition had no changes, kept `provider.reply` at `"none"`, moved call tokens into witnesses and reported `hostCalls: []`. This is semantic drift, not a valid compile.

Until that distinct RCL-owned compiler gap closes, downstream consumers must either reject this source on the self-host path or use a build-time RBC produced by the candidate JavaScript compiler and bind the exact source/RBC hashes. They must not report on-device source compilation for this subset.
