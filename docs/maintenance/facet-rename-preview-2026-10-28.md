# Facet rename previews

The existing LSP/source-map owner now builds same-document facet leaf rename
previews from parsed declaration/read/write occurrences. It preserves namespace
and subject ownership, field suffixes, strings, comments, function parameters and
UI-local state. New names must be exactly one identifier. The generated source
is compiled/indexed again and every facet occurrence is checked against its
translated original binding, rejecting parameter/literal capture. Name collisions,
unknown facets, no-ops, stale source pins and exact/descendant authority-scope
dependencies return no partial preview. Broad unchanged ancestor scopes remain
eligible; the tool does not rewrite authority declarations.

The SDK exports `buildFacetRenamePreview`, `writeFacetRenamePreview` and
`RCL_FACET_RENAME_PREVIEW_FORMAT`. The pure builder accepts `source`, `facet`,
`newName`, optional `sourceFile`, `typeModuleSources`, document `version` and
`expectedTextRoot`. It returns a CANDIDATE preview containing standard
`WorkspaceEdit.documentChanges`, original/preview text and program roots,
the renamed source and a deterministic preview root. It performs compilation and
indexing only, including when provider expressions appear in the source.

The public CLI exports a new directory containing `renamed.rcl` and
`rename-preview.json`:

```powershell
node src/reality-hub-cli.mjs lsp-rename-preview examples/hello-reality.rcl world.greeting message output/hello-rename
# For typed source, append: --types <directory-or-file>
```

The original is preserved and existing outputs reject. UTF-8 BOM, CRLF,
supplementary Unicode columns, Chinese paths and owned/typed field references
are covered. Ten new functional checks and all 46 affected LSP/CLI checks pass.
The actual Hello preview runs with native/reference state, history and semantic
root parity, producing `world.message = "Hello, reality."`. The integration phase
used the local TaoX WHOLE_ARTIFACT router recommendation (advisory only).

This is a reviewable local refactoring candidate, not a complete language
refactorer or live LSP rename endpoint. The static index still does not advertise
a live rename provider. Source hashes detect changes and do not authenticate a
publisher or grant permission. No native C/compiler artifact, version contract,
K400 evidence, hosted Actions, publication or deployment changed. Exact sources,
checks and the real preview execution are bound in the adjacent JSON.
