# Mother Structure IR candidate v0.1

This module is a candidate extraction layer between the RCL parser AST and
Framework/std/Pack/Provider decisions.

It is deliberately not a registry and does not change `compileReality` or any
runtime authority path. The exported functions in
`src/mother-structure-ir.mjs` do four bounded things:

1. `buildMotherStructureIR(programOrSource, options)` extracts normalized
   semantic graphs, structural slots, and source provenance from a
   `RealityProgram` AST.
2. `buildMotherStructureCorpus(irsOrObservations, options)` aggregates repeated
   structures across sources and scopes.
3. `classifyMotherStructure(structure, stats)` gives a conservative candidate
   classification. It is a recommendation, not promotion.
4. `verifyMotherStructureIR` and `verifyMotherStructureCorpus` validate the
   candidate envelopes.

## Extracted structures

The first profile covers the structures found repeatedly by the archaeology
scan:

- `rcl.rule.authorized_transition`
- `rcl.rule.transition` for incomplete governed transitions
- `rcl.rule.foresee_realize`
- `rcl.facet.declaration`
- `rcl.authority.subject_warrant`
- `rcl.provider.host_offer`
- `rcl.ui.*` state, derived-state, view-tree, binding/event, lifecycle,
  navigation, device-adaptation, and style/theme shapes

It also extracts bounded RCL contracts for reckon, dialect lowering, effects,
capability policies, stores, and meta revision. Top-level AST kinds outside
this profile are retained in `coverage.unmodeledTopLevelKinds`; they are not
silently treated as understood semantics.

Graphs use role-level symbols and relation classes. Declaration names, paths,
literal values, witness text, and provider implementation details are kept out
of the structural graph. Source path, source hash, scope, lineage, and evidence
references remain available as provenance.

## Recurrence and classification

The corpus records exact occurrence count, unique source count, independent
source count, scope count, repeated status, and the thresholds used. A repeated
shape is visible at two observations, but the conservative candidate threshold
defaults to three occurrences, two scopes, and two independent sources.

The current recommendations are:

| Candidate class | Current rule |
| --- | --- |
| `FRAMEWORK_CANDIDATE` | `rcl.rule.authorized_transition`, at least 3 observations and 2 scopes |
| `STD_CANDIDATE` | facet/warrant/host-offer/foresee-realize, at least 3 observations and 2 scopes |
| `PACK` | bounded UI/package/Forge/evidence/platform envelopes |
| `EXAMPLE` | low-frequency, narrow-scope, or insufficiently independent recurrence |
| `RCL_GAP_CANDIDATE` | explicit caller mark only; never inferred from clustering |
| `AUXILIARY_LANGUAGE_PROVIDER` | implementation/provider/runtime mechanics |

Every row remains `CANDIDATE_ONLY`, has `promotion: NOT_AUTOMATIC` (or
`NOT_ELIGIBLE` for an explicitly marked gap candidate), and carries a
`formalRclGap.eligible: false` guard. A formal `RCL_GAP` still requires a
signed, hash-bound PRIMITIVE/IR/RUNTIME/PROFILE comparison with a real missing
capability; frequency, labels, DWAC clusters, or provider output do not prove
that claim.

## DWAC handoff

`buildMotherStructureCorpus` emits `dwacInput` systems with role-level symbols,
`SOURCE_ASSERTION` relations, repository provenance, and candidate-only
invariants. DWAC may use this input to find structural analogies and mother
clusters. A DWAC analogy remains a structural candidate and does not establish
semantic identity, causality, ownership, or promotion.

The existing package/Forge JSON and implementation witness scan remains an
external observation source. It can be passed to the corpus aggregator through
the normalized observation shape (`structureId`, `graph`, `sourcePath`,
`sourceSha256`, `scope`, and optional `metadata`); it is not misrepresented as
RCL AST ownership.

## Verification boundary

Passing the candidate tests proves deterministic extraction, graph integrity,
negative handling, recurrence accounting, and DWAC-shaped serialization only.
It does not prove Framework/std admission, compiler/runtime equivalence, any
K400 gate, external provider behavior, device execution, package release, or
formal RCL gap status. Those remain separate Integration Court and evidence
ledger decisions.
