# Frontier External Observation Contract Evidence Ledger v0.1

**Date**: 2026-08-11  
**Verdict**: `READY / Phase1A contract plumbing PASS / external dataset pending`  
**External reality verified**: `false`

## Artifacts

- `src/frontier-external-observation-contract.mjs`
- `src/frontier-research-index.mjs`
- `tests/frontier-external-observation-contract.test.mjs`
- `examples/frontier-external-observation-contract-runner.mjs`
- `examples/frontier-external-observation-contract/run-external-observation-file.mjs`
- `docs/FRONTIER_EXTERNAL_OBSERVATION_CONTRACT_v0.1.md`
- `output/frontier-external-observation-contract-v0.1/*`

## New obligations closed

- provenance required;
- license/permission required;
- calibration must be `valid`;
- raw payload receives immutable `rawDataRoot`;
- sealed contract receives `contractRoot`;
- tampering after seal invalidates the contract;
- 2×2 cells require minimum observation coverage;
- semantic conditions are mapped into anonymous 0/1 factors;
- source metadata and active/control labels are removed from evaluator input;
- sealed randomization manifest is not passed to scorer;
- reveal happens after scoring;
- JSON file intake path is executable;
- all outputs preserve `externalRealityVerified=false`.

## Control suite

```text
positiveInteractionDetected = true
additiveControlRejected = true
tamperRejected = true
missingCalibrationRejected = true
blindScoreManifestIsolation = true
externalRealityVerified = false
```

Control root:

```text
f1b49de5ea59f6a6253f2aa71520dea4451a18a5d7f39a667c0bc62c3ff5d5fd
```

## Tests

New Phase1A tests:

```text
8 tests
8 passed
0 failed
```

Selected regression was rerun in three serial batches after one larger aggregate command hit the execution time limit. The smaller batches all passed:

```text
Batch 1: 14/14 PASS
Batch 2: 14/14 PASS
Batch 3: 11/11 PASS
Total: 39/39 PASS
```

The time-limit event was not a test failure; the affected suites were explicitly rerun.

## Evidence boundary

The known software controls are **ordinary engineered signals** used to validate contract and blinding plumbing. They are not natural-law discovery evidence.

No real sensor, instrument, public scientific dataset or independent third-party replication has yet been ingested by this Phase1A module. Therefore:

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

## Integration Court

`PASS` for the **Phase1A External Observation Contract** as a data-ingestion and blind-evaluation interface.

`BLOCKED` for any claim of external new physics until a real external dataset is bound to the contract and survives the same gates plus independent replication.
