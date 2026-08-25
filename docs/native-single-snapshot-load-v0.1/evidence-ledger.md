# Native Single-Snapshot RBC Load Evidence Ledger v0.1

| Gate | Status | Evidence |
|---|---|---|
| Real stress reproduction | PASS_LOCAL | Aether v0.7 final clean device gate failed 24/25 at compiler load after validation; isolated test then passed 10/10 and full device suite 5/5, marking the fault intermittent |
| Source ownership | PASS_SOURCE | defect is in RCL native bytecode admission, not an Android product semantic |
| Single-snapshot regression | PASS_LOCAL | intercepted native `fopen` harness returns valid bytes first and truncated bytes on any second open; loader succeeds and asserts exactly one open |
| Validation/load binding | PASS_SOURCE | validation and `Program` construction consume the same bounded byte buffer |
| Partial-read handling | PASS_SOURCE | snapshot acquisition loops until the declared file length is consumed or a real read failure occurs |
| Native rebuild | PASS_LOCAL | real Zig 0.16.0 Windows rebuild; `rclvm.exe` 316,416 bytes, SHA-256 `1b5ec5eacf3d2b4fc4f7c6e5f8a99ece7be1ff8fb069fbf38648e59b7383348a`; all distributed hashes are recorded in `native/native-windows-manifest.json` |
| Focused regression | PASS_LOCAL | 18/18 across the single-snapshot loader, self-host ABI, canonical CLI output and native Provider host-call suites |
| Full regression | PASS_LOCAL | 862 total: 861 passed, 0 failed, 1 conditional K08-D Windows Provider test skipped; 633851.3283 ms; pretest rebuilt native artifacts with real Zig 0.16.0 |
| Downstream Android replay | PENDING | Aether final clean device gate must pass with the merged/pinned RCL revision |
| Hosted checks | PENDING | required PR checks not yet run |
| K400 promotion | BLOCKED | nine non-compensatory gates were not completed |

The candidate closes only the native loader validation/use gap. General hostile-filesystem safety and arbitrary target robustness remain separate gates.
