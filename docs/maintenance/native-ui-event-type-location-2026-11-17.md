# Native UI event diagnostic location

An unknown event type previously reported `RCL_UI_EVENT_TYPE` at synthetic
position 1:1. The RCL-authored compiler now uses the event-type token span.
The new LF and CRLF controls first reproduced the old 1:1 output, then passed
after the change while retaining a pre-existing output file on rejection.

The rebuilt `selfhost/compiler.rbc` reaches native C0 = C1 = C2 at 368,156
bytes, SHA-256 `59c799364f4b9f0fd934eeb666c38447c7085b25b926cdb9be7c04fa7840b885`.
Using that artifact, 48 UI location and scoped-form checks pass locally. This
is a targeted diagnostic improvement, not closure of TD-019 or proof of all
diagnostic offsets and lengths. No hosted CI or device acceptance is implied.

The follow-up event-parameter change retains the parameter-name token span,
including when a type annotation is present. Duplicate parameters and invalid
parameter types now point to that name instead of 1:1. Four LF/CRLF controls
first reproduced the old location and then passed. The rebuilt compiler again
reaches C0 = C1 = C2 at 368,220 bytes, SHA-256
`7bb4dc49a9cfbd0351cc9fae10e34db2d45f11559875445b9587b4705543550f`.
With that artifact, 76 location, self-hosted control and event-runtime checks
pass locally, including exact bytes for declared and inferred control types.
The earlier compiler hash above remains historical; TD-019 remains active.

The subsequent adaptation diagnostic increment locates repeated `default`,
`min_width` and `max_width` declarations at the repeated source token instead
of 1:1. Six LF/CRLF controls reproduced the old locations and passed after the
change. The new native fixed point is 368,396 bytes, SHA-256
`1243ab6cc32c1707fb7dd9c0ce4ff19c3918df12b2ed8a7b4b7cfdd4651d6aee`.
The final artifact passed 61 location and UI runtime/layout checks; a valid
device-adaptation example also emitted bytes identical to the JS compiler.
Earlier fixed-point hashes remain historical and TD-019 remains active.

The next adaptation increment retains each profile identifier span through
width parsing. Duplicate profiles, invalid width ranges and overlapping
profiles now point to that profile name. Six LF/CRLF controls reproduced the
old 1:1 result and passed after the change. The new 368,556-byte compiler
reaches C0 = C1 = C2, SHA-256
`0cb81d018e462347c85a291c5b133d4e3eaf4ed29c7fcdec29f59c73a420c0a3`.
The final artifact passed 67 location and UI runtime/layout checks, and the
valid device-adaptation example retained native/reference byte parity.
This remains a bounded diagnostic increment; TD-019 stays active.

The next increment retains the adaptation declaration and default identifier
spans. Missing default/profile declarations point to `adaptation`; an unknown
default points to its identifier. Six LF/CRLF controls first reproduced 1:1 and
then passed. The 368,924-byte compiler reaches C0 = C1 = C2, SHA-256
`e454fc6486469967f941d6b5c7408427230d0fe1c5e5e9d4e4b537ba50329a4b`.
The final artifact passed 73 location and UI runtime/layout checks; a valid
device-adaptation example retained native/reference byte parity. TD-019 remains
active and earlier fixed-point hashes remain historical.

Duplicate adaptive-layout declarations now point to the repeated profile name,
and invalid layout modes point to the mode token. Four LF/CRLF controls first
reproduced 1:1 and then passed. The rebuilt 369,132-byte compiler reaches
C0 = C1 = C2, SHA-256
`f1ba62d7617bb34b23a2f4acd4258ed1fa10bfb5347de09b01a41f18d5c4f204`.
The final artifact passed 79 location and UI runtime/layout checks, and the valid
device-adaptation example retained native/reference byte parity. Unknown profile
references and other diagnostics remain outside this increment; TD-019 remains
active and prior fixed-point hashes are historical.

