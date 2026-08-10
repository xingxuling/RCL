# Frontier Design Grammar + Scorer Router Evidence Ledger v0.1

**Verdict**：`PASS / Phase1E structure-aware scorer routing`  
**External reality verified**：`false`

## Artifacts

- `src/frontier-design-grammar-router.mjs`
- `tests/frontier-design-grammar-router.test.mjs`
- `examples/frontier-design-grammar-router.mjs`
- `docs/FRONTIER_DESIGN_GRAMMAR_SCORER_ROUTER_v0.1.md`
- `src/frontier-research-index.mjs` export

## Closed obligations

- simple 2×2 routes to existing blind scorer: PASS
- full `2^k` routes to factorial scorer: PASS
- declared structured nuisance cannot be silently flattened: PASS
- repeated measures unsupported → BLOCKED: PASS
- continuous field unsupported → BLOCKED: PASS
- no automatic fallback: PASS
- deterministic factorial route root: PASS
- NIST speed×rate SS preserved near 4872.57: PASS

## Tests

```text
new router tests: 5/5 PASS
selected router + Phase0.5 + Phase1A + Phase1D regression: 23/23 PASS
```

Demo route:

```text
status = ROUTED
route = orthogonal_full_factorial_2powk
speedRateSumSquares = 4872.572403125
fallbackUsed = false
externalRealityVerified = false
routeRoot = 7871430dfef07bbcabd9fb126ae69ca98a36c696379b7a870dd634c6a9094ec0
```

No threshold was changed to make the NIST generic-scorer negative result disappear. The architecture changed instead: scorer selection is typed by declared experimental design.
