# Facet usage semantic tokens

The existing static LSP bridge now colors same-document facet reads and writes
from its parsed occurrence index. The token legend adds declaration and
modification modifiers. Function/match locals, UI-local values, strings, comments
and authority-scope paths retain their separate meaning and do not become facet
value tokens.

Tokens use actual lexical identifier fragments within parsed ranges. A qualified
path split across lines or containing comments therefore emits separate
single-line identifiers without coloring punctuation or whitespace. Nested facet
declarations retain their local source spelling. UTF-16 offsets continue to match
the parser after supplementary text and with CRLF line endings. The optional
parser sidecar reuses its existing lexer token stream outside the canonical AST.

Twenty focused editor checks pass, including four new cases that decode the
relative semantic-token packet, query a serialized index, distinguish declaration/
write/read modifiers, and cover fragmented paths, nested declarations and excluded
namespaces. This supplies static protocol data; no running editor or LSP server
acceptance is claimed. Canonical language versions and semantic authority remain
unchanged. No hosted Actions ran.
