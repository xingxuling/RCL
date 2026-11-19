# Raw source ranges for editor tooling

The reference lexer can optionally retain exact raw UTF-16 token ranges in a private WeakMap with `lexReality(source, { sourceRanges: true })`; `getTokenSourceRange(token)` returns an immutable range containing zero-based editor start/end points, offset and raw length. Ordinary compiler lexing does not allocate those optional ranges. Enumerable token fields and JSON token serialization remain unchanged.

`parseRealityWithLocations` requests the metadata and now records literal, call, unary and binary expression ranges as well as existing path/declaration ranges. End positions come from raw source consumption, preserving quotes, escape spelling, multiline/CRLF text and supplementary characters rather than inferring an end from decoded string length. Canonical AST objects still carry no new fields. The existing facet-reference/rename logic retains its source namespaces.

Eight raw-range controls and twenty-two existing semantic-token/reference/rename controls pass, including immutable metadata, EOF, unchanged serialized token/AST shape and actionable WorkspaceEdit output. The current compiler bootstrap bytecode is exactly unchanged by this tooling increment. This supplies richer source metadata; it does not introduce a live LSP server or claim that every editor feature consumes every new expression range.
