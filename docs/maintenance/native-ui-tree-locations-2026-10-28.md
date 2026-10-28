# Native UI tree and navigation diagnostic positions

The RCL parser now retains private source positions for UI node IDs, event types,
navigation declarations/initial routes/targets, and navigate/realize references.
Control-event normalization preserves its event position. Existing tree, form,
modal, event and navigation checks use these positions instead of synthetic 1:1.
Form-scope diagnostics use the existing property-expression position. Canonical
UI serialization reads the same semantic fields and excludes the private spans.

All forty new LF/CRLF/Unicode location controls failed against the preserved
pre-change compiler and now pass, retaining the prior output on every rejection.
The actual native compiler reaches C0=C1=C2, 368076 bytes, SHA-256
`00299c1a240e363a28c45e4ffe6107f898cc26c79fe4237cbd4113c6880c08e0`.
All 246 affected compiler/UI/warrant/session checks pass. The full 233-source
collector retains 60000 ms: 195 byte matches, 38 reference rejections and zero
failures, with 122 actual native compiles and 73 reused alias results. This covers
existing typed controls, scoped forms, modals, routes and adaptation target bytes.

The verified location contract is the actual line and UTF-16 column. The token
span model still uses zero offset/length placeholders. Other UI property, event
parameter, mixed-authority and adaptation diagnostics retain their own existing
coverage, so TD-019 remains ACTIVE. No whole-language location equivalence is
claimed. The expensive independent JavaScript self-compilation replay stopped in
the preceding checkpoint was not rerun or promoted here; native evidence remains
separate. The adjacent JSON binds exact sources and results.

No C binary, public RBC format, language version, historical K400 evidence, hosted
Actions, publication or deployment changed.
