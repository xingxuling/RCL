# RCL JSON Schema Independent Donor Oracle v0.1

- Status: **VERIFIED**
- Evidence root: `569a1891cec305c01e1e30c45ef62fe47f17ac5c9c0878f65ceb31f3eca754f7`
- Implementation: **Ajv2020**
- Exact dependency: **ajv@8.20.0**
- Process boundary: separate Node process per model differential and replay
- Shared candidate imports: **false**
- Semantic projection: valid, errors[].keyword, errors[].instancePath, errors[].schemaPath, errors[].params

## Supported fixed subset

- `$schema`
- `$id`
- `title`
- `description`
- `type`
- `required`
- `properties`
- `additionalProperties`
- `enum`
- `minimum`
- `maximum`
- `minLength`
- `maxLength`
- `items`
- `minItems`
- `maxItems`

## Corpus and controls

- Corpus root: `c9c5d4938c71a1e10b106dbb00d6265b69288b544f22c1c4765138034cbf0f67`
- Cases: 100 (40 positive / 40 negative / 20 boundary)
- Mutation controls: ignore-required, minimum-comparison, additional-properties-true, array-item-bypass, enum-equality-bug

## Security and authority boundary

The oracle imports Ajv and Node built-ins only. It does not import RCL candidate validators, candidate helpers, candidate outputs, or prior research outputs. It runs as a separate process, fails closed on malformed input or schema compilation failure, and emits semantic errors with keyword, instancePath, schemaPath, and params. The oracle is an evidence source, not an execution-authority grant.

Reproduction: `npm run verify:rbc13-ai-assimilation-compatibility`
