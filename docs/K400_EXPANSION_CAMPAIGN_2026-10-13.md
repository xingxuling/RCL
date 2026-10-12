# K400 expansion campaign, 2026-10-13

Goal: at least **200/400** verified cells. Current checkpoint: **44 PASS, 356 UNTESTED**, verdict INCOMPLETE, maturity U3. Version promotion remains frozen. The initial baseline was 24 cells; historical receipts keep their original scope and authority.

## Reuse and implementation

REUSE the current RCL-authored compiler artifact, native C VM, semantic-root-v2 checker and K400 evaluator. ADAPT the existing recursive algorithm source into a fresh frozen portable profile. KEEP_SEPARATE the historical campaigns and their hosted replay receipts. No new hosted CI has been requested.

The new wasm32-WASI backend compiles the same `native/rclvm.c`. The adapters provide SHA-256 through Zig's standard library and seekable transaction-capture files through WASI libc. They contain no algorithm-specific lowering or evaluator. The checked `native/wasi/rclvm.wasm` and relative build manifest allow replay from another checkout without the developer's ignored build directory. Rebuild with Zig 0.16.0 using `node scripts/build-native-wasi.mjs`; replay the checked module using:

```text
node scripts/run-native-wasi.mjs native/wasi/rclvm.wasm program.rbc
node scripts/run-k400-portable-algorithm-campaign.mjs
node scripts/verify-k400-expansion-receipts.mjs
npm run evidence:k400
```