The control-validation increment points invalid text length bounds to their
property value, invalid slider ranges to the control, and invalid slider steps
to the step value. LF/CRLF controls cover these cases. The 369,564-byte compiler
reaches C0 = C1 = C2, SHA-256
`dad2d303219def9d1f55e3f7a4b684621110b51d3284d80a02d1158fe54e1cc1`.
The final artifact passed 116 location and control checks; the typed-control
showcase and validated-signup examples retained native/reference byte parity.
This is scoped evidence; TD-019 remains active.

The following control increment reports missing value bindings or label/event
requirements at the control, and invalid select options or explicit date values
at the corresponding property value. LF/CRLF controls cover all four cases. The
370,252-byte compiler reaches C0 = C1 = C2, SHA-256
`10e1098a0074917ad51c5419ea766c69082e81d2b1bf0b80577ed65833fb85ce`.
The final artifact passed 134 location and control checks; the typed-control
showcase and advanced-form examples retained native/reference byte parity.
This remains a bounded diagnostic increment; TD-019 remains active.

The event-mutation increment retains each set target's token span. Unknown
state targets point to the target; type mismatches point to the assigned
expression. Four LF/CRLF controls reproduced the prior 1:1 output and passed
afterward. The 370,684-byte compiler reaches C0 = C1 = C2, SHA-256
`a8f1e7b23cea00778010eb863bd563a6bef2b286e3ba59065836179f25e59738`.
The final artifact passed 132 location, control and event checks; two valid UI
examples retained native/reference byte parity. TD-019 remains active.

The next control-validation increment locates unsupported slider/choice/length
properties, slider `required`, and reversed text-length bounds at the relevant
property value. Ten LF/CRLF controls cover these cases; the initial four cases
were reproduced at 1:1 before the change. The rebuilt 370,092-byte compiler
reaches C0 = C1 = C2, SHA-256
`d62443cf48a91100c023528b7bac65fb027f08603117dbf5a0527a6003a2996d`.
The final artifact passed 126 location and control checks; two valid control
examples retained native/reference byte parity. TD-019 remains active.

The subsequent increment retains each adaptive-layout profile reference span.
Missing adaptation configuration and unknown profile references point to that
reference, rather than 1:1. Four LF/CRLF controls reproduced the prior result
and passed after the change. The 369,404-byte compiler reaches C0 = C1 = C2,
SHA-256 `559dfc97cb23d543813de5a88b5a3c7d3b612954b3c83871dc17044c195c6b0b`.
The final artifact passed 83 location and UI runtime/layout checks; the valid
device-adaptation example retained native/reference byte parity. TD-019 remains
active and prior fixed-point hashes are historical.

Duplicate adaptation blocks now report the second `adaptation` token; LF and
CRLF controls reproduced the prior 1:1 location before passing. The rebuilt
368,972-byte compiler reaches C0 = C1 = C2, SHA-256
`a5d16a392aad3694dba280d2c13fc658444366981909d46ae9881ab6027902a3`.
The final artifact passed 75 location and UI runtime/layout checks; the valid
device-adaptation example retained native/reference byte parity. TD-019 remains
active and earlier fixed-point hashes remain historical.

### Unknown UI reference locations

`RCL_UI_REFERENCE_UNKNOWN` now carries the referenced path expression's span through both type and scope resolution. Focused negative cases first reproduced the old `1:1` location, then passed for a binding and a nested event expression with LF and CRLF; each verifies existing output is retained. The rebuilt `selfhost/compiler.rbc` reached the native C0 = C1 = C2 fixed point with SHA-256 `983c909adf2b41753bb6d9d534114174dd8c66c73cf14263b5c1189d5f97c80b`. The 136 relevant location, control, and event tests passed using that artifact, and the typed-control and advanced-form examples remained byte-identical to the reference compiler. This covers these unknown-reference paths, not every outstanding TD-019 diagnostic.

### Typed control event parameter locations

A typed control's change/input event with an invalid parameter list now reports the event name's span instead of `1:1`. The missing-parameter negative case reproduced the old behavior and passed for LF and CRLF after the change, while preserving the existing output file. The rebuilt compiler reached C0 = C1 = C2 with SHA-256 `1bf33c5435ec8719b9bb6e5c0ed4dc571e5e088b72b67c915da85c1367d48a4a`; 138 relevant location, control, and event checks passed, and two valid examples retained reference byte parity. This does not close TD-019.

