# RCL Source Capability Frontends v0.1

## Purpose

Capability Metabolism v0.1 accepts a typed external capability specification. Source Capability Frontends add the missing ingestion layer:

```text
real source document
→ source-specific structural extraction
→ External Capability Spec
→ Capability Metabolism
→ Differential Absorption
→ Native Promotion
```

The frontend does not claim to understand every source-language construct. It emits content-addressed capability candidates plus explicit coverage and diagnostics.

## Supported frontends

### JSON Schema

Initial target: JSON Schema Draft 2020-12 shaped JSON documents.

Emits:

- one validator capability for the root schema;
- optional validator capabilities for `$defs` entries;
- structural invariants from types, required properties, enumerations, numeric/string/array limits, object closure, dependency and composition keywords;
- provider-free lowering candidates for `validation_ir` and `native_rbc`.

Not yet implemented:

- instance validation;
- remote `$ref` resolution;
- complete vocabulary semantics;
- dynamic-reference execution;
- equivalence corpus generation.

### OpenAPI

Initial target: OpenAPI 3.x JSON documents.

Emits one capability per HTTP operation and extracts:

- method and path;
- required path/query/header/cookie parameters;
- request-body content contracts;
- declared response codes and content contracts;
- read versus mutation effects;
- provider, resource and authority requirements.

Not yet implemented:

- YAML parsing;
- remote-reference resolution;
- callback and webhook capabilities;
- HTTP execution;
- complete OpenAPI conformance validation.

### SQL DDL

Initial target: a PostgreSQL-shaped `CREATE TABLE` subset.

Emits one relational storage capability per table and extracts:

- schema-qualified and quoted table identifiers;
- columns and data types;
- `NOT NULL`, `PRIMARY KEY`, `UNIQUE`, `CHECK`, `DEFAULT` and `REFERENCES` signals;
- table-level constraints;
- relational write, constraint, resource and authority models.

Not yet implemented:

- a complete SQL grammar;
- `ALTER TABLE`, indexes, views, triggers, functions or procedures;
- migration execution;
- dialect-specific semantic equivalence.

## Public API

```js
extractCapabilitiesFromJsonSchema(input, options)
extractCapabilitiesFromOpenApi(input, options)
extractCapabilitiesFromSqlDdl(input, options)
detectSourceCapabilityKind(input, options)
extractSourceCapabilities(input, options)
metabolizeSourceCapabilityBundle(input, options)
```

Every extraction returns `rcl.source-capability-bundle.v0.1` with:

- source kind and version;
- canonical source root;
- normalized capability specs and roots;
- extraction coverage;
- unsupported-feature diagnostics;
- an explicit evidence boundary.

`metabolizeSourceCapabilityBundle` connects the extracted specs to the existing metabolism engine. Source extraction and semantic metabolism still do not establish independent runtime equivalence or native verification.

## Promotion boundary

The stage sequence remains:

```text
source-extracted
→ semantic-absorbed
→ independent-differential
→ native-candidate
→ native-verified
```

A frontend result is an evidence-bearing candidate, not proof that RCL has already reproduced the source runtime.