[Node WASI](https://nodejs.org/api/wasi.html) supplies the Preview 1 host interface. This is a real WebAssembly target execution profile; it claims no secure sandbox, browser execution or Linux execution. The runner uses a fresh temporary directory for each invocation. Build evidence is distinct from runtime evidence.

## Algorithm/CLI checkpoint

Only K001/K002 and K041/K042 are admitted by `algorithm-contract.json`, `algorithm-runtime.json` and `algorithm-independent-proposals.json` under `examples/universal-stress/expansion-wave1/`. RCL owns GCD, Fibonacci, square summation and boundary handling. Native C and WASI return matching independently recomputed semantic roots.

The contract and three mutated candidate hashes were frozen before independent requests. Three fresh proposal-only contexts repaired effective mutations; the evaluator applied the exact returned edits and replayed the repaired source on both backends. The human authorized these contexts. No tools, memory, filesystem or network access was requested from them; hardened OS isolation is not claimed. Two earlier prompt-format acquisitions were rejected and receive no credit.

Twenty rounds per backend meet the pre-fixed compile/execute p95 budgets. Ten additional parametric cases have independent iterative numerical oracles. These cases were selected after generation and withheld from proposal contexts; they are not pre-sealed holdouts or a claim of corpus generalization. Malformed source, corrupt RBC and semantic mutations are detected. Admission independently checks source/binary bindings, recorded output roots, numerical results, measured timings, exact edits and eligible coordinates.

Additional targeted checks verify Unicode, binary64 values, nested sequences and transaction capture across native/WASI; they also reject rehashed incorrect results, concealed slow timings and expanded scopes. These tests do not themselves add K400 cells.

## Next capability gaps

Expand reusable governed, agent, learning, event and workflow profiles using fresh frozen contracts and independent generation. Additional environments require actual adapters and observed target execution. Browser/device, distributed, GPU and external effects keep separate runtime requirements.

## Linux and Android target expansion

The original user WSL distributions still reference missing disks, and Docker's engine remains unavailable. A separate task-owned `RCL-K400-Alpine` WSL2 distribution now runs the Linux native process. Its [official Alpine minirootfs](https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/x86_64/) is pinned to `alpine-minirootfs-3.24.2-x86_64.tar.gz`, SHA-256 `c5ca053cfe1d85c5b96dff8b9bc57045f7f184a30ffb6b65776409ca90388677`, checked against the publisher's SHA-256 file before import. Runtime kernel identity and binary hashes are recorded in every Linux receipt.

`scripts/build-native-linux.mjs` cross-compiles the unchanged C VM and C compiler host to statically linked x86_64 Linux binaries with the same SHA-256 adapter. Checked binaries and source manifest are in `native/linux/`. The C compiler host executes the existing RCL-authored `selfhost/compiler.rbc`; exact bootstrap RBC parity is checked on every target round.

`src/portable-native-vm.mjs` provides explicit Windows/WASI/Linux/Android target adapters and is exported as `createPortableNativeTarget`. It also powers `rcl portable-run <target> <source.rcl>`. Every result requires an independently recomputed semantic root and optional expected program root. Unsupported/unavailable targets fail instead of falling back. Android execution checks the connected x86_64 emulator identity and remote file hashes, compiles on the target, and removes only the files it placed in its fresh transfer directory. There is no mobile UI or physical-device claim.

On a Windows host, configure an existing Linux distribution with `RCL_K400_WSL_DISTRO` or import the pinned rootfs into a new task directory using `wsl --import RCL-K400-Alpine <directory> <verified-rootfs.tar.gz> --version 2`. The current default is `RCL-K400-Alpine`. Android uses the SDK's ADB path (override with `ADB`) and `emulator-5554` (override with `RCL_ANDROID_SERIAL`); the current backend requires x86_64. These are development runtime requirements, not hosted deployment or package-publication evidence.

## Pre-sealed multi-target profiles

The immutable contracts, source files, case files and runtime receipts live in `examples/universal-stress/portable-profiles/`. The contracts and ten case/oracle hashes were frozen before independent requests. Three fresh contexts each received one mutated candidate for each of three profiles, with permission to read only those named candidate files. They received neither the canonical program nor the evaluator/case files, and returned only exact repair proposals. The policy is requested candidate-only access; hardened OS isolation is not claimed. The unchanged responses are preserved in `independent-batch.json`.

| Profile | Credited environments | Added cells |
|---|---|---|
| Algorithm/CLI POSIX process | Linux, Android x86_64 emulator | K021/K022/K081/K082 |
| Relation selection, joins, aggregation, keys and atomic insert/rejection | Windows, WASI, Linux, Android x86_64 emulator | K046/K006/K026/K086 |
| Discrete trajectory and scientific differential checks | Windows, WASI, Linux, Android x86_64 emulator | K049/K052/K009/K012/K029/K032/K089/K092 |

Each credited target has twenty actual compile/execute rounds, ten pre-sealed parametric cases, three effective semantic mutations and three exact repaired-source replays. Tests include empty relations, absent regions, unapproved/negative insertions, zero steps, signed trajectories and a binary-exact fractional trajectory. The numerical/relational oracle is implemented independently of RCL recursion. RBC bytes and canonical/parametric state roots agree across targets. Malformed source and truncated RBC are rejected; compile p95 must remain <=5000 ms and execution p95 <=2000 ms under the frozen local budgets. Timing is a bounded local acceptance ceiling, not a general speed comparison.

```text
node scripts/run-k400-portable-profiles.mjs
node scripts/verify-k400-portable-profiles.mjs
npm run evidence:k400
```

Admission checks recorded outputs against the sealed oracles, rehashes typed state roots and source/binary bindings, recomputes p95 from the twenty measurements, requires every target and every independent context, and rejects expanded scopes. Adversarial tests reject rehashed wrong joins, missing target/source/case records and physical-device relabeling. The full matrix contains 44 PASS and 356 UNTESTED; these sixteen cells plus the first four portable cells are the complete increment over the historical 24.

The source-backed DWAC four-mode router was reused from the local TaoX archive with source SHA-256 `feec830b66b404c243f3bb4c3d2c66706429c670a0f4c396dee6246d5363ee44`. It selected NORTH_STAR; this routing is advisory and grants no K400 credit or release authority. Laya abstained on the optional next-gap priority, so Codex retained the decision.
