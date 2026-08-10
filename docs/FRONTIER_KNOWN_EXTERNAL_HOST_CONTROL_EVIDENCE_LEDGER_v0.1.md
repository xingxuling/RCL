# Frontier Known External Host Control Evidence Ledger v0.1

**Date**: 2026-08-11  
**Verdict**: `PASS / Phase1B real host known-effect control`  
**External reality verified for frontier law**: `false`

## Artifacts

- `src/frontier-known-external-host-control.mjs`
- `tests/frontier-known-external-host-control.test.mjs`
- `examples/frontier-known-external-host-control-runner.mjs`
- `docs/FRONTIER_KNOWN_EXTERNAL_HOST_CONTROL_v0.1.md`
- `output/frontier-known-external-host-control-v0.1/*`

## Real observation boundary crossed

Unlike the prior synthetic controls, Phase1B response values are measured from actual host execution using:

```text
Atomics.wait
+ process.hrtime.bigint
```

The experiment introduces a known engineered software interaction, but RCL does not directly write the expected numeric response into the dataset. The operating environment and real clock determine the observed elapsed time.

## Sealed run evidence

```text
positiveDetected = true
positiveModelWinner = H_interaction
additiveRejected = true
additiveModelWinner = H_additive
hostFingerprint = 5022c0a78bba85984d7a212ababa4b7d0509deaef10c633aa07e4f319eab7314
runnerRoot = 2961484a8bcb90d6104b606b4a0c0f719d8a30016a27c791d1f369216fdd959d
externalRealityVerified = false
```

Positive blind-score sample:

```text
BIC margin = 387.03023986
interaction delta = 7.980273251 ms
standardized interaction = 224.647701542
```

## Tests

New host-control suite:

```text
4 tests
4 passed
0 failed
```

The prior selected frontier baseline was `39/39 PASS`; adding the new host-control checks yields **43/43 cumulative selected checks** across the frontier stack.

## Integration Court

**PASS**:

- actual host observations collected;
- provenance/calibration contract valid;
- raw measurement path root-bound;
- positive known interaction detected;
- additive-only real measurement rejected as interaction;
- blind scorer unchanged;
- `externalRealityVerified=false` retained.

**Not a new-physics result**. The evidence class is `real_host_measurement_known_engineered_software_control`.