### Mixed-authority event locations

A UI event mixing reality transactions with state mutation or navigation still fails closed, now at the event name. Focused negative cases reproduced the prior `1:1` location for both operation orders and passed for LF and CRLF, retaining pre-existing output. The rebuilt compiler reached C0 = C1 = C2 with SHA-256 `12e276f78130fc97da1e0e9dfefbc88069c669a74de8c3128f0333d43b48adf5`; 142 related location, control, and event checks passed. Valid governed and typed-control examples retained reference byte parity. This is not closure of TD-019.

### UI root and style declaration locations

Missing or multiple root views now report the UI name, and a style lacking its required selector reports the style name. All three negative cases reproduced `1:1` before the change and pass for LF and CRLF with output preservation. The native compiler reached C0 = C1 = C2 at SHA-256 `fd00ffc5a0bbc24bde15a0cc934334505e38318429bb67f788b233a1ba7fc01e`. The 157 location, control, event, and style-layout checks passed, and valid counter and typed-control examples matched reference bytes. TD-019 remains open.

### Layout size diagnostics

Invalid width and height modes now report the mode token; the fixed-size bound check also receives its numeric token span. The mode cases reproduced the previous `1:1` result and pass for LF and CRLF while retaining pre-existing output. The fixed-size bound branch was not independently exercised by these cases. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `360f99ae2454d0566c5565712950b7e6d8b12cd9ca843437101925726e63638d`. The 158 relevant location, style-layout and control checks passed, and fixed-layout and counter examples matched reference bytes. TD-019 remains open.

### Native layout admission parity

The native compiler previously emitted bytecode for invalid layout modes, alignment, distribution, overflow and non-positive or fractional column counts that the reference compiler rejects. It now rejects these with token locations and retains existing output. LF/CRLF negative controls cover six cases, independently checked against reference rejection. Valid enum values, valid columns and four overwritten invalid clauses retain reference-identical bytecode; other layout admission remains outside this increment. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `cda83cb448e213e9b31727fe124b0851f39edde11ae3d1e2728f2d0cc7e4d8b9`, and 174 related checks passed. TD-019 remains open.

### Style and theme admission parity

The native compiler now rejects unknown selector kinds and roles, unknown theme/style properties, and covered wrong-type or nonliteral property values that previously produced bytecode. Ten LF/CRLF rejection controls retain existing output and five distinct cases also reject in the reference compiler. A valid corpus covers all selector kinds, roles and style property types, plus an overridden selector; accepted output is byte-identical to the reference. A first class-selector fixture exposed the reference requirement that classes exist in the view tree, and was corrected to provide one; unresolved class/node target validation is outside this change. The compiler reached C0 = C1 = C2 at SHA-256 `3348cffe9c1c74f90df90795c03f2ae8637cb1b6341d1349e938ac84f2d7e13a`; 185 relevant checks passed. TD-019 remains open.

### Style target admission and remaining nested-style mismatch

Native admission now checks that node and class selectors refer to an ID or class anywhere in the UI view tree. Missing targets are rejected at the style declaration and preserve existing output; LF/CRLF negative cases and reference rejection controls pass. A nested target corpus with empty declarations matches reference bytecode. Separately, a nested tree with multiple nonempty styles produces a different bytecode root from the reference with both the previous and current compiler, so this is a pre-existing unresolved parity issue; no fix or root parity is claimed for that case. The current compiler reached C0 = C1 = C2 at SHA-256 `d1516a851c90ef540183ce605146c54ae29995621bd2578dec5d66b6355570dc`; 190 related checks passed. TD-019 remains open.

### Native nested style inheritance and precedence

The previously reproduced nested-style root mismatch is corrected for the recorded case. Native canonicalization now propagates parent values for default and explicitly inherited style properties, recording inherited provenance; theme, rule and node values still override the inherited value. Rule ordering now compares priority, specificity and declaration order as separate fields, and repeated properties in a style or theme use the last value. Focused byte-for-byte reference controls cover nested inheritance, explicit inheritance, overriding, themes, fractional priority, duplicate declarations and equal-priority order. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `cd01f97404c94b1f772f6b5eeb32293a9eae519939d311a34613d715147ac21c`; 192 relevant checks passed. This evidence does not claim all style combinations or close TD-019.

