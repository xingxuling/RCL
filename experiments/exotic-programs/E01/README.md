# E01 — RCL Minimal Living Intelligence

E01 is the first Exotic Programs Campaign vertical slice. It deliberately starts with a small fixed-language capability body and tests a complete bounded lifecycle:

```text
observe → remember → task failure → capability gap
→ human donor selection → metabolism → independent differential
→ candidate-organ install → retry → completion
```

The third task selects a wrong donor. Its differential fails, the candidate is not installed, and the subject closes honestly as `BLOCKED` without contaminating its body.

This is a program experiment, not an LLM wrapper and not a canonical language change. Human-in-the-loop donor selection is explicit; network donor search is out of scope. Candidate organs remain non-canonical.

## Run

From the repository root:

```text
npm run verify:exotic-e01
npm run test:exotic-e01
```

The runner writes machine-readable receipts to `evidence/` and the persistent growth history to `results/living_intelligence_growth_history.json`.

## Tasks

- Task A uses existing `compare` and completes immediately.
- Task B requires `weighted_sum`, detects the gap, absorbs the valid donor, installs a candidate organ, retries, and completes.
- Task C selects a wrong donor; independent differential rejects it, no organ is installed, and the result is an honest `BLOCKED` closure.

## Boundaries

- No new RCL grammar or canonical semantic was added.
- No LLM is used to produce the answer or donor implementation.
- No candidate organ becomes canonical.
- Retry is bounded and deletion replay must reproduce the original capability failure.
- A passing E01 proves only this bounded lifecycle and its evidence chain.
