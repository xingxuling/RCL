# Verification Report v0.1

## Federation implementation

- Registry: 8 language-family records, 7 translation contracts, 5 backend records.
- Duplicate owner detector: PASS across 12 declared canonical claims; synthetic second `reality-ir` owner correctly returns CONFLICT.
- RSL candidate corpus: 25 meanings, 50 localized surfaces, 9 negative cases.
- Cross-surface invariant: different locale AST roots, same ASIL meaning root and same compiled RCL program root.
- Round-trip: zh-CN -> ASIL -> en-US -> ASIL -> zh-CN preserves the meaning root within the frozen create-project subset.
- Authority/evidence: every compiled semantic record is candidate-only; unsupported, negated, ambiguous and authority-shaped inputs require clarification. Generated RCL contains `foresee propose` and no `realize propose`.
- Evidence bundle status: CANDIDATE, root `2abfc214be511714c577477650feb94c309bf9f576ab12795eadfffe1f5b8e3b`.
- Focused federation + K400 selection suite: 29/29 PASS.
- Full RCL regression: 842 total, 841 PASS, 0 FAIL, 1 existing skip. The skip is the external DLL/import-library link test when Zig is unavailable; signed prebuilt artifacts were verified instead.
- Version contract: PASS.

## External asset live checks

| Asset | Live check | Result | Boundary |
|---|---|---|---|
| ASIL | focused Node tests | 12/12 PASS | tracked on WorldSeed branch; federation-wide promotion not proved |
| SNLL P0–P2 | focused Node tests | 14/14 PASS | source/docs/tests untracked in audited worktree |
| SNLL authority sample | proposal command with evidence but no approved authority | blocked; 0 executions; world root unchanged | existing output is SNLL IR + RNCS proposal, not an ASIL/RCL compiler |
| CSL | temporary authenticated clone at `d476f8...` | 162/162 PASS; production build PASS | clean `npm ci` FAIL due stale lockfile; warnings remain |
| K08/RCL baseline | GitHub Canonical, Authority and Universal Stress | PASS at `b4f1883...` | proves prior RCL baseline, not language federation until new CI runs |

## Unverified claims

- IAL -> ASIL -> IAL semantic loss is unmeasured.
- General RSL grammar and ja-JP/zh-HK are not implemented.
- SNLL and CSL do not yet target ASIL.
- General ASIL -> RCL lowering is not implemented.
- The corpus covers one program meaning family, not the full 50–100 meaning-category benchmark envisioned for later versions.
