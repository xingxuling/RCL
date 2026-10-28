# Native source path admission

The shared RCL path parser now requires identifier tokens at the first name and
after every dot. Warrant and rule-need parsing also require the actual `on`
delimiter. Previously the direct native compiler accepted numeric names, quoted
capabilities/targets, wildcard source targets and unrelated delimiter words even
though the reference grammar rejected them. Sixteen LF/CRLF negative controls
reproduced those acceptances; they now reject before replacing the output artifact
at the actual offending token. Both general and session compiler entries pass.

Unicode and hierarchical identifier paths retain bootstrap byte parity. All 206
affected compiler, UI, warrant and session checks pass. Native C0=C1=C2 is 364364
bytes, SHA-256
`571f39c3265c65803c364fc03ef6cb3ac264ed8ff7c11302d4bfd41c6e54828b`.
The full collector still reports 195 byte matches, 38 reference rejections and zero
failures across 233 sources at 60000 ms, with 122 native attempts and 73 aliases.

An additional full JavaScript bytecode-interpreter self-compilation replay did
not complete after more than five minutes and was explicitly stopped after
verifying its owned process identities. It is NOT_COMPLETED_BUDGET_STOP, not a
passed check; the actual native fixed-point result above is separate. No timeout
was enlarged and no JavaScript replay acceptance is inferred. Its process record
and the final scoped regression are bound in the adjacent JSON.

This closes the exploratory wildcard-source gap recorded in the preceding
missing-warrant checkpoint. It does not change internal wildcard scope matching,
add wildcard source syntax, or establish complete grammar equivalence. Other
parser contexts retain their existing admission rules. No C binary, RBC format,
language version, K400 admission, hosted Actions, publication or deployment changed.
