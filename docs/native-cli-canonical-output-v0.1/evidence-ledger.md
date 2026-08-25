# Native CLI Canonical Output Evidence Ledger v0.1

| Gate | Status | Evidence |
|---|---|---|
| Reality reproduction | PASS_LOCAL | same RBC/state/history result differed only at final Windows CRLF versus Android LF |
| Windows success stdout | PASS_LOCAL | raw bytes end in LF and the previous byte is not CR |
| Windows error stderr | PASS_LOCAL | raw bytes end in LF and parse as valid JSON with an escaped Windows path |
| Embedded API isolation | PASS_SOURCE | stream configuration is compiled only for standalone `rclvm` main |
| Focused regression | PASS_LOCAL | 6/6 across canonical-output and native Provider host-call suites |
| Native rebuild | PASS_LOCAL | real Zig 0.16.0 Windows rebuild; `rclvm.exe` 316,416 bytes, SHA-256 `d3d8cffdd611051c828dac7fcb35c66ec114a807aca1df02529130c690cb699e` |
| Full regression | PASS_LOCAL | 857/857, 0 failed/skipped; 663640.0033 ms; pretest rebuilt native artifacts with real Zig 0.16.0 |
| Hosted checks | PENDING | run after pull request |
| Multi-target generality | BLOCKED | one Aether portable vector is stress evidence, not arbitrary-target parity |
| K400 promotion | BLOCKED | nine non-compensatory gates were not completed |

This candidate closes the native CLI transport defect only. It does not convert the Aether product-local multi-target vector into a universal RCL parity claim.
