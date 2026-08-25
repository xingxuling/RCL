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
| Downstream Android replay | PASS_CANDIDATE | Aether candidate pin completed 163/163 clean tasks, 25/25 JVM and 25/25 API 35 x86_64 tests; exported Android result remained byte-identical to Windows (2,146 bytes, SHA-256 `6aa061d29a06d71d641250aed8199cc7719ce5671b24474b016284f5953e21dd`) |
| Hosted checks | PASS_IMPLEMENTATION_HEAD | PR #63 implementation `df7a004`: Authority `32816816990`, Canonical `32816816829`, PR stress `32816816822`, push stress `32816811427` and Vercel passed; both stress runs passed Linux focused and Windows K01 jobs |
| K400 promotion | BLOCKED | nine non-compensatory gates were not completed |

The candidate closes only the native loader validation/use gap. General hostile-filesystem safety and arbitrary target robustness remain separate gates.
