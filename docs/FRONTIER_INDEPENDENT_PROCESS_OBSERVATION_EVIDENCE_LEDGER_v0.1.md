# Frontier Independent Process Observation Evidence Ledger v0.1

**Verdict**：`PASS / Phase1C separate-process file boundary`  
**External reality verified**：`false`

## Artifacts

- `tools/frontier-independent-acquisition/produce-known-timing-dataset.mjs`
- `src/frontier-independent-file-observation.mjs`
- `tests/frontier-independent-file-observation.test.mjs`
- `examples/frontier-independent-file-observation/run-independent-file-pair.mjs`
- `docs/FRONTIER_INDEPENDENT_PROCESS_OBSERVATION_v0.1.md`
- `src/frontier-research-index.mjs` public export

## Closed obligations

- acquisition producer imports no RCL module;
- producer PID differs from RCL intake PID;
- file exists before RCL reads it;
- file root detects post-production tampering;
- Phase1A contract still validates provenance/calibration/root binding;
- same blind scorer remains unchanged;
- known interaction is detected;
- known additive control is not promoted to interaction;
- `externalRealityVerified=false` remains mandatory.

## Boundary

This is process/file independence on the same host, not third-party replication or independent-device evidence. It strengthens contamination resistance without upgrading any natural-law claim.

## Test evidence

Phase1C new tests:

```text
frontier-independent-file-observation.test.mjs: 5/5 PASS
```

Current Frontier public suite rerun by file:

```text
calibration benchmark:            2/2 PASS
natural law lab:                  4/4 PASS
symbolic × geometry blindtest:    6/6 PASS
external observation contract:    8/8 PASS
known external host control:      4/4 PASS
independent file observation:     5/5 PASS
TOTAL FRONTIER:                  29/29 PASS
```

Upstream research regressions rerun separately:

```text
esoteric mechanism compiler:      4/4 PASS
experiment design synthesizer:    4/4 PASS
mechanism-to-prototype:           4/4 PASS
reality compiler kernel:          7/7 PASS
TOTAL UPSTREAM:                  19/19 PASS
```

Combined selected checks this turn: **48/48 PASS**.

One aggregate `npm run test:frontier` invocation exceeded the assistant execution time limit after already reporting passing tests; every suite was then rerun individually and all 29 frontier tests passed. This timeout is recorded as an execution-limit event, not silently relabeled as an aggregate PASS.

## 2026-08-24 Windows main integration verification

- Windows absolute output paths are resolved before conversion to file URLs, closing the duplicated drive-letter failure;
- the independent producer records and applies `timingScale=16` on Windows so the engineered interaction is not erased by sub-16ms wait quantization;
- the scorer thresholds and interaction/additive success gates remain unchanged;
- independent-file suite passed `5/5` twice consecutively;
- current Frontier suite passed `96/96`;
- full repository regression passed `826 tests / 825 pass / 0 fail / 1 skip`.

The first full repository attempt encountered a transient Windows `EPERM` rename in an RCLApp store test. The exact RCLApp kernel file then passed `3/3`, and an unchanged second full run passed cleanly. This is retained as execution evidence rather than hidden. No external-reality or independent-device claim is promoted.

## Sealed Phase1C run

```text
verdict = PASS_PHASE1C_SEPARATE_PROCESS_FILE_BOUNDARY
interactionWinner = H_interaction
additiveWinner = H_additive
producerProcessesDifferFromIntake = true
externalRealityVerified = false
runRoot = 911d82474812fb81181a167207f2ba2c0aa9a8968cc730df8cc042fd510f1455
```
