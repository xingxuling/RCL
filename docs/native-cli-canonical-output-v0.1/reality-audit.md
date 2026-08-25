# Native CLI Canonical Output Reality Audit v0.1

## Stress finding

RCL Aether Runtime executed one byte-identical RBC through Android JNI and Windows `rclvm.exe`. State, history, authority, witnesses and semantic state roots were identical, but the complete result hashes differed. The only byte difference was the final line ending: Android returned LF while the Windows C text stream translated LF to CRLF.

The Windows CLI load-error path also inserted an unescaped Windows path directly into a JSON string, so a backslash sequence could make the diagnostic invalid JSON.

These are native CLI evidence-transport defects, not product or language semantics. Downstream normalization alone would silently preserve non-canonical RCL output, so the fix belongs in the native CLI boundary.

## Candidate contract

- standalone `rclvm` configures stdout and stderr as binary streams on Windows before any output;
- success and error records end in exactly one LF on every host;
- load/runtime error messages pass through the native JSON string encoder;
- embedded VM APIs are unchanged and do not depend on standard streams.

## Boundaries

- this does not prove semantic parity for arbitrary programs or targets;
- it does not change RBC, language semantics, state-root calculation or Provider ABI;
- Android arm64 execution and K400 promotion remain separate gates.
