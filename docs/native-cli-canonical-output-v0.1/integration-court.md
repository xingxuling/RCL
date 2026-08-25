# Native CLI Canonical Output Integration Court v0.1

**Decision:** `CANDIDATE_CANONICAL_NATIVE_CLI_JSON_BYTES`

- Founder Twin: RCL owns the canonical native result transport; product adapters must not conceal byte drift.
- 柳清莲 Gate: byte-level output, valid JSON diagnostics and rebuilt artifact roots are required.
- 洞哥 Grounding: the defect was reproduced between real Windows x64 and Android x86_64 native runtimes.
- Engineering: the change is confined to standalone CLI stream configuration and JSON escaping; embedded APIs remain untouched.
- Test: both successful stdout and failing stderr require LF without CRLF and valid JSON.
- Security: path/error text can no longer escape the JSON evidence field.
- Release: candidate only until local full regression and hosted required checks pass.

No RCL Core semantic or K400 promotion is granted.