### Native lifecycle admission and normalization

Native UI compilation now rejects unknown lifecycle stages, unknown restore state IDs and duplicate lifecycle blocks; repeated stages and restore IDs are normalized in first-seen order like the reference. Negative LF/CRLF controls preserve output and are independently rejected by the reference, and valid empty, reordered, repeated and forward-declared restore cases produce identical bytecode. Unknown restore currently points at the UI name rather than the specific restore token. The compiler reached C0 = C1 = C2 at SHA-256 `9860900c55708fcc58c6ba9e3db1ddec06dadcbf917dbd7b20d3f5e8d04fcc0a`; related UI, event, layout and atomic-restore checks passed. TD-019 remains open.

### Lifecycle restore reference locations

Unknown lifecycle restore IDs now report the referenced token instead of the UI name. The compiler retains parallel internal spans for distinct restore IDs, preserving first-occurrence alignment across duplicates and retaining those spans when navigation and adaptation are parsed. LF/CRLF negative controls cover all three cases with output preservation; valid restore normalization still matches reference bytecode. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `4a8791f4968c387ffa466d07707d854c4e6806968dade66320906d0661789db9`; related UI, style, control, event and atomic-restore checks passed. This narrows, but does not close, TD-019.

### View role and layout declaration order

The native compiler now supports canonical `role` overrides and rejects a second layout block. Parsing a base layout preserves previously declared adaptive layouts; validation of their parent role and final base layout occurs after the node is parsed, so later role/layout declarations are respected. Focused reference controls cover valid role changes and adaptive-before-base order, and reject duplicate layouts and a final overlay with adaptive layout; failed compilation retains output. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `ed502363978cf2f7aedd19d22bd3b0bbd0f1fac7b8040c9c3b4f05858d4bfadc`; related UI, layout, event, control and atomic-restore checks passed. TD-019 remains open.

### Adaptive width interval boundaries

Native adaptation admission now rejects fractional minimum and maximum widths and compares open-ended intervals without an arbitrary one-billion ceiling. Six LF/CRLF negative controls reproduce the former acceptance and now reject while preserving output; corresponding reference rejections and valid large, reversed-order, adjacent and zero-boundary profiles were checked. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `a7119a2a23724c541da9784637ae88177646539b7b2a4d5c6a33c26393423cd1`; related UI, layout and control checks passed. This does not close TD-019 or establish parity for every numeric input.

### Duplicate UI program identities

The native compiler now rejects repeated UI program names, reporting the second name and preserving existing output. The former acceptance was reproduced under LF and CRLF, while distinct UI names retain reference-identical bytecode. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `ef7475fe9822a6c028890e60cc26f44416bfbc2bdbebaa28840041b7323d4f0e`; the relevant UI location, style, control and event checks passed. The separately recorded package built from `173b360` predates this change. TD-019 remains open.

### Expression delimiters and string tokens

Native expression parsing no longer accepts an arbitrary token in place of a closing parenthesis in grouped expressions or function calls. Both native and reference expression parsers now distinguish punctuation tokens from string values that happen to contain `)` or `,`; strings `not` and `-` are also no longer mistaken for unary operators. Focused controls reproduce malformed inputs, verify source positions and retained output, and compare valid nested expressions and punctuation/operator strings byte-for-byte. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `7e5a06df1b9f99bbcb97b00f32ddc441af86f126baf7877ea6fbd40ccfe45a28`; targeted UI, parser and semantic-location suites passed. An earlier, long general fixed-point test run was stopped after the parser changed and is not evidence for this final revision. No claim is made that all delimiter handling or TD-019 is complete. The package from `173b360` predates this change.

### Keyword and operator token kinds in expressions

Expression parsing now recognizes `match` only as an identifier keyword, and binary operators only from identifier or symbol tokens, in both reference and native compiler paths. The reference parser previously rejected the valid string `"match"`; the native parser previously treated string `"+"` as a binary operator. Controls now cover these cases, preserve failed native output, and compare accepted bytecode. The compiler reached C0 = C1 = C2 at SHA-256 `a0feb336dd7b0c60735adcb496afa46a5839415ed90c4f28c44f626548d6539b`; targeted parser, UI and semantic-location checks passed. This does not claim all keyword contexts or TD-019 are resolved; the candidate archive from `173b360` predates the change.

