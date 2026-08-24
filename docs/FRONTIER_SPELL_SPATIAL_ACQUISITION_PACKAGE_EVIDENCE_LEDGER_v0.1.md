# Frontier Spell × Spatial Acquisition Package Evidence Ledger v0.1

**Verdict**：`PASS / Phase2B acquisition package ready for instrument binding`  
**Unknown acquisition armed**：`false`

## Artifacts

- `src/frontier-spell-spatial-acquisition-package.mjs`
- `tests/frontier-spell-spatial-acquisition-package.test.mjs`
- `docs/FRONTIER_SPELL_SPATIAL_ACQUISITION_PACKAGE_v0.1.md`
- `docs/FRONTIER_SPELL_SPATIAL_ACQUISITION_PACKAGE_EVIDENCE_LEDGER_v0.1.md`

## Evidence roots

```text
manifestRoot = b383cf4b67e6ea6c29777b97ef9cdafb6298e1743434ef6e005fa2a3e9abccb1
sealedConditionRoot = 63957d011592bcaaf8919ead54b41cb1ad5e603fe5244d39a7f20f3c6f09b8c7
dryRunRoot = 77ecf3e52cac6b85040276183a2e7913d87e32f6b5621955219008a32dd983b3
```

## Tests

Phase2B new suite:

```text
5/5 PASS
```

Combined Phase1A external-observation + Phase2B:

```text
13 tests
13 passed
0 failed
```

Covered:

- 96-slot balanced 2×2 schedule: PASS
- semantic labels absent from redacted schedule: PASS
- deterministic same-seed root: PASS
- changed seed changes package root: PASS
- manifest tamper rejection: PASS
- known ordinary interaction traverses blind pipeline: PASS
- unknown acquisition remains disarmed: PASS

## Evidence boundary

Known-control dry run is ordinary software-control evidence. It does not support the candidate physical hypothesis.

```text
externalRealityVerified=false
newNaturalLawVerified=false
magicVerified=false
```
