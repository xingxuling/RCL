# RCL Equivalence Corpus Forge v0.1

## Purpose

Source Capability Frontends turn real specifications into typed `External Capability Spec` candidates. Equivalence Corpus Forge adds the missing experiment-design layer:

```text
JSON Schema / OpenAPI / SQL DDL
→ Source Capability Bundle
→ Equivalence Corpus Forge
→ deterministic experiment cases
→ independent source adapter
→ independent absorbed adapter
→ Differential Absorption
→ Native Promotion
```

The forge does **not** execute external runtimes and does not fabricate `sourceOutput`, `absorbedOutput`, receipts or pass/fail verdicts.

## Artifact model

### Corpus batch

Format: `rcl.equivalence-corpus.v0.1`

Binds:

- source root;
- source capability bundle root;
- capability corpus roots;
- total case and mutation-plan counts;
- inherited source diagnostics;
- explicit evidence boundary.

### Capability corpus

Format: `rcl.capability-equivalence-corpus.v0.1`

Binds:

- capability id and spec root;
- source identity;
- deterministic case roots;
- mutation-plan roots;
- generation coverage and diagnostics.

### Corpus case

Format: `rcl.equivalence-corpus-case.v0.1`

Each case contains:

- a stable id;
- classification: `valid`, `invalid`, `boundary`, or `mutation-probe`;
- concrete adapter input;
- expected semantic class: `accept`, `reject`, or `observe`;
- targeted invariants;
- tags and provenance;
- a content root.

`observe` is used whenever the extracted semantic contract does not support a safe accept/reject claim.

### Mutation plan

Format: `rcl.equivalence-mutation-plan.v0.1`

A mutation plan describes a deliberately wrong implementation and the case ids that should detect it. It is not an executable negative-control adapter. Implementing and independently invoking that adapter remains the responsibility of the Differential Absorption stage.

## Frontend-specific generation

### JSON Schema

Generates bounded cases for:

- minimal and full valid objects;
- missing required properties;
- wrong property types;
- enum violations;
- exact and violating string-length boundaries;
- numeric minimum/maximum boundaries;
- closed-object additional-property violations.

Regex patterns, composition keywords, conditionals and other solver-requiring constructs are diagnosed rather than guessed.

### OpenAPI

Generates side-effect-free contract probes for:

- nominal required request structure;
- missing path/query/header/cookie parameters;
- empty required-parameter observation boundaries;
- missing required request bodies;
- declared response-status probes.

The forge never contacts declared servers. Concrete response bodies are not invented when they were not retained by the extracted semantic contract.

### SQL DDL

Generates isolated transaction probes for:

- nominal inserts;
- missing and null `NOT NULL` columns;
- duplicate primary-key/unique values;
- absent foreign references;
- CHECK and table-constraint observation probes.

Arbitrary SQL constraint expressions are not solved in v0.1. Cases requiring those semantics are marked `observe`.

## Differential integration

```js
const corpus = forgeEquivalenceCorpus(sourceBundle);
const cases = differentialCasesFromCorpus(corpus, {
  capability: 'openapi_getorder',
  includeObserve: false,
});

const plan = createDifferentialExperimentPlan(corpus, {
  capability: 'openapi_getorder',
});
```

The returned cases match the existing Differential Absorption runner input shape:

```js
{ id, input, tags }
```

The experiment plan records adapter separation, replay and negative-control requirements without claiming that those requirements have already been satisfied.

## Evidence boundary

The stage sequence is now:

```text
source-extracted
→ corpus-forged
→ independently-executed
→ independent-differential
→ native-candidate
→ native-verified
```

`corpus-forged` means that RCL has designed deterministic experiments from an extracted semantic contract. It does not mean that the source runtime and absorbed implementation have produced matching observations.
