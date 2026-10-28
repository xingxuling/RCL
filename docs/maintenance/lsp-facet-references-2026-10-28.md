# Source-backed facet navigation

The static LSP bridge now resolves same-document facet usages for definition,
hover and references queries. Declaration and semantic-token ranges select actual
source names/types instead of estimating positions from the facet keyword or a
canonicalized type spelling. Half-open UTF-16 ranges support CRLF and supplementary
Unicode text before a usage. Invalid/negative/noninteger positions do not select
an arbitrary symbol.

The existing parser provides `parseRealityWithLocations` as an internal tooling
entry point. Facet names/types, path expressions and rule write targets are mapped
through WeakMaps. Source positions are not added to the canonical AST. The reference
walker respects reckon parameters and match bindings, follows qualified fields
to the owning facet, and preserves the type checker's exact-facet precedence.
Comments, string values, UI-local state and authority scope declarations are
excluded from value-reference results. Rule alteration and host-call output
targets are included as writes.

```js
const { lspIndex } = buildLspIndex({ source, typeModuleSources });
const definition = queryLspIndex(lspIndex, {
  kind: 'definition', position: { line: 4, character: 12 },
});
const references = queryLspIndex(lspIndex, {
  kind: 'references', facet: 'app.session', includeDeclaration: true,
});
```

`context: { includeDeclaration: true }` is also accepted. The default excludes the
declaration. CLI query syntax supports `references:app.session` and
`references:line=4,12` through the existing `lsp-query` command. Source positions
use zero-based line/character coordinates. Index serialization preserves the
occurrence records and deterministic query roots.

Validation: 30 focused LSP/DAP/IDE, native UI parser/root and self-host compiler
checks pass, including seven new reference cases. A separate comparison with the
committed parser at `d047988` covered all 233 current example sources: 212 accepted
ASTs were deeply equal, and 21 rejected sources retained identical diagnostics.
The source-bound comparison is retained in
`lsp-parser-sidecar-2026-10-28.json`; scoped test output is retained under
`output/module-development-20261028/lsp-regression.log`.

This extends the existing static bridge. It does not introduce a running LSP
server, cross-document symbol resolution, function/type references or rename
edits. No language version, canonical semantic authority or release status is
promoted by editor metadata. GitHub Actions were not run.
