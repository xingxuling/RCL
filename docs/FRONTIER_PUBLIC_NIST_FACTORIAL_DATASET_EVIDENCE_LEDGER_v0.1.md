# Frontier Public NIST Factorial Dataset Evidence Ledger v0.1

**Verdict**：`PASS / Phase1D external public dataset crossed; generic scorer negative result preserved`  
**External reality verified for unknown law**：`false`

## Source

Official NIST e-Handbook high-performance ceramics full factorial example.

Repository fixture preserves the 32 published rows and factor levels used by the adapter.

## Evidence obligations

- 32 rows: PASS
- complete `2^5` design, 32 unique cells: PASS
- public-dataset provenance: PASS
- published interaction summary withheld from blind scorer: PASS
- existing 2×2 scorer executed unchanged: PASS
- generic scorer reproduced published speed×rate interaction: **NO / NEGATIVE RESULT**
- structured orthogonal factorial engine reproduced published sums of squares: PASS
- no threshold relaxation after seeing result: PASS
- `externalRealityVerified=false`: PASS

## Published holdout reproduction

Target sums of squares and computed values agree within 0.01 for:

```text
speed       894.33
rate       3497.20
speed×rate 4872.57
grit      12663.96
direction 315132.65
batch     33653.91
```

The generic scorer miss is retained as a boundary finding, not repaired by weakening gates.

## Phase1D tests and sealed run

```text
frontier-public-factorial-dataset.test.mjs: 4/4 PASS
verdict = PASS_PHASE1D_PUBLIC_DATASET_INGEST_WITH_GENERIC_SCORER_NEGATIVE_RESULT
generic2x2Detected = false
generic2x2Winner = H0_null
factorialSpeedRateSS = 4872.572403125
publishedHoldoutPass = true
externalRealityVerified = false
runRoot = a3bebdb39648d9a3ee1b139fc1a56c584e3b46e65b2c199b67128bc1b562541c
```
