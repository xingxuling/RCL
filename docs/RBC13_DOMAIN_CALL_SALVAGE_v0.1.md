# RBC 1.3 DOMAIN_CALL Salvage v0.1

**Status:** `CANDIDATE`  
**Source branch:** `agent/advanced-runtime-rcl`  
**Target baseline:** current `xingxuling/RCL@main`  
**Issue:** #38

## 1. Goal

Recover the reusable semantic idea behind the stale RBC 1.3 `DOMAIN_CALL` experiment without merging the stale branch, reusing its checked binaries, or silently upgrading current Foundation bridge evidence into native-language evidence.

The migration target is not:

```text
old branch -> merge everything -> call it native
```

It is:

```text
old experiment
-> isolate semantic delta
-> rebuild a current reference oracle
-> differential evidence
-> current native implementation candidate
-> native promotion gate
-> only then change canonical bytecode/runtime claims
```

## 2. Multi-civilization federation decision

### Founder Twin

Keep the general idea: one typed domain-operation dispatch primitive can reduce special-case compiler/runtime growth and gives Capability Metabolism a concrete native target.

Reject wholesale branch merge. The stale branch is far behind current authority, semantic-root, Provider, Universal Stress and evidence contracts.

### 柳清莲 Gate

High-noise inputs are the old prebuilt binaries and the assumption that every C builtin on the branch was independently verified. Both are excluded from the salvage path.

### 洞哥 Grounding

The first accepted load-bearing unit is only the set for which the stale branch had both a JavaScript reference meaning and a native candidate path:

- `core.echo`
- `quantity.make`
- `quantitative.measure`
- `knowledge.claim`

Everything else remains quarantined until an explicit current oracle and differential contract exist.

### Product / UX

No user-visible syntax is changed in v0.1. This is infrastructure work, not a new public language promise.

### Engineering / Code

The first slice is an isolated source-only reference organ: `src/rbc13-domain-call-salvage.mjs`. It does not modify the parser, `src/bytecode.mjs`, self-hosted compiler, native VM, version contract or Foundation status.

### Test / Security / Release

Tests must prove fail-closed behavior and, most importantly, prove that old native-only operations cannot inherit a current native claim merely because their names still exist.

No release/version bump is permitted in this slice.

## 3. Historical ABI extracted from the stale branch

The old experiment introduced:

```text
RBC version: 1.3
opcode:      45
name:        DOMAIN_CALL
flag 0:      literal domain + operation indexes
flag 1:      dynamic domain + operation from the stack
c operand:   argument count
```

The old native test also required:

- RBC 1.3 for `DOMAIN_CALL`;
- rejection of unknown flags;
- rejection of missing operations and invalid arguments;
- preservation of prior RBC 1.1 / 1.2 behavior.

Current canonical bytecode remains RBC 1.2 and is intentionally unchanged by this salvage slice.

## 4. Operation inventory

The stale C runtime registered 18 operations.

### 4.1 Admitted reference-backed set

| Legacy operation | Current semantic oracle | v0.1 disposition |
|---|---|---|
| `core.echo` | identity | reference restored |
| `quantity.make` | `src/quantity.mjs#quantity` | reference restored |
| `quantitative.measure` | `src/quantity.mjs#measurement` | reference restored |
| `knowledge.claim` | `src/knowledge.mjs#knowledgeClaim` | reference restored |

These four had an explicit JavaScript `domain_call` path on the stale branch and can therefore be reconstructed without inventing a new meaning.

### 4.2 Quarantined native-only set

| Legacy operation | Nearest current bridge/oracle | v0.1 disposition |
|---|---|---|
| `language.utterance` | `natural-language.interpret` | quarantine |
| `language.intent` | `natural-language.interpret` | quarantine |
| `understanding.model` | `understanding.model` | quarantine; name overlap is not equivalence |
| `creation.candidate` | `creative.generate` | quarantine |
| `creation.select` | `creative.generate` | quarantine |
| `energy.scale` | `energy.balance` | quarantine |
| `element.species` | `elemental.compose` | quarantine |
| `element.compound` | `elemental.compose` | quarantine |
| `science.claim` | none in current native bridge | quarantine |
| `science.experiment` | none in current native bridge | quarantine |
| `body.state` | `embodiment.integrate` | quarantine |
| `spirit.state` | none in current native bridge | quarantine |
| `spacetime.point` | `meta.spacetime.sequence` | quarantine |
| `spacetime.retime` | `meta.spacetime.sequence` | quarantine |

A nearby current capability is only a comparison target. It is not evidence of semantic equivalence.

## 5. Why direct porting would be wrong

Current Foundation native execution has a stronger contract than the old direct builtins. The bridge path binds:

- authority requirements;
- AIF stability decisions;
- evidence;
- causal parent roots;
- deterministic replay metadata;
- provider receipts;
- result validation;
- state before/after roots.

A direct C builtin that only returns the right data shape would therefore be weaker than the current bridge even if its numerical output matched.

Any future native `DOMAIN_CALL` must preserve these governance/evidence properties or explicitly prove why a pure operation is exempt from particular effect obligations.

## 6. v0.1 implementation

Added:

```text
src/rbc13-domain-call-salvage.mjs
tests/rbc13-domain-call-salvage.test.mjs
```

The module:

- records the historical ABI candidate and provenance;
- records all 18 legacy operations;
- restores only the four reference-backed operation meanings using current source modules;
- fails closed on the 14 native-only historical operations;
- emits a rooted salvage report;
- explicitly forbids canonical bytecode mutation, native Foundation claims and old-binary reuse.

## 7. Acceptance gates for the next slice

Before opcode 45 can return to the current VM:

1. **Reference parity:** the four admitted operations must match current reference-module outputs across positive and negative corpora.
2. **Bridge comparison:** every promoted Foundation operation must have a declared relation to the current Provider bridge oracle: exact, refinement, projection or intentionally different.
3. **RBC compatibility:** RBC 1.1/1.2 behavior must remain byte/runtime compatible; RBC 1.3 must be feature-gated.
4. **Native source rebuild:** modify current `native/rclvm.c`; never copy the stale binary artifacts.
5. **Semantic-root parity:** native outputs must pass the current `rcl.semantic-state-root.v1` authority boundary (or a separately versioned successor if Number encoding changes).
6. **Negative controls:** invalid flags, arity, type, missing operation, authority/effect mismatch and tampered receipts must reject.
7. **Replay:** deterministic operations must produce stable semantic/evidence roots.
8. **Capability Metabolism:** the operation must pass the current differential/native promotion pipeline.
9. **Universal Stress:** no capability credit is granted by special-case inflation.
10. **Canonical authority:** `VERSION-CONTRACT.json` / component versions change only after all required evidence exists.

## 8. Current verdict

```text
Historical idea value:        SALVAGE
Old branch wholesale merge:   REJECT
Old binaries:                 REJECT
Four reference-backed ops:    CANDIDATE
Fourteen native-only ops:     QUARANTINE
Canonical RBC 1.3 activation: BLOCKED
Native Foundation claim:      BLOCKED
```

The next engineering step is a differential corpus for the four admitted operations, followed by a fresh current-main native implementation candidate. The stale branch remains preserved until that decision closes.