### Structural tokens versus string literals

Reference token expectations now exclude string tokens; native `require_token` accepts only identifier or symbol tokens. Native block termination also requires a real closing-brace symbol, and top-level and UI-node dispatch require an identifier clause. Controls reproduce and reject strings impersonating an opening brace, closing brace, binding arrow, top-level `ui` and node `class`; failures retain the previous output, and valid punctuation strings still compile. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `dfc8125a8e529d57a519fb2f628b0d721cc7d0f9608e18726ae039bb41c54b03`; targeted parser, UI, event and semantic-location suites passed. Other keyword-dispatch contexts still need separate audit. The package from `173b360` predates this change.

### UI clause keyword token types

Native UI theme, style, layout, event, navigation, adaptation, lifecycle and declaration dispatch now requires an identifier clause or a real closing brace. Reference UI declaration and layout loops likewise require identifier clauses. Negative controls cover strings impersonating `state`, `target`, `restore`, `align`, `set`, and `profile`, alongside the earlier structural controls, with previous output retained. These guards do not establish coverage of every non-UI declaration. The native compiler reached C0 = C1 = C2 at SHA-256 `6dedd57f75c297893c5be87bda99336fffab08afaaf97e6d8449f980a186b71e`; targeted UI parser, controls, layout, event and expression suites passed. The package from `173b360` predates this change.

### Subject and rule clause admission

The native compiler no longer interprets arbitrary subject clauses as warrants. Subject and rule bodies require actual identifier clauses, and native subject/rule headers and `cause`, `from`, `into` values require the expected identifier and brace tokens. The reference rule parser also rejects quoted clause keywords. Focused controls cover an unknown subject clause, quoted keywords, names and braces, and a quoted cause; both compilers reject them without overwriting native output, while the valid multi-warrant rule fixture remains byte-identical. The compiler reached C0 = C1 = C2 at SHA-256 `eaf38ff14cc605366dffc48607e7b06553cbf860a97b83fd460be24d32944a7e`; targeted authority, rule-host, warrant, UI and parser suites passed. This is scoped parsing evidence, not a complete authority or security audit. The package from `173b360` predates the change.

### Facet and reckoning declaration delimiters

Native facet parsing now requires `:` and `=`, and reckoning parsing requires identifier names and parameters plus the opening, parameter, closing, arrow and assignment delimiters. A quoted `while` no longer introduces a conditional warrant. Focused negative controls show the former acceptance, independently verify reference rejection and preserve prior native output; a valid facet/reckoning fixture remains byte-identical. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `0466845d80d37017d54f4a53218e89292ed0dde477b9e5ed6755fef1b154453e`; related expression, warrant, authority, rule-host and UI checks passed. This is bounded syntax evidence; the package from `173b360` predates it.

### UI node property, binding and class syntax

Native UI nodes now require identifier tokens for class, property and binding names, and require the actual `=` token for properties. Focused malformed inputs reproduced native acceptance and are now rejected by both compilers without replacing previous output. The rebuilt compiler reached C0 = C1 = C2 at SHA-256 `294274c55771e2be04534ec60f956a738956e0801889b8ce814373cdb2e3fde1`; related UI parser, controls, style-layout and event suites passed. This does not cover every syntax position; the package from `173b360` predates the change.

### Style selectors and layout value token kinds

Native style selectors now require identifier kinds and values and numeric priority tokens. Layout alignment, distribution, overflow, gap, padding and columns likewise require their intended token types even when a later declaration overrides a value. Focused negative controls reject strings impersonating selector kinds, selector values, numeric priorities, alignment, gap and columns; valid selector and layout override corpora remain reference-identical. The compiler reached C0 = C1 = C2 at SHA-256 `65a258d9521a4ed2d77d16a8505b4cc55fdcf8f4d04d9633c1859965e47b3c91`; targeted UI, parser, style-layout, control and event checks passed. The package from `173b360` predates this change.
