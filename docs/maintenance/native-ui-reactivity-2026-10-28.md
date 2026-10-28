# Native reactive UI declaration admission

The existing RCL semantic pass now validates all UI state and derived declarations
before constructing canonical UI metadata. State initials must be literal scalar
values of their declared type. Duplicate state/derived identities, cross-kind
collisions, derived result mismatches and cyclic derived dependencies reject.
Expression typing applies even when a derived value is unused by the view.

Dependency traversal retains completed nodes across branches and declarations,
and visits both choose branches. Forward references and shared acyclic dependencies
remain valid. Nineteen focused cases moved from 6 PASS / 13 FAIL on the prior
artifact to 19 PASS on the final artifact. Rejected sources retain an existing
output artifact. Positive fixtures reproduce exact bootstrap bytes, including
forward-reference diamonds and a 36-node shared dependency graph.

The compiler reaches native C0=C1=C2 at 343089 bytes, SHA-256
`796b12201d1fe9112c56962165997c54da41811a6cf6d6a1e5c5d07b8beaf78e`.
All 122 final-artifact checks pass. This does not establish complete native UI
schema or diagnostic parity, real-device UI acceptance, new K400 admission or a
release/version promotion. The full-example collector from the earlier compiler
remains historical evidence bound to that artifact.
