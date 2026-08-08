# RCL AI Capability Assimilation Experiment v0.1

Status: `NEGATIVE_RESULT`; the donor was captured and tested, but it did not close the capability-to-promotion chain.

## Experiment

The selected donor was JSON Schema validation. The harness gave the local model a donor contract and a JSON Schema output shape, but did not provide the target implementation body, repository path, hidden expected output, or implementation source. The contract is recorded in `examples/rbc13-ai-donor-json-schema-contract.json`.

Model: `aetherseed-tinyllama-runtime:latest`.

The intended chain was:

```text
external contract -> semantic extraction -> capability spec -> corpus -> differential controls -> native candidate -> Native Promotion
```

Only the first four harness stages could be credited after the response was evaluated. No implementation was copied from the repository and no promotion attempt was authorized from this response.

## Observed response

The live response was parseable JSON and declared `DonorMeasurement`, exact required fields, `additionalProperties: false`, and basic value/confidence constraints. It nevertheless failed the declared contract because it used JSON Schema draft-07 rather than the required 2020-12 dialect, and its `unit` property omitted the required non-empty-string constraint.

The independent harness forged 16 deterministic cases and 10 mutation plans. The negative control that removed `additionalProperties: false` was detected, so the control mechanism itself remains useful. That does not repair the donor contract: successful trials were 0 of 1.

| Item | Evidence |
| --- | --- |
| live prompt root | `c9165f68465ed1ffa5bbf4730308bd072eefd3660e08c8ecf4293e7407725ebe` |
| live raw response root | `69477953ac53798d83cc2aec49931076e25906792e44d03fa53ab9c8fc8f3138` |
| response root | `9530eadbc61384bbb865a6bb37ea76573102ed23803c5f6cd9702889f4b26295` |
| extraction root | `0d311ab94e16be16d8f5162091a8046753900e58807621ffde0fe362e08db462` |
| corpus root | `778ba7ba4f44d499994096055ac06617aa132640886c8c44b9d2893eb1b7963c` |
| live report root | `32d72528b0acba16bc2dfe47a529603f69f6542d818597920fbb85d4d0ce82ef` |
| replay report root | `0154c480b805753d48e3bc95dc7f5b14dd92bd5fb8d0856e6609f7a54a8646a5` |

Replay uses:

```text
node scripts/run-rbc13-ai-generate-json-schema.mjs output/rbc13-ai-generate-json-schema/replay-2026-08-09.json --replay examples/rbc13-ai-generated-donor-output-2026-08-09-live.json
```

The replay preserves the semantic response and corpus roots while independently hashing the raw replay envelope. There was no manual candidate-body repair and no hidden implementation disclosure. The harness itself performed the capture and replay; this is not counted as a successful AI trial.

## Governance result

The donor is not evidence for native semantic admission. It receives no Native Promotion credit, no Universal Stress AI_GENERATE credit, and no canonical admission credit. The correct follow-up is a fresh blinded trial with a corrected contract or a different donor; lowering the schema requirements would invalidate the experiment.
