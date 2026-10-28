# Native session pure-expression admission

The direct RCL-authored session compiler now applies the existing pure replay
profile to its supported expression tree. It checks facet initializers, every
function body, conditional warrants, rule guards, alterations and preserves.
Provider calls reject even in unused functions or unselected choose branches.
Typed-reference operation names retain the same explicit unsupported policy,
with the shared frontend still rejecting unsupported constructs earlier when
applicable. Rule-level host effects retain their preceding dedicated rejection.

Public session compilation already rejected provider effects through reference
preflight; this change aligns the direct native compiler entry rather than
claiming a new public restriction. Nine before-change native rejection controls
failed while one pure positive control passed. All ten now pass, including exact
native diagnostic positions and retention of an existing output file. Literal
provider-like text remains ordinary Text. A pure function program retains exact
bootstrap bytes and executes in a genuine native session process.

Sixty affected session/compiler/durable/backup/history checks pass. A subsequent
focused ten-case run also verifies diagnostic coordinates. The general compiler
artifact is unchanged; the session compiler retains its documented JavaScript-
built RCL bytecode bootstrap. This is source-bound local admission evidence, not
an independent session-compiler self-hosting, external settlement or whole-language
purity claim. No hosted Actions ran and no versions changed.
