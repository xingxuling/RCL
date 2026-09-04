# Mother Structure extraction result v0.1

Run date: 2026-09-04
Candidate branch: `codex/rcl-mother-structure-ir-v0.1`
RCL source base: `cae0bb2304563d37ea089088142baf42d7e42fc9`

## Input and evidence boundary

The candidate replayer discovered 60 `.rcl` files across K400, native-ui,
selfhost-core native UI examples, typed-package, and package-ecosystem. It
parsed 28 unique contents; 32 exact duplicate contents were skipped and there
were 0 parse failures.

The prior whole-field archaeology corpus supplied 451 non-RCL-AST observations
for package, Forge, evidence, platform, and implementation witnesses. Its
source hash was:

`8beb033e988e0fa175552e5aea631843ce70544551746547698de18f6aff0890`

The merged candidate corpus contains 821 observations across 33 structure IDs.
The corpus root is:

`162972d4168fc685089d970e5bb6f011531a8961ee756c94905d63c7629efea2`

All outputs are `CANDIDATE_ONLY`; no RCL registry, compiler rule, runtime
authority path, Framework, or std entry was changed.

## Repeated structures

Counts below are `occurrences / independent sources / scopes`.

| Structure | Count | Candidate classification |
| --- | ---: | --- |
| `rcl.rule.authorized_transition` | 12 / 5 / 3 | `FRAMEWORK_CANDIDATE` |
| `rcl.facet.declaration` | 193 / 11 / 3 | `STD_CANDIDATE` |
| `rcl.authority.subject_warrant` | 10 / 6 / 3 | `STD_CANDIDATE` |
| `rcl.rule.foresee_realize` | 7 / 3 / 3 | `STD_CANDIDATE` |
| `rcl.reckon.function_contract` | 131 / 1 / 2 | `EXAMPLE` |
| `rcl.ui.view_tree` | 7 / 7 / 1 | `PACK` |
| `rcl.ui.state_declaration` | 3 / 3 / 1 | `PACK` |
| `rcl.ui.state_binding_event` | 2 / 2 / 1 | `PACK` |
| `evidence.gate_result` | 337 / 4 / 2 | `PACK` |
| `evidence.k400_claim` | 28 / 2 / 1 | `PACK` |
| `evidence.ui_target_contract` | 2 / 1 / 1 | `PACK` |
| `platform.android_target` | 3 / 2 / 2 | `PACK` |
| `implementation.compile_lower_execute` | 7 / 7 / 3 | `AUXILIARY_LANGUAGE_PROVIDER` |
| `implementation.integrity_manifest` | 16 / 16 / 3 | `AUXILIARY_LANGUAGE_PROVIDER` |
| `implementation.provider_authorization` | 17 / 17 / 3 | `AUXILIARY_LANGUAGE_PROVIDER` |
| `implementation.artifact_receipt` | 10 / 10 / 3 | `AUXILIARY_LANGUAGE_PROVIDER` |
| `implementation.verify_release` | 7 / 7 / 3 | `AUXILIARY_LANGUAGE_PROVIDER` |
| `implementation.atomic_emission` | 7 / 7 / 2 | `AUXILIARY_LANGUAGE_PROVIDER` |
| `implementation.blueprint_validation` | 5 / 5 / 1 | `AUXILIARY_LANGUAGE_PROVIDER` |
| `implementation.target_matrix` | 4 / 4 / 2 | `AUXILIARY_LANGUAGE_PROVIDER` |

The aggregate classification counts are:

`PACK=20`, `AUXILIARY_LANGUAGE_PROVIDER=8`, `STD_CANDIDATE=3`,
`FRAMEWORK_CANDIDATE=1`, `EXAMPLE=1`.

There were no formal `RCL_GAP` records created by this run. The previously
observed open themes remain gap candidates requiring independent capability
comparison: async/physical time/external effects, database durability and
concurrency, general compiler/ML scope, static warrant validation, UI platform
semantics, and standards-complete web/native semantics.

## DWAC result

DWAC compiled all 821 candidate systems with 0 compile failures. It produced 50
PatternLens, 23 repeated PatternLens, 5 bounded structural-analogy candidates,
and 18 structural mother clusters. The DWAC result root is:

`8eea375720499670bb975d85571c04b3af30cea962c8443e167172050fb35543`

One cluster joins `rcl.rule.authorized_transition` and
`rcl.rule.foresee_realize` by graph analogy. That is useful mother-structure
evidence, not proof that the two are semantically identical or should share one
syntax, owner, or registry entry. All cluster rows retain
`causalClaim=false`, `identityClaim=false`, and `promotion=NOT_AUTOMATIC`.

## Verification

- Mother Structure candidate tests: 8 passed, 0 failed.
- Existing RCL native-ui/package/Forge/K400 focused suite: 58 passed, 0 failed.
- DWAC world-knowledge tests: 12 passed, 0 failed.
- K400 evidence schema: 400 cells, 23 claims, 0 validation errors.

These results prove extraction, recurrence accounting, graph integrity, and
DWAC handoff only. They do not prove any Framework/std promotion, K400
completion, external provider execution, device execution, package release, or
formal RCL_GAP.
