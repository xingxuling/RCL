# RCL research maturity correction — 2026-10-13

RCL is **RESEARCH_PREVIEW**. The current registered K400 evidence reports
**24/400 PASS (6%), 376 UNTESTED, INCOMPLETE, maturity U3**.

The earlier promotion to a 2.0 release used bounded session/compiler improvements
as the basis for a major language milestone. That overstated whole-language
maturity. Those improvements and their original tests remain valid within their
documented profiles; they do not constitute K400 completion.

## Current policy

- The homepage leads with research status and K400 coverage.
- Existing package/native identity 2.0.0 is retained for artifact/history lookup.
  It is not a maturity score. Further package-version advancement is frozen in
  `VERSION-CONTRACT.json` and checked by the version-contract verifier.
- `formalLanguageRelease` is false. The old `localReleaseVerified` record is
  explicitly scoped to its historical bounded Windows session implementation.
- CLI `version --json` and `doctor` expose research readiness recomputed using
  the existing K400 evaluator. A healthy local environment is separate from
  whole-language readiness.
- K400 completion requires all 400 stable cells and all nine non-compensatory
  gates, without special-case or opaque-delegation credit. Completion still
  requires an explicit release review; the metadata utility authorizes no writes,
  publication or version promotion.

## Development reporting

New work should target identified K400 cells and their missing gates. Reports must
state baseline counts, specific cell/gate changes and the updated completion
verdict. Engineering maintenance can be worthwhile with no matrix promotion,
but its test counts and version labels must not stand in for K400 progress.

`src/research-readiness.mjs` reuses `validateUniversalStressEvidence`,
`evaluateStressCell`, `auditK400Completion` and `classifyUniversalMaturity`.
It checks registered evidence consistency; it does not rerun historical hardware,
performance or independent-generation receipts. Historical verification records
are preserved rather than rewritten to pretend the mature release existed.

The correction introduces no new K400 PASS claims and runs no GitHub Actions.
